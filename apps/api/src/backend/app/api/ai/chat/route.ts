import { readPrivateAttachment } from "@backend/server/usecases/media/private-attachments";
import { resolveActor, type Actor } from "@backend/server/actor";
import { assertApprovedAiProvider } from "@backend/lib/ai/provider-policy";
import { PRIVATE_ATTACHMENT_MAX_BYTES } from "@atria/core/media/private-attachment";
import { sessionAccessFailure } from "@backend/lib/server/session-access";
import { geminiClient, GEMINI_OCR_MODEL } from "@backend/lib/ai/gemini";
import { runChatStream } from "@backend/lib/ai/chat-stream";
import { getCompanyIdentity } from "@backend/lib/company/identity";
import {
  appendMessage,
  createConversation,
  findOwnedConversation,
  loadConversationMessages,
  setConversationTitleIfEmpty,
} from "@backend/lib/ai/conversation-store";
import { checkRateLimit } from "@backend/lib/ai/rate-limit";
import type { AiToolContext } from "@backend/lib/ai/tools/context";
import { loadAiPreference } from "@backend/lib/ai/user-preference";
import { assertPermission, resolveRoleName } from "@backend/lib/auth/permissions";
import { getRoleAccess } from "@backend/lib/auth/role-access";
import { getServerSession } from "@backend/lib/server/session";
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

const attachmentSchema = z.object({
  url: z.string().url(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  size: z.number().positive().max(PRIVATE_ATTACHMENT_MAX_BYTES),
});

const requestSchema = z
  .object({
    conversationId: z.string().uuid().nullable().optional(),
    text: z.string().trim().max(2000),
    attachments: z.array(attachmentSchema).max(4).optional().default([]),
  })
  .refine((data) => data.text.length > 0 || data.attachments.length > 0, {
    message: "Pesan atau lampiran berkas harus diisi.",
  });

async function extractAttachmentContent(
  file: Awaited<ReturnType<typeof readPrivateAttachment>>,
  signal: AbortSignal,
): Promise<string | null> {
  const { fileName, mimeType } = file.row;
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
  const isImage = mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(fileName);
  const isPdf = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

  if (!isExcel && !isCsvOrText && !isImage && !isPdf) return null;

  try {
    const response = new Response(new Uint8Array(file.bytes));

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

      assertApprovedAiProvider("GEMINI");
      const ocrResponse = await geminiClient.models.generateContent({
        config: { abortSignal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) },
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

  const accessFailure = sessionAccessFailure({
    ...session.user,
    developerActorUserId: session.session.developerActorUserId,
  });
  if (accessFailure)
    return jsonError(accessFailure.status, accessFailure.message, { code: accessFailure.code });

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
  const actor = await resolveActor();
  if (!actor) return jsonError(401, "Silakan masuk kembali.");
  const attachmentActor: Actor = actor;
  const requestDeadline = AbortSignal.any([request.signal, AbortSignal.timeout(50_000)]);
  const fileCache = new Map<string, Promise<Awaited<ReturnType<typeof readPrivateAttachment>>>>();
  function readFile(url: string): Promise<Awaited<ReturnType<typeof readPrivateAttachment>>> {
    const cached = fileCache.get(url);
    if (cached) return cached;
    const pending = readPrivateAttachment(attachmentActor, url, "ai_chat");
    fileCache.set(url, pending);
    return pending;
  }
  try {
    await Promise.all(attachments.map((item) => readFile(item.url)));
  } catch {
    return jsonError(403, "Lampiran tidak tersedia atau akses ditolak.");
  }
  const effectiveText = text.length > 0 ? text : "Tolong periksa dan analisa berkas terlampir.";

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
    const content = await extractAttachmentContent(await readFile(att.url), requestDeadline);
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
    parts: [{ type: "text", text: modelUserText }, ...userParts.filter((p) => p.type === "file")],
  };

  const sourceMessages: UIMessage[] = [...history, modelUserMessage];
  const activeFileUrls = sourceMessages
    .flatMap((message) =>
      message.parts.filter((part) => part.type === "file").map((part) => part.url),
    )
    .slice(-4);
  let messages: UIMessage[];
  try {
    messages = await Promise.all(
      sourceMessages.map(async (message): Promise<UIMessage> => ({
        ...message,
        parts: await Promise.all(
          message.parts.map(async (part): Promise<UIMessage["parts"][number]> => {
            if (part.type !== "file") return part;
            if (!activeFileUrls.includes(part.url))
              return { type: "text", text: `[Lampiran sebelumnya: ${part.filename ?? "berkas"}]` };
            const file = await readFile(part.url);
            return {
              ...part,
              mediaType: file.row.mimeType,
              url: `data:${file.row.mimeType};base64,${file.bytes.toString("base64")}`,
            };
          }),
        ),
      })),
    );
  } catch {
    return jsonError(
      403,
      "Lampiran percakapan tidak tersedia. Unggah kembali berkas yang diperlukan.",
    );
  }

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
    signal: requestDeadline,
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
