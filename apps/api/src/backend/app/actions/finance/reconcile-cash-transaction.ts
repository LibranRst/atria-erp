import { cookies } from "@runtime/request-context";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { eq } from "drizzle-orm";

import { db } from "@backend/db";
import {
  auditLog,
  bankStatementImport,
  bankStatementRow,
  cashTransaction,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { assertPermission } from "@backend/lib/auth/permissions";
import { parseNumericToCents } from "@backend/lib/finance/balance-mutation";
import { normalizeCashDirection } from "@atria/core/finance/cash-direction";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  clearReconciliationExceptionSchema,
  markReconciliationExceptionSchema,
  reconcileCashTransactionSchema,
  type ClearReconciliationExceptionInput,
  type MarkReconciliationExceptionInput,
  type ReconcileCashTransactionInput,
} from "@atria/core/validations/finance";

type ReconciliationUser = { readonly id: string; readonly roleId?: string };

async function requireReconciliationUser(): Promise<ActionResponse<ReconciliationUser>> {
  const session = await auth.api.getSession({ headers: { cookie: (await cookies()).toString() } });
  if (!session?.user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }
  try {
    await assertPermission(session.user, "reconcile:ledger");
    return { success: true, data: session.user };
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: error instanceof Error ? error.message : "Akses rekonsiliasi ditolak.",
      },
    };
  }
}

export async function reconcileCashTransaction(
  input: ReconcileCashTransactionInput,
): Promise<ActionResponse<{ readonly cashTransactionId: string }>> {
  const parsed = reconcileCashTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data rekonsiliasi tidak valid." },
    };
  }

  const userResult = await requireReconciliationUser();
  if (!userResult.success) return userResult;

  try {
    const result = await db.transaction(async (tx) => {
      const [transaction] = await tx
        .select()
        .from(cashTransaction)
        .where(eq(cashTransaction.id, parsed.data.cashTransactionId))
        .for("update");
      if (!transaction) throw new Error("CASH_TRANSACTION_NOT_FOUND");
      if (transaction.reconciled) throw new Error("CASH_TRANSACTION_ALREADY_RECONCILED");

      const [statementRow] = await tx
        .select({ row: bankStatementRow, import: bankStatementImport })
        .from(bankStatementRow)
        .innerJoin(bankStatementImport, eq(bankStatementRow.importId, bankStatementImport.id))
        .where(eq(bankStatementRow.id, parsed.data.bankStatementRowId))
        .for("update");
      if (!statementRow) throw new Error("BANK_STATEMENT_ROW_NOT_FOUND");
      if (statementRow.row.isReconciled || statementRow.row.matchedCashTransactionId) {
        throw new Error("BANK_STATEMENT_ROW_ALREADY_RECONCILED");
      }
      if (
        statementRow.import.bankAccountId !== transaction.bankAccountId ||
        normalizeCashDirection(statementRow.row.type) !==
          normalizeCashDirection(transaction.type) ||
        parseNumericToCents(statementRow.row.amount) !== parseNumericToCents(transaction.amount)
      ) {
        throw new Error("RECONCILIATION_DETAILS_MISMATCH");
      }

      const reconciledAt = new Date();
      await tx
        .update(cashTransaction)
        .set({
          reconciled: true,
          reconciliationDate: reconciledAt,
          reconciledById: userResult.data.id,
          reconciliationExceptionReason: null,
          reconciliationExceptionAt: null,
          reconciliationExceptionById: null,
        })
        .where(eq(cashTransaction.id, transaction.id));
      await tx
        .update(bankStatementRow)
        .set({ isReconciled: true, matchedCashTransactionId: transaction.id })
        .where(eq(bankStatementRow.id, statementRow.row.id));
      await tx.insert(auditLog).values({
        userId: userResult.data.id,
        action: "RECONCILE_CASH_TRANSACTION",
        targetTable: "cash_transaction",
        targetId: transaction.id,
        originalState: JSON.stringify({ reconciled: false, bankStatementRowId: null }),
        newState: JSON.stringify({ reconciled: true, bankStatementRowId: statementRow.row.id }),
      });
      return { cashTransactionId: transaction.id };
    });
    revalidatePath("/reconciliation");
    return { success: true, data: result };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "RECONCILIATION_FAILED";
    const code =
      reason === "CASH_TRANSACTION_NOT_FOUND" || reason === "BANK_STATEMENT_ROW_NOT_FOUND"
        ? "NOT_FOUND"
        : reason === "CASH_TRANSACTION_ALREADY_RECONCILED" ||
            reason === "BANK_STATEMENT_ROW_ALREADY_RECONCILED" ||
            reason === "RECONCILIATION_DETAILS_MISMATCH"
          ? "FORBIDDEN"
          : "TRANSACTION_FAILED";
    const message =
      reason === "CASH_TRANSACTION_NOT_FOUND" || reason === "BANK_STATEMENT_ROW_NOT_FOUND"
        ? "Transaksi atau mutasi rekening koran tidak ditemukan."
        : reason === "CASH_TRANSACTION_ALREADY_RECONCILED" ||
            reason === "BANK_STATEMENT_ROW_ALREADY_RECONCILED"
          ? "Salah satu transaksi sudah direkonsiliasi. Muat ulang halaman untuk melihat data terbaru."
          : reason === "RECONCILIATION_DETAILS_MISMATCH"
            ? "Rekening, arah dana, atau nominal pasangan tidak sama."
            : "Gagal merekonsiliasi transaksi kas.";
    return { success: false, error: { code, message } };
  }
}

export async function markReconciliationException(
  input: MarkReconciliationExceptionInput,
): Promise<ActionResponse<{ readonly cashTransactionId: string }>> {
  const parsed = markReconciliationExceptionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Alasan pengecualian tidak valid.",
      },
    };
  }
  const userResult = await requireReconciliationUser();
  if (!userResult.success) return userResult;

  try {
    const result = await db.transaction(async (tx) => {
      const [transaction] = await tx
        .select()
        .from(cashTransaction)
        .where(eq(cashTransaction.id, parsed.data.cashTransactionId))
        .for("update");
      if (!transaction) throw new Error("CASH_TRANSACTION_NOT_FOUND");
      if (transaction.reconciled) throw new Error("CASH_TRANSACTION_ALREADY_RECONCILED");

      const exceptionAt = new Date();
      await tx
        .update(cashTransaction)
        .set({
          reconciliationExceptionReason: parsed.data.reason,
          reconciliationExceptionAt: exceptionAt,
          reconciliationExceptionById: userResult.data.id,
          updatedAt: exceptionAt,
        })
        .where(eq(cashTransaction.id, transaction.id));
      await tx.insert(auditLog).values({
        userId: userResult.data.id,
        action: "MARK_RECONCILIATION_EXCEPTION",
        targetTable: "cash_transaction",
        targetId: transaction.id,
        originalState: JSON.stringify({
          reason: transaction.reconciliationExceptionReason,
          exceptionAt: transaction.reconciliationExceptionAt,
          exceptionById: transaction.reconciliationExceptionById,
        }),
        newState: JSON.stringify({
          reason: parsed.data.reason,
          exceptionAt,
          exceptionById: userResult.data.id,
        }),
      });
      return { cashTransactionId: transaction.id };
    });
    revalidatePath("/reconciliation");
    return { success: true, data: result };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "RECONCILIATION_EXCEPTION_FAILED";
    return {
      success: false,
      error: {
        code: reason === "CASH_TRANSACTION_NOT_FOUND" ? "NOT_FOUND" : "TRANSACTION_FAILED",
        message:
          reason === "CASH_TRANSACTION_NOT_FOUND"
            ? "Transaksi kas tidak ditemukan."
            : reason === "CASH_TRANSACTION_ALREADY_RECONCILED"
              ? "Transaksi yang sudah cocok tidak dapat dijadikan pengecualian."
              : "Gagal menyimpan pengecualian rekonsiliasi.",
      },
    };
  }
}

export async function clearReconciliationException(
  input: ClearReconciliationExceptionInput,
): Promise<ActionResponse<{ readonly cashTransactionId: string }>> {
  const parsed = clearReconciliationExceptionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Transaksi kas tidak valid." },
    };
  }
  const userResult = await requireReconciliationUser();
  if (!userResult.success) return userResult;

  try {
    const result = await db.transaction(async (tx) => {
      const [transaction] = await tx
        .select()
        .from(cashTransaction)
        .where(eq(cashTransaction.id, parsed.data.cashTransactionId))
        .for("update");
      if (!transaction) throw new Error("CASH_TRANSACTION_NOT_FOUND");
      if (transaction.reconciled) throw new Error("CASH_TRANSACTION_ALREADY_RECONCILED");
      if (!transaction.reconciliationExceptionAt) {
        return { cashTransactionId: transaction.id };
      }

      const clearedAt = new Date();
      await tx
        .update(cashTransaction)
        .set({
          reconciliationExceptionReason: null,
          reconciliationExceptionAt: null,
          reconciliationExceptionById: null,
          updatedAt: clearedAt,
        })
        .where(eq(cashTransaction.id, transaction.id));
      await tx.insert(auditLog).values({
        userId: userResult.data.id,
        action: "CLEAR_RECONCILIATION_EXCEPTION",
        targetTable: "cash_transaction",
        targetId: transaction.id,
        originalState: JSON.stringify({
          reason: transaction.reconciliationExceptionReason,
          exceptionAt: transaction.reconciliationExceptionAt,
          exceptionById: transaction.reconciliationExceptionById,
        }),
        newState: JSON.stringify({ clearedAt }),
      });
      return { cashTransactionId: transaction.id };
    });
    revalidatePath("/reconciliation");
    return { success: true, data: result };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "RECONCILIATION_EXCEPTION_FAILED";
    return {
      success: false,
      error: {
        code: reason === "CASH_TRANSACTION_NOT_FOUND" ? "NOT_FOUND" : "TRANSACTION_FAILED",
        message:
          reason === "CASH_TRANSACTION_NOT_FOUND"
            ? "Transaksi kas tidak ditemukan."
            : reason === "CASH_TRANSACTION_ALREADY_RECONCILED"
              ? "Transaksi sudah direkonsiliasi."
              : "Gagal menghapus pengecualian rekonsiliasi.",
      },
    };
  }
}
