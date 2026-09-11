import { geminiClient, GEMINI_OCR_MODEL } from "@/lib/ai/gemini";
import { runChatStream } from "@/lib/ai/chat-stream";
import { getCompanyIdentity } from "@/lib/company/identity";
import {
  appendMessage,
  createConversation,
  findOwnedConversation,
  loadConversationMessages,
  setConversationTitleIfEmpty,
} from "@/lib/ai/conversation-store";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import type { AiToolContext } from "@/lib/ai/tools/context";
import { loadAiPreference } from "@/lib/ai/user-preference";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { getRoleAccess } from "@/lib/auth/role-access";
import { getServerSession } from "@/lib/server/session";
import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import { z } from "zod";

/**
 * Satu-satunya route handler internal di aplikasi ini, dibuka khusus untuk
 * streaming AI chat karena `useChat` membutuhkan transport HTTP.
 *
 * Batasan yang membuat pengecualian ini aman:
 * - Hanya membaca. Seluruh tool yang tersedia bagi model bersifat read-only.
 * - Tidak ada mutasi finansial atau material di sini. Semua penulisan tetap
 *   lewat Server Action ber-RBAC di `app/actions/**`.
 * - Sesi dan izin diverifikasi sebelum apa pun dikerjakan.
 */

export const maxDuration = 60;

const attachmentSchema = z.object({
  url: z.string().url(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  size: z.number().nonnegative(),
});

const requestSchema = z
  .object({
    conversationId: z.string().uuid().nullable().optional(),
    text: z.string().trim().max(2000),
    attachments: z.array(attachmentSchema).optional().default([]),
  })
  .refine((data) => data.text.length > 0 || data.attachments.length > 0, {
    message: "Pesan atau lampiran berkas harus diisi.",
  });

async function extractAttachmentContent(
  attachment: z.infer<typeof attachmentSchema>,
): Promise<string | null> {
  const { url, fileName, mimeType } = attachment;
  const isExcel =
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".xls");
  const isCsvOrText =
    mimeType.includes("csv") ||
    fileName.endsWith(".csv") ||
    mimeType.startsWith("text/") ||
    fileName.endsWith(".txt") ||
    fileName.endsWith(".md");
  const isImage =
    mimeType.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|bmp)$/i.test(fileName);
  const isPdf =
    mimeType === "application/pdf" ||
    fileName.toLowerCase().endsWith(".pdf");

  if (!isExcel && !isCsvOrText && !isImage && !isPdf) return null;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;

    if (isExcel) {
      const buffer = await response.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheets: string[] = [];
      for (const sheetName of workbook.SheetNames.slice(0, 3)) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const csvContent = XLSX.utils.sheet_to_csv(sheet);
        const previewLines = csvContent.split("\n").slice(0, 100).join("\n");
        sheets.push(`--- Sheet: ${sheetName} ---\n${previewLines}`);
      }
      return `[Data Berkas Spreadsheet: ${fileName}]\n${sheets.join("\n\n")}`;
    }

    if (isCsvOrText) {
      const textContent = await response.text();
      const previewLines = textContent.split("\n").slice(0, 100).join("\n");
      return `[Data Berkas Teks: ${fileName}]\n${previewLines}`;
    }

    if (isImage || isPdf) {
      const arrayBuffer = await response.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString("base64");
      const effectiveMime = mimeType || (isPdf ? "application/pdf" : "image/jpeg");

      const ocrResponse = await geminiClient.models.generateContent({
        model: GEMINI_OCR_MODEL,
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: effectiveMime,
            },
          },
          "Baca dan ekstrak seluruh teks serta tabel data dari dokumen/gambar ini (termasuk tanggal transaksi, nominal, keterangan, saldo, nama bank, atau nomor rekening jika ada). Sajikan informasi secara terstruktur dan lengkap untuk analisis mutasi atau rekonsiliasi.",
        ],
      });

      const extractedText = ocrResponse.text;
      if (extractedText) {
        return `[Data Ekstraksi ${isPdf ? "Dokumen PDF" : "Gambar"}: ${fileName}]\n${extractedText.slice(0, 8000)}`;
      }
    }
  } catch (error) {
    console.error("Gagal mengekstrak lampiran berkas:", error);
  }

  return null;
}

function jsonError(status: number, message: string, extra?: Record<string, string>): Response {
  return Response.json({ error: message, ...extra }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession();
  if (!session) {
    return jsonError(401, "Sesi tidak valid. Silakan masuk kembali.");
  }

  const roleName = await resolveRoleName(session.user.roleId);

  try {
    await assertPermission({ id: session.user.id, role: roleName }, "use:ai_chat");
  } catch {
    return jsonError(403, "Peran Anda belum memiliki akses ke asisten AI.");
  }

  const limit = checkRateLimit(session.user.id);
  if (!limit.allowed) {
    return jsonError(429, "Terlalu banyak permintaan. Coba lagi sebentar lagi.", {
      retryAfter: String(limit.retryAfterSeconds),
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Pesan tidak valid atau terlalu panjang.");
  }

  const { conversationId, text, attachments } = parsed.data;
  const effectiveText =
    text.length > 0 ? text : "Tolong periksa dan analisa berkas terlampir.";

  // Riwayat selalu dibaca ulang dari database, tidak pernah dari klien,
  // supaya percakapan tidak bisa dipalsukan lewat payload permintaan.
  let conversation = conversationId
    ? await findOwnedConversation(conversationId, session.user.id)
    : null;

  if (conversationId && !conversation) {
    return jsonError(404, "Percakapan tidak ditemukan.");
  }

  if (!conversation) {
    conversation = await createConversation(session.user.id, effectiveText);
  }

  // Percakapan yang dibuat kosong lewat tombol "Percakapan baru" belum punya judul.
  // Tidak perlu dijaga dengan pemeriksaan riwayat: klausa `WHERE title IS NULL`
  // di dalamnya sudah membuat pemanggilan ini aman diulang.
  await setConversationTitleIfEmpty(conversation.id, effectiveText);

  const history = await loadConversationMessages(conversation.id);

  const userParts: UIMessage["parts"] = [{ type: "text", text: effectiveText }];

  for (const att of attachments) {
    userParts.push({
      type: "file",
      mediaType: att.mimeType,
      mimeType: att.mimeType,
      url: att.url,
      fileName: att.fileName,
      size: att.size,
    } as unknown as UIMessage["parts"][number]);
  }

  const userMessage: UIMessage = {
    id: randomUUID(),
    role: "user",
    parts: userParts,
  };

  await appendMessage({
    conversationId: conversation.id,
    role: "user",
    parts: userMessage.parts,
  });

  const extractedAttachmentTexts: string[] = [];
  for (const att of attachments) {
    const content = await extractAttachmentContent(att);
    if (content) {
      extractedAttachmentTexts.push(content);
    }
  }

  const modelUserText =
    extractedAttachmentTexts.length > 0
      ? `${effectiveText}\n\n${extractedAttachmentTexts.join("\n\n")}`
      : effectiveText;

  const modelUserMessage: UIMessage = {
    id: userMessage.id,
    role: "user",
    parts: [
      { type: "text", text: modelUserText },
      ...userParts.filter((p) => p.type === "file"),
    ],
  };

  const messages: UIMessage[] = [...history, modelUserMessage];

  const roleAccess = await getRoleAccess(session.user.roleId);
  const toolContext: AiToolContext = {
    userId: session.user.id,
    roleName,
    roleId: session.user.roleId,
    permissions: roleAccess?.permissions ?? [],
    dataScope: roleAccess?.dataScope ?? "NONE",
  };
  const preference = await loadAiPreference(session.user.id);
  const company = await getCompanyIdentity();

  const { stream } = runChatStream({
    messages,
    toolContext,
    userName: session.user.name,
    conversationId: conversation.id,
    preference,
    companyName: company.name,
    onAssistantMessage: async ({ message, provider, inputTokens, outputTokens }) => {
      await appendMessage({
        conversationId: conversation.id,
        role: "assistant",
        parts: message.parts,
        provider,
        inputTokens,
        outputTokens,
      });
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { "x-conversation-id": conversation.id },
  });
}
