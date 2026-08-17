"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLog,
  budgetAllocationSetting,
  budgetAllocationSettingCategory,
  expenseCategory,
} from "@/db/schema";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  updateBudgetAllocationCategoryRatioSchema,
  updateBudgetAllocationDefaultsSchema,
  updateBudgetAllocationSettingSchema,
  updateExpenseCategoryDetailsSchema,
  updateExpenseCategorySettingSchema,
  type UpdateBudgetAllocationCategoryRatioInput,
  type UpdateBudgetAllocationDefaultsInput,
  type UpdateBudgetAllocationSettingInput,
  type UpdateExpenseCategoryDetailsInput,
  type UpdateExpenseCategorySettingInput,
} from "@/lib/validations/settings";
import type {
  BudgetAllocationCategoryRow,
  BudgetAllocationSettingRow,
  ExpenseCategorySettingRow,
} from "./system-types";
import {
  CORE_EXPENSE_CATEGORY_CODES,
  assertSettingsPermission,
  getSessionUser,
  mapExpenseCategory,
  revalidateSettings,
  toNullableText,
  toRatio,
  writeSettingsAudit,
} from "./system-utils";
import { getBudgetSettings, getSettingsOverview } from "./system-read";

export async function updateBudgetAllocationDefaults(
  input: UpdateBudgetAllocationDefaultsInput,
): Promise<ActionResponse<BudgetAllocationSettingRow>> {
  const validation = updateBudgetAllocationDefaultsSchema.safeParse(input);
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
  const accessError = await assertSettingsPermission(user, "manage:budget_settings");
  if (accessError) return accessError;

  const existing = await db.query.budgetAllocationSetting.findFirst({
    where: eq(budgetAllocationSetting.id, validation.data.budgetAllocationSettingId),
    with: { categories: { with: { expenseCategory: true } } },
  });
  if (!existing)
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Setting budget tidak ditemukan." },
    };

  const expectedIds = new Set(existing.categories.map((category) => category.id));
  if (
    validation.data.categories.length !== expectedIds.size ||
    validation.data.categories.some(
      (category) => !expectedIds.has(category.budgetAllocationSettingCategoryId),
    )
  ) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Daftar kategori budget tidak lengkap atau tidak sesuai.",
      },
    };
  }

  await db.transaction(async (tx) => {
    const [updatedSetting] = await tx
      .update(budgetAllocationSetting)
      .set({
        name: validation.data.name.trim(),
        budgetCapRatio: toRatio(validation.data.budgetCapRatio),
        notes: toNullableText(validation.data.notes),
        updatedById: user.id,
        updatedAt: new Date(),
      })
      .where(eq(budgetAllocationSetting.id, existing.id))
      .returning();

    for (const inputCategory of validation.data.categories) {
      const currentCategory = existing.categories.find(
        (category) => category.id === inputCategory.budgetAllocationSettingCategoryId,
      );
      if (!currentCategory) continue;
      const [updatedCategory] = await tx
        .update(budgetAllocationSettingCategory)
        .set({
          ratioPercentage: toRatio(inputCategory.ratioPercentage),
          isEnabled: inputCategory.isEnabled,
          updatedAt: new Date(),
        })
        .where(
          eq(budgetAllocationSettingCategory.id, inputCategory.budgetAllocationSettingCategoryId),
        )
        .returning();
      await tx
        .update(expenseCategory)
        .set({
          defaultRatio: toRatio(inputCategory.ratioPercentage),
          updatedAt: new Date(),
        })
        .where(eq(expenseCategory.id, currentCategory.expenseCategoryId));
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "UPDATE_BUDGET_ALLOCATION_CATEGORY",
        targetTable: "budget_allocation_setting_category",
        targetId: updatedCategory.id,
        originalState: JSON.stringify(currentCategory),
        newState: JSON.stringify(updatedCategory),
      });
    }

    await tx.insert(auditLog).values({
      userId: user.id,
      action: "UPDATE_BUDGET_ALLOCATION_DEFAULTS",
      targetTable: "budget_allocation_setting",
      targetId: updatedSetting.id,
      originalState: JSON.stringify(existing),
      newState: JSON.stringify({ setting: updatedSetting, categories: validation.data.categories }),
    });
  });

  revalidateSettings();
  const refreshed = await getBudgetSettings();
  if (!refreshed.success || !refreshed.data.budgetAllocationSetting) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Alokasi tersimpan tetapi gagal dibaca kembali.",
      },
    };
  }
  return { success: true, data: refreshed.data.budgetAllocationSetting };
}

export async function updateBudgetAllocationSetting(
  input: UpdateBudgetAllocationSettingInput,
): Promise<ActionResponse<BudgetAllocationSettingRow>> {
  const validation = updateBudgetAllocationSettingSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Setting budget tidak valid." },
    };
  }

  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  const accessError = await assertSettingsPermission(user, "manage:budget_settings");
  if (accessError) return accessError;

  const existing = await db.query.budgetAllocationSetting.findFirst({
    where: eq(budgetAllocationSetting.id, validation.data.budgetAllocationSettingId),
  });
  if (!existing)
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Setting budget tidak ditemukan." },
    };

  const [updated] = await db
    .update(budgetAllocationSetting)
    .set({
      name: validation.data.name.trim(),
      budgetCapRatio: toRatio(validation.data.budgetCapRatio),
      notes: toNullableText(validation.data.notes),
      updatedById: user.id,
      updatedAt: new Date(),
    })
    .where(eq(budgetAllocationSetting.id, validation.data.budgetAllocationSettingId))
    .returning();

  await writeSettingsAudit({
    userId: user.id,
    action: "UPDATE_BUDGET_ALLOCATION_SETTING",
    targetTable: "budget_allocation_setting",
    targetId: updated.id,
    originalState: existing,
    newState: updated,
  });

  revalidatePath("/settings");
  const overview = await getSettingsOverview();
  if (!overview.success || !overview.data.budgetAllocationSetting) {
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Setting terupdate tetapi gagal dibaca." },
    };
  }
  return { success: true, data: overview.data.budgetAllocationSetting };
}

export async function updateBudgetAllocationCategoryRatio(
  input: UpdateBudgetAllocationCategoryRatioInput,
): Promise<ActionResponse<BudgetAllocationCategoryRow>> {
  const validation = updateBudgetAllocationCategoryRatioSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Ratio kategori tidak valid." },
    };
  }

  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  const accessError = await assertSettingsPermission(user, "manage:budget_settings");
  if (accessError) return accessError;

  const existing = await db.query.budgetAllocationSettingCategory.findFirst({
    where: eq(
      budgetAllocationSettingCategory.id,
      validation.data.budgetAllocationSettingCategoryId,
    ),
    with: { expenseCategory: true },
  });
  if (!existing)
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Kategori allocation tidak ditemukan." },
    };

  const [updated] = await db.transaction(async (tx) => {
    const [category] = await tx
      .update(budgetAllocationSettingCategory)
      .set({
        ratioPercentage: toRatio(validation.data.ratioPercentage),
        isEnabled: validation.data.isEnabled,
        updatedAt: new Date(),
      })
      .where(
        eq(budgetAllocationSettingCategory.id, validation.data.budgetAllocationSettingCategoryId),
      )
      .returning();

    await tx
      .update(expenseCategory)
      .set({
        defaultRatio: toRatio(validation.data.ratioPercentage),
        updatedAt: new Date(),
      })
      .where(eq(expenseCategory.id, existing.expenseCategoryId));

    await tx.insert(auditLog).values({
      userId: user.id,
      action: "UPDATE_BUDGET_ALLOCATION_CATEGORY",
      targetTable: "budget_allocation_setting_category",
      targetId: category.id,
      originalState: JSON.stringify(existing),
      newState: JSON.stringify(category),
    });

    return [category] as const;
  });

  revalidatePath("/settings");
  return {
    success: true,
    data: {
      id: updated.id,
      expenseCategoryId: updated.expenseCategoryId,
      code: existing.expenseCategory.code,
      name: existing.expenseCategory.name,
      ratioPercentage: Number(updated.ratioPercentage),
      isEnabled: updated.isEnabled,
      sortOrder: updated.sortOrder,
    },
  };
}

export async function updateExpenseCategorySetting(
  input: UpdateExpenseCategorySettingInput,
): Promise<ActionResponse<ExpenseCategorySettingRow>> {
  const validation = updateExpenseCategorySettingSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Kategori expense tidak valid." },
    };
  }

  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  const accessError = await assertSettingsPermission(user, "manage:expense_categories");
  if (accessError) return accessError;

  const existing = await db.query.expenseCategory.findFirst({
    where: eq(expenseCategory.id, validation.data.expenseCategoryId),
  });
  if (!existing)
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Kategori expense tidak ditemukan." },
    };

  const [updated] = await db
    .update(expenseCategory)
    .set({
      name: validation.data.name.trim(),
      description: toNullableText(validation.data.description),
      defaultRatio: toRatio(validation.data.defaultRatio),
      isActive: validation.data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(expenseCategory.id, validation.data.expenseCategoryId))
    .returning();

  await writeSettingsAudit({
    userId: user.id,
    action: "UPDATE_EXPENSE_CATEGORY_SETTING",
    targetTable: "expense_category",
    targetId: updated.id,
    originalState: existing,
    newState: updated,
  });

  revalidatePath("/settings");
  return {
    success: true,
    data: {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      description: updated.description,
      defaultRatio: Number(updated.defaultRatio),
      sortOrder: updated.sortOrder,
      isActive: updated.isActive,
      isCore: CORE_EXPENSE_CATEGORY_CODES.has(updated.code),
    },
  };
}

export async function updateExpenseCategoryDetails(
  input: UpdateExpenseCategoryDetailsInput,
): Promise<ActionResponse<ExpenseCategorySettingRow>> {
  const validation = updateExpenseCategoryDetailsSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Detail kategori tidak valid." },
    };
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const accessError = await assertSettingsPermission(user, "manage:expense_categories");
  if (accessError) return accessError;
  const existing = await db.query.expenseCategory.findFirst({
    where: eq(expenseCategory.id, validation.data.expenseCategoryId),
  });
  if (!existing || !CORE_EXPENSE_CATEGORY_CODES.has(existing.code)) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Kategori budget tidak ditemukan." },
    };
  }
  const [updated] = await db
    .update(expenseCategory)
    .set({
      name: validation.data.name.trim(),
      description: toNullableText(validation.data.description),
      updatedAt: new Date(),
    })
    .where(eq(expenseCategory.id, existing.id))
    .returning();
  await writeSettingsAudit({
    userId: user.id,
    action: "UPDATE_EXPENSE_CATEGORY_DETAILS",
    targetTable: "expense_category",
    targetId: updated.id,
    originalState: existing,
    newState: updated,
  });
  revalidateSettings();
  return { success: true, data: mapExpenseCategory(updated) };
}
