"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  project,
  projectBudgetCategory,
  projectBudgets,
} from "@/db/schema";
import { assertPermission } from "@/lib/auth/permissions";
import {
  calculateTargetGross,
  calculateUsedPercentage,
  getBudgetCategoryStatus,
} from "@/lib/budget/excel-budget";
import { syncProjectBudgetCategories } from "@/lib/budget/budget-sync";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  approveCanonicalProjectBudgetSchema,
  createProjectBudgetFromRatiosSchema,
  type CreateProjectBudgetFromRatiosInput,
  updateProjectBudgetCategoryAllocationSchema,
  type UpdateProjectBudgetCategoryAllocationInput,
} from "@/lib/validations/budget";
import {
  aggregateOwnerBudgetDashboard,
  assertBudgetAccess,
  buildProjectBudgetDashboard,
  buildProjectBudgetDashboardFromBudget,
  getBudgetAllocationDefault,
  getSessionUser,
  type OwnerBudgetDashboard,
  type ProjectBudgetDashboard,
} from "./excel-budget-utils";

export type {
  BudgetCategoryDashboardItem,
  OwnerBudgetDashboard,
  ProjectBudgetDashboard,
} from "./excel-budget-utils";

export async function createProjectBudgetFromRatios(
  input: CreateProjectBudgetFromRatiosInput
): Promise<ActionResponse<ProjectBudgetDashboard>> {
  const validation = createProjectBudgetFromRatiosSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Validasi budget proyek gagal." },
    };
  }

  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }

  const { projectId, contractValue, approvedRabValue, projectProgressPercentage, notes } = validation.data;
  const accessError = await assertBudgetAccess<ProjectBudgetDashboard>(user, projectId, "create:budget");
  if (accessError) return accessError;

  const proj = await db.query.project.findFirst({ where: eq(project.id, projectId) });
  if (!proj) {
    return { success: false, error: { code: "NOT_FOUND", message: "Proyek tidak ditemukan." } };
  }

  const existing = await db.query.projectBudgets.findFirst({
    where: eq(projectBudgets.projectId, projectId),
  });
  if (existing) {
    return { success: false, error: { code: "FORBIDDEN", message: "Budget proyek canonical sudah ada." } };
  }

  const allocationDefault = await getBudgetAllocationDefault();

  if (allocationDefault.categories.length === 0) {
    return { success: false, error: { code: "NOT_FOUND", message: "Expense category belum tersedia." } };
  }

  const internalBudget = contractValue * allocationDefault.budgetCapRatio;
  const gross = calculateTargetGross(contractValue, internalBudget);
  const newBudgetId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(projectBudgets).values({
      id: newBudgetId,
      projectId,
      status: "DRAFT",
      contractValue: contractValue.toFixed(2),
      approvedRabValue: (approvedRabValue ?? contractValue).toFixed(2),
      internalBudget: internalBudget.toFixed(2),
      budgetCapRatio: allocationDefault.budgetCapRatio.toFixed(6),
      targetGrossAmount: gross.amount.toFixed(2),
      targetGrossPercentage: gross.percentage.toFixed(4),
      projectProgressPercentage: (projectProgressPercentage ?? 0).toFixed(4),
      notes: notes ?? null,
    });

    await tx.insert(projectBudgetCategory).values(
      allocationDefault.categories.map((category) => {
        const ratio = category.ratioPercentage;
        const allocatedAmount = internalBudget * ratio;
        return {
          projectBudgetId: newBudgetId,
          expenseCategoryId: category.expenseCategoryId,
          ratioPercentage: ratio.toFixed(6),
          allocatedAmount: allocatedAmount.toFixed(2),
          pendingAmount: "0.00",
          actualAmount: "0.00",
          paidAmount: "0.00",
          remainingAmount: allocatedAmount.toFixed(2),
          usedPercentage: "0.0000",
          status: "SAFE",
          sortOrder: category.sortOrder,
        };
      })
    );
  });

  const dashboard = await buildProjectBudgetDashboard(projectId);
  if (!dashboard) {
    return { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Budget dibuat tetapi dashboard gagal dibaca." } };
  }

  return { success: true, data: dashboard };
}

export async function updateProjectBudgetCategoryAllocation(
  input: UpdateProjectBudgetCategoryAllocationInput
): Promise<ActionResponse<ProjectBudgetDashboard>> {
  const validation = updateProjectBudgetCategoryAllocationSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Validasi alokasi kategori gagal." },
    };
  }

  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }

  const category = await db.query.projectBudgetCategory.findFirst({
    where: eq(projectBudgetCategory.id, validation.data.projectBudgetCategoryId),
    with: {
      budget: true,
    },
  });

  if (!category) {
    return { success: false, error: { code: "NOT_FOUND", message: "Kategori budget proyek tidak ditemukan." } };
  }

  const accessError = await assertBudgetAccess<ProjectBudgetDashboard>(user, category.budget.projectId, "update:budget");
  if (accessError) return accessError;

  const allocatedAmount = validation.data.allocatedAmount ?? Number(category.budget.internalBudget) * (validation.data.ratioPercentage ?? Number(category.ratioPercentage));
  const ratioPercentage = validation.data.ratioPercentage ?? (Number(category.budget.internalBudget) > 0 ? allocatedAmount / Number(category.budget.internalBudget) : 0);
  const actualAmount = Number(category.actualAmount);
  const usedPercentage = calculateUsedPercentage(actualAmount, allocatedAmount);

  await db.update(projectBudgetCategory)
    .set({
      ratioPercentage: ratioPercentage.toFixed(6),
      allocatedAmount: allocatedAmount.toFixed(2),
      pendingAmount: category.pendingAmount,
      remainingAmount: (allocatedAmount - actualAmount).toFixed(2),
      paidAmount: category.paidAmount,
      usedPercentage: usedPercentage.toFixed(4),
      status: getBudgetCategoryStatus(usedPercentage),
      isManualOverride: true,
      updatedAt: new Date(),
    })
    .where(eq(projectBudgetCategory.id, category.id));

  const dashboard = await buildProjectBudgetDashboard(category.budget.projectId);
  if (!dashboard) {
    return { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Dashboard budget gagal dibaca." } };
  }

  return { success: true, data: dashboard };
}

export async function approveProjectBudget(projectBudgetId: string): Promise<ActionResponse<ProjectBudgetDashboard>> {
  const validation = approveCanonicalProjectBudgetSchema.safeParse({ projectBudgetId });
  if (!validation.success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: "ID budget proyek tidak valid." } };
  }

  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }

  const budget = await db.query.projectBudgets.findFirst({
    where: eq(projectBudgets.id, validation.data.projectBudgetId),
  });
  if (!budget) {
    return { success: false, error: { code: "NOT_FOUND", message: "Budget proyek tidak ditemukan." } };
  }

  const accessError = await assertBudgetAccess<ProjectBudgetDashboard>(user, budget.projectId, "approve:budget");
  if (accessError) return accessError;

  await db.update(projectBudgets)
    .set({
      status: "APPROVED",
      approvedById: user.id,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(projectBudgets.id, budget.id));

  const dashboard = await buildProjectBudgetDashboard(budget.projectId);
  if (!dashboard) {
    return { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Dashboard budget gagal dibaca." } };
  }

  return { success: true, data: dashboard };
}

export async function recalculateProjectBudgetCategories(projectBudgetId: string): Promise<ActionResponse<ProjectBudgetDashboard>> {
  const validation = approveCanonicalProjectBudgetSchema.safeParse({ projectBudgetId });
  if (!validation.success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: "ID budget proyek tidak valid." } };
  }

  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }

  const budget = await db.query.projectBudgets.findFirst({
    where: eq(projectBudgets.id, validation.data.projectBudgetId),
  });
  if (!budget) {
    return { success: false, error: { code: "NOT_FOUND", message: "Budget proyek tidak ditemukan." } };
  }

  const accessError = await assertBudgetAccess<ProjectBudgetDashboard>(user, budget.projectId, "update:budget");
  if (accessError) return accessError;

  await db.transaction(async (tx) => {
    const categories = await tx.query.projectBudgetCategory.findMany({
      where: eq(projectBudgetCategory.projectBudgetId, budget.id),
    });
    await syncProjectBudgetCategories({
      tx,
      projectBudgetCategoryIds: categories.map((category) => category.id),
    });
  });

  const dashboard = await buildProjectBudgetDashboard(budget.projectId);
  if (!dashboard) {
    return { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Dashboard budget gagal dibaca." } };
  }

  return { success: true, data: dashboard };
}

export async function getProjectBudgetDashboard(projectId: string): Promise<ActionResponse<ProjectBudgetDashboard>> {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }

  const accessError = await assertBudgetAccess<ProjectBudgetDashboard>(user, projectId, "view:budget");
  if (accessError) return accessError;

  const dashboard = await buildProjectBudgetDashboard(projectId);
  if (!dashboard) {
    return { success: false, error: { code: "NOT_FOUND", message: "Dashboard budget proyek belum tersedia." } };
  }

  return { success: true, data: dashboard };
}

export async function getOwnerBudgetDashboard(): Promise<ActionResponse<OwnerBudgetDashboard>> {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }

  try {
    await assertPermission(user, "view:budget");
    await assertPermission(user, "view:profitability");
  } catch (error) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: error instanceof Error ? error.message : "Akses ditolak.",
      },
    };
  }

  const budgets = await db.query.projectBudgets.findMany({
    with: {
      project: true,
      categories: {
        with: {
          expenseCategory: true,
        },
      },
    },
  });

  const projects = budgets.map(buildProjectBudgetDashboardFromBudget);

  return {
    success: true,
    data: aggregateOwnerBudgetDashboard(projects),
  };
}
