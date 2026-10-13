import { db } from "@backend/db";
import { requireReconciliationUser } from "./reconciliation-action-utils";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import {
  reconcilePairTx,
  setReconciliationExceptionTx,
  ReconciliationError,
} from "@backend/server/usecases/finance/reconciliation-writer";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  clearReconciliationExceptionSchema,
  markReconciliationExceptionSchema,
  reconcileCashTransactionSchema,
  type ClearReconciliationExceptionInput,
  type MarkReconciliationExceptionInput,
  type ReconcileCashTransactionInput,
} from "@atria/core/validations/finance";
function failure(error: unknown): ActionResponse<never> {
  return {
    success: false,
    error: {
      code: error instanceof ReconciliationError ? error.code : "TRANSACTION_FAILED",
      message:
        error instanceof ReconciliationError
          ? error.message
          : "Rekonsiliasi belum dapat disimpan. Periksa lagi.",
    },
  };
}
export async function reconcileCashTransaction(
  input: ReconcileCashTransactionInput,
): Promise<ActionResponse<{ readonly cashTransactionId: string }>> {
  const parsed = reconcileCashTransactionSchema.safeParse(input),
    user = await requireReconciliationUser();
  if (!user.success) return user;
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data rekonsiliasi tidak valid." },
    };
  try {
    const data = await db.transaction((tx) => reconcilePairTx(tx, user.data.id, parsed.data));
    revalidateWorkspacePath("/reconciliation");
    return { success: true, data };
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function markReconciliationException(
  input: MarkReconciliationExceptionInput,
): Promise<ActionResponse<{ readonly cashTransactionId: string }>> {
  const parsed = markReconciliationExceptionSchema.safeParse(input),
    user = await requireReconciliationUser();
  if (!user.success) return user;
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Alasan pengecualian wajib diisi." },
    };
  try {
    const data = await db.transaction((tx) =>
      setReconciliationExceptionTx(tx, user.data.id, parsed.data),
    );
    revalidateWorkspacePath("/reconciliation");
    return { success: true, data };
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function clearReconciliationException(
  input: ClearReconciliationExceptionInput,
): Promise<ActionResponse<{ readonly cashTransactionId: string }>> {
  const parsed = clearReconciliationExceptionSchema.safeParse(input),
    user = await requireReconciliationUser();
  if (!user.success) return user;
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Catatan kas tidak valid." },
    };
  try {
    const data = await db.transaction((tx) =>
      setReconciliationExceptionTx(tx, user.data.id, { ...parsed.data, reason: null }),
    );
    revalidateWorkspacePath("/reconciliation");
    return { success: true, data };
  } catch (error: unknown) {
    return failure(error);
  }
}
