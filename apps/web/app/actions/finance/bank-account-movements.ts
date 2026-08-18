"use server";

import { and, eq, inArray } from "drizzle-orm";

import {
  authorizeBankAccountAction,
  mapBankAccountError,
  revalidateFinanceViews,
  toBankMoney,
} from "@/app/actions/finance/bank-account-action-utils";
import { db } from "@/db";
import { bankAccount, cashTransaction } from "@/db/schema";
import { mutateBalance } from "@/lib/finance/balance-mutation";
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
    const result = await db.transaction(async (tx) => {
      const account = await tx.query.bankAccount.findFirst({
        where: and(
          eq(bankAccount.id, validation.data.bankAccountId),
          eq(bankAccount.isActive, true),
        ),
      });
      if (!account) throw new Error("BANK_ACCOUNT_NOT_FOUND");
      return mutateBalance({
        tx,
        bankAccountId: validation.data.bankAccountId,
        type: validation.data.type,
        amount: toBankMoney(validation.data.amount),
        category: validation.data.category,
        description: validation.data.referenceNumber?.trim()
          ? `${validation.data.description.trim()} (${validation.data.referenceNumber.trim()})`
          : validation.data.description.trim(),
        referenceType: "manual_cash_movement",
        referenceId: crypto.randomUUID(),
        userId: authResult.data.user.id,
        transactionDate: validation.data.transactionDate,
      });
    });
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
    const transferId = crypto.randomUUID();
    await db.transaction(async (tx) => {
      const accounts = await tx.query.bankAccount.findMany({
        where: and(
          eq(bankAccount.isActive, true),
          inArray(bankAccount.id, [
            validation.data.fromBankAccountId,
            validation.data.toBankAccountId,
          ]),
        ),
      });
      const fromAccount = accounts.find(
        (account) => account.id === validation.data.fromBankAccountId,
      );
      const toAccount = accounts.find((account) => account.id === validation.data.toBankAccountId);
      if (!fromAccount || !toAccount) throw new Error("BANK_ACCOUNT_NOT_FOUND");
      const reference = validation.data.referenceNumber?.trim();
      const descriptionSuffix = reference ? ` (${reference})` : "";
      await mutateBalance({
        tx,
        bankAccountId: fromAccount.id,
        type: "OUTFLOW",
        amount: toBankMoney(validation.data.amount),
        category: "bank_transfer_out",
        description: `${validation.data.description.trim()} ke ${toAccount.name}${descriptionSuffix}`,
        referenceType: "bank_transfer",
        referenceId: transferId,
        userId: authResult.data.user.id,
        transactionDate: validation.data.transactionDate,
      });
      await mutateBalance({
        tx,
        bankAccountId: toAccount.id,
        type: "INFLOW",
        amount: toBankMoney(validation.data.amount),
        category: "bank_transfer_in",
        description: `${validation.data.description.trim()} dari ${fromAccount.name}${descriptionSuffix}`,
        referenceType: "bank_transfer",
        referenceId: transferId,
        userId: authResult.data.user.id,
        transactionDate: validation.data.transactionDate,
      });
    });
    revalidateFinanceViews();
    return { success: true, data: { transferId } };
  } catch (error) {
    return mapBankAccountError(error, "Gagal memindahkan saldo antar rekening.");
  }
}
