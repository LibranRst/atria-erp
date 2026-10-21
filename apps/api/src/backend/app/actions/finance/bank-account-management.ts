import {
  createBankAccountTx,
  updateBankAccountTx,
  setBankAccountActiveTx,
  lockBankAccounts,
  lockBankCatalog,
} from "@backend/server/usecases/finance/bank-cash-writer";

import {
  authorizeBankAccountAction,
  bankAccountPayload,
  mapBankAccountError,
  revalidateFinanceViews,
} from "@backend/app/actions/finance/bank-account-action-utils";
import { db } from "@backend/db";
import { assertPermission } from "@backend/lib/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  type CreateBankAccountInput,
  type UpdateBankAccountInput,
} from "@atria/core/validations/finance";

export async function createBankAccount(
  input: CreateBankAccountInput,
): Promise<ActionResponse<ReturnType<typeof bankAccountPayload>>> {
  const validation = createBankAccountSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Data rekening tidak valid.",
      },
    };
  }
  const authResult = await authorizeBankAccountAction("create:bank_account");
  if (!authResult.success) return authResult;
  try {
    const result = await db.transaction((tx) =>
      createBankAccountTx(tx, authResult.data.user.id, validation.data),
    );
    revalidateFinanceViews();
    return { success: true, data: bankAccountPayload(result) };
  } catch (error) {
    return mapBankAccountError(error, "Gagal membuat rekening bank.");
  }
}

export async function updateBankAccount(
  input: UpdateBankAccountInput,
): Promise<ActionResponse<ReturnType<typeof bankAccountPayload>>> {
  const validation = updateBankAccountSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Data rekening tidak valid.",
      },
    };
  }
  const authResult = await authorizeBankAccountAction("update:bank_account");
  if (!authResult.success) return authResult;
  try {
    const updated = await db.transaction(async (tx) => {
      await lockBankCatalog(tx);
      const [existing] = await lockBankAccounts(tx, [validation.data.bankAccountId]);
      if (existing.isActive !== validation.data.isActive) {
        try {
          await assertPermission(authResult.data.user, "delete:bank_account");
        } catch {
          throw new Error("BANK_ACCOUNT_STATUS_FORBIDDEN");
        }
      }
      return updateBankAccountTx(tx, authResult.data.user.id, validation.data);
    });
    revalidateFinanceViews();
    return { success: true, data: bankAccountPayload(updated) };
  } catch (error) {
    return mapBankAccountError(error, "Gagal memperbarui rekening bank.");
  }
}

export async function setBankAccountActive(input: {
  readonly bankAccountId: string;
  readonly isActive: boolean;
}): Promise<ActionResponse<{ readonly id: string; readonly isActive: boolean }>> {
  const validation = updateBankAccountSchema
    .pick({ bankAccountId: true, isActive: true })
    .safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Status rekening tidak valid." },
    };
  }
  const authResult = await authorizeBankAccountAction("delete:bank_account");
  if (!authResult.success) return authResult;
  try {
    const updated = await db.transaction((tx) =>
      setBankAccountActiveTx(
        tx,
        authResult.data.user.id,
        validation.data.bankAccountId,
        validation.data.isActive,
      ),
    );
    revalidateFinanceViews();
    return { success: true, data: { id: updated.id, isActive: updated.isActive } };
  } catch (error) {
    return mapBankAccountError(error, "Gagal mengubah status rekening.");
  }
}
