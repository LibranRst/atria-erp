"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLog,
  bankAccount,
  bankStatementImport,
  bankStatementRow,
  cashTransaction,
  projectCost,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertPermission } from "@/lib/auth/permissions";
import { parseBankStatementCsv } from "@/lib/finance/bank-statement-csv";
import { parseNumericToCents } from "@/lib/finance/balance-mutation";
import { normalizeCashDirection, type CashDirection } from "@/lib/finance/cash-direction";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  importBankStatementCsvSchema,
  recordBankStatementRowSchema,
  type ImportBankStatementCsvInput,
  type RecordBankStatementRowInput,
} from "@/lib/validations/finance";

export type ReconciliationCashTransaction = {
  readonly id: string;
  readonly bankAccountId: string;
  readonly bankAccountName: string;
  readonly type: CashDirection;
  readonly amount: number;
  readonly description: string;
  readonly source: {
    readonly label: "Pengeluaran Lapangan";
    readonly projectName: string;
    readonly description: string;
  } | null;
  readonly bankReference: string | null;
  readonly createdAt: Date;
  readonly ageDays: number;
  readonly exceptionReason: string | null;
  readonly exceptionAt: Date | null;
  readonly exceptionByName: string | null;
};

export type ReconciliationHistoryRow = {
  readonly id: string;
  readonly cashTransactionId: string;
  readonly bankAccountName: string;
  readonly type: CashDirection;
  readonly amount: number;
  readonly cashDescription: string;
  readonly statementDescription: string;
  readonly bankReference: string | null;
  readonly transactionDate: Date;
  readonly reconciledAt: Date;
  readonly reconciledByName: string;
  readonly importFileName: string;
};

export type ReconciliationStatementRow = {
  readonly id: string;
  readonly bankAccountId: string;
  readonly bankAccountName: string;
  readonly type: CashDirection;
  readonly amount: number;
  readonly description: string;
  readonly transactionDate: Date;
  readonly suggestedCashTransactionId: string | null;
  readonly candidateCount: number;
};

export type ReconciliationWorkspace = {
  readonly bankAccounts: readonly {
    readonly id: string;
    readonly name: string;
    readonly bankName: string;
  }[];
  readonly cashTransactions: readonly ReconciliationCashTransaction[];
  readonly statementRows: readonly ReconciliationStatementRow[];
  readonly history: readonly ReconciliationHistoryRow[];
  readonly historyTotal: number;
};

async function requireReconciliationUser(): Promise<ActionResponse<{ readonly id: string }>> {
  const session = await auth.api.getSession({ headers: { cookie: (await cookies()).toString() } });
  if (!session?.user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }
  try {
    await assertPermission(session.user, "reconcile:ledger");
    return { success: true, data: { id: session.user.id } };
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

function normalizeDescription(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

function createStatementFingerprint(input: {
  readonly bankAccountId: string;
  readonly transactionDate: Date;
  readonly type: CashDirection;
  readonly amount: string;
  readonly description: string;
}): string {
  return crypto
    .createHash("sha256")
    .update(
      `${input.bankAccountId}|${input.transactionDate.toISOString().slice(0, 10)}|${input.type}|${input.amount}|${normalizeDescription(input.description)}`,
    )
    .digest("hex");
}

function findSuggestedTransactionId(
  statement: {
    readonly bankAccountId: string;
    readonly type: CashDirection;
    readonly amount: string;
    readonly description: string;
  },
  transactions: readonly {
    readonly id: string;
    readonly bankAccountId: string;
    readonly type: string;
    readonly amount: string;
    readonly bankReference: string | null;
  }[],
): { readonly id: string | null; readonly candidateCount: number } {
  const candidates = transactions.filter(
    (transaction) =>
      transaction.bankAccountId === statement.bankAccountId &&
      normalizeCashDirection(transaction.type) === statement.type &&
      parseNumericToCents(transaction.amount) === parseNumericToCents(statement.amount),
  );
  if (candidates.length === 1) return { id: candidates[0]?.id ?? null, candidateCount: 1 };

  const normalizedDescription = normalizeDescription(statement.description);
  const referenceMatches = candidates.filter((candidate) => {
    const reference = candidate.bankReference?.trim().toLocaleLowerCase("id-ID");
    return Boolean(reference && normalizedDescription.includes(reference));
  });
  return {
    id: referenceMatches.length === 1 ? (referenceMatches[0]?.id ?? null) : null,
    candidateCount: candidates.length,
  };
}

export async function getReconciliationWorkspace(): Promise<
  ActionResponse<ReconciliationWorkspace>
> {
  const authResult = await requireReconciliationUser();
  if (!authResult.success) return authResult;
  try {
    const [accounts, transactions, statementRows, historyRows, historyCountRows] =
      await Promise.all([
        db.query.bankAccount.findMany({
          where: eq(bankAccount.isActive, true),
          orderBy: [asc(bankAccount.name)],
        }),
        db.query.cashTransaction.findMany({
          where: eq(cashTransaction.reconciled, false),
          with: { bankAccount: true, reconciliationExceptionBy: true },
          orderBy: [desc(cashTransaction.createdAt)],
          limit: 100,
        }),
        db.query.bankStatementRow.findMany({
          where: eq(bankStatementRow.isReconciled, false),
          with: { import: { with: { bankAccount: true } } },
          orderBy: [asc(bankStatementRow.transactionDate)],
          limit: 100,
        }),
        db.query.bankStatementRow.findMany({
          where: eq(bankStatementRow.isReconciled, true),
          with: {
            import: { with: { bankAccount: true } },
            matchedCashTransaction: { with: { reconciledBy: true } },
          },
          orderBy: [desc(bankStatementRow.createdAt)],
          limit: 500,
        }),
        db
          .select({ value: count() })
          .from(bankStatementRow)
          .where(eq(bankStatementRow.isReconciled, true)),
      ]);
    const projectCostReferenceIds = transactions.flatMap((transaction) =>
      transaction.referenceType === "project_cost" && transaction.referenceId
        ? [transaction.referenceId]
        : [],
    );
    const projectCostSources = projectCostReferenceIds.length
      ? await db.query.projectCost.findMany({
          where: inArray(projectCost.id, projectCostReferenceIds),
          with: { project: true },
        })
      : [];
    const projectCostSourceById = new Map(
      projectCostSources.map((cost) => [
        cost.id,
        {
          label: "Pengeluaran Lapangan" as const,
          projectName: cost.project.name,
          description: cost.description,
        },
      ]),
    );
    return {
      success: true,
      data: {
        bankAccounts: accounts.map((account) => ({
          id: account.id,
          name: account.name,
          bankName: account.bankName,
        })),
        cashTransactions: transactions.map((row) => ({
          id: row.id,
          bankAccountId: row.bankAccountId,
          bankAccountName: row.bankAccount.name,
          type: normalizeCashDirection(row.type),
          amount: Number(row.amount),
          description: row.description,
          source:
            row.referenceType === "project_cost" && row.referenceId
              ? (projectCostSourceById.get(row.referenceId) ?? null)
              : null,
          bankReference: row.bankReference,
          createdAt: row.createdAt,
          ageDays: Math.max(
            0,
            Math.floor((Date.now() - row.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
          ),
          exceptionReason: row.reconciliationExceptionReason,
          exceptionAt: row.reconciliationExceptionAt,
          exceptionByName: row.reconciliationExceptionBy?.name ?? null,
        })),
        statementRows: statementRows.map((row) => {
          const type = normalizeCashDirection(row.type);
          const suggestion = findSuggestedTransactionId(
            {
              bankAccountId: row.import.bankAccountId,
              type,
              amount: row.amount,
              description: row.description,
            },
            transactions,
          );
          return {
            id: row.id,
            bankAccountId: row.import.bankAccountId,
            bankAccountName: row.import.bankAccount.name,
            type,
            amount: Number(row.amount),
            description: row.description,
            transactionDate: row.transactionDate,
            suggestedCashTransactionId: suggestion.id,
            candidateCount: suggestion.candidateCount,
          };
        }),
        history: historyRows
          .flatMap((row) => {
            const transaction = row.matchedCashTransaction;
            if (!transaction?.reconciliationDate || !transaction.reconciledBy) return [];
            return [
              {
                id: row.id,
                cashTransactionId: transaction.id,
                bankAccountName: row.import.bankAccount.name,
                type: normalizeCashDirection(transaction.type),
                amount: Number(transaction.amount),
                cashDescription: transaction.description,
                statementDescription: row.description,
                bankReference: transaction.bankReference,
                transactionDate: row.transactionDate,
                reconciledAt: transaction.reconciliationDate,
                reconciledByName: transaction.reconciledBy.name,
                importFileName: row.import.fileName,
              },
            ];
          })
          .sort((left, right) => right.reconciledAt.getTime() - left.reconciledAt.getTime())
          .slice(0, 100),
        historyTotal: Number(historyCountRows[0]?.value ?? 0),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Gagal memuat rekonsiliasi.",
      },
    };
  }
}

export async function recordBankStatementRow(
  input: RecordBankStatementRowInput,
): Promise<ActionResponse<{ readonly statementRowId: string }>> {
  const parsed = recordBankStatementRowSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data mutasi bank tidak valid." },
    };
  }
  const authResult = await requireReconciliationUser();
  if (!authResult.success) return authResult;
  const value = parsed.data;
  const amount = value.amount.toFixed(2);
  const fingerprint = createStatementFingerprint({
    bankAccountId: value.bankAccountId,
    transactionDate: value.transactionDate,
    type: value.type,
    amount,
    description: value.description,
  });
  try {
    const result = await db.transaction(async (tx) => {
      const account = await tx.query.bankAccount.findFirst({
        where: and(eq(bankAccount.id, value.bankAccountId), eq(bankAccount.isActive, true)),
      });
      if (!account) throw new Error("BANK_ACCOUNT_NOT_FOUND");
      const duplicate = await tx.query.bankStatementRow.findFirst({
        where: eq(bankStatementRow.fingerprint, fingerprint),
      });
      if (duplicate) throw new Error("DUPLICATE_BANK_STATEMENT_ROW");
      const [statementImport] = await tx
        .insert(bankStatementImport)
        .values({
          bankAccountId: account.id,
          fileName: `Entri manual ${value.transactionDate.toLocaleDateString("id-ID")}`,
          fileUrl: "manual://reconciliation-entry",
          importedById: authResult.data.id,
          startDate: value.transactionDate,
          endDate: value.transactionDate,
        })
        .returning();
      if (!statementImport) throw new Error("BANK_STATEMENT_IMPORT_CREATE_FAILED");
      const [statementRow] = await tx
        .insert(bankStatementRow)
        .values({
          importId: statementImport.id,
          transactionDate: value.transactionDate,
          description: value.description.trim(),
          amount,
          type: value.type,
          fingerprint,
        })
        .returning();
      if (!statementRow) throw new Error("BANK_STATEMENT_ROW_CREATE_FAILED");
      await tx.insert(auditLog).values({
        userId: authResult.data.id,
        action: "RECORD_BANK_STATEMENT_ROW",
        targetTable: "bank_statement_row",
        targetId: statementRow.id,
        newState: JSON.stringify({
          bankAccountId: account.id,
          amount: statementRow.amount,
          type: statementRow.type,
        }),
      });
      return { statementRowId: statementRow.id };
    });
    return { success: true, data: result };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mencatat mutasi rekening koran.";
    return {
      success: false,
      error: {
        code: message === "BANK_ACCOUNT_NOT_FOUND" ? "NOT_FOUND" : "TRANSACTION_FAILED",
        message:
          message === "DUPLICATE_BANK_STATEMENT_ROW"
            ? "Mutasi rekening koran ini sudah tercatat."
            : message,
      },
    };
  }
}

export async function importBankStatementCsv(input: ImportBankStatementCsvInput): Promise<
  ActionResponse<{
    readonly importId: string | null;
    readonly importedCount: number;
    readonly duplicateCount: number;
  }>
> {
  const parsed = importBankStatementCsvSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "File rekening koran tidak valid." },
    };
  }
  const authResult = await requireReconciliationUser();
  if (!authResult.success) return authResult;

  let rows: ReturnType<typeof parseBankStatementCsv>;
  try {
    rows = parseBankStatementCsv(parsed.data.content);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message.replace(/^[A-Z_]+:\s*/, "")
        : "CSV tidak dapat dibaca.";
    return { success: false, error: { code: "VALIDATION_ERROR", message } };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const account = await tx.query.bankAccount.findFirst({
        where: and(eq(bankAccount.id, parsed.data.bankAccountId), eq(bankAccount.isActive, true)),
      });
      if (!account) throw new Error("BANK_ACCOUNT_NOT_FOUND");

      const preparedRows = rows.map((row) => ({
        ...row,
        fingerprint: createStatementFingerprint({
          bankAccountId: account.id,
          transactionDate: row.transactionDate,
          type: row.type,
          amount: row.amount,
          description: row.description,
        }),
      }));
      const fingerprints = [...new Set(preparedRows.map((row) => row.fingerprint))];
      const existing = fingerprints.length
        ? await tx
            .select({ fingerprint: bankStatementRow.fingerprint })
            .from(bankStatementRow)
            .where(inArray(bankStatementRow.fingerprint, fingerprints))
        : [];
      const seen = new Set(existing.flatMap((row) => (row.fingerprint ? [row.fingerprint] : [])));
      const uniqueRows = preparedRows.filter((row) => {
        if (seen.has(row.fingerprint)) return false;
        seen.add(row.fingerprint);
        return true;
      });
      const duplicateCount = preparedRows.length - uniqueRows.length;
      if (uniqueRows.length === 0) {
        return { importId: null, importedCount: 0, duplicateCount };
      }

      const dates = uniqueRows.map((row) => row.transactionDate.getTime());
      const [statementImport] = await tx
        .insert(bankStatementImport)
        .values({
          bankAccountId: account.id,
          fileName: parsed.data.fileName,
          fileUrl: `inline-csv://reconciliation/${encodeURIComponent(parsed.data.fileName)}`,
          importedById: authResult.data.id,
          startDate: new Date(Math.min(...dates)),
          endDate: new Date(Math.max(...dates)),
        })
        .returning();
      if (!statementImport) throw new Error("BANK_STATEMENT_IMPORT_CREATE_FAILED");

      await tx.insert(bankStatementRow).values(
        uniqueRows.map((row) => ({
          importId: statementImport.id,
          transactionDate: row.transactionDate,
          description: row.description,
          amount: row.amount,
          type: row.type,
          fingerprint: row.fingerprint,
        })),
      );
      await tx.insert(auditLog).values({
        userId: authResult.data.id,
        action: "IMPORT_BANK_STATEMENT",
        targetTable: "bank_statement_import",
        targetId: statementImport.id,
        newState: JSON.stringify({
          bankAccountId: account.id,
          fileName: parsed.data.fileName,
          importedCount: uniqueRows.length,
          duplicateCount,
        }),
      });
      return {
        importId: statementImport.id,
        importedCount: uniqueRows.length,
        duplicateCount,
      };
    });
    return { success: true, data: result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengimpor rekening koran.";
    return {
      success: false,
      error: {
        code: message === "BANK_ACCOUNT_NOT_FOUND" ? "NOT_FOUND" : "TRANSACTION_FAILED",
        message: message === "BANK_ACCOUNT_NOT_FOUND" ? "Rekening aktif tidak ditemukan." : message,
      },
    };
  }
}
