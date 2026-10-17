import type { ActionResponse } from "@atria/core/types/action-response";
import {
  reconciliationDesktopInputSchema,
  reconciliationMatchContextInputSchema,
  type ReconciliationDesktopData,
  type ReconciliationDesktopInput,
  type ReconciliationDesktopRequest,
  type ReconciliationMatchContext,
  type ReconciliationMatchContextInput,
} from "@atria/core/finance/reconciliation-desktop";
import {
  RECONCILIATION_FIXTURE_REFERENCE,
  reconciliationFixtureCounts,
  reconciliationFixtureData,
  type ReconciliationFixtureScenario,
} from "./reconciliation-data.fixture";

let scenario: ReconciliationFixtureScenario = "complete";
const pendingWrites = new Set<() => void>();
export function setReconciliationFixtureScenario(next: ReconciliationFixtureScenario): void {
  for (const release of pendingWrites) release();
  pendingWrites.clear();
  scenario = next;
}
function failure(message: string): ActionResponse<never> {
  return { success: false, error: { code: "VALIDATION_ERROR", message } };
}
async function fixtureWrite(): Promise<ActionResponse<never>> {
  if (scenario === "pending") await new Promise<void>((resolve) => pendingWrites.add(resolve));
  return failure("Fixture visual: tindakan tidak menyimpan data atau menghubungi backend.");
}
export const recordBankStatementRow = fixtureWrite;
export const importBankStatementCsv = fixtureWrite;
export const importParsedBankStatementRows = fixtureWrite;
export const reconcileCashTransaction = fixtureWrite;
export const markReconciliationException = fixtureWrite;
export const clearReconciliationException = fixtureWrite;
export const analyzeBankStatement = fixtureWrite;

function page<Row>(
  rows: readonly Row[],
  input: ReconciliationDesktopInput,
  predicate: (row: Row) => boolean,
  sortValue: (row: Row) => string | number,
): { readonly rows: readonly Row[]; readonly total: number; readonly page: number } {
  const collator = new Intl.Collator("id-ID", { numeric: true, sensitivity: "base" });
  const filtered = rows.filter(predicate).map((row, index) => ({ row, index }));
  filtered.sort((a, b): number => {
    const av = sortValue(a.row),
      bv = sortValue(b.row);
    const result =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : collator.compare(String(av), String(bv));
    return (input.sortDirection === "descending" ? -result : result) || a.index - b.index;
  });
  const current = Math.min(input.page, Math.max(1, Math.ceil(filtered.length / input.pageSize)));
  return {
    rows: filtered
      .slice((current - 1) * input.pageSize, current * input.pageSize)
      .map(({ row }) => row),
    total: filtered.length,
    page: current,
  };
}
export async function readReconciliationDesktop(
  request: ReconciliationDesktopRequest,
): Promise<ActionResponse<ReconciliationDesktopData>> {
  if (scenario === "source-error")
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Fixture: daftar belum dapat dimuat. Coba lagi.",
      },
    };
  const parsed = reconciliationDesktopInputSchema.safeParse(request);
  if (!parsed.success) return failure("Fixture: filter tidak valid.");
  const input = parsed.data;
  const data = reconciliationFixtureData(scenario);
  const search = input.search.toLocaleLowerCase("id-ID");
  const common = {
    pageSize: input.pageSize,
    updatedAt: RECONCILIATION_FIXTURE_REFERENCE,
    counts: reconciliationFixtureCounts(scenario),
    bankAccounts: data.bankAccounts,
  };
  if (input.view === "cash")
    return {
      success: true,
      data: {
        ...common,
        view: "cash",
        ...page(
          data.cashTransactions,
          input,
          (row) =>
            (!input.accountId || row.bankAccountId === input.accountId) &&
            (input.direction === "all" || row.type === input.direction) &&
            (input.status === "all" ||
              (input.status === "exception"
                ? row.exceptionReason !== null
                : row.exceptionReason === null)) &&
            `${row.description} ${row.bankAccountName} ${row.source?.projectName ?? ""}`
              .toLocaleLowerCase("id-ID")
              .includes(search),
          (row) =>
            input.sort === "date"
              ? row.createdAt.getTime()
              : input.sort === "amount"
                ? row.amount
                : input.sort === "account"
                  ? row.bankAccountName
                  : input.sort === "status"
                    ? row.exceptionReason
                      ? "exception"
                      : "actionable"
                    : row.description,
        ),
      },
    };
  if (input.view === "statement")
    return {
      success: true,
      data: {
        ...common,
        view: "statement",
        ...page(
          data.statementRows,
          input,
          (row) =>
            (!input.accountId || row.bankAccountId === input.accountId) &&
            (input.direction === "all" || row.type === input.direction) &&
            (input.status === "all" ||
              (input.status === "candidate" ? row.candidateCount > 0 : row.candidateCount === 0)) &&
            `${row.description} ${row.bankAccountName}`.toLocaleLowerCase("id-ID").includes(search),
          (row) =>
            input.sort === "date"
              ? row.transactionDate.getTime()
              : input.sort === "amount"
                ? row.amount
                : input.sort === "account"
                  ? row.bankAccountName
                  : input.sort === "status"
                    ? row.candidateCount
                    : row.description,
        ),
      },
    };
  return {
    success: true,
    data: {
      ...common,
      view: "history",
      ...page(
        data.history,
        input,
        (row) =>
          (!input.accountId ||
            row.bankAccountName ===
              data.bankAccounts.find((account) => account.id === input.accountId)?.name) &&
          (input.direction === "all" || row.type === input.direction) &&
          `${row.cashDescription} ${row.statementDescription} ${row.bankAccountName} ${row.reconciledByName}`
            .toLocaleLowerCase("id-ID")
            .includes(search),
        (row) =>
          input.sort === "date"
            ? row.reconciledAt.getTime()
            : input.sort === "amount"
              ? row.amount
              : input.sort === "account"
                ? row.bankAccountName
                : input.sort === "status"
                  ? row.reconciledByName
                  : row.cashDescription,
      ),
    },
  };
}
export async function readReconciliationMatchContext(
  request: ReconciliationMatchContextInput,
): Promise<ActionResponse<ReconciliationMatchContext>> {
  const parsed = reconciliationMatchContextInputSchema.safeParse(request);
  if (!parsed.success) return failure("Fixture: pilih satu catatan kas atau mutasi bank.");
  const data = reconciliationFixtureData(scenario);
  const cash = data.cashTransactions.find((row) => row.id === parsed.data.cashTransactionId);
  const statement = data.statementRows.find((row) => row.id === parsed.data.statementRowId);
  const selected = cash ?? statement;
  if (!selected)
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Fixture: catatan tidak ditemukan." },
    };
  const same = (row: {
    readonly bankAccountId: string;
    readonly type: string;
    readonly amount: number;
  }): boolean =>
    row.bankAccountId === selected.bankAccountId &&
    row.type === selected.type &&
    row.amount === selected.amount;
  return {
    success: true,
    data: {
      cashTransactions: cash ? [cash] : data.cashTransactions.filter(same),
      statementRows: statement ? [statement] : data.statementRows.filter(same),
    },
  };
}
export const getReconciliationDesktopWorkspace = readReconciliationDesktop;
export const getReconciliationMatchContext = readReconciliationMatchContext;
export async function getReconciliationWorkspace(): Promise<
  ActionResponse<ReturnType<typeof reconciliationFixtureData>>
> {
  return { success: true, data: reconciliationFixtureData(scenario) };
}
