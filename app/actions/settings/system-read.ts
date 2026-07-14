"use server";

import { and, asc, eq, ilike } from "drizzle-orm";

import { db } from "@/db";
import {
  budgetAllocationSetting,
  budgetAllocationSettingCategory,
  expenseCategory,
  inventoryLocation,
  itemPriceLibrary,
  materialCategory,
  materialMaster,
  vendor,
} from "@/db/schema";
import { resolveRoleName } from "@/lib/auth/permissions";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  getItemPriceLibrarySchema,
  type GetItemPriceLibraryInput,
} from "@/lib/validations/settings";
import type {
  BudgetSettingsData,
  ExpenseCategorySettingsData,
  ItemLibrarySettingsData,
  ItemPriceLibraryRow,
  MaterialSettingsData,
  SettingsContext,
  SettingsHubOverview,
  SettingsOverview,
  SettingsPermissionState,
} from "./system-types";
import {
  assertSettingsPermission,
  getSessionUser,
  getSettingsContextForUser,
  hasPermission,
  mapBudgetSetting,
  mapExpenseCategory,
  mapItemLibraryRow,
  mapMaterial,
  type SessionUser,
} from "./system-utils";

export async function getItemPriceLibrary(
  input: GetItemPriceLibraryInput = {},
): Promise<ActionResponse<readonly ItemPriceLibraryRow[]>> {
  const validation = getItemPriceLibrarySchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Filter item library tidak valid.",
      },
    };
  }

  const user = await getSessionUser();
  if (!user) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
    };
  }

  const accessError = await assertSettingsPermission(user, "view:settings");
  if (accessError) return accessError;

  const filters = [
    validation.data.includeInactive
      ? undefined
      : eq(itemPriceLibrary.isActive, true),
    validation.data.expenseCategoryId
      ? eq(itemPriceLibrary.expenseCategoryId, validation.data.expenseCategoryId)
      : undefined,
    validation.data.itemType
      ? eq(itemPriceLibrary.itemType, validation.data.itemType)
      : undefined,
    validation.data.search
      ? ilike(itemPriceLibrary.name, `%${validation.data.search}%`)
      : undefined,
  ].filter((filter): filter is NonNullable<typeof filter> => Boolean(filter));

  const rows = await db.query.itemPriceLibrary.findMany({
    where: filters.length > 0 ? and(...filters) : undefined,
    with: { expenseCategory: true, material: true },
    orderBy: [asc(itemPriceLibrary.itemCategory), asc(itemPriceLibrary.name)],
  });

  return { success: true, data: rows.map(mapItemLibraryRow) };
}

async function authorizeSettingsRead(): Promise<
  ActionResponse<{ readonly user: SessionUser; readonly context: SettingsContext }>
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
    };
  }
  const accessError = await assertSettingsPermission(user, "view:settings");
  if (accessError) return accessError;
  return {
    success: true,
    data: { user, context: await getSettingsContextForUser(user) },
  };
}

export async function getSettingsHubOverview(): Promise<
  ActionResponse<SettingsHubOverview>
> {
  const authResult = await authorizeSettingsRead();
  if (!authResult.success) return authResult;

  const [setting, categories, items, materials] = await Promise.all([
    db.query.budgetAllocationSetting.findFirst({
      where: eq(budgetAllocationSetting.isActive, true),
      with: { categories: true },
    }),
    db.query.expenseCategory.findMany({
      where: eq(expenseCategory.isActive, true),
    }),
    db.query.itemPriceLibrary.findMany({
      where: eq(itemPriceLibrary.isActive, true),
      columns: { id: true },
    }),
    db.query.materialMaster.findMany({
      where: eq(materialMaster.isActive, true),
      columns: { id: true },
    }),
  ]);
  const allocation =
    setting?.categories.reduce(
      (total, category) =>
        total + (category.isEnabled ? Number(category.ratioPercentage) : 0),
      0,
    ) ?? 0;

  return {
    success: true,
    data: {
      ...authResult.data.context,
      budgetCapRatio: Number(setting?.budgetCapRatio ?? 0),
      categoryAllocationRatio: allocation,
      unallocatedBufferRatio: Math.max(0, 1 - allocation),
      activeCategoryCount: categories.length,
      activeItemCount: items.length,
      activeMaterialCount: materials.length,
    },
  };
}

export async function getBudgetSettings(): Promise<
  ActionResponse<BudgetSettingsData>
> {
  const authResult = await authorizeSettingsRead();
  if (!authResult.success) return authResult;
  const setting = await db.query.budgetAllocationSetting.findFirst({
    where: eq(budgetAllocationSetting.isActive, true),
    with: {
      categories: {
        with: { expenseCategory: true },
        orderBy: [asc(budgetAllocationSettingCategory.sortOrder)],
      },
    },
  });
  return {
    success: true,
    data: {
      ...authResult.data.context,
      budgetAllocationSetting: setting ? mapBudgetSetting(setting) : null,
    },
  };
}

export async function getExpenseCategorySettings(): Promise<
  ActionResponse<ExpenseCategorySettingsData>
> {
  const authResult = await authorizeSettingsRead();
  if (!authResult.success) return authResult;
  const categories = await db.query.expenseCategory.findMany({
    orderBy: [asc(expenseCategory.sortOrder)],
  });
  return {
    success: true,
    data: {
      ...authResult.data.context,
      expenseCategories: categories.map(mapExpenseCategory),
    },
  };
}

export async function getItemLibrarySettings(): Promise<
  ActionResponse<ItemLibrarySettingsData>
> {
  const authResult = await authorizeSettingsRead();
  if (!authResult.success) return authResult;
  const [categories, items, materials, vendors] = await Promise.all([
    db.query.expenseCategory.findMany({
      orderBy: [asc(expenseCategory.sortOrder)],
    }),
    db.query.itemPriceLibrary.findMany({
      with: { expenseCategory: true, material: true },
      orderBy: [asc(itemPriceLibrary.itemCategory), asc(itemPriceLibrary.name)],
    }),
    db.query.materialMaster.findMany({
      columns: { id: true, name: true, isActive: true },
      orderBy: [asc(materialMaster.name)],
    }),
    db.query.vendor.findMany({
      columns: { id: true, name: true },
      orderBy: [asc(vendor.name)],
    }),
  ]);
  return {
    success: true,
    data: {
      ...authResult.data.context,
      expenseCategories: categories.map(mapExpenseCategory),
      itemLibrary: items.map(mapItemLibraryRow),
      materials,
      vendors,
    },
  };
}

export async function getMaterialSettings(): Promise<
  ActionResponse<MaterialSettingsData>
> {
  const authResult = await authorizeSettingsRead();
  if (!authResult.success) return authResult;
  const [categories, vendors, locations, materials] = await Promise.all([
    db.query.materialCategory.findMany({ orderBy: [asc(materialCategory.name)] }),
    db.query.vendor.findMany({ orderBy: [asc(vendor.name)] }),
    db.query.inventoryLocation.findMany({
      where: eq(inventoryLocation.isActive, true),
      orderBy: [asc(inventoryLocation.name)],
    }),
    db.query.materialMaster.findMany({
      with: {
        category: true,
        defaultVendor: true,
        inventory: { with: { location: true } },
      },
      orderBy: [asc(materialMaster.name)],
    }),
  ]);
  return {
    success: true,
    data: {
      ...authResult.data.context,
      materialCategories: categories.map((category) => ({
        id: category.id,
        name: category.name,
      })),
      vendors: vendors.map((row) => ({ id: row.id, name: row.name })),
      inventoryLocations: locations.map((location) => ({
        id: location.id,
        name: location.name,
      })),
      materials: materials.map(mapMaterial),
    },
  };
}

export async function getSettingsOverview(): Promise<
  ActionResponse<SettingsOverview>
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
    };
  }

  const accessError = await assertSettingsPermission(user, "view:settings");
  if (accessError) return accessError;

  const roleName = await resolveRoleName(user.roleId ?? "");
  const permissions: SettingsPermissionState = {
    canManageBudgetSettings: await hasPermission(user, "manage:budget_settings"),
    canManageExpenseCategories: await hasPermission(
      user,
      "manage:expense_categories",
    ),
    canManageItemLibrary: await hasPermission(user, "manage:item_library"),
    canManageMaterialSettings: await hasPermission(
      user,
      "manage:material_settings",
    ),
  };

  const [
    setting,
    categories,
    libraryRows,
    materialCategories,
    vendors,
    locations,
    materials,
  ] = await Promise.all([
    db.query.budgetAllocationSetting.findFirst({
      where: eq(budgetAllocationSetting.isActive, true),
      with: {
        categories: {
          with: { expenseCategory: true },
          orderBy: [asc(budgetAllocationSettingCategory.sortOrder)],
        },
      },
    }),
    db.query.expenseCategory.findMany({
      orderBy: [asc(expenseCategory.sortOrder)],
    }),
    db.query.itemPriceLibrary.findMany({
      with: { expenseCategory: true, material: true },
      orderBy: [asc(itemPriceLibrary.itemCategory), asc(itemPriceLibrary.name)],
    }),
    db.query.materialCategory.findMany({ orderBy: [asc(materialCategory.name)] }),
    db.query.vendor.findMany({ orderBy: [asc(vendor.name)] }),
    db.query.inventoryLocation.findMany({
      where: eq(inventoryLocation.isActive, true),
      orderBy: [asc(inventoryLocation.name)],
    }),
    db.query.materialMaster.findMany({
      with: {
        category: true,
        defaultVendor: true,
        inventory: { with: { location: true } },
      },
      orderBy: [asc(materialMaster.name)],
    }),
  ]);

  return {
    success: true,
    data: {
      roleName,
      permissions,
      budgetAllocationSetting: setting ? mapBudgetSetting(setting) : null,
      expenseCategories: categories.map(mapExpenseCategory),
      itemLibrary: libraryRows.map(mapItemLibraryRow),
      materialCategories: materialCategories.map((category) => ({
        id: category.id,
        name: category.name,
      })),
      vendors: vendors.map((row) => ({ id: row.id, name: row.name })),
      inventoryLocations: locations.map((location) => ({
        id: location.id,
        name: location.name,
      })),
      materials: materials.map(mapMaterial),
    },
  };
}
