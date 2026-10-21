import {
  inspectBudgetSummaryTx,
  writeBudgetSummaryTx,
  BudgetSummaryError,
} from "@backend/server/usecases/project/budget-summary-writer";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import {
  prepareProjectManagementTx,
  writeProjectManagementTx,
  ProjectManagementError,
} from "@backend/server/usecases/project/project-management-writer";
import { resolveActor } from "@backend/server/actor";

import { eq } from "drizzle-orm";

import { db } from "@backend/db";
import { auditLog, project, projectBudgetCategory, projectBudgets } from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import { calculateTargetGross } from "@atria/core/budget/excel-budget";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  createProjectBudgetFromRatiosSchema,
  approveCanonicalProjectBudgetSchema,
  type CreateProjectBudgetFromRatiosInput,
  updateProjectBudgetCategoryAllocationSchema,
  type UpdateProjectBudgetCategoryAllocationInput,
} from "@atria/core/validations/budget";
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
  input: CreateProjectBudgetFromRatiosInput,
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

  const { projectId, contractValue, approvedRabValue, projectProgressPercentage, notes } =
    validation.data;
  const accessError = await assertBudgetAccess<ProjectBudgetDashboard>(
    user,
    projectId,
    "create:budget",
  );
  if (accessError) return accessError;

  const proj = await db.query.project.findFirst({ where: eq(project.id, projectId) });
  if (!proj) {
    return { success: false, error: { code: "NOT_FOUND", message: "Proyek tidak ditemukan." } };
  }

  const existing = await db.query.projectBudgets.findFirst({
    where: eq(projectBudgets.projectId, projectId),
  });
  if (existing) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Budget utama proyek sudah tersedia." },
    };
  }

  const allocationDefault = await getBudgetAllocationDefault();

  if (allocationDefault.categories.length === 0) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Expense category belum tersedia." },
    };
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
      }),
    );
    await tx.insert(auditLog).values({
      userId: user.id,
      action: "CREATE_CANONICAL_PROJECT_BUDGET",
      targetTable: "project_budgets",
      targetId: newBudgetId,
      newState: JSON.stringify({
        projectId,
        contractValue,
        internalBudget,
        budgetCapRatio: allocationDefault.budgetCapRatio,
      }),
    });
  });

  const dashboard = await buildProjectBudgetDashboard(projectId);
  if (!dashboard) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Budget dibuat tetapi dashboard gagal dibaca.",
      },
    };
  }

  return { success: true, data: dashboard };
}

async function manageBudget(input: unknown): Promise<ActionResponse<ProjectBudgetDashboard>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const projectId = await db.transaction(async (tx) => {
      const proposal = await prepareProjectManagementTx(tx, actor, input);
      await writeProjectManagementTx(tx, actor, proposal);
      return proposal.projectId;
    });
    revalidateWorkspacePath(`/projects/${projectId}`);
    revalidateWorkspacePath("/projects");
    const dashboard = await buildProjectBudgetDashboard(projectId);
    if (!dashboard) throw new Error("Dashboard tidak ditemukan.");
    return { success: true, data: dashboard };
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: error instanceof ProjectManagementError ? error.code : "TRANSACTION_FAILED",
        message:
          error instanceof ProjectManagementError
            ? error.message
            : "Gagal memperbarui budget proyek.",
      },
    };
  }
}
export async function updateProjectBudgetCategoryAllocation(
  input: UpdateProjectBudgetCategoryAllocationInput,
): Promise<ActionResponse<ProjectBudgetDashboard>> {
  const parsed = updateProjectBudgetCategoryAllocationSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Alokasi tidak valid." } };
  const category = await db.query.projectBudgetCategory.findFirst({
    where: eq(projectBudgetCategory.id, parsed.data.projectBudgetCategoryId),
    with: { budget: true },
  });
  if (!category)
    return { success: false, error: { code: "NOT_FOUND", message: "Kategori tidak ditemukan." } };
  return manageBudget({
    action: "REALLOCATE_BUDGET",
    projectId: category.budget.projectId,
    projectBudgetId: category.budget.id,
    reason: "Koreksi alokasi melalui form budget proyek.",
    categories: [
      {
        projectBudgetCategoryId: category.id,
        ...(parsed.data.allocatedAmount !== undefined
          ? { allocatedAmount: parsed.data.allocatedAmount }
          : { ratioPercentage: parsed.data.ratioPercentage }),
      },
    ],
  });
}
async function budgetDecision(
  projectBudgetId: string,
  action: "SUBMIT_BUDGET" | "APPROVE_BUDGET" | "REJECT_BUDGET",
  reason?: string,
): Promise<ActionResponse<ProjectBudgetDashboard>> {
  const identity = approveCanonicalProjectBudgetSchema.safeParse({ projectBudgetId });
  if (!identity.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "ID budget proyek tidak valid." },
    };
  const budget = await db.query.projectBudgets.findFirst({
    where: eq(projectBudgets.id, projectBudgetId),
  });
  if (!budget)
    return { success: false, error: { code: "NOT_FOUND", message: "Budget tidak ditemukan." } };
  return manageBudget({
    action,
    projectId: budget.projectId,
    projectBudgetId,
    ...(reason === undefined ? {} : { reason }),
  });
}
export async function submitProjectBudget(
  projectBudgetId: string,
): Promise<ActionResponse<ProjectBudgetDashboard>> {
  return budgetDecision(projectBudgetId, "SUBMIT_BUDGET");
}
export async function approveProjectBudget(
  projectBudgetId: string,
): Promise<ActionResponse<ProjectBudgetDashboard>> {
  return budgetDecision(projectBudgetId, "APPROVE_BUDGET");
}
export async function rejectProjectBudget(
  projectBudgetId: string,
  reason: string,
): Promise<ActionResponse<ProjectBudgetDashboard>> {
  return budgetDecision(projectBudgetId, "REJECT_BUDGET", reason);
}

export async function recalculateProjectBudgetCategories(
  projectBudgetId: string,
): Promise<ActionResponse<ProjectBudgetDashboard>> {
  const validation = approveCanonicalProjectBudgetSchema.safeParse({ projectBudgetId });
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "ID budget proyek tidak valid." },
    };
  }

  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }

  const budget = await db.query.projectBudgets.findFirst({
    where: eq(projectBudgets.id, validation.data.projectBudgetId),
  });
  if (!budget) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Budget proyek tidak ditemukan." },
    };
  }

  const accessError = await assertBudgetAccess<ProjectBudgetDashboard>(
    user,
    budget.projectId,
    "update:budget",
  );
  if (accessError) return accessError;

  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await db.transaction(async (tx) => {
      const inspected = await inspectBudgetSummaryTx(tx, actor, budget.projectId);
      await writeBudgetSummaryTx(tx, actor, inspected);
    });
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: error instanceof BudgetSummaryError ? error.code : "TRANSACTION_FAILED",
        message:
          error instanceof BudgetSummaryError
            ? error.message
            : "Ringkasan budget belum dapat disinkronkan.",
      },
    };
  }
  for (const path of ["/ledger", "/projects", `/projects/${budget.projectId}`, "/expenses"])
    revalidateWorkspacePath(path);

  const dashboard = await buildProjectBudgetDashboard(budget.projectId);
  if (!dashboard) {
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Dashboard budget gagal dibaca." },
    };
  }

  return { success: true, data: dashboard };
}

export async function getProjectBudgetDashboard(
  projectId: string,
): Promise<ActionResponse<ProjectBudgetDashboard>> {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }

  const accessError = await assertBudgetAccess<ProjectBudgetDashboard>(
    user,
    projectId,
    "view:budget",
  );
  if (accessError) return accessError;

  const dashboard = await buildProjectBudgetDashboard(projectId);
  if (!dashboard) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Dashboard budget proyek belum tersedia." },
    };
  }

  return { success: true, data: dashboard };
}

export async function getOwnerBudgetDashboard(): Promise<ActionResponse<OwnerBudgetDashboard>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (
    !actorCan(actor, "view:budget") ||
    !actorCan(actor, "view:profitability") ||
    actor.dataScope !== "GLOBAL"
  ) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Dashboard anggaran hanya tersedia untuk akses global yang berwenang.",
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

  const projects = budgets.map((budget) => buildProjectBudgetDashboardFromBudget(budget));

  return {
    success: true,
    data: aggregateOwnerBudgetDashboard(projects),
  };
}
