import { db } from "@backend/db";
import { requireReconciliationUser } from "./reconciliation-action-utils";
import {
  importStatementRowsTx,
  ReconciliationError,
} from "@backend/server/usecases/finance/reconciliation-writer";
import { parseBankStatementCsv } from "@atria/core/finance/bank-statement-csv";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  importBankStatementCsvSchema,
  importParsedBankStatementRowsSchema,
  recordBankStatementRowSchema,
  type ImportBankStatementCsvInput,
  type ImportParsedBankStatementRowsInput,
  type RecordBankStatementRowInput,
} from "@atria/core/validations/finance";
type ImportResult = {
  readonly importId: string | null;
  readonly importedCount: number;
  readonly duplicateCount: number;
};
function failure(error: unknown): ActionResponse<never> {
  return {
    success: false,
    error: {
      code: error instanceof ReconciliationError ? error.code : "TRANSACTION_FAILED",
      message:
        error instanceof ReconciliationError
          ? error.message
          : "Mutasi belum dapat diimpor. Periksa format dan coba lagi.",
    },
  };
}
export async function recordBankStatementRow(
  input: RecordBankStatementRowInput,
): Promise<ActionResponse<{ readonly statementRowId: string }>> {
  const parsed = recordBankStatementRowSchema.safeParse(input),
    user = await requireReconciliationUser();
  if (!user.success) return user;
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data mutasi bank tidak valid." },
    };
  try {
    const result = await db.transaction(async (tx) => {
      const result = await importStatementRowsTx(tx, user.data.id, {
        bankAccountId: parsed.data.bankAccountId,
        fileName: `Entri manual ${parsed.data.transactionDate.toLocaleDateString("id-ID")}`,
        fileUrl: "manual://reconciliation-entry",
        rows: [parsed.data],
      });
      if (!result.rowIds[0])
        throw new ReconciliationError("CONFLICT", "Mutasi rekening koran ini sudah tercatat.");
      return { statementRowId: result.rowIds[0] };
    });
    return { success: true, data: result };
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function importBankStatementCsv(
  input: ImportBankStatementCsvInput,
): Promise<ActionResponse<ImportResult>> {
  const parsed = importBankStatementCsvSchema.safeParse(input),
    user = await requireReconciliationUser();
  if (!user.success) return user;
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "File rekening koran tidak valid." },
    };
  try {
    const rows = parseBankStatementCsv(parsed.data.content).map((r) => ({
      ...r,
      amount: Number(r.amount),
    }));
    const data = await db.transaction((tx) =>
      importStatementRowsTx(tx, user.data.id, {
        ...parsed.data,
        fileUrl: `inline-csv://reconciliation/${encodeURIComponent(parsed.data.fileName)}`,
        rows,
      }),
    );
    return { success: true, data };
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith("CSV_"))
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: error.message.replace(/^[A-Z_]+:\s*/, "") },
      };
    return failure(error);
  }
}
export async function importParsedBankStatementRows(
  input: ImportParsedBankStatementRowsInput,
): Promise<ActionResponse<ImportResult>> {
  const parsed = importParsedBankStatementRowsSchema.safeParse(input),
    user = await requireReconciliationUser();
  if (!user.success) return user;
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Daftar mutasi rekening koran tidak valid." },
    };
  try {
    const data = await db.transaction((tx) => importStatementRowsTx(tx, user.data.id, parsed.data));
    return { success: true, data };
  } catch (error: unknown) {
    return failure(error);
  }
}
