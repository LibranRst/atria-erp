"use server";

import { postGoodsReceipt } from "@/app/actions/material/goods-receipt";
import { db } from "@/db";
import { aiConversation, aiProposalConfirmation } from "@/db/schema";
import { getServerSession } from "@/lib/server/session";
import type { ActionResponse } from "@atria/core/types/action-response";
import { aiGoodsReceiptProposalSchema } from "@atria/core/validations/ai-proposal";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function confirmAiGoodsReceiptProposal(
  input: unknown,
): Promise<ActionResponse<{ receiptId: string; alreadyConfirmed: boolean }>> {
  const session = await getServerSession();
  if (!session) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  }

  const validation = aiGoodsReceiptProposalSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Rincian penerimaan barang tidak valid." },
    };
  }

  const proposal = validation.data;

  const outcome = await db.transaction(async (tx) => {
    const [conversation] = await tx
      .select({ id: aiConversation.id })
      .from(aiConversation)
      .where(
        and(
          eq(aiConversation.id, proposal.conversationId),
          eq(aiConversation.userId, session.user.id),
        ),
      )
      .for("update");

    if (!conversation) return { kind: "not_found" } as const;

    const existing = await tx.query.aiProposalConfirmation.findFirst({
      where: eq(aiProposalConfirmation.toolCallId, proposal.toolCallId),
      columns: { documentId: true, userId: true },
    });

    if (existing) {
      return existing.userId === session.user.id
        ? ({ kind: "already", documentId: existing.documentId } as const)
        : ({ kind: "foreign" } as const);
    }

    const result = await postGoodsReceipt({
      projectId: proposal.projectId,
      inventoryLocationId: proposal.inventoryLocationId,
      receiptNumber: proposal.receiptNumber,
      receivedAt: new Date(proposal.receivedAt),
      vendorBillId: proposal.vendorBillId || undefined,
      note: proposal.note || undefined,
      items: proposal.items.map((it) => ({
        materialId: it.materialId,
        quantity: it.quantity,
        unitCost: it.unitCost,
        projectRapItemId: it.projectRapItemId || undefined,
        note: it.note,
      })),
    });

    if (!result.success) return { kind: "submit_failed", response: result } as const;

    await tx.insert(aiProposalConfirmation).values({
      toolCallId: proposal.toolCallId,
      conversationId: conversation.id,
      userId: session.user.id,
      proposalType: "POST_GOODS_RECEIPT",
      documentId: result.data.id,
    });

    return { kind: "created", documentId: result.data.id } as const;
  });

  if (outcome.kind === "not_found") {
    return { success: false, error: { code: "NOT_FOUND", message: "Percakapan tidak ditemukan." } };
  }
  if (outcome.kind === "foreign") {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Usulan ini bukan milik Anda." },
    };
  }
  if (outcome.kind === "submit_failed") return outcome.response;

  revalidatePath("/materials");
  revalidatePath(`/projects/${proposal.projectId}`);

  return {
    success: true,
    data: { receiptId: outcome.documentId, alreadyConfirmed: outcome.kind === "already" },
  };
}
