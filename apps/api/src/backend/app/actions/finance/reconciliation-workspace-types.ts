import type {
  ReconciliationCashTransaction,
  ReconciliationHistoryRow,
  ReconciliationStatementRow,
} from "@atria/core/finance/reconciliation-desktop";

export type {
  ReconciliationCashTransaction,
  ReconciliationHistoryRow,
  ReconciliationStatementRow,
} from "@atria/core/finance/reconciliation-desktop";

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
