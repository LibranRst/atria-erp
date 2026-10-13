import { eq } from "drizzle-orm";

import { db } from "@backend/db";
import { budgetAllocationSetting, budgetAllocationSettingCategory } from "@backend/db/schema";
import type { ActionResponse } from "@atria/core/types/action-response";
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
} from "@atria/core/validations/settings";
import type {
  BudgetAllocationCategoryRow,
  BudgetAllocationSettingRow,
  ExpenseCategorySettingRow,
} from "./system-types";
import { mapExpenseCategory, revalidateSettings } from "./system-utils";
import { getBudgetSettings } from "./system-read";
import { resolveActor } from "@backend/server/actor";
import {
  OperationalSettingsError,
  writeExpenseCategorySettingsTx,
} from "@backend/server/usecases/settings/operational-settings-writer";
import {
  lockBudgetDefaultsTx,
  writeBudgetDefaultsTx,
} from "@backend/server/usecases/settings/budget-defaults-writer";

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
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await db.transaction((tx) => writeBudgetDefaultsTx(tx, actor, validation.data));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    return {
      success: false,
      error: {
        code: message.startsWith("FORBIDDEN:") ? "FORBIDDEN" : "VALIDATION_ERROR",
        message:
          message && !message.startsWith("Failed query:")
            ? message
            : "Default budget belum tersimpan. Periksa isian lalu coba lagi.",
      },
    };
  }

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
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Setting budget tidak valid.",
      },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await db.transaction(async (tx) => {
      await lockBudgetDefaultsTx(tx, actor, validation.data.budgetAllocationSettingId);
      const existing = await tx.query.budgetAllocationSetting.findFirst({
        where: eq(budgetAllocationSetting.id, validation.data.budgetAllocationSettingId),
        with: { categories: true },
      });
      if (!existing) throw new Error("Setting budget tidak ditemukan.");
      await writeBudgetDefaultsTx(tx, actor, {
        ...validation.data,
        categories: existing.categories.map((row) => ({
          budgetAllocationSettingCategoryId: row.id,
          ratioPercentage: Number(row.ratioPercentage),
          isEnabled: row.isEnabled,
        })),
      });
    });
    revalidateSettings();
    const result = await getBudgetSettings();
    if (!result.success || !result.data.budgetAllocationSetting)
      throw new Error("Pengaturan tersimpan tetapi belum dapat dibaca kembali.");
    return { success: true, data: result.data.budgetAllocationSetting };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "";
    return {
      success: false,
      error: {
        code: reason.startsWith("FORBIDDEN:") ? "FORBIDDEN" : "VALIDATION_ERROR",
        message:
          reason && !reason.startsWith("Failed query:") ? reason : "Pengaturan belum tersimpan.",
      },
    };
  }
}

export async function updateBudgetAllocationCategoryRatio(
  input: UpdateBudgetAllocationCategoryRatioInput,
): Promise<ActionResponse<BudgetAllocationCategoryRow>> {
  const validation = updateBudgetAllocationCategoryRatioSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Ratio kategori tidak valid.",
      },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const source = await db.query.budgetAllocationSettingCategory.findFirst({
      where: eq(
        budgetAllocationSettingCategory.id,
        validation.data.budgetAllocationSettingCategoryId,
      ),
    });
    if (!source) throw new Error("Kategori alokasi tidak ditemukan.");
    await db.transaction(async (tx) => {
      await lockBudgetDefaultsTx(tx, actor, source.budgetAllocationSettingId);
      const existing = await tx.query.budgetAllocationSetting.findFirst({
        where: eq(budgetAllocationSetting.id, source.budgetAllocationSettingId),
        with: { categories: true },
      });
      if (!existing) throw new Error("Setting budget tidak ditemukan.");
      await writeBudgetDefaultsTx(tx, actor, {
        budgetAllocationSettingId: existing.id,
        name: existing.name,
        notes: existing.notes,
        budgetCapRatio: Number(existing.budgetCapRatio),
        categories: existing.categories.map((row) => ({
          budgetAllocationSettingCategoryId: row.id,
          ratioPercentage:
            row.id === source.id ? validation.data.ratioPercentage : Number(row.ratioPercentage),
          isEnabled: row.id === source.id ? validation.data.isEnabled : row.isEnabled,
        })),
      });
    });
    revalidateSettings();
    const result = await getBudgetSettings();
    const row = result.success
      ? result.data.budgetAllocationSetting?.categories.find((c) => c.id === source.id)
      : undefined;
    if (!row) throw new Error("Alokasi tersimpan tetapi belum dapat dibaca kembali.");
    return { success: true, data: row };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "";
    return {
      success: false,
      error: {
        code: reason.startsWith("FORBIDDEN:") ? "FORBIDDEN" : "VALIDATION_ERROR",
        message:
          reason && !reason.startsWith("Failed query:") ? reason : "Alokasi belum tersimpan.",
      },
    };
  }
}

export async function updateExpenseCategorySetting(
  input: UpdateExpenseCategorySettingInput,
): Promise<ActionResponse<ExpenseCategorySettingRow>> {
  const parsed = updateExpenseCategorySettingSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Kategori pengeluaran tidak valid." },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const { expenseCategoryId, ...patch } = parsed.data;
    const updated = await db.transaction((tx) =>
      writeExpenseCategorySettingsTx(tx, actor, expenseCategoryId, patch),
    );
    revalidateSettings();
    return { success: true, data: mapExpenseCategory(updated) };
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: error instanceof OperationalSettingsError ? error.code : "TRANSACTION_FAILED",
        message:
          error instanceof OperationalSettingsError
            ? error.message
            : "Kategori belum tersimpan. Periksa pengaturan lalu coba lagi.",
      },
    };
  }
}

export async function updateExpenseCategoryDetails(
  input: UpdateExpenseCategoryDetailsInput,
): Promise<ActionResponse<ExpenseCategorySettingRow>> {
  const parsed = updateExpenseCategoryDetailsSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Detail kategori tidak valid." },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const { expenseCategoryId, ...patch } = parsed.data;
    const updated = await db.transaction((tx) =>
      writeExpenseCategorySettingsTx(tx, actor, expenseCategoryId, patch, null, true),
    );
    revalidateSettings();
    return { success: true, data: mapExpenseCategory(updated) };
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: error instanceof OperationalSettingsError ? error.code : "TRANSACTION_FAILED",
        message:
          error instanceof OperationalSettingsError
            ? error.message
            : "Detail kategori belum tersimpan. Periksa pengaturan lalu coba lagi.",
      },
    };
  }
}
