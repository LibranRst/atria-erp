import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";

export type BankAccount = FinanceDashboardOverview["bankAccounts"][number];
export type CashTransaction = BankAccount["recentTransactions"][number];

export type SheetMode = "detail" | "create" | "edit" | "movement" | "transfer";
export type MovementType = "DEBIT" | "CREDIT";
export type TextTone = "light" | "dark";

export type CashMovementCategory =
  | "owner_capital"
  | "bank_fee"
  | "correction"
  | "cash_adjustment"
  | "other";

export type AccountDraft = {
  readonly id: string | null;
  readonly name: string;
  readonly accountNumber: string;
  readonly bankName: string;
  readonly holderName: string;
  readonly openingBalance: string;
  readonly cardColorFrom: string;
  readonly cardColorTo: string;
  readonly cardTextColor: TextTone;
  readonly isActive: boolean;
};

export type MovementDraft = {
  readonly type: MovementType;
  readonly amount: string;
  readonly category: CashMovementCategory;
  readonly description: string;
  readonly transactionDate: string;
  readonly referenceNumber: string;
};

export type TransferDraft = {
  readonly toBankAccountId: string;
  readonly amount: string;
  readonly description: string;
  readonly transactionDate: string;
  readonly referenceNumber: string;
};
