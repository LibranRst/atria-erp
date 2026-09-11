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

export interface RabItemForDerivation {
  readonly bundleId?: string | null;
  readonly isHidden: boolean;
  readonly lineTotal: string | number;
  readonly itemNature?: "PRODUCTION" | "SERVICE_FEE" | string | null;
}

export interface RabBundleForDerivation {
  readonly id: string;
  readonly isHidden: boolean;
  readonly lineTotal: string | number;
}

export interface RabBudgetDerivationResult {
  readonly approvedValue: number;
  readonly productionScopeTotal: number;
  readonly serviceFeeTotal: number;
  readonly internalBudget: number;
  readonly targetGrossAmount: number;
  readonly targetGrossPercentage: number;
  readonly productionGrossMarginAmount: number;
  readonly productionGrossMarginPercentage: number;
}

export function calculateRabBudgetDerivation(params: {
  readonly items: readonly RabItemForDerivation[];
  readonly bundles?: readonly RabBundleForDerivation[];
  readonly budgetCapRatio: number;
}): RabBudgetDerivationResult {
  const bundles = params.bundles ?? [];
  const standalone = params.items
    .filter((item) => !item.bundleId && !item.isHidden)
    .reduce((sum, item) => sum + Number(item.lineTotal), 0);
  const bundled = bundles
    .filter((bundle) => !bundle.isHidden)
    .reduce((sum, bundle) => sum + Number(bundle.lineTotal), 0);
  const approvedValue = standalone + bundled;

  const serviceFeeTotal = params.items
    .filter((item) => !item.bundleId && !item.isHidden && item.itemNature === "SERVICE_FEE")
    .reduce((sum, item) => sum + Number(item.lineTotal), 0);

  const productionScopeTotal = Math.max(0, approvedValue - serviceFeeTotal);
  const internalBudget = Math.round(productionScopeTotal * params.budgetCapRatio * 100) / 100;
  const targetGrossAmount = Math.round((approvedValue - internalBudget) * 100) / 100;
  const targetGrossPercentage =
    approvedValue > 0 ? (targetGrossAmount / approvedValue) * 100 : 0;
  const productionGrossMarginAmount =
    Math.round((productionScopeTotal - internalBudget) * 100) / 100;
  const productionGrossMarginPercentage =
    productionScopeTotal > 0
      ? (productionGrossMarginAmount / productionScopeTotal) * 100
      : 0;

  return {
    approvedValue,
    productionScopeTotal,
    serviceFeeTotal,
    internalBudget,
    targetGrossAmount,
    targetGrossPercentage,
    productionGrossMarginAmount,
    productionGrossMarginPercentage,
  };
}
