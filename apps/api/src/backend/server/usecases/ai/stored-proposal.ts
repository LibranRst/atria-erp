import { aiConversation, aiMessage, INSTANCE_TENANT_ID } from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export const PROPOSAL_REVIEW_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export class StoredProposalError extends Error {
  readonly code = "NOT_FOUND";
}
export async function readOwnedStoredProposal<T>(
  connection: Pick<FinanceTransaction, "query">,
  actor: Pick<Actor, "userId">,
  identity: { readonly conversationId: string; readonly toolCallId: string },
  toolName: string,
  schema: z.ZodType<T>,
): Promise<{ proposal: T; expiresAt: number }> {
  const conversation = await connection.query.aiConversation.findFirst({
    where: and(
      eq(aiConversation.id, identity.conversationId),
      eq(aiConversation.userId, actor.userId),
      eq(aiConversation.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  if (!conversation) throw new StoredProposalError("Percakapan tidak ditemukan.");
  const messages = await connection.query.aiMessage.findMany({
    where: and(
      eq(aiMessage.conversationId, conversation.id),
      eq(aiMessage.tenantId, INSTANCE_TENANT_ID),
      eq(aiMessage.role, "assistant"),
    ),
    columns: { parts: true, createdAt: true },
  });
  const partSchema = z.object({
    type: z.literal(`tool-${toolName}`),
    toolCallId: z.string(),
    state: z.literal("output-available"),
    output: z.object({ proposal: schema }),
  });
  const found: { proposal: T; expiresAt: number }[] = [];
  for (const message of messages) {
    const parts = z.array(z.unknown()).safeParse(message.parts);
    if (!parts.success) continue;
    for (const part of parts.data) {
      const parsed = partSchema.safeParse(part);
      if (parsed.success && parsed.data.toolCallId === identity.toolCallId)
        found.push({
          proposal: parsed.data.output.proposal,
          expiresAt: message.createdAt.getTime() + PROPOSAL_REVIEW_TTL_MS,
        });
    }
  }
  if (found.length !== 1)
    throw new StoredProposalError(
      "Usulan belum tersimpan atau tidak tersedia. Tunggu jawaban selesai lalu coba lagi.",
    );
  return found[0];
}
