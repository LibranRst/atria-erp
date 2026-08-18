"use server";

import {
  createConversation,
  deleteConversation,
  findOwnedConversation,
  listConversations,
  loadConfirmedProposals,
  loadConversationMessages,
} from "@/lib/ai/conversation-store";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { getServerSession } from "@/lib/server/session";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { UIMessage } from "ai";

/**
 * Riwayat percakapan AI milik pengguna.
 *
 * Semua aksi di sini membatasi diri pada percakapan milik sesi yang sedang aktif.
 * Percakapan orang lain selalu dilaporkan sebagai tidak ditemukan, sehingga
 * keberadaannya tidak bocor lewat perbedaan pesan kesalahan.
 */

type ConversationSummary = {
  readonly id: string;
  readonly title: string | null;
  readonly updatedAt: string;
};

type ConversationPayload = {
  readonly conversationId: string | null;
  readonly messages: UIMessage[];
  /** Peta toolCallId → id dokumen, untuk kartu usulan yang sudah dieksekusi. */
  readonly confirmedProposals: Record<string, string>;
};

async function requireChatAccess(): Promise<
  { ok: true; userId: string } | { ok: false; response: ActionResponse<never> }
> {
  const session = await getServerSession();
  if (!session) {
    return {
      ok: false,
      response: {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
      },
    };
  }

  const roleName = await resolveRoleName(session.user.roleId);
  try {
    await assertPermission({ id: session.user.id, role: roleName }, "use:ai_chat");
  } catch {
    return {
      ok: false,
      response: {
        success: false,
        error: { code: "FORBIDDEN", message: "Peran Anda belum memiliki akses ke asisten AI." },
      },
    };
  }

  return { ok: true, userId: session.user.id };
}

/**
 * Memuat percakapan AI terakhir beserta pesan dan status kartu usulannya.
 * Dipakai saat sheet chat dibuka supaya percakapan sebelumnya berlanjut.
 */
export async function getLatestAiConversation(): Promise<ActionResponse<ConversationPayload>> {
  const access = await requireChatAccess();
  if (!access.ok) return access.response;

  try {
    const conversations = await listConversations(access.userId, 1);
    const latest = conversations[0];

    if (!latest) {
      return {
        success: true,
        data: { conversationId: null, messages: [], confirmedProposals: {} },
      };
    }

    const [messages, confirmedProposals] = await Promise.all([
      loadConversationMessages(latest.id),
      loadConfirmedProposals(latest.id),
    ]);

    return {
      success: true,
      data: { conversationId: latest.id, messages, confirmedProposals },
    };
  } catch {
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Riwayat percakapan gagal dimuat." },
    };
  }
}

/**
 * Memuat satu percakapan tertentu milik pengguna.
 */
export async function getAiConversation(
  conversationId: string,
): Promise<ActionResponse<ConversationPayload>> {
  const access = await requireChatAccess();
  if (!access.ok) return access.response;

  const conversation = await findOwnedConversation(conversationId, access.userId);
  if (!conversation) {
    return { success: false, error: { code: "NOT_FOUND", message: "Percakapan tidak ditemukan." } };
  }

  const [messages, confirmedProposals] = await Promise.all([
    loadConversationMessages(conversation.id),
    loadConfirmedProposals(conversation.id),
  ]);

  return {
    success: true,
    data: { conversationId: conversation.id, messages, confirmedProposals },
  };
}

/**
 * Daftar percakapan untuk pemilih di dalam sheet chat.
 */
export async function listAiConversations(): Promise<
  ActionResponse<readonly ConversationSummary[]>
> {
  const access = await requireChatAccess();
  if (!access.ok) return access.response;

  const conversations = await listConversations(access.userId, 30);

  return {
    success: true,
    data: conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt.toISOString(),
    })),
  };
}

/**
 * Menghapus satu percakapan milik pengguna beserta pesannya.
 *
 * Dokumen yang sudah pernah dibuat lewat kartu usulan TIDAK ikut terhapus —
 * pengeluaran yang sudah tercatat adalah catatan finansial, dan hanya bisa
 * dikoreksi lewat jalur pembatalan yang sesuai di menu Pengeluaran.
 */
export async function deleteAiConversation(
  conversationId: string,
): Promise<ActionResponse<{ deleted: true }>> {
  const access = await requireChatAccess();
  if (!access.ok) return access.response;

  const conversation = await findOwnedConversation(conversationId, access.userId);
  if (!conversation) {
    return { success: false, error: { code: "NOT_FOUND", message: "Percakapan tidak ditemukan." } };
  }

  await deleteConversation(conversation.id, access.userId);
  return { success: true, data: { deleted: true } };
}

/**
 * Membuat percakapan kosong dan menjadikannya percakapan aktif.
 *
 * Dibuat lebih dulu di server agar id-nya bisa langsung dipakai kartu usulan,
 * yang membutuhkan id percakapan yang sah sejak pesan pertama.
 */
export async function startAiConversation(): Promise<ActionResponse<{ conversationId: string }>> {
  const access = await requireChatAccess();
  if (!access.ok) return access.response;

  const conversation = await createConversation(access.userId, null);
  return { success: true, data: { conversationId: conversation.id } };
}
