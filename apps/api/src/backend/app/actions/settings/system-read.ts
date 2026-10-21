import { and, asc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@backend/db";
import {
  budgetAllocationSetting,
  budgetAllocationSettingCategory,
  expenseCategory,
  inventoryLocation,
  itemPriceLibrary,
  materialCategory,
  materialMaster,
  materialInventory,
  INSTANCE_TENANT_ID,
  vendor,
} from "@backend/db/schema";
import { resolveRoleName } from "@backend/lib/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  getItemPriceLibrarySchema,
  type GetItemPriceLibraryInput,
} from "@atria/core/validations/settings";
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

function materialReadScope(): SQL | undefined {
  return and(
    eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
    inArray(
      materialMaster.categoryId,
      db
        .select({ id: materialCategory.id })
        .from(materialCategory)
        .where(eq(materialCategory.tenantId, INSTANCE_TENANT_ID)),
    ),
    or(
      isNull(materialMaster.defaultVendorId),
      inArray(
        materialMaster.defaultVendorId,
        db.select({ id: vendor.id }).from(vendor).where(eq(vendor.tenantId, INSTANCE_TENANT_ID)),
      ),
    ),
  );
}

function inventoryReadScope(): SQL | undefined {
  return and(
    eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
    inArray(
      materialInventory.locationId,
      db
        .select({ id: inventoryLocation.id })
        .from(inventoryLocation)
        .where(eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID)),
    ),
  );
}

function libraryReadScope(): SQL | undefined {
  return and(
    eq(itemPriceLibrary.tenantId, INSTANCE_TENANT_ID),
    inArray(
      itemPriceLibrary.expenseCategoryId,
      db
        .select({ id: expenseCategory.id })
        .from(expenseCategory)
        .where(eq(expenseCategory.tenantId, INSTANCE_TENANT_ID)),
    ),
    or(
      isNull(itemPriceLibrary.materialId),
      inArray(
        itemPriceLibrary.materialId,
        db
          .select({ id: materialMaster.id })
          .from(materialMaster)
          .where(eq(materialMaster.tenantId, INSTANCE_TENANT_ID)),
      ),
    ),
  );
}

function allocationReadScope(): SQL | undefined {
  return and(
    eq(budgetAllocationSettingCategory.tenantId, INSTANCE_TENANT_ID),
    inArray(
      budgetAllocationSettingCategory.expenseCategoryId,
      db
        .select({ id: expenseCategory.id })
        .from(expenseCategory)
        .where(eq(expenseCategory.tenantId, INSTANCE_TENANT_ID)),
    ),
  );
}

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
    libraryReadScope(),
    validation.data.includeInactive ? undefined : eq(itemPriceLibrary.isActive, true),
    validation.data.expenseCategoryId
      ? eq(itemPriceLibrary.expenseCategoryId, validation.data.expenseCategoryId)
      : undefined,
    validation.data.itemType ? eq(itemPriceLibrary.itemType, validation.data.itemType) : undefined,
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

export async function getSettingsHubOverview(): Promise<ActionResponse<SettingsHubOverview>> {
  const authResult = await authorizeSettingsRead();
  if (!authResult.success) return authResult;

  const [setting, categories, items, materials] = await Promise.all([
    db.query.budgetAllocationSetting.findFirst({
      where: and(
        eq(budgetAllocationSetting.tenantId, INSTANCE_TENANT_ID),
        eq(budgetAllocationSetting.isActive, true),
      ),
      with: { categories: { where: allocationReadScope() } },
    }),
    db.query.expenseCategory.findMany({
      where: and(
        eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
        eq(expenseCategory.isActive, true),
      ),
    }),
    db.query.itemPriceLibrary.findMany({
      where: and(libraryReadScope(), eq(itemPriceLibrary.isActive, true)),
      columns: { id: true },
    }),
    db.query.materialMaster.findMany({
      where: and(materialReadScope(), eq(materialMaster.isActive, true)),
      columns: { id: true },
    }),
  ]);
  const allocation =
    setting?.categories.reduce(
      (total, category) => total + (category.isEnabled ? Number(category.ratioPercentage) : 0),
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

export async function getBudgetSettings(): Promise<ActionResponse<BudgetSettingsData>> {
  const authResult = await authorizeSettingsRead();
  if (!authResult.success) return authResult;
  const setting = await db.query.budgetAllocationSetting.findFirst({
    where: and(
      eq(budgetAllocationSetting.tenantId, INSTANCE_TENANT_ID),
      eq(budgetAllocationSetting.isActive, true),
    ),
    with: {
      categories: {
        where: allocationReadScope(),
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
    where: eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
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

export async function getItemLibrarySettings(): Promise<ActionResponse<ItemLibrarySettingsData>> {
  const authResult = await authorizeSettingsRead();
  if (!authResult.success) return authResult;
  const [categories, items, materials, vendors] = await Promise.all([
    db.query.expenseCategory.findMany({
      where: eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
      orderBy: [asc(expenseCategory.sortOrder)],
    }),
    db.query.itemPriceLibrary.findMany({
      where: libraryReadScope(),
      with: { expenseCategory: true, material: true },
      orderBy: [asc(itemPriceLibrary.itemCategory), asc(itemPriceLibrary.name)],
    }),
    db.query.materialMaster.findMany({
      where: materialReadScope(),
      columns: { id: true, name: true, isActive: true },
      orderBy: [asc(materialMaster.name)],
    }),
    db.query.vendor.findMany({
      where: eq(vendor.tenantId, INSTANCE_TENANT_ID),
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

export async function getMaterialSettings(): Promise<ActionResponse<MaterialSettingsData>> {
  const authResult = await authorizeSettingsRead();
  if (!authResult.success) return authResult;
  const [categories, vendors, locations, materials] = await Promise.all([
    db.query.materialCategory.findMany({
      where: eq(materialCategory.tenantId, INSTANCE_TENANT_ID),
      orderBy: [asc(materialCategory.name)],
    }),
    db.query.vendor.findMany({
      where: eq(vendor.tenantId, INSTANCE_TENANT_ID),
      orderBy: [asc(vendor.name)],
    }),
    db.query.inventoryLocation.findMany({
      where: and(
        eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
        eq(inventoryLocation.isActive, true),
      ),
      orderBy: [asc(inventoryLocation.name)],
    }),
    db.query.materialMaster.findMany({
      where: materialReadScope(),
      with: {
        category: true,
        defaultVendor: true,
        inventory: { where: inventoryReadScope(), with: { location: true } },
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

export async function getSettingsOverview(): Promise<ActionResponse<SettingsOverview>> {
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
    canManageExpenseCategories: await hasPermission(user, "manage:expense_categories"),
    canManageItemLibrary: await hasPermission(user, "manage:item_library"),
    canManageMaterialSettings: await hasPermission(user, "manage:material_settings"),
    canManageUsers: await hasPermission(user, "manage:users"),
    canManageVendors: await hasPermission(user, "manage:vendors"),
  };

  const [setting, categories, libraryRows, materialCategories, vendors, locations, materials] =
    await Promise.all([
      db.query.budgetAllocationSetting.findFirst({
        where: and(
          eq(budgetAllocationSetting.tenantId, INSTANCE_TENANT_ID),
          eq(budgetAllocationSetting.isActive, true),
        ),
        with: {
          categories: {
            where: allocationReadScope(),
            with: { expenseCategory: true },
            orderBy: [asc(budgetAllocationSettingCategory.sortOrder)],
          },
        },
      }),
      db.query.expenseCategory.findMany({
        where: eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
        orderBy: [asc(expenseCategory.sortOrder)],
      }),
      db.query.itemPriceLibrary.findMany({
        where: libraryReadScope(),
        with: { expenseCategory: true, material: true },
        orderBy: [asc(itemPriceLibrary.itemCategory), asc(itemPriceLibrary.name)],
      }),
      db.query.materialCategory.findMany({
        where: eq(materialCategory.tenantId, INSTANCE_TENANT_ID),
        orderBy: [asc(materialCategory.name)],
      }),
      db.query.vendor.findMany({
        where: eq(vendor.tenantId, INSTANCE_TENANT_ID),
        orderBy: [asc(vendor.name)],
      }),
      db.query.inventoryLocation.findMany({
        where: and(
          eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
          eq(inventoryLocation.isActive, true),
        ),
        orderBy: [asc(inventoryLocation.name)],
      }),
      db.query.materialMaster.findMany({
        where: materialReadScope(),
        with: {
          category: true,
          defaultVendor: true,
          inventory: {
            where: inventoryReadScope(),
            with: { location: true },
          },
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
