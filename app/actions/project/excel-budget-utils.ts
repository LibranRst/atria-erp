import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  budgetAllocationSetting,
  expenseCategory,
  projectBudgetCategory,
  projectBudgets,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { assertProjectAccess } from "@/lib/auth/scoping";
import {
  calculateUsedPercentage,
  EXCEL_BUDGET_CAP_RATIO,
  getBudgetCategoryStatus,
  type BudgetCategoryStatus,
  type ExpenseCategoryCode,
} from "@/lib/budget/excel-budget";
import type { ActionResponse } from "@/lib/types/action-response";

type SessionUser = {
  readonly id: string;
  readonly roleId?: string;
  readonly role?: string;
};

export type BudgetCategoryDashboardItem = {
  readonly id: string;
  readonly code: ExpenseCategoryCode;
  readonly name: string;
  readonly allocatedAmount: number;
  readonly pendingAmount: number;
  readonly actualAmount: number;
  readonly paidAmount: number;
  readonly remainingAmount: number;
  readonly usedPercentage: number;
  readonly status: BudgetCategoryStatus;
  readonly sortOrder: number;
};

export type ProjectBudgetDashboard = {
  readonly projectId: string;
  readonly projectName: string;
  readonly budgetId: string;
  readonly status: string;
  readonly contractValue: number;
  readonly approvedRabValue: number;
  readonly internalBudget: number;
  readonly pendingCost: number;
  readonly actualCost: number;
  readonly paidCost: number;
  readonly remainingBudget: number;
  readonly usedPercentage: number;
  readonly targetGrossAmount: number;
  readonly targetGrossPercentage: number;
  readonly projectedMarginAmount: number;
  readonly projectedMarginPercentage: number;
  readonly projectProgressPercentage: number;
  readonly categories: readonly BudgetCategoryDashboardItem[];
};

export type OwnerBudgetDashboard = {
  readonly totalProjectValue: number;
  readonly totalBudget: number;
  readonly pendingBudget: number;
  readonly consumedBudget: number;
  readonly paidBudget: number;
  readonly remainingBudget: number;
  readonly usedPercentage: number;
  readonly projectedMarginAmount: number;
  readonly projectedMarginPercentage: number;
  readonly projectsOverBudget: number;
  readonly categoriesNearLimit: number;
  readonly categories: readonly BudgetCategoryDashboardItem[];
  readonly projects: readonly ProjectBudgetDashboard[];
};

type BudgetAllocationDefaultCategory = {
  readonly expenseCategoryId: string;
  readonly code: string;
  readonly name: string;
  readonly ratioPercentage: number;
  readonly sortOrder: number;
};

export type BudgetAllocationDefault = {
  readonly budgetCapRatio: number;
  readonly categories: readonly BudgetAllocationDefaultCategory[];
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({
    headers: {
      cookie: (await cookies()).toString(),
    },
  });

  return session?.user ? (session.user as SessionUser) : null;
}

export function toStatus(value: string): BudgetCategoryStatus {
  if (value === "WATCH" || value === "CRITICAL" || value === "OVER_BUDGET") {
    return value;
  }
  return "SAFE";
}

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

export async function getBudgetAllocationDefault(): Promise<BudgetAllocationDefault> {
  const setting = await db.query.budgetAllocationSetting.findFirst({
    where: eq(budgetAllocationSetting.isActive, true),
    with: {
      categories: {
        with: { expenseCategory: true },
      },
    },
  });

  if (setting) {
    const enabledCategories = setting.categories
      .filter((category) => category.isEnabled && category.expenseCategory.isActive)
      .map((category) => ({
        expenseCategoryId: category.expenseCategoryId,
        code: category.expenseCategory.code,
        name: category.expenseCategory.name,
        ratioPercentage: Number(category.ratioPercentage),
        sortOrder: category.sortOrder,
      }))
      .sort((first, second) => first.sortOrder - second.sortOrder);

    if (enabledCategories.length > 0) {
      return {
        budgetCapRatio: Number(setting.budgetCapRatio),
        categories: enabledCategories,
      };
    }
  }

  const activeCategories = await db.query.expenseCategory.findMany({
    where: eq(expenseCategory.isActive, true),
  });

  return {
    budgetCapRatio: EXCEL_BUDGET_CAP_RATIO,
    categories: activeCategories
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

export async function assertBudgetAccess<T>(
  user: SessionUser,
  projectId: string,
  permission: "view:budget" | "create:budget" | "update:budget" | "approve:budget",
): Promise<ActionResponse<T> | null> {
  try {
    await assertPermission(user, permission);
    const roleName = await resolveRoleName(user.roleId ?? "");
    await assertProjectAccess(projectId, user.id, roleName);
    return null;
  } catch (error) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: error instanceof Error ? error.message : "Akses ditolak.",
      },
    };
  }
}

export function mapBudgetCategories(
  categories: readonly (typeof projectBudgetCategory.$inferSelect & {
    expenseCategory: { code: string; name: string };
  })[],
): BudgetCategoryDashboardItem[] {
  return categories
    .map((category): BudgetCategoryDashboardItem => ({
      id: category.id,
      code: toCategoryCode(category.expenseCategory.code),
      name: category.expenseCategory.name,
      allocatedAmount: Number(category.allocatedAmount),
      pendingAmount: Number(category.pendingAmount),
      actualAmount: Number(category.actualAmount),
      paidAmount: Number(category.paidAmount),
      remainingAmount: Number(category.remainingAmount),
      usedPercentage: Number(category.usedPercentage),
      status: toStatus(category.status),
      sortOrder: category.sortOrder,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function buildProjectBudgetDashboardFromBudget(
  budget: typeof projectBudgets.$inferSelect & {
    project: { name: string };
    categories: readonly (typeof projectBudgetCategory.$inferSelect & {
      expenseCategory: { code: string; name: string };
    })[];
  },
): ProjectBudgetDashboard {
  const categories = mapBudgetCategories(budget.categories);
  const actualCost = categories.reduce((sum, item) => sum + item.actualAmount, 0);
  const pendingCost = categories.reduce((sum, item) => sum + item.pendingAmount, 0);
  const paidCost = categories.reduce((sum, item) => sum + item.paidAmount, 0);
  const internalBudget = Number(budget.internalBudget);
  const contractValue = Number(budget.contractValue);
  const remainingBudget = internalBudget - actualCost;
  const usedPercentage = calculateUsedPercentage(actualCost, internalBudget);
  const projectedMarginAmount = contractValue - Math.max(actualCost, internalBudget);
  const projectedMarginPercentage =
    contractValue > 0 ? (projectedMarginAmount / contractValue) * 100 : 0;

  return {
    projectId: budget.projectId,
    projectName: budget.project.name,
    budgetId: budget.id,
    status: budget.status,
    contractValue,
    approvedRabValue: Number(budget.approvedRabValue),
    internalBudget,
    pendingCost,
    actualCost,
    paidCost,
    remainingBudget,
    usedPercentage,
    targetGrossAmount: Number(budget.targetGrossAmount),
    targetGrossPercentage: Number(budget.targetGrossPercentage),
    projectedMarginAmount,
    projectedMarginPercentage,
    projectProgressPercentage: Number(budget.projectProgressPercentage),
    categories,
  };
}

export async function buildProjectBudgetDashboard(
  projectId: string,
): Promise<ProjectBudgetDashboard | null> {
  const budget = await db.query.projectBudgets.findFirst({
    where: eq(projectBudgets.projectId, projectId),
    with: {
      project: true,
      categories: {
        with: {
          expenseCategory: true,
        },
      },
    },
  });

  if (!budget) return null;

  return buildProjectBudgetDashboardFromBudget(budget);
}

export function aggregateOwnerBudgetDashboard(
  projects: readonly ProjectBudgetDashboard[],
): OwnerBudgetDashboard {
  const categoryMap = new Map<ExpenseCategoryCode, BudgetCategoryDashboardItem>();
  for (const projectDashboard of projects) {
    for (const category of projectDashboard.categories) {
      const current = categoryMap.get(category.code);
      const allocatedAmount = (current?.allocatedAmount ?? 0) + category.allocatedAmount;
      const pendingAmount = (current?.pendingAmount ?? 0) + category.pendingAmount;
      const actualAmount = (current?.actualAmount ?? 0) + category.actualAmount;
      const paidAmount = (current?.paidAmount ?? 0) + category.paidAmount;
      const usedPercentage = calculateUsedPercentage(actualAmount, allocatedAmount);
      categoryMap.set(category.code, {
        id: category.code,
        code: category.code,
        name: category.name,
        allocatedAmount,
        pendingAmount,
        actualAmount,
        paidAmount,
        remainingAmount: allocatedAmount - actualAmount,
        usedPercentage,
        status: getBudgetCategoryStatus(usedPercentage),
        sortOrder: category.sortOrder,
      });
    }
  }

  const totalProjectValue = projects.reduce((sum, item) => sum + item.contractValue, 0);
  const totalBudget = projects.reduce((sum, item) => sum + item.internalBudget, 0);
  const pendingBudget = projects.reduce((sum, item) => sum + item.pendingCost, 0);
  const consumedBudget = projects.reduce((sum, item) => sum + item.actualCost, 0);
  const paidBudget = projects.reduce((sum, item) => sum + item.paidCost, 0);
  const remainingBudget = totalBudget - consumedBudget;
  const projectedMarginAmount = totalProjectValue - Math.max(totalBudget, consumedBudget);

  return {
    totalProjectValue,
    totalBudget,
    pendingBudget,
    consumedBudget,
    paidBudget,
    remainingBudget,
    usedPercentage: calculateUsedPercentage(consumedBudget, totalBudget),
    projectedMarginAmount,
    projectedMarginPercentage:
      totalProjectValue > 0 ? (projectedMarginAmount / totalProjectValue) * 100 : 0,
    projectsOverBudget: projects.filter((item) => item.usedPercentage > 100).length,
    categoriesNearLimit: projects
      .flatMap((item) => item.categories)
      .filter((item) => item.status !== "SAFE").length,
    categories: Array.from(categoryMap.values()).sort((a, b) => a.sortOrder - b.sortOrder),
    projects,
  };
}
