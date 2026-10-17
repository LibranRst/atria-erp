import { and, count, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@backend/db";
import {
  bankAccount,
  bankStatementImport,
  bankStatementRow,
  cashTransaction,
  projectCost,
} from "@backend/db/schema";
import { INSTANCE_TENANT_ID } from "@backend/db/schema/tenant-constants";
import { actorCan } from "@backend/lib/auth/permissions";
import { findSuggestedTransactionId } from "@backend/app/actions/finance/reconciliation-action-utils";
import { parseNumericToCents } from "@backend/lib/finance/balance-mutation";
import type { Actor } from "@backend/server/actor";
import { normalizeCashDirection } from "@atria/core/finance/cash-direction";
import {
  reconciliationDesktopInputSchema,
  reconciliationMatchContextInputSchema,
  type ReconciliationDesktopRequest,
  type ReconciliationDesktopInput,
  type ReconciliationDesktopData,
  type ReconciliationDesktopCounts,
  type ReconciliationDesktopBankAccount,
  type ReconciliationCashTransaction,
  type ReconciliationStatementRow,
  type ReconciliationHistoryRow,
  type ReconciliationMatchContext,
  type ReconciliationMatchContextInput,
} from "@atria/core/finance/reconciliation-desktop";
import type { ActionResponse } from "@atria/core/types/action-response";

function allowed(actor: Actor): boolean {
  return actor.isActive && actor.dataScope === "GLOBAL" && actorCan(actor, "reconcile:ledger");
}
function forbidden(): ActionResponse<never> {
  return {
    success: false,
    error: {
      code: "FORBIDDEN",
      message: "Rekonsiliasi memerlukan izin buku kas dan akses data global.",
    },
  };
}
function unavailable(): ActionResponse<never> {
  return {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Data rekonsiliasi belum dapat dimuat. Coba lagi.",
    },
  };
}

type ReconciliationDesktopSource = {
  readonly cash: readonly ReconciliationCashTransaction[];
  readonly statement: readonly ReconciliationStatementRow[];
  readonly history: readonly (ReconciliationHistoryRow & { readonly bankAccountId: string })[];
  readonly updatedAt: Date;
  readonly counts: ReconciliationDesktopCounts;
  readonly bankAccounts: readonly ReconciliationDesktopBankAccount[];
};
/** Complete server-only source. Only a filtered page (or exact match context) crosses HTTP. */
async function readSource(includeHistory: boolean): Promise<ReconciliationDesktopSource> {
  const accounts = await db.query.bankAccount.findMany({
    where: eq(bankAccount.tenantId, INSTANCE_TENANT_ID),
  });
  const accountIds = accounts.map((account) => account.id);
  const imports = accountIds.length
    ? await db.query.bankStatementImport.findMany({
        where: and(
          eq(bankStatementImport.tenantId, INSTANCE_TENANT_ID),
          inArray(bankStatementImport.bankAccountId, accountIds),
        ),
        columns: { id: true },
      })
    : [];
  const importIds = imports.map((entry) => entry.id);
  const [cashRows, statements, historyRows, historyCount] = await Promise.all([
    accountIds.length
      ? db.query.cashTransaction.findMany({
          where: and(
            eq(cashTransaction.tenantId, INSTANCE_TENANT_ID),
            eq(cashTransaction.reconciled, false),
            inArray(cashTransaction.bankAccountId, accountIds),
          ),
          with: { bankAccount: true, reconciliationExceptionBy: true },
        })
      : Promise.resolve([]),
    importIds.length
      ? db.query.bankStatementRow.findMany({
          where: and(
            eq(bankStatementRow.tenantId, INSTANCE_TENANT_ID),
            eq(bankStatementRow.isReconciled, false),
            inArray(bankStatementRow.importId, importIds),
          ),
          with: { import: { with: { bankAccount: true } } },
        })
      : Promise.resolve([]),
    includeHistory && importIds.length
      ? db.query.bankStatementRow.findMany({
          where: and(
            eq(bankStatementRow.tenantId, INSTANCE_TENANT_ID),
            eq(bankStatementRow.isReconciled, true),
            inArray(bankStatementRow.importId, importIds),
          ),
          with: {
            import: { with: { bankAccount: true } },
            matchedCashTransaction: { with: { reconciledBy: true } },
          },
        })
      : Promise.resolve([]),
    db
      .select({ value: count() })
      .from(bankStatementRow)
      .innerJoin(bankStatementImport, eq(bankStatementImport.id, bankStatementRow.importId))
      .innerJoin(bankAccount, eq(bankAccount.id, bankStatementImport.bankAccountId))
      .innerJoin(cashTransaction, eq(cashTransaction.id, bankStatementRow.matchedCashTransactionId))
      .where(
        and(
          eq(bankStatementRow.tenantId, INSTANCE_TENANT_ID),
          eq(bankStatementImport.tenantId, INSTANCE_TENANT_ID),
          eq(bankAccount.tenantId, INSTANCE_TENANT_ID),
          eq(cashTransaction.tenantId, INSTANCE_TENANT_ID),
          eq(bankStatementRow.isReconciled, true),
          eq(cashTransaction.reconciled, true),
          isNotNull(cashTransaction.reconciliationDate),
          isNotNull(cashTransaction.reconciledById),
        ),
      ),
  ]);
  const costIds = cashRows.flatMap((row) =>
    row.referenceType === "project_cost" && row.referenceId ? [row.referenceId] : [],
  );
  const costs = costIds.length
    ? await db.query.projectCost.findMany({
        where: and(eq(projectCost.tenantId, INSTANCE_TENANT_ID), inArray(projectCost.id, costIds)),
        with: { project: true },
      })
    : [];
  const sourceById = new Map(
    costs
      .filter((cost) => cost.project.tenantId === INSTANCE_TENANT_ID)
      .map((cost) => [
        cost.id,
        {
          label: "Pengeluaran Lapangan" as const,
          projectName: cost.project.name,
          description: cost.description,
        },
      ]),
  );
  const updatedAt = new Date();
  const cash: ReconciliationCashTransaction[] = cashRows.map((row) => ({
    id: row.id,
    bankAccountId: row.bankAccountId,
    bankAccountName: row.bankAccount.name,
    type: normalizeCashDirection(row.type),
    amount: Number(row.amount),
    description: row.description,
    source:
      row.referenceType === "project_cost" && row.referenceId
        ? (sourceById.get(row.referenceId) ?? null)
        : null,
    bankReference: row.bankReference,
    createdAt: row.createdAt,
    ageDays: Math.max(0, Math.floor((updatedAt.getTime() - row.createdAt.getTime()) / 86_400_000)),
    exceptionReason: row.reconciliationExceptionReason,
    exceptionAt: row.reconciliationExceptionAt,
    exceptionByName: row.reconciliationExceptionBy?.name ?? null,
  }));
  const statement: ReconciliationStatementRow[] = statements.map((row) => {
    const type = normalizeCashDirection(row.type);
    const suggestion = findSuggestedTransactionId(
      {
        bankAccountId: row.import.bankAccountId,
        type,
        amount: row.amount,
        description: row.description,
      },
      cashRows,
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
  });
  const history: (ReconciliationHistoryRow & { readonly bankAccountId: string })[] =
    historyRows.flatMap((row) => {
      const transaction = row.matchedCashTransaction;
      if (
        !transaction?.reconciled ||
        !transaction.reconciliationDate ||
        !transaction.reconciledBy ||
        transaction.tenantId !== INSTANCE_TENANT_ID
      )
        return [];
      return [
        {
          id: row.id,
          cashTransactionId: transaction.id,
          bankAccountId: row.import.bankAccountId,
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
    });
  const exceptions = cash.filter((row) => row.exceptionAt !== null).length;
  return {
    cash,
    statement,
    history,
    updatedAt,
    counts: {
      cash: cash.length,
      statement: statement.length,
      history: includeHistory ? history.length : Number(historyCount[0]?.value ?? 0),
      exceptions,
      actionRequired: cash.length - exceptions,
    },
    bankAccounts: accounts
      .filter((account) => account.isActive)
      .sort((a, b) => a.name.localeCompare(b.name, "id-ID"))
      .map(({ id, name, bankName }) => ({ id, name, bankName })),
  };
}

function pageRows<
  Row extends {
    readonly id: string;
    readonly bankAccountId: string;
    readonly bankAccountName: string;
    readonly type: string;
    readonly amount: number;
  },
>(
  rows: readonly Row[],
  input: ReconciliationDesktopInput,
  text: (row: Row) => string,
  date: (row: Row) => Date,
  status: (row: Row) => string,
): { readonly rows: readonly Row[]; readonly total: number; readonly page: number } {
  const search = input.search.toLocaleLowerCase("id-ID");
  const matching = rows.filter(
    (row) =>
      (!input.accountId || row.bankAccountId === input.accountId) &&
      (input.direction === "all" || row.type === input.direction) &&
      (input.status === "all" || status(row) === input.status) &&
      text(row).toLocaleLowerCase("id-ID").includes(search),
  );
  const collator = new Intl.Collator("id-ID", { numeric: true, sensitivity: "base" });
  const sortValue = (row: Row): number | string =>
    input.sort === "amount"
      ? row.amount
      : input.sort === "account"
        ? row.bankAccountName
        : input.sort === "description"
          ? text(row)
          : input.sort === "status"
            ? status(row)
            : date(row).getTime();
  matching.sort((a, b) => {
    const av = sortValue(a),
      bv = sortValue(b);
    const comparison =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : collator.compare(String(av), String(bv));
    return comparison * (input.sortDirection === "ascending" ? 1 : -1) || a.id.localeCompare(b.id);
  });
  const page = Math.min(input.page, Math.max(1, Math.ceil(matching.length / input.pageSize)));
  return {
    rows: matching.slice((page - 1) * input.pageSize, page * input.pageSize),
    total: matching.length,
    page,
  };
}

export async function getReconciliationDesktopWorkspaceUseCase(
  actor: Actor,
  raw: ReconciliationDesktopRequest,
): Promise<ActionResponse<ReconciliationDesktopData>> {
  if (!allowed(actor)) return forbidden();
  const parsed = reconciliationDesktopInputSchema.safeParse(raw);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Filter rekonsiliasi tidak valid." },
    };
  try {
    const input = parsed.data,
      source = await readSource(input.view === "history");
    const base = {
      counts: source.counts,
      bankAccounts: source.bankAccounts,
      updatedAt: source.updatedAt,
      pageSize: input.pageSize,
    };
    if (input.view === "cash")
      return {
        success: true,
        data: {
          ...base,
          view: "cash",
          ...pageRows(
            source.cash,
            input,
            (row) =>
              `${row.description} ${row.bankAccountName} ${row.bankReference ?? ""} ${row.source?.projectName ?? ""}`,
            (row) => row.createdAt,
            (row) => (row.exceptionAt ? "exception" : "actionable"),
          ),
        },
      };
    if (input.view === "statement")
      return {
        success: true,
        data: {
          ...base,
          view: "statement",
          ...pageRows(
            source.statement,
            input,
            (row) => `${row.description} ${row.bankAccountName}`,
            (row) => row.transactionDate,
            (row) => (row.candidateCount > 0 ? "candidate" : "unmatched"),
          ),
        },
      };
    return {
      success: true,
      data: {
        ...base,
        view: "history",
        ...pageRows(
          source.history,
          input,
          (row) =>
            `${row.cashDescription} ${row.statementDescription} ${row.bankAccountName} ${row.bankReference ?? ""} ${row.reconciledByName}`,
          (row) => row.reconciledAt,
          () => "all",
        ),
      },
    };
  } catch {
    return unavailable();
  }
}

export async function getReconciliationMatchContextUseCase(
  actor: Actor,
  raw: ReconciliationMatchContextInput,
): Promise<ActionResponse<ReconciliationMatchContext>> {
  if (!allowed(actor)) return forbidden();
  const parsed = reconciliationMatchContextInputSchema.safeParse(raw);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas pasangan rekonsiliasi tidak valid." },
    };
  try {
    const source = await readSource(false);
    const cash = source.cash.find((row) => row.id === parsed.data.cashTransactionId);
    const statement = source.statement.find((row) => row.id === parsed.data.statementRowId);
    if (!cash && !statement)
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Catatan sudah berubah atau tidak ditemukan. Segarkan daftar.",
        },
      };
    const chosen = cash ?? statement;
    if (!chosen) return unavailable();
    const matches = (row: ReconciliationCashTransaction | ReconciliationStatementRow): boolean =>
      row.bankAccountId === chosen.bankAccountId &&
      row.type === chosen.type &&
      parseNumericToCents(row.amount.toFixed(2)) === parseNumericToCents(chosen.amount.toFixed(2));
    return {
      success: true,
      data: {
        cashTransactions: source.cash.filter(matches),
        statementRows: source.statement.filter(matches),
      },
    };
  } catch {
    return unavailable();
  }
}
