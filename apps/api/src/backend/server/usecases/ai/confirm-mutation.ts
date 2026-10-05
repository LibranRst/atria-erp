import { db } from "@backend/db";
import { aiConversation, aiProposalConfirmation } from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import type { ActionResponse } from "@atria/core/types/action-response";
import { and, eq } from "drizzle-orm";

export type ConfirmedMutation<Result> =
  | { readonly kind: "created"; readonly documentId: string; readonly result: Result }
  | { readonly kind: "already"; readonly documentId: string };

export function mapConfirmationError(error: unknown): ActionResponse<never> {
  const reason = error instanceof Error ? error.message : "";
  if (
    reason.startsWith("FORBIDDEN:") ||
    reason.startsWith("UNAUTHORIZED:") ||
    reason.startsWith("PROJECT_NOT_ACTIVE:")
  ) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses tindakan atau proyek ditolak." },
    };
  }
  if (reason === "AI_CONVERSATION_NOT_FOUND") {
    return { success: false, error: { code: "NOT_FOUND", message: "Percakapan tidak ditemukan." } };
  }
  return {
    success: false,
    error: {
      code: "TRANSACTION_FAILED",
      message: "Usulan belum tersimpan. Muat ulang dan periksa kembali sebelum mencoba ulang.",
    },
  };
}

/** The card, domain write, audit and outbox share the same COMMIT boundary. */
export async function confirmMutation<Result>(
  actor: Actor,
  identity: { readonly conversationId: string; readonly toolCallId: string },
  proposalType: string,
  mutate: (
    tx: FinanceTransaction,
  ) => Promise<{ readonly documentId: string; readonly result: Result }>,
  mapError: (error: unknown) => ActionResponse<never> = mapConfirmationError,
): Promise<ActionResponse<ConfirmedMutation<Result>>> {
  try {
    const outcome = await db.transaction(async (tx): Promise<ConfirmedMutation<Result>> => {
      const [conversation] = await tx
        .select({ id: aiConversation.id })
        .from(aiConversation)
        .where(
          and(
            eq(aiConversation.id, identity.conversationId),
            eq(aiConversation.userId, actor.userId),
          ),
        )
        .for("update");
      if (!conversation) throw new Error("AI_CONVERSATION_NOT_FOUND");
      const existing = await tx.query.aiProposalConfirmation.findFirst({
        where: eq(aiProposalConfirmation.toolCallId, identity.toolCallId),
      });
      if (existing) {
        if (
          existing.userId !== actor.userId ||
          existing.conversationId !== conversation.id ||
          existing.proposalType !== proposalType
        ) {
          throw new Error("FORBIDDEN: Usulan ini bukan milik percakapan atau tindakan ini.");
        }
        return { kind: "already", documentId: existing.documentId };
      }
      const created = await mutate(tx);
      await tx.insert(aiProposalConfirmation).values({
        toolCallId: identity.toolCallId,
        conversationId: conversation.id,
        userId: actor.userId,
        proposalType,
        documentId: created.documentId,
      });
      return { kind: "created", ...created };
    });
    return { success: true, data: outcome };
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.message === "AI_CONVERSATION_NOT_FOUND" || error.message.startsWith("FORBIDDEN:"))
    ) {
      return mapConfirmationError(error);
    }
    // Database diagnostics may contain statement text and private financial values.
    if (error instanceof Error && error.message.startsWith("Failed query:")) {
      return mapConfirmationError(error);
    }
    return mapError(error);
  }
}
