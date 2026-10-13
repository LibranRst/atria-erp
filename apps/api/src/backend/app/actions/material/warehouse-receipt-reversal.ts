import { and, eq } from "drizzle-orm";
import { db } from "@backend/db";
import { goodsReceipt, INSTANCE_TENANT_ID } from "@backend/db/schema";
import { resolveActor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import {
  receiptReversalDecisionSchema,
  receiptReversalRequestSchema,
} from "@atria/core/validations/warehouse";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  assertReceiptScope,
  receiptReversalPermission,
  writeReceiptReversalTx,
  ReceiptReversalError,
  type ReceiptReversalInput,
} from "@backend/server/usecases/material/receipt-reversal-writer";
import { refreshWarehouse, warehouseFailure } from "./warehouse-action-utils";
type Receipt = typeof goodsReceipt.$inferSelect;
async function execute(input: ReceiptReversalInput): Promise<ActionResponse<Receipt>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    if (!actorCan(actor, receiptReversalPermission(input.action)))
      throw new ReceiptReversalError("FORBIDDEN", "Izin pembatalan penerimaan tidak tersedia.");
    const result = await db.transaction(async (tx) => {
      const [receipt] = await tx
        .select()
        .from(goodsReceipt)
        .where(
          and(
            eq(goodsReceipt.id, input.goodsReceiptId),
            eq(goodsReceipt.tenantId, INSTANCE_TENANT_ID),
          ),
        )
        .for("update");
      if (receipt) await assertReceiptScope(tx, actor, receipt.projectId);
      // Preserve ordinary manual retry behavior; AI receipts replay separately.
      if (
        receipt &&
        ((input.action === "RECEIPT_REVERSAL_APPROVE" && receipt.status === "REVERSED") ||
          (input.action === "RECEIPT_REVERSAL_REQUEST" &&
            receipt.status === "REVERSAL_REQUESTED" &&
            receipt.reversalRequestedById === actor.userId &&
            receipt.reversalReason === input.reason))
      )
        return receipt;
      return writeReceiptReversalTx(tx, actor, input);
    });
    refreshWarehouse();
    revalidateWorkspacePath(`/projects/${result.projectId}`);
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof ReceiptReversalError)
      return { success: false, error: { code: error.code, message: error.message } };
    return warehouseFailure(error, "Pembatalan penerimaan belum tersimpan.");
  }
}
export async function requestGoodsReceiptReversal(
  input: unknown,
): Promise<ActionResponse<Receipt>> {
  const parsed = receiptReversalRequestSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Request tidak valid.",
      },
    };
  return execute({ action: "RECEIPT_REVERSAL_REQUEST", ...parsed.data });
}
export async function approveGoodsReceiptReversal(
  input: unknown,
): Promise<ActionResponse<Receipt>> {
  const parsed = receiptReversalDecisionSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Receipt tidak valid." } };
  return execute({ action: "RECEIPT_REVERSAL_APPROVE", ...parsed.data });
}
export async function rejectGoodsReceiptReversal(input: unknown): Promise<ActionResponse<Receipt>> {
  const parsed = receiptReversalDecisionSchema.safeParse(input);
  if (!parsed.success || !parsed.data.reason)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Alasan penolakan wajib diisi." },
    };
  return execute({ action: "RECEIPT_REVERSAL_REJECT", ...parsed.data });
}
