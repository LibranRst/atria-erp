export const EXCEL_BUDGET_CAP_RATIO = 0.9;

export const EXPENSE_CATEGORY_CODES = [
  "MATERIAL",
  "TUKANG",
  "OPERASIONAL",
  "LAIN_LAIN",
  "SUBCON",
] as const;

export type ExpenseCategoryCode = (typeof EXPENSE_CATEGORY_CODES)[number];

export type BudgetCategoryStatus = "SAFE" | "WATCH" | "CRITICAL" | "OVER_BUDGET";

export type DefaultExpenseCategory = {
  readonly code: ExpenseCategoryCode;
  readonly name: string;
  readonly description: string;
  readonly defaultRatio: number;
  readonly sortOrder: number;
};

export const DEFAULT_EXPENSE_CATEGORIES: readonly DefaultExpenseCategory[] = [
  {
    code: "TUKANG",
    name: "Tukang",
    description: "Biaya tukang, pekerja, SPK tukang, dan borongan lapangan.",
    defaultRatio: 0.18,
    sortOrder: 10,
  },
  {
    code: "MATERIAL",
    name: "Material",
    description: "Material proyek dan pembelian barang yang dapat ditautkan ke RAP/stock.",
    defaultRatio: 0.35,
    sortOrder: 20,
  },
  {
    code: "OPERASIONAL",
    name: "Operasional",
    description: "Transportasi, mobilisasi, konsumsi, dan kebutuhan operasional proyek.",
    defaultRatio: 0.01,
    sortOrder: 30,
  },
  {
    code: "LAIN_LAIN",
    name: "Lain-lain",
    description: "Biaya tambahan kecil atau kategori lain yang tidak masuk bucket utama.",
    defaultRatio: 0.005,
    sortOrder: 40,
  },
  {
    code: "SUBCON",
    name: "Subcon",
    description: "Biaya subkontraktor. Default nonaktif secara nilai sampai diaktifkan per proyek.",
    defaultRatio: 0,
    sortOrder: 50,
  },
] as const;

export function getBudgetCategoryStatus(usedPercentage: number): BudgetCategoryStatus {
  if (usedPercentage > 100) return "OVER_BUDGET";
  if (usedPercentage >= 95) return "CRITICAL";
  if (usedPercentage >= 75) return "WATCH";
  return "SAFE";
}

export function calculateInternalBudget(contractValue: number): number {
  return contractValue * EXCEL_BUDGET_CAP_RATIO;
}

export function calculateUsedPercentage(actualAmount: number, allocatedAmount: number): number {
  if (allocatedAmount <= 0) return actualAmount > 0 ? 100 : 0;
  return (actualAmount / allocatedAmount) * 100;
}

export function calculateTargetGross(
  contractValue: number,
  internalBudget: number,
): {
  readonly amount: number;
  readonly percentage: number;
} {
  const amount = contractValue - internalBudget;
  return {
    amount,
    percentage: contractValue > 0 ? (amount / contractValue) * 100 : 0,
  };
}
