"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { auditLog, bankAccount, cashTransaction } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertPermission, type PermissionKey } from "@/lib/auth/permissions";
import { mutateBalance } from "@/lib/finance/balance-mutation";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  createBankAccountSchema,
  postManualCashMovementSchema,
  transferBetweenBankAccountsSchema,
  updateBankAccountSchema,
  type CreateBankAccountInput,
  type PostManualCashMovementInput,
  type TransferBetweenBankAccountsInput,
  type UpdateBankAccountInput,
} from "@/lib/validations/finance";

type SessionUser = {
  readonly id: string;
  readonly roleId?: string;
};

type BankAccountRow = typeof bankAccount.$inferSelect;

async function getActionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({
    headers: { cookie: (await cookies()).toString() },
  });
  return session?.user ? { id: session.user.id, roleId: session.user.roleId } : null;
}

async function authorize(
  permission: PermissionKey,
): Promise<ActionResponse<{ readonly user: SessionUser }>> {
  const user = await getActionUser();
  if (!user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }

  try {
    await assertPermission(user, permission);
    return { success: true, data: { user } };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: error instanceof Error ? error.message : "Akses ditolak.",
      },
    };
  }
}

function toMoney(value: number): string {
  return value.toFixed(2);
}

function revalidateFinanceViews(): void {
  revalidatePath("/ledger");
  revalidatePath("/expenses");
  revalidatePath("/projects");
}

function bankAccountPayload(
  row: BankAccountRow,
): BankAccountRow & { readonly balanceNumber: number } {
  return { ...row, balanceNumber: Number(row.balance) };
}

function mapFinanceError(error: unknown, fallback: string): ActionResponse<never> {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes("INSUFFICIENT_FUNDS")) {
    return {
      success: false,
      error: { code: "INSUFFICIENT_FUNDS", message: "Saldo rekening tidak mencukupi." },
    };
  }
  if (message.includes("BANK_ACCOUNT_NOT_FOUND")) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Rekening bank tidak ditemukan." },
    };
  }
  if (message.includes("BANK_ACCOUNT_STATUS_FORBIDDEN")) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Hanya Owner yang dapat mengarsipkan atau mengaktifkan rekening.",
      },
    };
  }
  if (message.includes("duplicate key") || message.includes("unique")) {
    return {
      success: false,
      error: { code: "TRANSACTION_FAILED", message: "Nomor rekening sudah terdaftar." },
    };
  }
  if (message.includes("Failed query")) {
    return { success: false, error: { code: "TRANSACTION_FAILED", message: fallback } };
  }
  return { success: false, error: { code: "TRANSACTION_FAILED", message } };
}

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

  const authResult = await authorize("create:bank_account");
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
        const referenceId = crypto.randomUUID();
        await mutateBalance({
          tx,
          bankAccountId: created.id,
          type: "DEBIT",
          amount: toMoney(validation.data.openingBalance),
          category: "opening_balance",
          description: validation.data.openingNote?.trim() || `Saldo awal ${created.name}`,
          referenceType: "opening_balance",
          referenceId,
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
    return mapFinanceError(error, "Gagal membuat rekening bank.");
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

  const authResult = await authorize("update:bank_account");
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
    return mapFinanceError(error, "Gagal memperbarui rekening bank.");
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

  const authResult = await authorize("delete:bank_account");
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
    return mapFinanceError(error, "Gagal mengubah status rekening.");
  }
}

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

  const authResult = await authorize("create:ledger");
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
        amount: toMoney(validation.data.amount),
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
    return mapFinanceError(error, "Gagal mencatat mutasi kas.");
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

  const authResult = await authorize("create:ledger");
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
        type: "CREDIT",
        amount: toMoney(validation.data.amount),
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
        type: "DEBIT",
        amount: toMoney(validation.data.amount),
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
    return mapFinanceError(error, "Gagal memindahkan saldo antar rekening.");
  }
}
