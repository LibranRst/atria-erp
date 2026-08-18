"use server";

import { eq } from "drizzle-orm";

import {
  authorizeBankAccountAction,
  bankAccountPayload,
  mapBankAccountError,
  revalidateFinanceViews,
  toBankMoney,
} from "@/app/actions/finance/bank-account-action-utils";
import { db } from "@/db";
import { auditLog, bankAccount } from "@/db/schema";
import { assertPermission } from "@/lib/auth/permissions";
import { mutateBalance } from "@/lib/finance/balance-mutation";
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
    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(bankAccount)
        .values({
          name: validation.data.name.trim(),
          accountNumber: validation.data.accountNumber.trim(),
          bankName: validation.data.bankName.trim(),
          holderName: validation.data.holderName.trim(),
          balance: "0.00",
          cardColorFrom: validation.data.cardColorFrom,
          cardColorTo: validation.data.cardColorTo,
          cardTextColor: validation.data.cardTextColor,
          isActive: true,
        })
        .returning();
      if (!created) throw new Error("BANK_ACCOUNT_CREATE_FAILED");
      await tx.insert(auditLog).values({
        userId: authResult.data.user.id,
        action: "CREATE_BANK_ACCOUNT",
        targetTable: "bank_account",
        targetId: created.id,
        newState: JSON.stringify(created),
      });
      if (validation.data.openingBalance > 0) {
        await mutateBalance({
          tx,
          bankAccountId: created.id,
          type: "INFLOW",
          amount: toBankMoney(validation.data.openingBalance),
          category: "opening_balance",
          description: validation.data.openingNote?.trim() || `Saldo awal ${created.name}`,
          referenceType: "opening_balance",
          referenceId: crypto.randomUUID(),
          userId: authResult.data.user.id,
        });
      }
      const latest = await tx.query.bankAccount.findFirst({
        where: eq(bankAccount.id, created.id),
      });
      if (!latest) throw new Error("BANK_ACCOUNT_NOT_FOUND");
      return latest;
    });
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
      const existing = await tx.query.bankAccount.findFirst({
        where: eq(bankAccount.id, validation.data.bankAccountId),
      });
      if (!existing) throw new Error("BANK_ACCOUNT_NOT_FOUND");
      if (existing.isActive !== validation.data.isActive) {
        try {
          await assertPermission(authResult.data.user, "delete:bank_account");
        } catch {
          throw new Error("BANK_ACCOUNT_STATUS_FORBIDDEN");
        }
      }
      const [row] = await tx
        .update(bankAccount)
        .set({
          name: validation.data.name.trim(),
          accountNumber: validation.data.accountNumber.trim(),
          bankName: validation.data.bankName.trim(),
          holderName: validation.data.holderName.trim(),
          cardColorFrom: validation.data.cardColorFrom,
          cardColorTo: validation.data.cardColorTo,
          cardTextColor: validation.data.cardTextColor,
          isActive: validation.data.isActive,
          updatedAt: new Date(),
        })
        .where(eq(bankAccount.id, validation.data.bankAccountId))
        .returning();
      if (!row) throw new Error("BANK_ACCOUNT_UPDATE_FAILED");
      await tx.insert(auditLog).values({
        userId: authResult.data.user.id,
        action: "UPDATE_BANK_ACCOUNT",
        targetTable: "bank_account",
        targetId: row.id,
        originalState: JSON.stringify(existing),
        newState: JSON.stringify(row),
      });
      return row;
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
    const updated = await db.transaction(async (tx) => {
      const existing = await tx.query.bankAccount.findFirst({
        where: eq(bankAccount.id, validation.data.bankAccountId),
      });
      if (!existing) throw new Error("BANK_ACCOUNT_NOT_FOUND");
      const [row] = await tx
        .update(bankAccount)
        .set({ isActive: validation.data.isActive, updatedAt: new Date() })
        .where(eq(bankAccount.id, validation.data.bankAccountId))
        .returning();
      if (!row) throw new Error("BANK_ACCOUNT_UPDATE_FAILED");
      await tx.insert(auditLog).values({
        userId: authResult.data.user.id,
        action: validation.data.isActive ? "REACTIVATE_BANK_ACCOUNT" : "ARCHIVE_BANK_ACCOUNT",
        targetTable: "bank_account",
        targetId: row.id,
        originalState: JSON.stringify(existing),
        newState: JSON.stringify({ isActive: row.isActive }),
      });
      return row;
    });
    revalidateFinanceViews();
    return { success: true, data: { id: updated.id, isActive: updated.isActive } };
  } catch (error) {
    return mapBankAccountError(error, "Gagal mengubah status rekening.");
  }
}
