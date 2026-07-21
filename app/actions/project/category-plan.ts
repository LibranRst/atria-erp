"use server";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { auditLog, project, projectBudgetCategory, projectCategoryPlanItem } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { assertProjectAccess } from "@/lib/auth/scoping";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  createProjectCategoryPlanItemSchema,
  deleteProjectCategoryPlanItemSchema,
  markProjectCategoryPlanItemActiveSchema,
  updateProjectCategoryPlanItemSchema,
  type CreateProjectCategoryPlanItemInput,
  type UpdateProjectCategoryPlanItemInput,
} from "@/lib/validations/category-plan";

type SessionUser = {
  readonly id: string;
  readonly roleId?: string;
};

type CategoryPlanItem = typeof projectCategoryPlanItem.$inferSelect;

async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({
    headers: {
      cookie: (await cookies()).toString(),
    },
  });
  return session?.user ? (session.user as SessionUser) : null;
}

function toError<T>(error: unknown, fallbackMessage: string): ActionResponse<T> {
  const message = error instanceof Error ? error.message : fallbackMessage;
  if (message.includes("FORBIDDEN") || message.includes("Akses")) {
    return { success: false, error: { code: "FORBIDDEN", message } };
  }
  if (message.includes("NOT_FOUND")) {
    return { success: false, error: { code: "NOT_FOUND", message: fallbackMessage } };
  }
  return { success: false, error: { code: "TRANSACTION_FAILED", message } };
}

async function assertCategoryPlanMutationAccess(
  user: SessionUser,
  projectId: string,
): Promise<void> {
  await assertPermission(user, "update:budget");
  const roleName = await resolveRoleName(user.roleId ?? "");
  await assertProjectAccess(projectId, user.id, roleName);
}

async function resolveAllowedPlanCategory(input: {
  readonly projectId: string;
  readonly projectBudgetCategoryId: string;
}): Promise<{
  readonly projectBudgetId: string;
  readonly expenseCategoryId: string;
  readonly categoryCode: string;
}> {
  const category = await db.query.projectBudgetCategory.findFirst({
    where: eq(projectBudgetCategory.id, input.projectBudgetCategoryId),
    with: {
      budget: true,
      expenseCategory: true,
    },
  });
  if (!category || category.budget.projectId !== input.projectId) {
    throw new Error("PROJECT_BUDGET_CATEGORY_NOT_FOUND");
  }
  if (category.expenseCategory.code !== "TUKANG" && category.expenseCategory.code !== "SUBCON") {
    throw new Error("CATEGORY_PLAN_ONLY_ALLOWED_FOR_TUKANG_OR_SUBCON");
  }
  return {
    projectBudgetId: category.projectBudgetId,
    expenseCategoryId: category.expenseCategoryId,
    categoryCode: category.expenseCategory.code,
  };
}

export async function createProjectCategoryPlanItem(
  input: CreateProjectCategoryPlanItemInput,
): Promise<ActionResponse<CategoryPlanItem>> {
  const validation = createProjectCategoryPlanItemSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data detail plan kategori tidak valid." },
    };
  }

  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  try {
    const proj = await db.query.project.findFirst({
      where: eq(project.id, validation.data.projectId),
    });
    if (!proj) throw new Error("PROJECT_NOT_FOUND");
    await assertCategoryPlanMutationAccess(user, validation.data.projectId);

    const category = await resolveAllowedPlanCategory({
      projectId: validation.data.projectId,
      projectBudgetCategoryId: validation.data.projectBudgetCategoryId,
    });
    const estimatedTotalCost = validation.data.quantity * validation.data.estimatedUnitCost;

    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(projectCategoryPlanItem)
        .values({
          projectId: validation.data.projectId,
          projectBudgetId: category.projectBudgetId,
          projectBudgetCategoryId: validation.data.projectBudgetCategoryId,
          expenseCategoryId: category.expenseCategoryId,
          vendorId: validation.data.vendorId ?? null,
          name: validation.data.name,
          scopeDescription: validation.data.scopeDescription ?? null,
          area: validation.data.area,
          quantity: validation.data.quantity.toFixed(2),
          unit: validation.data.unit,
          estimatedUnitCost: validation.data.estimatedUnitCost.toFixed(2),
          estimatedTotalCost: estimatedTotalCost.toFixed(2),
          status: "DRAFT",
          internalNote: validation.data.internalNote ?? null,
          displayOrder: validation.data.displayOrder ?? 0,
        })
        .returning();
      await tx
        .insert(auditLog)
        .values({
          userId: user.id,
          action: "CREATE_CATEGORY_PLAN_DRAFT",
          targetTable: "project_category_plan_item",
          targetId: row.id,
          newState: JSON.stringify(row),
        });
      return row;
    });

    return { success: true, data: created };
  } catch (error) {
    return toError(error, "Gagal membuat detail plan kategori.");
  }
}

export async function updateProjectCategoryPlanItem(
  input: UpdateProjectCategoryPlanItemInput,
): Promise<ActionResponse<CategoryPlanItem>> {
  const validation = updateProjectCategoryPlanItemSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data detail plan kategori tidak valid." },
    };
  }

  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  try {
    const existing = await db.query.projectCategoryPlanItem.findFirst({
      where: eq(projectCategoryPlanItem.id, validation.data.projectCategoryPlanItemId),
    });
    if (!existing) throw new Error("CATEGORY_PLAN_ITEM_NOT_FOUND");
    if (existing.status !== "DRAFT")
      throw new Error("Package harus DRAFT. Pilih Edit Lagi sebelum mengubah package Siap.");
    await assertCategoryPlanMutationAccess(user, existing.projectId);

    const category = await resolveAllowedPlanCategory({
      projectId: validation.data.projectId,
      projectBudgetCategoryId: validation.data.projectBudgetCategoryId,
    });
    if (validation.data.projectId !== existing.projectId) {
      throw new Error("CATEGORY_PLAN_ITEM_PROJECT_MISMATCH");
    }
    const estimatedTotalCost = validation.data.quantity * validation.data.estimatedUnitCost;

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(projectCategoryPlanItem)
        .set({
          projectBudgetId: category.projectBudgetId,
          projectBudgetCategoryId: validation.data.projectBudgetCategoryId,
          expenseCategoryId: category.expenseCategoryId,
          vendorId: validation.data.vendorId ?? null,
          name: validation.data.name,
          scopeDescription: validation.data.scopeDescription ?? null,
          area: validation.data.area,
          quantity: validation.data.quantity.toFixed(2),
          unit: validation.data.unit,
          estimatedUnitCost: validation.data.estimatedUnitCost.toFixed(2),
          estimatedTotalCost: estimatedTotalCost.toFixed(2),
          status: validation.data.status ?? existing.status,
          internalNote: validation.data.internalNote ?? null,
          displayOrder: validation.data.displayOrder ?? existing.displayOrder,
          updatedAt: new Date(),
        })
        .where(eq(projectCategoryPlanItem.id, existing.id))
        .returning();
      await tx
        .insert(auditLog)
        .values({
          userId: user.id,
          action: "UPDATE_CATEGORY_PLAN_DRAFT",
          targetTable: "project_category_plan_item",
          targetId: existing.id,
          originalState: JSON.stringify(existing),
          newState: JSON.stringify(row),
        });
      return row;
    });

    return { success: true, data: updated };
  } catch (error) {
    return toError(error, "Gagal memperbarui detail plan kategori.");
  }
}

export async function markProjectCategoryPlanItemActive(
  projectCategoryPlanItemId: string,
): Promise<ActionResponse<CategoryPlanItem>> {
  const validation = markProjectCategoryPlanItemActiveSchema.safeParse({
    projectCategoryPlanItemId,
  });
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "ID detail plan kategori tidak valid." },
    };
  }

  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  try {
    const existing = await db.query.projectCategoryPlanItem.findFirst({
      where: eq(projectCategoryPlanItem.id, validation.data.projectCategoryPlanItemId),
    });
    if (!existing) throw new Error("CATEGORY_PLAN_ITEM_NOT_FOUND");
    if (existing.status !== "DRAFT") throw new Error("Hanya package DRAFT yang dapat diaktifkan.");
    await assertCategoryPlanMutationAccess(user, existing.projectId);

    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx
        .update(projectCategoryPlanItem)
        .set({ status: "ACTIVE", updatedAt: new Date() })
        .where(eq(projectCategoryPlanItem.id, existing.id))
        .returning();
      await tx
        .insert(auditLog)
        .values({
          userId: user.id,
          action: "MARK_CATEGORY_PLAN_PACKAGE_READY",
          targetTable: "project_category_plan_item",
          targetId: existing.id,
          originalState: JSON.stringify(existing),
          newState: JSON.stringify(rows[0]),
        });
      return rows;
    });

    return { success: true, data: updated };
  } catch (error) {
    return toError(error, "Gagal mengaktifkan detail plan kategori.");
  }
}

export async function deleteProjectCategoryPlanItem(
  projectCategoryPlanItemId: string,
): Promise<ActionResponse<{ readonly deletedId: string }>> {
  const validation = deleteProjectCategoryPlanItemSchema.safeParse({ projectCategoryPlanItemId });
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "ID detail plan kategori tidak valid." },
    };
  }

  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  try {
    const existing = await db.query.projectCategoryPlanItem.findFirst({
      where: eq(projectCategoryPlanItem.id, validation.data.projectCategoryPlanItemId),
    });
    if (!existing) throw new Error("CATEGORY_PLAN_ITEM_NOT_FOUND");
    await assertCategoryPlanMutationAccess(user, existing.projectId);
    if (existing.status !== "DRAFT") {
      throw new Error("ONLY_DRAFT_CATEGORY_PLAN_ITEM_CAN_BE_DELETED");
    }

    await db.transaction(async (tx) => {
      await tx.delete(projectCategoryPlanItem).where(eq(projectCategoryPlanItem.id, existing.id));
      await tx
        .insert(auditLog)
        .values({
          userId: user.id,
          action: "DELETE_CATEGORY_PLAN_DRAFT",
          targetTable: "project_category_plan_item",
          targetId: existing.id,
          originalState: JSON.stringify(existing),
        });
    });
    return { success: true, data: { deletedId: existing.id } };
  } catch (error) {
    return toError(error, "Gagal menghapus detail plan kategori.");
  }
}

export async function getProjectCategoryPlanItems(
  projectId: string,
): Promise<ActionResponse<CategoryPlanItem[]>> {
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  try {
    await assertPermission(user, "view:budget");
    const roleName = await resolveRoleName(user.roleId ?? "");
    await assertProjectAccess(projectId, user.id, roleName);

    const items = await db.query.projectCategoryPlanItem.findMany({
      where: eq(projectCategoryPlanItem.projectId, projectId),
      orderBy: (table, { asc }) => [asc(table.displayOrder), asc(table.createdAt)],
    });
    return { success: true, data: items };
  } catch (error) {
    return toError(error, "Gagal mengambil detail plan kategori.");
  }
}
