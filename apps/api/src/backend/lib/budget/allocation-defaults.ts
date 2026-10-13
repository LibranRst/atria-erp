import { and, eq } from "drizzle-orm";
import type { db } from "@backend/db";
import { budgetAllocationSetting, expenseCategory, INSTANCE_TENANT_ID } from "@backend/db/schema";
import { EXCEL_BUDGET_CAP_RATIO } from "@atria/core/budget/excel-budget";

export type BudgetAllocationDefault = {
  readonly budgetCapRatio: number;
  readonly categories: readonly {
    readonly expenseCategoryId: string;
    readonly code: string;
    readonly name: string;
    readonly ratioPercentage: number;
    readonly sortOrder: number;
  }[];
};

export type BudgetAllocationSnapshot = BudgetAllocationDefault & {
  readonly settingId: string | null;
  readonly settingName: string | null;
};

type ActiveSetting = {
  readonly id: string;
  readonly name: string;
  readonly budgetCapRatio: string;
  readonly categories: readonly {
    readonly expenseCategoryId: string;
    readonly ratioPercentage: string;
    readonly sortOrder: number;
    readonly isEnabled: boolean;
    readonly expenseCategory: {
      readonly code: string;
      readonly name: string;
      readonly isActive: boolean;
    };
  }[];
};

export function configuredBudgetSnapshot(
  setting: ActiveSetting | undefined,
): BudgetAllocationSnapshot | null {
  if (!setting) return null;
  const categories = setting.categories
    .filter((category) => category.isEnabled && category.expenseCategory.isActive)
    .map((category) => ({
      expenseCategoryId: category.expenseCategoryId,
      code: category.expenseCategory.code,
      name: category.expenseCategory.name,
      ratioPercentage: Number(category.ratioPercentage),
      sortOrder: category.sortOrder,
    }))
    .sort((first, second) => first.sortOrder - second.sortOrder);
  return categories.length > 0
    ? {
        settingId: setting.id,
        settingName: setting.name,
        budgetCapRatio: Number(setting.budgetCapRatio),
        categories,
      }
    : null;
}

/** The same read-only resolver backs manual creation and AI policy/proposals. */
export async function readBudgetAllocationSnapshot(
  reader: Pick<typeof db, "query">,
): Promise<BudgetAllocationSnapshot> {
  const setting = await reader.query.budgetAllocationSetting.findFirst({
    where: and(
      eq(budgetAllocationSetting.tenantId, INSTANCE_TENANT_ID),
      eq(budgetAllocationSetting.isActive, true),
    ),
    with: { categories: { with: { expenseCategory: true } } },
  });
  const configured = configuredBudgetSnapshot(setting);
  if (configured) return configured;
  const categories = await reader.query.expenseCategory.findMany({
    where: and(
      eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
      eq(expenseCategory.isActive, true),
    ),
  });
  return {
    settingId: null,
    settingName: null,
    budgetCapRatio: EXCEL_BUDGET_CAP_RATIO,
    categories: categories
      .map((category) => ({
        expenseCategoryId: category.id,
        code: category.code,
        name: category.name,
        ratioPercentage: Number(category.defaultRatio),
        sortOrder: category.sortOrder,
      }))
      .sort((first, second) => first.sortOrder - second.sortOrder),
  };
}

/** Preserve the existing public manual signature and fallback contract. */
export async function readBudgetAllocationDefault(
  reader: Pick<typeof db, "query">,
): Promise<BudgetAllocationDefault> {
  const snapshot = await readBudgetAllocationSnapshot(reader);
  return { budgetCapRatio: snapshot.budgetCapRatio, categories: snapshot.categories };
}
