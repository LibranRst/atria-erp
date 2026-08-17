import "server-only";

import { db } from "@/db";
import { aiConversation, aiMessage, aiProposalConfirmation } from "@/db/schema";
import type { UIMessage } from "ai";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

import type { ChatProviderName } from "./providers";

/**
 * Penyimpanan riwayat AI chat.
 *
 * Pesan disimpan sebagai `UIMessage.parts` mentah agar riwayat bisa dirender ulang
 * persis seperti saat percakapan berlangsung, termasuk jejak pemanggilan tool.
 */

const TITLE_MAX_LENGTH = 80;

export type StoredConversation = {
  readonly id: string;
  readonly title: string | null;
  readonly updatedAt: Date;
};

/**
 * Mengambil percakapan milik pengguna. Mengembalikan null jika percakapan
 * tidak ada atau bukan milik pengguna tersebut — kedua kasus disamakan supaya
 * keberadaan percakapan orang lain tidak bocor.
 */
export async function findOwnedConversation(
  conversationId: string,
  userId: string,
): Promise<StoredConversation | null> {
  const found = await db.query.aiConversation.findFirst({
    where: and(eq(aiConversation.id, conversationId), eq(aiConversation.userId, userId)),
    columns: { id: true, title: true, updatedAt: true },
  });
  return found ?? null;
}

/**
 * Membuat percakapan baru. `firstUserText` boleh null ketika percakapan dibuat
 * kosong dari tombol "Percakapan baru"; judulnya diisi belakangan oleh
 * `setConversationTitleIfEmpty` saat pesan pertama masuk.
 */
export async function createConversation(
  userId: string,
  firstUserText: string | null,
): Promise<StoredConversation> {
  const [created] = await db
    .insert(aiConversation)
    .values({ userId, title: firstUserText === null ? null : buildTitle(firstUserText) })
    .returning({
      id: aiConversation.id,
      title: aiConversation.title,
      updatedAt: aiConversation.updatedAt,
    });
  return created;
}

/**
 * Mengisi judul percakapan dari pesan pertama, hanya jika judulnya masih kosong.
 * Judul yang sudah ada tidak pernah ditimpa agar daftar percakapan tetap stabil.
 */
export async function setConversationTitleIfEmpty(
  conversationId: string,
  firstUserText: string,
): Promise<void> {
  await db
    .update(aiConversation)
    .set({ title: buildTitle(firstUserText) })
    .where(and(eq(aiConversation.id, conversationId), isNull(aiConversation.title)));
}

export async function listConversations(
  userId: string,
  limit = 20,
): Promise<readonly StoredConversation[]> {
  return db.query.aiConversation.findMany({
    where: eq(aiConversation.userId, userId),
    columns: { id: true, title: true, updatedAt: true },
    orderBy: [desc(aiConversation.updatedAt)],
    limit,
  });
}

export async function loadConversationMessages(conversationId: string): Promise<UIMessage[]> {
  const rows = await db.query.aiMessage.findMany({
    where: eq(aiMessage.conversationId, conversationId),
    columns: { id: true, role: true, parts: true },
    orderBy: [asc(aiMessage.createdAt)],
  });

  return rows.map((row) => ({
    id: row.id,
    role: row.role === "user" ? "user" : "assistant",
    parts: row.parts as UIMessage["parts"],
  }));
}

/**
 * Kartu usulan mana di percakapan ini yang sudah dieksekusi menjadi dokumen.
 *
 * Dipakai antarmuka untuk merender kartu lama dalam keadaan sudah terkirim,
 * sehingga tombol konfirmasinya tidak muncul lagi setelah riwayat dimuat ulang.
 */
export async function loadConfirmedProposals(
  conversationId: string,
): Promise<Record<string, string>> {
  const rows = await db.query.aiProposalConfirmation.findMany({
    where: eq(aiProposalConfirmation.conversationId, conversationId),
    columns: { toolCallId: true, documentId: true },
  });

  return Object.fromEntries(rows.map((row) => [row.toolCallId, row.documentId]));
}

export async function appendMessage(input: {
  conversationId: string;
  role: "user" | "assistant";
  parts: UIMessage["parts"];
  provider?: ChatProviderName;
  inputTokens?: number;
  outputTokens?: number;
}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(aiMessage).values({
      conversationId: input.conversationId,
      role: input.role,
      parts: input.parts,
      provider: input.provider ?? null,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
    });
    await tx
      .update(aiConversation)
      .set({ updatedAt: new Date() })
      .where(eq(aiConversation.id, input.conversationId));
  });
}

export async function deleteConversation(conversationId: string, userId: string): Promise<void> {
  await db
    .delete(aiConversation)
    .where(and(eq(aiConversation.id, conversationId), eq(aiConversation.userId, userId)));
}

/**
 * Judul percakapan diambil dari kalimat pertama pengguna, dipotong pada batas kata
 * supaya tidak terpotong di tengah kata.
 */
export function buildTitle(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) {
    return "Percakapan baru";
  }
  if (normalized.length <= TITLE_MAX_LENGTH) {
    return normalized;
  }
  const clipped = normalized.slice(0, TITLE_MAX_LENGTH);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${lastSpace > 20 ? clipped.slice(0, lastSpace) : clipped}…`;
}

/**
 * Mengambil teks polos dari sebuah UIMessage untuk keperluan judul.
 */
export function extractText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join(" ");
}
