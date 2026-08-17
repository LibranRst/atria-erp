"use server";

import { and, eq, inArray } from "drizzle-orm";

import {
  createStatementFingerprint,
  requireReconciliationUser,
} from "@/app/actions/finance/reconciliation-action-utils";
import { db } from "@/db";
import { auditLog, bankAccount, bankStatementImport, bankStatementRow } from "@/db/schema";
import { parseBankStatementCsv } from "@/lib/finance/bank-statement-csv";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  importBankStatementCsvSchema,
  recordBankStatementRowSchema,
  type ImportBankStatementCsvInput,
  type RecordBankStatementRowInput,
} from "@/lib/validations/finance";

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
