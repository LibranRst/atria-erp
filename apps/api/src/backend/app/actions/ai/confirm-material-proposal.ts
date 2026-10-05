import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { actorCan } from "@backend/lib/auth/permissions";
import { resolveActor } from "@backend/server/actor";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import { postGoodsReceiptTx } from "@backend/server/usecases/material/post-goods-receipt";
import type { ActionResponse } from "@atria/core/types/action-response";
import { aiGoodsReceiptProposalSchema } from "@atria/core/validations/ai-proposal";
import { createGoodsReceiptSchema } from "@atria/core/validations/workflow-governance";

export async function confirmAiGoodsReceiptProposal(
  input: unknown,
): Promise<ActionResponse<{ receiptId: string; alreadyConfirmed: boolean }>> {
  const actor = await resolveActor();
  if (!actor)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  const parsed = aiGoodsReceiptProposalSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Rincian penerimaan barang tidak valid." },
    };
  if (!actorCan(actor, "create:stock_movement"))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Tidak memiliki izin mencatat penerimaan barang." },
    };
  const proposal = parsed.data;
  const receipt = createGoodsReceiptSchema.safeParse({
    ...proposal,
    vendorBillId: proposal.vendorBillId || undefined,
    receivedAt: new Date(proposal.receivedAt),
    items: proposal.items.map((item) => ({
      ...item,
      projectRapItemId: item.projectRapItemId || undefined,
    })),
  });
  if (!receipt.success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Periksa nomor penerimaan, lokasi, dan rincian material." } };
  }
  const outcome = await confirmMutation(actor, proposal, "POST_GOODS_RECEIPT", async (tx) => {
    const result = await postGoodsReceiptTx(tx, actor, receipt.data);
    return { documentId: result.id, result };
  });
  if (!outcome.success) return outcome;
  revalidatePath("/materials");
  revalidatePath(`/projects/${proposal.projectId}`);
  return {
    success: true,
    data: { receiptId: outcome.data.documentId, alreadyConfirmed: outcome.data.kind === "already" },
  };
}
