import type { ExpenseCategoryCode } from "@atria/core/budget/excel-budget";
import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import type { ApprovalQueueSummary } from "@atria/core/finance/approval-summary";
import type {
  DashboardRole,
  DashboardDueBucket,
  FinanceDashboardAction,
  FinanceDashboardCategory,
  FinanceDashboardRiskyProject,
} from "@atria/core/finance/dashboard-overview";

export type FinanceDashboardRecentTransaction = {
  readonly id: string;
  readonly bankAccountId: string;
  readonly type: string;
  readonly category: string;
  readonly description: string;
  readonly amount: number;
  readonly reconciled: boolean;
  readonly createdAt: Date;
};

export type FinanceDashboardCashDueItem = {
  readonly id: string;
  readonly type: "payable" | "receivable";
  readonly amount: number;
  readonly paidAmount: number;
  readonly outstandingAmount: number;
  readonly dueDate: Date;
  readonly projectName: string;
  readonly counterpartyName: string;
  readonly documentNumber: string;
  readonly status: string;
  readonly bucket: DashboardDueBucket;
  readonly dayOffset: number;
  readonly href: string;
};

export type FinanceDashboardCashDueGroup = {
  readonly bucket: DashboardDueBucket;
  readonly label: string;
  readonly count: number;
  readonly totalOutstanding: number;
  readonly items: readonly FinanceDashboardCashDueItem[];
};

export type FinanceDashboardMaterialIssue = {
  readonly id: string;
  readonly type: "RAP_SHORTAGE" | "LOW_STOCK" | "REVERSAL_REQUEST" | "WASTE" | "ADJUSTMENT";
  readonly severity: "CRITICAL" | "WARNING" | "INFO";
  readonly materialName: string;
  readonly projectName: string | null;
  readonly locationName: string | null;
  readonly availableStock: number;
  readonly requiredStock: number | null;
  readonly minimumStock: number | null;
  readonly quantity: number | null;
  readonly createdAt: Date | null;
  readonly unit: string;
  readonly description: string;
  readonly href: string;
};

export type FinanceDashboardBankAccount = {
  readonly id: string;
  readonly name: string;
  readonly bankName: string;
  readonly accountNumber: string;
  readonly holderName: string;
  readonly balance: number;
  readonly cardColorFrom: string;
  readonly cardColorTo: string;
  readonly cardTextColor: "light" | "dark";
  readonly isActive: boolean;
  readonly recentTransactions: readonly FinanceDashboardRecentTransaction[];
};

export type FinanceDashboardTabDetails = {
  readonly approvals: readonly ApprovalDetail[];
  readonly approvalSummary: ApprovalQueueSummary;
  readonly cashDue: readonly FinanceDashboardCashDueItem[];
  readonly cashDueGroups: readonly FinanceDashboardCashDueGroup[];
  readonly budgetRisks: readonly FinanceDashboardRiskyProject[];
  readonly materials: readonly FinanceDashboardMaterialIssue[];
};

export type FinanceDashboardOverview = {
  readonly role: DashboardRole;
  readonly generatedAt: Date;
  readonly dataQuality: {
    readonly partial: boolean;
    readonly unavailableSources: readonly string[];
  };
  readonly summary: {
    readonly cashAvailable: number;
    readonly receivablesOutstanding: number;
    readonly payablesOutstanding: number;
    readonly payablesDueSoon: number;
    readonly projectValue: number;
    readonly internalBudget: number;
    readonly actualCost: number;
    readonly remainingBudget: number;
    readonly usedPercentage: number;
    readonly projectedMarginAmount: number;
    readonly projectedMarginPercentage: number;
  };
  readonly bankAccounts: readonly FinanceDashboardBankAccount[];
  readonly actions: readonly FinanceDashboardAction[];
  readonly categories: readonly FinanceDashboardCategory[];
  readonly riskyProjects: readonly FinanceDashboardRiskyProject[];
  readonly dashboardTabs: {
    readonly counts: {
      readonly approvals: number;
      readonly budget: number;
      readonly cash: number;
      readonly accounts: number;
      readonly materials: number;
    };
    readonly defaultTab: "overview" | "approvals" | "budget" | "cash" | "accounts" | "materials";
    readonly detailLimit: number;
  };
  readonly dashboardDetails: FinanceDashboardTabDetails;
  readonly stockIssues: {
    readonly materialShortageCount: number;
    readonly lowStockCount: number;
    readonly totalStockValue: number;
    readonly reusableStockValue: number;
  };
  readonly recentTransactions: readonly FinanceDashboardRecentTransaction[];
};

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
