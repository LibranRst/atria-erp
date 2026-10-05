import type { ExpenseCategoryCode } from "@atria/core/budget/excel-budget";

export type {
  FinanceDashboardRecentTransaction,
  FinanceDashboardCashDueItem,
  FinanceDashboardCashDueGroup,
  FinanceDashboardMaterialIssue,
  FinanceDashboardBankAccount,
  FinanceDashboardTabDetails,
  FinanceDashboardOverview,
} from "@atria/core/finance/dashboard-contracts";

export function toCategoryCode(value: string): ExpenseCategoryCode {
  switch (value) {
    case "MATERIAL":
    case "TUKANG":
    case "OPERASIONAL":
    case "LAIN_LAIN":
    case "SUBCON":
      return value;
    default:
      throw new Error(`Kategori expense tidak dikenal: ${value}`);
  }
}

export function outstandingAmount(amount: number, paidAmount: number, status: string): number {
  if (status === "PAID" || status === "VOID") return 0;
  return Math.max(0, amount - paidAmount);
}

export function isLowStockThresholdBreached(availableStock: number, minimumStock: number): boolean {
  return minimumStock > 0 && availableStock <= minimumStock;
}
