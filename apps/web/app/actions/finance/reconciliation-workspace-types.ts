import type { CashDirection } from "@/lib/finance/cash-direction";

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
