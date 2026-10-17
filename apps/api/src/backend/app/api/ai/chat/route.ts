import { boundedAttachmentPreview } from "@backend/lib/ai/attachment-preview";
import { readPrivateAttachment } from "@backend/server/usecases/media/private-attachments";
import { resolveActor, type Actor } from "@backend/server/actor";
import { PRIVATE_ATTACHMENT_MAX_BYTES } from "@atria/core/media/private-attachment";
import { sessionAccessFailure } from "@backend/lib/server/session-access";
import { documentModel, requireDocumentProvider } from "@backend/lib/ai/document-model";
import { resolveProviderChain, resolveChatModel } from "@backend/lib/ai/providers";
import { classifyChatWorkload } from "@backend/lib/ai/chat-workload-policy";
import {
  documentReadFactStream,
  isPlainDocumentReadQuestion,
  isCompleteDocumentReadExtraction,
  type CompleteDocumentReadExtraction,
} from "@backend/lib/ai/document-read-fact-stream";
import {
  createOcrTextCacheKey,
  immutableOcrTextCache,
} from "@backend/lib/ai/ocr-text-artifact-cache";
import type { ChatTiming } from "@backend/lib/ai/chat-timing";
import { runChatStream } from "@backend/lib/ai/chat-stream";
import { createChatTiming } from "@backend/lib/ai/chat-timing";
import {
  companyBudgetFactStream,
  isCompanyBudgetDefaultsQuestion,
} from "@backend/lib/ai/company-budget-fact-stream";
import { availableAiCapabilities } from "@backend/lib/ai/tools/capability-catalog";
import { requiredFreshRead } from "@backend/lib/ai/chat-context";
import { db } from "@backend/db";
import {
  readOwnProfileTx,
  ownProfileSnapshot,
} from "@backend/server/usecases/ai/own-profile-context";
import type { OwnProfileSnapshot } from "@atria/core/ai/own-profile";
import { OwnProfileError } from "@backend/server/usecases/profile/update-own-profile";
import { isOwnProfileNameQuestion, profileFactStream } from "@backend/lib/ai/profile-fact-stream";
import { getCompanyIdentity } from "@backend/lib/company/identity";
import { readCompanyBudgetPolicy } from "@backend/lib/ai/tools/company-budget-tools";
import {
  appendMessage,
  findOwnedConversation,
  loadConversationMessages,
} from "@backend/lib/ai/conversation-store";
import {
  persistUserTurn,
  findUserTurnConversation,
  historyBeforeTurn,
  ChatTurnConflict,
} from "@backend/lib/ai/user-turn";
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
const PDF_EXTRACTION_FAILURE =
  "PDF belum berhasil dibaca. Coba lagi atau unggah gambar dokumen yang diperlukan.";

const requestSchema = z
  .object({
    conversationId: z.string().uuid().nullable().optional(),
    userMessageId: z.string().uuid().optional(),
    text: z.string().trim().max(2000),
    attachments: z.array(attachmentSchema).max(4).optional().default([]),
  })
  .refine((data) => data.text.length > 0 || data.attachments.length > 0, {
    message: "Pesan atau lampiran berkas harus diisi.",
  });

async function extractAttachmentContent(
  file: Awaited<ReturnType<typeof readPrivateAttachment>>,
  signal: AbortSignal,
  actorScope: string,
  question: string,
  multipleFiles: boolean,
  timing?: ChatTiming,
  onExtraction?: (extraction: CompleteDocumentReadExtraction) => void,
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
        const previewLines = boundedAttachmentPreview(csvContent);
        sheets.push(`--- Sheet: ${sheetName} ---\n${previewLines}`);
      }
      return `[Data Berkas Spreadsheet: ${fileName}]\n${sheets.join("\n\n")}${workbook.SheetNames.length > 3 ? "\n[PREVIEW TIDAK LENGKAP: hanya 3 sheet pertama. Minta sumber dipecah sebelum usulan invoice; jangan mengklaim seluruh sheet dibaca.]" : ""}`;
    }

    if (isCsvOrText) {
      const textContent = await response.text();
      const previewLines = boundedAttachmentPreview(textContent);
      return `[Data Berkas Teks: ${fileName}]\n${previewLines}`;
    }

    if (isImage || isPdf) {
      const arrayBuffer = await response.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString("base64");
      const effectiveMime = mimeType || (isPdf ? "application/pdf" : "image/jpeg");

      const provider = requireDocumentProvider();
      const workloadProfile = multipleFiles
        ? "complex"
        : isPlainDocumentReadQuestion(question)
          ? "simple"
          : classifyChatWorkload({ question, hasAttachments: true });
      const model = resolveChatModel(provider, workloadProfile);
      const endpoint = process.env.NINEROUTER_BASE_URL;
      const safeEndpoint = endpoint ? new URL(endpoint) : undefined;
      const key = createOcrTextCacheKey({
        actorScope,
        mimeType: effectiveMime,
        bytes: file.bytes,
        extractorVersion: "chat-full-document-ocr-v4",
        modelSignature: JSON.stringify({
          provider,
          model: typeof model === "string" ? model : model.modelId,
          workloadProfile,
          effort: process.env.NINEROUTER_REASONING_EFFORT ?? "default",
          endpoint: safeEndpoint ? `${safeEndpoint.origin}${safeEndpoint.pathname}` : "default",
        }),
      });
      let extractedText = immutableOcrTextCache.get(key, actorScope, signal);
      let complete = extractedText !== undefined;
      if (extractedText === undefined) {
        const ocrResponse = await documentModel.models.generateContent({
          config: {
            abortSignal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
            workloadProfile,
            timing,
          },
          contents: [
            {
              inlineData: {
                data: base64Data,
                mimeType: effectiveMime,
              },
            },
            isPlainDocumentReadQuestion(question)
              ? "Salin seluruh teks dan seluruh tabel yang benar-benar tercetak pada gambar/dokumen ini secara terstruktur, dari awal sampai akhir. Pertahankan semua tanggal, satuan, tanda desimal dan nominal persis. Jawaban hanya berisi hasil pembacaan; jangan menambahkan penjelasan proses, schema, JSON, atau catatan teknis. Jangan menambah kolom atau informasi yang tidak tercetak dan jangan menghitung atau menebak nilai. Jika bagian yang tercetak ambigu atau tidak terbaca, nyatakan bagian itu dengan jelas."
              : "Baca dan ekstrak seluruh teks serta tabel data dari dokumen/gambar ini (termasuk tanggal transaksi, nominal, keterangan, saldo, nama bank, atau nomor rekening jika ada). Sajikan teks dan seluruh tabel secara terstruktur, termasuk vendor, nomor invoice, rincian barang/jumlah/satuan/harga, total/pajak/diskon dan jatuh tempo bila ada. Sebutkan bagian yang ambigu atau tidak terbaca; jangan mengisi atau menebak nilai yang hilang.",
          ],
        });

        extractedText = ocrResponse.text;
        complete = ocrResponse.complete === true;
        immutableOcrTextCache.set(
          key,
          actorScope,
          {
            status: ocrResponse.complete === true ? "complete" : "incomplete",
            text: extractedText ?? "",
          },
          signal,
        );
      }
      signal.throwIfAborted();
      if (extractedText?.trim()) {
        onExtraction?.({ text: extractedText, complete });
        return `[Data Ekstraksi ${isPdf ? "Dokumen PDF" : "Gambar"}: ${fileName}]\n${boundedAttachmentPreview(extractedText, 300, 8000)}`;
      }
      if (isPdf) throw new Error(PDF_EXTRACTION_FAILURE);
      return `[EKSTRAKSI BELUM BERHASIL: ${fileName}. Minta berkas lebih jelas atau rincian manusia; jangan menebak invoice.]`;
    }
  } catch {
    console.error("Gagal mengekstrak lampiran berkas.");
    if (isPdf) throw new Error(PDF_EXTRACTION_FAILURE);
    return `[EKSTRAKSI BELUM BERHASIL: ${fileName}. Minta sumber yang lebih jelas atau rincian manusia.]`;
  }

  return null;
}

function jsonError(status: number, message: string, extra?: Record<string, string>): Response {
  return Response.json({ error: message, ...extra }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const timing = createChatTiming(request.signal);
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

  const { conversationId, text, attachments, userMessageId } = parsed.data;
  const actor = await resolveActor();
  if (!actor) return jsonError(401, "Silakan masuk kembali.");
  const attachmentActor: Actor = actor;
  timing?.mark("authorized");
  const requestDeadline = AbortSignal.any([request.signal, AbortSignal.timeout(50_000)]);
  const fileCache = new Map<string, Promise<Awaited<ReturnType<typeof readPrivateAttachment>>>>();
  const extractionCache = new Map<string, Promise<string | null>>();
  const completeExtractions = new Map<string, CompleteDocumentReadExtraction>();
  let extractionTail: Promise<string | null> = Promise.resolve(null);
  function readFile(url: string): Promise<Awaited<ReturnType<typeof readPrivateAttachment>>> {
    const cached = fileCache.get(url);
    if (cached) return cached;
    const pending = readPrivateAttachment(attachmentActor, url, "ai_chat");
    fileCache.set(url, pending);
    return pending;
  }
  function extractFile(url: string): Promise<string | null> {
    const cached = extractionCache.get(url);
    if (cached) return cached;
    // The bounded PDF renderer admits one job at a time. Queue extraction within
    // this request and stop later jobs if an earlier PDF fails.
    const pending = extractionTail.then(async (): Promise<string | null> =>
      extractAttachmentContent(
        await readFile(url),
        requestDeadline,
        attachmentActor.userId,
        text || "Tolong periksa dan analisa berkas terlampir.",
        attachments.length > 1,
        timing,
        (extraction): void => {
          completeExtractions.set(url, extraction);
          timing?.mark(
            isCompleteDocumentReadExtraction(extraction)
              ? "document-complete-clear"
              : "document-needs-review",
          );
        },
      ),
    );
    extractionCache.set(url, pending);
    extractionTail = pending;
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
  if (!conversationId && userMessageId)
    conversation = await findUserTurnConversation(session.user.id, userMessageId);
  const history = historyBeforeTurn(
    conversation ? await loadConversationMessages(conversation.id) : [],
    userMessageId ?? "",
  );
  const currentFileUrls = new Set(attachments.map((item) => item.url));
  timing?.mark("history");

  const materialIntent =
    /(material|katalog)/i.test(effectiveText) &&
    /(tambah|buat|input|import|impor|masuk|daftar|analisis|analisa)/i.test(effectiveText) &&
    (!/(invoice|tagihan|nota|transfer|opname)/i.test(effectiveText) ||
      /(material master|master material|katalog material)/i.test(effectiveText));
  const extractedAttachmentTexts: string[] = attachments.map(
    (att) =>
      `[Lampiran privat: ${att.url}; berkas: ${att.fileName}]. Untuk input Material Master, gunakan URL sumber ini melalui proposeMaterialMaster agar seluruh data dianalisis di background, bukan hanya preview chat.`,
  );
  if (materialIntent)
    for (const att of attachments)
      extractedAttachmentTexts.push(
        `[Sumber material privat: ${att.url}; berkas: ${att.fileName ?? "lampiran"}]. Gunakan proposeMaterialMaster dengan attachmentUrls, jangan ekstrak katalog di chat.`,
      );
  try {
    for (const url of materialIntent ? [] : currentFileUrls) {
      const content = await extractFile(url);
      if (content)
        extractedAttachmentTexts.push(
          `[Preview lampiran untuk percakapan; import Material Master memakai sumber lengkap melalui background analysis.]\n${content}`,
        );
    }
  } catch {
    console.error("PDF chat belum berhasil diproses.");
    return jsonError(422, PDF_EXTRACTION_FAILURE);
  }

  const userParts: UIMessage["parts"] = [{ type: "text", text: effectiveText }];
  timing?.mark("attachments");

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
    id: userMessageId ?? randomUUID(),
    role: "user",
    parts: userParts,
  };

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
    const selectedProvider = resolveProviderChain()[0];
    messages = await Promise.all(
      sourceMessages.map(async (message): Promise<UIMessage> => {
        const parts = await Promise.all(
          message.parts.map(async (part): Promise<UIMessage["parts"][number] | null> => {
            if (part.type !== "file") return part;
            if (!activeFileUrls.includes(part.url))
              return { type: "text", text: `[Lampiran sebelumnya: ${part.filename ?? "berkas"}]` };
            if (materialIntent)
              return {
                type: "text",
                text: `[Lampiran material privat: ${part.url}; ${part.filename ?? "berkas"}]`,
              };
            const file = await readFile(part.url);
            const isPdf =
              file.row.mimeType === "application/pdf" ||
              file.row.fileName.toLowerCase().endsWith(".pdf");
            if (selectedProvider === "NINEROUTER" && isPdf) {
              const content = await extractFile(part.url);
              if (!content) throw new Error(PDF_EXTRACTION_FAILURE);
              // Current PDFs already appear once in modelUserText; historical
              // refs are hydrated only in memory, never into stored messages.
              return currentFileUrls.has(part.url) ? null : { type: "text", text: content };
            }
            return {
              ...part,
              mediaType: file.row.mimeType,
              url: `data:${file.row.mimeType};base64,${file.bytes.toString("base64")}`,
            };
          }),
        );
        return {
          ...message,
          parts: parts.filter((part): part is UIMessage["parts"][number] => part !== null),
        };
      }),
    );
  } catch (error: unknown) {
    console.error("Lampiran percakapan belum berhasil diproses.");
    if (error instanceof Error && error.message === PDF_EXTRACTION_FAILURE)
      return jsonError(422, PDF_EXTRACTION_FAILURE);
    return jsonError(
      403,
      "Lampiran percakapan tidak tersedia. Unggah kembali berkas yang diperlukan.",
    );
  }

  timing?.mark("messages");
  try {
    conversation = await persistUserTurn({
      userId: session.user.id,
      conversationId,
      messageId: userMessage.id,
      text: effectiveText,
      parts: userMessage.parts,
    });
  } catch (error: unknown) {
    if (error instanceof ChatTurnConflict) return jsonError(409, error.message);
    return jsonError(503, "Pertanyaan belum dapat disimpan. Coba lagi.");
  }
  const roleAccess = await getRoleAccess(session.user.roleId);
  timing?.mark("user-persisted");
  const toolContext: AiToolContext = {
    userId: session.user.id,
    roleName,
    roleId: session.user.roleId,
    permissions: roleAccess?.permissions ?? [],
    dataScope: roleAccess?.dataScope ?? "NONE",
  };
  const preference = await loadAiPreference(session.user.id);
  const [company, companyBudgetPolicy] = await Promise.all([
    getCompanyIdentity(),
    readCompanyBudgetPolicy(toolContext),
  ]);
  timing?.mark("context");

  const currentAttachment = attachments.length === 1 ? attachments[0] : undefined;
  const currentExtraction = currentAttachment
    ? completeExtractions.get(currentAttachment.url)
    : undefined;
  if (
    currentAttachment &&
    currentExtraction &&
    isPlainDocumentReadQuestion(effectiveText) &&
    isCompleteDocumentReadExtraction(currentExtraction)
  ) {
    const currentFile = await readFile(currentAttachment.url);
    timing?.mark("first-answer");
    return createUIMessageStreamResponse({
      stream: documentReadFactStream({
        question: effectiveText,
        extraction: currentExtraction,
        source: {
          fileName: currentFile.row.fileName,
          attachmentUrl: currentAttachment.url,
          mimeType: currentFile.row.mimeType,
        },
        conversationId: conversation.id,
        messages,
        signal: requestDeadline,
        save: async (message: UIMessage): Promise<void> => {
          await appendMessage({
            conversationId: conversation.id,
            role: "assistant",
            parts: message.parts,
          });
          timing?.mark("assistant-persisted");
          timing?.finish("complete");
        },
      }),
      headers: { "x-conversation-id": conversation.id },
    });
  }

  if (
    attachments.length === 0 &&
    isCompanyBudgetDefaultsQuestion(effectiveText) &&
    availableAiCapabilities(toolContext).some(
      (capability) => capability.tool === "getCompanyBudgetDefaults",
    )
  ) {
    timing?.mark("first-answer");
    return createUIMessageStreamResponse({
      stream: companyBudgetFactStream({
        question: effectiveText,
        policy: companyBudgetPolicy,
        permissions: toolContext.permissions,
        conversationId: conversation.id,
        messages,
        signal: requestDeadline,
        save: async (message: UIMessage): Promise<void> => {
          await appendMessage({
            conversationId: conversation.id,
            role: "assistant",
            parts: message.parts,
          });
          timing?.mark("assistant-persisted");
          timing?.finish("complete");
        },
      }),
      headers: { "x-conversation-id": conversation.id },
    });
  }
  let verifiedOwnProfile: OwnProfileSnapshot | undefined;
  const ownNameOnly =
    /\bnama\b/i.test(effectiveText) &&
    /\b(?:profil|akun)\s+(?:saya|aku)\b|\bnama\s+(?:saya|aku)\b/i.test(effectiveText) &&
    !/\b(?:foto|avatar|gambar|staf|staff|karyawan)\b/i.test(effectiveText);
  if (
    requiredFreshRead([userMessage], ["getOwnProfileContext"]) &&
    (ownNameOnly ||
      !/\b(siapkan|usulan|ubah|koreksi|edit|update|ganti|hapus|tambahkan)\b/i.test(
        effectiveText.replace(/\bjangan\b[^.!?\n]*/gi, ""),
      ))
  ) {
    try {
      verifiedOwnProfile = await db.transaction(async (tx) =>
        ownProfileSnapshot(await readOwnProfileTx(tx, actor)),
      );
    } catch (error: unknown) {
      return error instanceof OwnProfileError
        ? jsonError(403, error.message)
        : jsonError(503, "Profil terbaru belum dapat dibaca. Coba lagi.");
    }
  }

  if (verifiedOwnProfile && attachments.length === 0 && isOwnProfileNameQuestion(effectiveText)) {
    return createUIMessageStreamResponse({
      stream: profileFactStream({
        profile: verifiedOwnProfile,
        conversationId: conversation.id,
        messages,
        save: async (message): Promise<void> => {
          await appendMessage({
            conversationId: conversation.id,
            role: "assistant",
            parts: message.parts,
          });
          timing?.mark("assistant-persisted");
          timing?.finish("complete");
        },
      }),
      headers: { "x-conversation-id": conversation.id },
    });
  }
  const { stream } = runChatStream({
    timing,
    hasAttachments: attachments.length > 0,
    signal: requestDeadline,
    userQuestion: effectiveText,
    messages,
    toolContext,
    userName: session.user.name,
    conversationId: conversation.id,
    preference,
    companyName: company.name,
    companyBudgetPolicy,
    verifiedOwnProfile,
    prefilledOwnProfileName:
      ownNameOnly && verifiedOwnProfile !== undefined && attachments.length === 0,
    onAssistantMessage: async ({ message, provider, inputTokens, outputTokens }) => {
      await appendMessage({
        conversationId: conversation.id,
        role: "assistant",
        parts: message.parts,
        provider,
        inputTokens,
        outputTokens,
      });
      timing?.mark("assistant-persisted");
      timing?.finish("complete");
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { "x-conversation-id": conversation.id },
  });
}
