import "server-only";

import { db } from "@/db";
import { aiConversation, aiMessage, aiProposalConfirmation } from "@/db/schema";
import type { UIMessage } from "ai";
import { and, asc, count, desc, eq, ilike, isNull, lt, or } from "drizzle-orm";

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

export type ConversationSummary = StoredConversation & { readonly messageCount: number };
export type ConversationPage = {
  readonly items: readonly ConversationSummary[];
  readonly nextCursor: string | null;
};

type ConversationCursor = { readonly updatedAt: string; readonly id: string };

function encodeConversationCursor(value: ConversationCursor): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeConversationCursor(value?: string): ConversationCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as { updatedAt?: unknown; id?: unknown };
    return typeof candidate.updatedAt === "string" && typeof candidate.id === "string"
      ? { updatedAt: candidate.updatedAt, id: candidate.id }
      : null;
  } catch {
    return null;
  }
}

export async function listConversationPage(input: {
  readonly userId: string;
  readonly query?: string;
  readonly cursor?: string;
  readonly limit?: number;
}): Promise<ConversationPage> {
  const limit = Math.min(50, Math.max(1, Math.floor(input.limit ?? 30)));
  const query = input.query?.trim();
  const cursor = decodeConversationCursor(input.cursor);
  const cursorDate = cursor ? new Date(cursor.updatedAt) : null;
  const rows = await db
    .select({
      id: aiConversation.id,
      title: aiConversation.title,
      updatedAt: aiConversation.updatedAt,
      messageCount: count(aiMessage.id),
    })
    .from(aiConversation)
    .innerJoin(aiMessage, eq(aiMessage.conversationId, aiConversation.id))
    .where(
      and(
        eq(aiConversation.userId, input.userId),
        query ? ilike(aiConversation.title, `%${query}%`) : undefined,
        cursor && cursorDate && Number.isFinite(cursorDate.getTime())
          ? or(
              lt(aiConversation.updatedAt, cursorDate),
              and(eq(aiConversation.updatedAt, cursorDate), lt(aiConversation.id, cursor.id)),
            )
          : undefined,
      ),
    )
    .groupBy(aiConversation.id)
    .orderBy(desc(aiConversation.updatedAt), desc(aiConversation.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const items = rows
    .slice(0, limit)
    .map((row) => ({ ...row, messageCount: Number(row.messageCount) }));
  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      hasMore && last
        ? encodeConversationCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id })
        : null,
  };
}

export async function renameConversation(
  conversationId: string,
  userId: string,
  title: string,
): Promise<boolean> {
  const rows = await db
    .update(aiConversation)
    .set({ title })
    .where(and(eq(aiConversation.id, conversationId), eq(aiConversation.userId, userId)))
    .returning({ id: aiConversation.id });
  return rows.length > 0;
}

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
  const [rows, confirmedRows] = await Promise.all([
    db.query.aiMessage.findMany({
      where: eq(aiMessage.conversationId, conversationId),
      columns: { id: true, role: true, parts: true },
      orderBy: [asc(aiMessage.createdAt)],
    }),
    db.query.aiProposalConfirmation.findMany({
      where: eq(aiProposalConfirmation.conversationId, conversationId),
      columns: { toolCallId: true, documentId: true, proposalType: true, createdAt: true },
    }),
  ]);

  const confirmedMap = new Map<
    string,
    { documentId: string; proposalType: string; createdAt: Date }
  >();
  for (const row of confirmedRows) {
    confirmedMap.set(row.toolCallId, {
      documentId: row.documentId,
      proposalType: row.proposalType,
      createdAt: row.createdAt,
    });
  }

  return rows.map((row) => {
    const parts = row.parts as UIMessage["parts"];
    if (row.role !== "assistant" || confirmedMap.size === 0 || !Array.isArray(parts)) {
      return {
        id: row.id,
        role: row.role === "user" ? "user" : "assistant",
        parts,
      };
    }

    const enrichedParts = parts.map((part) => {
      const toolCallId = (part as { toolCallId?: string }).toolCallId;
      if (!toolCallId || !confirmedMap.has(toolCallId)) {
        return part;
      }

      const conf = confirmedMap.get(toolCallId)!;
      const originalOutput = (part as { output?: unknown }).output;
      if (typeof originalOutput === "object" && originalOutput !== null) {
        const outputObj = originalOutput as Record<string, unknown>;
        return {
          ...part,
          output: {
            ...outputObj,
            isConfirmedByUser: true,
            confirmation: {
              status: "CONFIRMED_AND_EXECUTED",
              proposalType: conf.proposalType,
              documentId: conf.documentId,
              confirmedAt: conf.createdAt.toISOString(),
            },
            instruction: `STATUS: Usulan ini TELAH DIKONFIRMASI oleh pengguna dan BERHASIL DIEKSEKUSI ke database (ID Dokumen: ${conf.documentId}). Transaksi sudah selesai diproses. Jika pengguna bertanya tentang statusnya, konfirmasikan bahwa aksi telah berhasil dilakukan.`,
          },
        };
      }
      return part;
    });

    return {
      id: row.id,
      role: "assistant",
      parts: enrichedParts as UIMessage["parts"],
    };
  });
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
