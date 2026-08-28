"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLog,
  itemPriceLibrary,
  projectBudgetCategory,
  projectBudgets,
  projectCategoryPlanItem,
  projectRap,
  projectRapItem,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { actorHasPermission, assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { assertProjectAccess } from "@/lib/auth/scoping";
import { getBudgetCategoryStatus } from "@atria/core/budget/excel-budget";
import { getRapItemAvailabilityStatus } from "@atria/core/project/rap-rab";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  copyTemplateToCategoryPlanSchema,
  copyTemplateToRapSchema,
  reallocateProjectBudgetSchema,
} from "@atria/core/validations/workflow-governance";

type SessionUser = { readonly id: string; readonly roleId?: string };
type RapItem = typeof projectRapItem.$inferSelect;
type CategoryPlanItem = typeof projectCategoryPlanItem.$inferSelect;

async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: { cookie: (await cookies()).toString() } });
  return session?.user ? (session.user as SessionUser) : null;
}

function toFailure<T>(error: unknown, fallback: string): ActionResponse<T> {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes("FORBIDDEN") || message.includes("Akses")) {
    return { success: false, error: { code: "FORBIDDEN", message } };
  }
  if (message.includes("NOT_FOUND"))
    return { success: false, error: { code: "NOT_FOUND", message: fallback } };
  return { success: false, error: { code: "TRANSACTION_FAILED", message } };
}

async function assertScopedPermission(
  user: SessionUser,
  projectId: string,
  permission: "update:rap" | "update:budget",
): Promise<string> {
  await assertPermission(user, permission);
  const roleName = await resolveRoleName(user.roleId ?? "");
  await assertProjectAccess(projectId, user.id, roleName);
  return roleName;
}

export async function copyPricingTemplateToRap(input: unknown): Promise<ActionResponse<RapItem>> {
  const validation = copyTemplateToRapSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Template RAP tidak valid.",
      },
    };
  }
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction(async (tx) => {
      const rap = await tx.query.projectRap.findFirst({
        where: eq(projectRap.id, validation.data.projectRapId),
      });
      if (!rap) throw new Error("RAP_NOT_FOUND");
      if (rap.status !== "DRAFT")
        throw new Error("RAP revision harus DRAFT untuk menerima template.");
      await assertScopedPermission(user, rap.projectId, "update:rap");
      const template = await tx.query.itemPriceLibrary.findFirst({
        where: eq(itemPriceLibrary.id, validation.data.itemPriceLibraryId),
      });
      if (!template || !template.isActive) throw new Error("ITEM_PRICE_LIBRARY_NOT_FOUND");
      if (template.itemType !== "MATERIAL_ITEM")
        throw new Error("Hanya Material Item yang dapat disalin ke RAP Material.");
      if (!template.materialId)
        throw new Error("Template Material Item belum tertaut ke Material Master.");

      const unitCost = validation.data.overrideUnitCost ?? Number(template.defaultInternalCost);
      const totalQuantity = validation.data.requiredQuantity + validation.data.bufferQuantity;
      const materialId = template.materialId;
      const material = await tx.query.materialMaster.findFirst({
        where: (table, { eq: equals }) => equals(table.id, materialId),
        with: { inventory: true },
      });
      const availableStock =
        material?.inventory.reduce(
          (sum, inventory) =>
            sum + Number(inventory.currentStock) - Number(inventory.reservedStock),
          0,
        ) ?? 0;
      const [created] = await tx
        .insert(projectRapItem)
        .values({
          projectRapId: rap.id,
          materialId,
          sourceLibraryItemId: template.id,
          area: validation.data.area,
          name: template.name,
          description: template.description,
          requiredQuantity: validation.data.requiredQuantity.toFixed(2),
          bufferQuantity: validation.data.bufferQuantity.toFixed(2),
          totalQuantity: totalQuantity.toFixed(2),
          unit: template.unit,
          estimatedUnitCost: unitCost.toFixed(2),
          estimatedTotalCost: (unitCost * totalQuantity).toFixed(2),
          suggestedClientUnitPrice: template.defaultClientPrice,
          source: validation.data.source,
          status: getRapItemAvailabilityStatus({
            totalQuantity,
            availableStock,
            source: validation.data.source,
          }),
          internalNote:
            validation.data.overrideReason ??
            `Snapshot template ${template.code ?? template.name}.`,
        })
        .returning();
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "COPY_PRICING_TEMPLATE_TO_RAP",
        targetTable: "project_rap_item",
        targetId: created.id,
        newState: JSON.stringify({
          ...created,
          templateId: template.id,
          overrideReason: validation.data.overrideReason ?? null,
        }),
      });
      return { created, projectId: rap.projectId };
    });
    revalidatePath(`/projects/${result.projectId}`);
    return { success: true, data: result.created };
  } catch (error) {
    return toFailure(error, "Gagal menyalin template ke RAP.");
  }
}

export async function copyPricingTemplateToCategoryPlan(
  input: unknown,
): Promise<ActionResponse<CategoryPlanItem>> {
  const validation = copyTemplateToCategoryPlanSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Template package tidak valid.",
      },
    };
  }
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction(async (tx) => {
      await assertScopedPermission(user, validation.data.projectId, "update:budget");
      const category = await tx.query.projectBudgetCategory.findFirst({
        where: eq(projectBudgetCategory.id, validation.data.projectBudgetCategoryId),
        with: { expenseCategory: true, budget: true },
      });
      if (!category || category.budget.projectId !== validation.data.projectId)
        throw new Error("PROJECT_BUDGET_CATEGORY_NOT_FOUND");
      const template = await tx.query.itemPriceLibrary.findFirst({
        where: eq(itemPriceLibrary.id, validation.data.itemPriceLibraryId),
      });
      if (!template || !template.isActive) throw new Error("ITEM_PRICE_LIBRARY_NOT_FOUND");
      const expectedType =
        category.expenseCategory.code === "TUKANG"
          ? "WORK_PACKAGE"
          : category.expenseCategory.code === "SUBCON"
            ? "SUBCON_PACKAGE"
            : null;
      if (!expectedType || template.itemType !== expectedType) {
        throw new Error("Tipe template tidak sesuai dengan kategori budget proyek.");
      }
      const unitCost = validation.data.overrideUnitCost ?? Number(template.defaultInternalCost);
      const [created] = await tx
        .insert(projectCategoryPlanItem)
        .values({
          projectId: validation.data.projectId,
          projectBudgetId: category.projectBudgetId,
          projectBudgetCategoryId: category.id,
          expenseCategoryId: category.expenseCategoryId,
          vendorId: template.defaultVendorId,
          sourceLibraryItemId: template.id,
          name: template.name,
          scopeDescription: template.description,
          area: validation.data.area,
          quantity: validation.data.quantity.toFixed(2),
          unit: template.unit,
          estimatedUnitCost: unitCost.toFixed(2),
          estimatedTotalCost: (unitCost * validation.data.quantity).toFixed(2),
          suggestedClientUnitPrice: template.defaultClientPrice,
          status: "DRAFT",
          internalNote:
            validation.data.overrideReason ??
            `Snapshot template ${template.code ?? template.name}.`,
        })
        .returning();
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "COPY_PRICING_TEMPLATE_TO_CATEGORY_PLAN",
        targetTable: "project_category_plan_item",
        targetId: created.id,
        newState: JSON.stringify({
          ...created,
          templateId: template.id,
          overrideReason: validation.data.overrideReason ?? null,
        }),
      });
      return created;
    });
    revalidatePath(`/projects/${validation.data.projectId}`);
    return { success: true, data: result };
  } catch (error) {
    return toFailure(error, "Gagal menyalin template package ke proyek.");
  }
}

export async function reallocateProjectBudget(input: unknown): Promise<
  ActionResponse<{
    readonly projectBudgetId: string;
    readonly totalAllocationRatio: number;
    readonly unallocatedBufferRatio: number;
  }>
> {
  const validation = reallocateProjectBudgetSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Alokasi budget tidak valid.",
      },
    };
  }
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const budget = await db.query.projectBudgets.findFirst({
      where: eq(projectBudgets.id, validation.data.projectBudgetId),
      with: { categories: true },
    });
    if (!budget) throw new Error("PROJECT_BUDGET_NOT_FOUND");
    const roleName = await assertScopedPermission(user, budget.projectId, "update:budget");
    if (budget.status === "APPROVED") {
      // Mengubah budget yang sudah disetujui menuntut wewenang yang sama dengan
      // menyetujuinya — `update:budget` saja tidak cukup.
      if (!actorHasPermission(roleName, "approve:budget"))
        throw new Error(
          "FORBIDDEN: Budget approved hanya dapat direalokasi oleh penyetuju budget.",
        );
      if (!validation.data.reason || validation.data.reason.length < 10)
        throw new Error("Alasan minimal 10 karakter wajib untuk budget approved.");
    }
    const existingIds = new Set(budget.categories.map((category) => category.id));
    if (
      validation.data.categories.some(
        (category) => !existingIds.has(category.projectBudgetCategoryId),
      )
    ) {
      throw new Error("PROJECT_BUDGET_CATEGORY_NOT_FOUND");
    }
    const totalAllocationRatio = validation.data.categories.reduce(
      (sum, category) => sum + category.ratioPercentage,
      0,
    );
    await db.transaction(async (tx) => {
      const categoryIds = validation.data.categories.map(
        (category) => category.projectBudgetCategoryId,
      );
      const current = await tx.query.projectBudgetCategory.findMany({
        where: inArray(projectBudgetCategory.id, categoryIds),
      });
      for (const categoryInput of validation.data.categories) {
        const category = current.find((item) => item.id === categoryInput.projectBudgetCategoryId);
        if (!category) throw new Error("PROJECT_BUDGET_CATEGORY_NOT_FOUND");
        const allocatedAmount = Number(budget.internalBudget) * categoryInput.ratioPercentage;
        const actualAmount = Number(category.actualAmount);
        const usedPercentage =
          allocatedAmount > 0 ? (actualAmount / allocatedAmount) * 100 : actualAmount > 0 ? 100 : 0;
        await tx
          .update(projectBudgetCategory)
          .set({
            ratioPercentage: categoryInput.ratioPercentage.toFixed(6),
            allocatedAmount: allocatedAmount.toFixed(2),
            remainingAmount: (allocatedAmount - actualAmount).toFixed(2),
            usedPercentage: usedPercentage.toFixed(4),
            status: getBudgetCategoryStatus(usedPercentage),
            isManualOverride: true,
            updatedAt: new Date(),
          })
          .where(eq(projectBudgetCategory.id, category.id));
      }
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "REALLOCATE_PROJECT_BUDGET",
        targetTable: "project_budgets",
        targetId: budget.id,
        originalState: JSON.stringify(budget.categories),
        newState: JSON.stringify({
          categories: validation.data.categories,
          reason: validation.data.reason ?? null,
        }),
      });
    });
    revalidatePath(`/projects/${budget.projectId}`);
    return {
      success: true,
      data: {
        projectBudgetId: budget.id,
        totalAllocationRatio,
        unallocatedBufferRatio: Math.max(0, 1 - totalAllocationRatio),
      },
    };
  } catch (error) {
    return toFailure(error, "Gagal merealokasi budget proyek.");
  }
}
