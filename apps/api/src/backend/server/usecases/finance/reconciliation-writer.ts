import { and, eq, inArray } from "drizzle-orm";
import {
  auditLog,
  bankAccount,
  bankStatementImport,
  bankStatementRow,
  cashTransaction,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import type { FinanceTransaction } from "./mutation-access";
import { createStatementFingerprint } from "@backend/app/actions/finance/reconciliation-action-utils";
import { normalizeCashDirection } from "@atria/core/finance/cash-direction";
import { bankMoneySchema } from "@atria/core/ai/bank-cash";
import { parseNumericToCents } from "@atria/core/finance/money-minor";

export class ReconciliationError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
  }
}
export async function lockReconciliationAccount(
  tx: FinanceTransaction,
  id: string,
): Promise<typeof bankAccount.$inferSelect> {
  const [account] = await tx
    .select()
    .from(bankAccount)
    .where(and(eq(bankAccount.id, id), eq(bankAccount.tenantId, INSTANCE_TENANT_ID)))
    .for("update");
  if (!account)
    throw new ReconciliationError("NOT_FOUND", "Rekening tidak ditemukan atau di luar akses Anda.");
  if (!account.isActive)
    throw new ReconciliationError(
      "CONFLICT",
      "Rekening nonaktif. Aktifkan atau pilih rekening lain.",
    );
  return account;
}
export type StatementWriteRow = {
  readonly transactionDate: Date;
  readonly description: string;
  readonly amount: number;
  readonly type: "INFLOW" | "OUTFLOW";
};
export async function importStatementRowsTx(
  tx: FinanceTransaction,
  userId: string,
  input: {
    readonly bankAccountId: string;
    readonly fileName: string;
    readonly fileUrl?: string | null;
    readonly rows: readonly StatementWriteRow[];
  },
): Promise<{
  importId: string | null;
  importedCount: number;
  duplicateCount: number;
  rowIds: string[];
}> {
  const account = await lockReconciliationAccount(tx, input.bankAccountId);
  if (!input.rows.length || input.rows.length > 500)
    throw new ReconciliationError("VALIDATION_ERROR", "Impor harus berisi 1–500 mutasi.");
  const prepared = input.rows.map((row) => {
    bankMoneySchema.refine((n) => n > 0).parse(row.amount);
    if (!Number.isFinite(row.transactionDate.getTime()))
      throw new ReconciliationError("VALIDATION_ERROR", "Tanggal mutasi tidak valid.");
    return {
      ...row,
      description: row.description.trim(),
      amount: row.amount.toFixed(2),
      fingerprint: createStatementFingerprint({
        ...row,
        bankAccountId: account.id,
        amount: row.amount.toFixed(2),
      }),
    };
  });
  const existing = await tx
    .select({ fingerprint: bankStatementRow.fingerprint })
    .from(bankStatementRow)
    .where(
      and(
        eq(bankStatementRow.tenantId, INSTANCE_TENANT_ID),
        inArray(
          bankStatementRow.fingerprint,
          prepared.map((r) => r.fingerprint),
        ),
      ),
    );
  const seen = new Set(existing.map((r) => r.fingerprint));
  const unique = prepared.filter((r) => {
    if (seen.has(r.fingerprint)) return false;
    seen.add(r.fingerprint);
    return true;
  });
  if (!unique.length)
    return { importId: null, importedCount: 0, duplicateCount: prepared.length, rowIds: [] };
  const dates = unique.map((r) => r.transactionDate.getTime());
  const [header] = await tx
    .insert(bankStatementImport)
    .values({
      bankAccountId: account.id,
      fileName: input.fileName,
      fileUrl: input.fileUrl ?? "ai-chat://reconciliation",
      importedById: userId,
      startDate: new Date(Math.min(...dates)),
      endDate: new Date(Math.max(...dates)),
    })
    .returning();
  if (!header) throw new Error("Impor mutasi belum dapat dibuat.");
  const saved = await tx
    .insert(bankStatementRow)
    .values(unique.map((r) => ({ ...r, importId: header.id })))
    .returning({ id: bankStatementRow.id });
  const result = {
    importId: header.id,
    importedCount: saved.length,
    duplicateCount: prepared.length - saved.length,
    rowIds: saved.map((r) => r.id),
  };
  await tx.insert(auditLog).values({
    userId,
    action: "IMPORT_BANK_STATEMENT",
    targetTable: "bank_statement_import",
    targetId: header.id,
    newState: JSON.stringify({
      bankAccountId: account.id,
      fileName: input.fileName,
      importedCount: result.importedCount,
      duplicateCount: result.duplicateCount,
    }),
  });
  return result;
}
export async function reconcilePairTx(
  tx: FinanceTransaction,
  userId: string,
  input: { readonly cashTransactionId: string; readonly bankStatementRowId: string },
): Promise<{ cashTransactionId: string }> {
  const cashRead = await tx.query.cashTransaction.findFirst({
    where: and(
      eq(cashTransaction.id, input.cashTransactionId),
      eq(cashTransaction.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  if (!cashRead) throw new ReconciliationError("NOT_FOUND", "Catatan kas tidak ditemukan.");
  await lockReconciliationAccount(tx, cashRead.bankAccountId);
  const [cash] = await tx
    .select()
    .from(cashTransaction)
    .where(
      and(eq(cashTransaction.id, cashRead.id), eq(cashTransaction.tenantId, INSTANCE_TENANT_ID)),
    )
    .for("update");
  const [statement] = await tx
    .select({ row: bankStatementRow, import: bankStatementImport })
    .from(bankStatementRow)
    .innerJoin(bankStatementImport, eq(bankStatementRow.importId, bankStatementImport.id))
    .where(
      and(
        eq(bankStatementRow.id, input.bankStatementRowId),
        eq(bankStatementRow.tenantId, INSTANCE_TENANT_ID),
        eq(bankStatementImport.tenantId, INSTANCE_TENANT_ID),
      ),
    )
    .for("update");
  if (!cash || !statement)
    throw new ReconciliationError("NOT_FOUND", "Catatan kas atau mutasi tidak ditemukan.");
  if (cash.reconciled || statement.row.isReconciled || statement.row.matchedCashTransactionId)
    throw new ReconciliationError(
      "CONFLICT",
      "Salah satu transaksi sudah direkonsiliasi. Periksa sumber terbaru.",
    );
  if (
    cash.bankAccountId !== statement.import.bankAccountId ||
    normalizeCashDirection(cash.type) !== normalizeCashDirection(statement.row.type) ||
    parseNumericToCents(cash.amount) !== parseNumericToCents(statement.row.amount)
  )
    throw new ReconciliationError(
      "VALIDATION_ERROR",
      "Rekening, arah dana dan nominal pasangan harus sama persis.",
    );
  await tx
    .update(cashTransaction)
    .set({
      reconciled: true,
      reconciliationDate: new Date(),
      reconciledById: userId,
      reconciliationExceptionReason: null,
      reconciliationExceptionAt: null,
      reconciliationExceptionById: null,
    })
    .where(eq(cashTransaction.id, cash.id));
  await tx
    .update(bankStatementRow)
    .set({ isReconciled: true, matchedCashTransactionId: cash.id })
    .where(eq(bankStatementRow.id, statement.row.id));
  await tx.insert(auditLog).values({
    userId,
    action: "RECONCILE_CASH_TRANSACTION",
    targetTable: "cash_transaction",
    targetId: cash.id,
    originalState: JSON.stringify({
      reconciled: false,
      exception: cash.reconciliationExceptionReason,
    }),
    newState: JSON.stringify({ reconciled: true, bankStatementRowId: statement.row.id }),
  });
  return { cashTransactionId: cash.id };
}
export async function setReconciliationExceptionTx(
  tx: FinanceTransaction,
  userId: string,
  input: { readonly cashTransactionId: string; readonly reason: string | null },
): Promise<{ cashTransactionId: string }> {
  const row = await tx.query.cashTransaction.findFirst({
    where: and(
      eq(cashTransaction.id, input.cashTransactionId),
      eq(cashTransaction.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  if (!row) throw new ReconciliationError("NOT_FOUND", "Catatan kas tidak ditemukan.");
  await lockReconciliationAccount(tx, row.bankAccountId);
  const [cash] = await tx
    .select()
    .from(cashTransaction)
    .where(eq(cashTransaction.id, row.id))
    .for("update");
  if (!cash || cash.reconciled)
    throw new ReconciliationError(
      "CONFLICT",
      "Transaksi yang sudah cocok tidak dapat diberi atau dihapus pengecualiannya.",
    );
  if (input.reason === null && !cash.reconciliationExceptionAt)
    return { cashTransactionId: cash.id };
  const now = new Date();
  await tx
    .update(cashTransaction)
    .set({
      reconciliationExceptionReason: input.reason,
      reconciliationExceptionAt: input.reason ? now : null,
      reconciliationExceptionById: input.reason ? userId : null,
      updatedAt: now,
    })
    .where(eq(cashTransaction.id, cash.id));
  await tx.insert(auditLog).values({
    userId,
    action: input.reason ? "MARK_RECONCILIATION_EXCEPTION" : "CLEAR_RECONCILIATION_EXCEPTION",
    targetTable: "cash_transaction",
    targetId: cash.id,
    originalState: JSON.stringify({ reason: cash.reconciliationExceptionReason }),
    newState: JSON.stringify({ reason: input.reason, at: now }),
  });
  return { cashTransactionId: cash.id };
}
