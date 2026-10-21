import { db } from "@backend/db";
import { aiConversation, aiMessage, user } from "@backend/db/schema";
import type { UIMessage } from "ai";
import { and, eq } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { buildTitle, type StoredConversation } from "./conversation-store";

export class ChatTurnConflict extends Error {}

export async function findUserTurnConversation(
  userId: string,
  messageId: string,
): Promise<StoredConversation | null> {
  const message = await db.query.aiMessage.findFirst({ where: eq(aiMessage.id, messageId) });
  if (!message || message.role !== "user") return null;
  return (
    (await db.query.aiConversation.findFirst({
      where: and(eq(aiConversation.id, message.conversationId), eq(aiConversation.userId, userId)),
    })) ?? null
  );
}

/** A retry keeps its user-turn identity even if the conversation response was lost. */
export async function persistUserTurn(input: {
  readonly userId: string;
  readonly conversationId?: string | null;
  readonly messageId: string;
  readonly text: string;
  readonly parts: UIMessage["parts"];
}): Promise<StoredConversation> {
  return db.transaction(async (tx): Promise<StoredConversation> => {
    const previous = await tx.query.aiMessage.findFirst({
      where: eq(aiMessage.id, input.messageId),
    });
    const targetId = input.conversationId ?? previous?.conversationId;
    if (targetId) {
      // Same lock order as explicit proposal confirmation: conversation, then user.
      await tx
        .select({ id: aiConversation.id })
        .from(aiConversation)
        .where(and(eq(aiConversation.id, targetId), eq(aiConversation.userId, input.userId)))
        .for("update");
    }
    // Serializes concurrent first-turn retries before either creates a conversation.
    const [owner] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, input.userId))
      .for("update");
    if (!owner) throw new ChatTurnConflict("Sesi tidak valid. Silakan masuk kembali.");
    const existing = await tx.query.aiMessage.findFirst({
      where: eq(aiMessage.id, input.messageId),
    });
    if (existing) {
      const conversation = await tx.query.aiConversation.findFirst({
        where: and(
          eq(aiConversation.id, existing.conversationId),
          eq(aiConversation.userId, input.userId),
        ),
      });
      if (
        !conversation ||
        existing.role !== "user" ||
        (input.conversationId && input.conversationId !== conversation.id) ||
        !isDeepStrictEqual(existing.parts, input.parts)
      )
        throw new ChatTurnConflict(
          "Identitas pertanyaan tidak sesuai. Kirim sebagai pertanyaan baru.",
        );
      return conversation;
    }
    let conversation = input.conversationId
      ? await tx.query.aiConversation.findFirst({
          where: and(
            eq(aiConversation.id, input.conversationId),
            eq(aiConversation.userId, input.userId),
          ),
        })
      : undefined;
    if (input.conversationId && !conversation)
      throw new ChatTurnConflict("Percakapan tidak ditemukan.");
    if (!conversation) {
      [conversation] = await tx
        .insert(aiConversation)
        .values({ userId: input.userId, title: buildTitle(input.text) })
        .returning();
    }
    await tx.insert(aiMessage).values({
      id: input.messageId,
      conversationId: conversation.id,
      role: "user",
      parts: input.parts,
    });
    const [updated] = await tx
      .update(aiConversation)
      .set({ updatedAt: new Date(), title: conversation.title ?? buildTitle(input.text) })
      .where(eq(aiConversation.id, conversation.id))
      .returning();
    return updated;
  });
}

/** Never duplicate the retried question or include later answers as its input. */
export function historyBeforeTurn(messages: UIMessage[], messageId: string): UIMessage[] {
  const index = messages.findIndex((message) => message.id === messageId);
  return index < 0 ? messages : messages.slice(0, index);
}
