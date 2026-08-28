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

const requestSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  text: z.string().trim().min(1).max(2000),
});

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

  const { conversationId, text } = parsed.data;

  // Riwayat selalu dibaca ulang dari database, tidak pernah dari klien,
  // supaya percakapan tidak bisa dipalsukan lewat payload permintaan.
  let conversation = conversationId
    ? await findOwnedConversation(conversationId, session.user.id)
    : null;

  if (conversationId && !conversation) {
    return jsonError(404, "Percakapan tidak ditemukan.");
  }

  if (!conversation) {
    conversation = await createConversation(session.user.id, text);
  }

  // Percakapan yang dibuat kosong lewat tombol "Percakapan baru" belum punya judul.
  // Tidak perlu dijaga dengan pemeriksaan riwayat: klausa `WHERE title IS NULL`
  // di dalamnya sudah membuat pemanggilan ini aman diulang.
  await setConversationTitleIfEmpty(conversation.id, text);

  const history = await loadConversationMessages(conversation.id);

  const userMessage: UIMessage = {
    id: randomUUID(),
    role: "user",
    parts: [{ type: "text", text }],
  };

  await appendMessage({
    conversationId: conversation.id,
    role: "user",
    parts: userMessage.parts,
  });

  const messages: UIMessage[] = [...history, userMessage];

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
