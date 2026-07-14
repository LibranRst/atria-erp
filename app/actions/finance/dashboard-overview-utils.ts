import type { ExpenseCategoryCode } from "@/lib/budget/excel-budget";
import type { ApprovalDetail } from "@/lib/finance/approval-types";
import type {
  DashboardRole,
  FinanceDashboardAction,
  FinanceDashboardCategory,
  FinanceDashboardRiskyProject,
} from "@/lib/finance/dashboard-overview";

export type FinanceDashboardRecentTransaction = {
  readonly id: string;
  readonly bankAccountId: string;
  readonly type: string;
  readonly category: string;
  readonly description: string;
  readonly amount: number;
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
  readonly href: string;
};

export type FinanceDashboardMaterialIssue = {
  readonly id: string;
  readonly type: "RAP_SHORTAGE" | "LOW_STOCK";
  readonly severity: "CRITICAL" | "WARNING";
  readonly materialName: string;
  readonly projectName: string | null;
  readonly locationName: string | null;
  readonly availableStock: number;
  readonly requiredStock: number | null;
  readonly minimumStock: number | null;
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
  readonly cashDue: readonly FinanceDashboardCashDueItem[];
  readonly budgetRisks: readonly FinanceDashboardRiskyProject[];
  readonly materials: readonly FinanceDashboardMaterialIssue[];
};

export type FinanceDashboardOverview = {
  readonly role: DashboardRole;
  readonly summary: {
    readonly cashAvailable: number;
    readonly receivablesOutstanding: number;
    readonly payablesOutstanding: number;
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
    readonly defaultTab:
      | "overview"
      | "approvals"
      | "budget"
      | "cash"
      | "accounts"
      | "materials";
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
  readonly aiInsight: { readonly summary: string; date: Date } | null;
};

type BriefingResult = {
  readonly summary?: unknown;
  readonly briefingDate?: unknown;
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

export function parseAiInsight(
  result: string | null,
  createdAt: Date,
): FinanceDashboardOverview["aiInsight"] {
  if (!result) return null;
  try {
    const parsed = JSON.parse(result) as BriefingResult;
    if (
      typeof parsed.summary !== "string" ||
      parsed.summary.trim().length === 0
    )
      return null;
    const date =
      typeof parsed.briefingDate === "string"
        ? new Date(parsed.briefingDate)
        : createdAt;
    return {
      summary: parsed.summary.trim(),
      date: Number.isNaN(date.getTime()) ? createdAt : date,
    };
  } catch {
    return null;
  }
}

export function outstandingAmount(
  amount: number,
  paidAmount: number,
  status: string,
): number {
  if (status === "PAID" || status === "VOID") return 0;
  return Math.max(0, amount - paidAmount);
}
