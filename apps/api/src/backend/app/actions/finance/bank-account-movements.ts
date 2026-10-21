import {
  authorizeBankAccountAction,
  mapBankAccountError,
  revalidateFinanceViews,
} from "@backend/app/actions/finance/bank-account-action-utils";
import { db } from "@backend/db";
import { cashTransaction } from "@backend/db/schema";
import {
  postManualCashMovementTx,
  transferBetweenBankAccountsTx,
} from "@backend/server/usecases/finance/bank-cash-writer";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  postManualCashMovementSchema,
  transferBetweenBankAccountsSchema,
  type PostManualCashMovementInput,
  type TransferBetweenBankAccountsInput,
} from "@atria/core/validations/finance";

export async function postManualCashMovement(
  input: PostManualCashMovementInput,
): Promise<ActionResponse<typeof cashTransaction.$inferSelect>> {
  const validation = postManualCashMovementSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Mutasi kas tidak valid.",
      },
    };
  }
  const authResult = await authorizeBankAccountAction("create:ledger");
  if (!authResult.success) return authResult;
  try {
    const result = await db.transaction((tx) =>
      postManualCashMovementTx(tx, authResult.data.user.id, validation.data),
    );
    revalidateFinanceViews();
    return { success: true, data: result };
  } catch (error) {
    return mapBankAccountError(error, "Gagal mencatat mutasi kas.");
  }
}

export async function transferBetweenBankAccounts(
  input: TransferBetweenBankAccountsInput,
): Promise<ActionResponse<{ readonly transferId: string }>> {
  const validation = transferBetweenBankAccountsSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Transfer rekening tidak valid.",
      },
    };
  }
  const authResult = await authorizeBankAccountAction("create:ledger");
  if (!authResult.success) return authResult;
  try {
    const { transferId } = await db.transaction((tx) =>
      transferBetweenBankAccountsTx(tx, authResult.data.user.id, validation.data),
    );
    revalidateFinanceViews();
    return { success: true, data: { transferId } };
  } catch (error) {
    return mapBankAccountError(error, "Gagal memindahkan saldo antar rekening.");
  }
}
