import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { db } from "@/db";
import {
  auditLog,
  budgetAllocationSettingCategory,
  expenseCategory,
  inventoryLocation,
  itemPriceLibrary,
  materialCategory,
  materialInventory,
  materialMaster,
  vendor,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertPermission, resolveRoleName, type PermissionKey } from "@/lib/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
import type {
  BudgetAllocationSettingRow,
  ExpenseCategorySettingRow,
  ItemPriceLibraryRow,
  MaterialSettingRow,
  SettingsContext,
} from "./system-types";

export type SessionUser = {
  readonly id: string;
  readonly roleId?: string;
  readonly role?: string;
};

export const CORE_EXPENSE_CATEGORY_CODES = new Set([
  "MATERIAL",
  "TUKANG",
  "OPERASIONAL",
  "LAIN_LAIN",
  "SUBCON",
]);

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({
    headers: {
      cookie: (await cookies()).toString(),
    },
  });

  return session?.user ? (session.user as SessionUser) : null;
}

export async function hasPermission(
  user: SessionUser,
  permission: PermissionKey,
): Promise<boolean> {
  try {
    await assertPermission(user, permission);
    return true;
  } catch {
    return false;
  }
}

export async function assertSettingsPermission(
  user: SessionUser,
  permission: PermissionKey,
): Promise<ActionResponse<never> | null> {
  try {
    await assertPermission(user, permission);
    return null;
  } catch (error) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: error instanceof Error ? error.message : "Akses Settings ditolak.",
      },
    };
  }
}

export function toMoney(value: number): string {
  return value.toFixed(2);
}

export function toRatio(value: number): string {
  return value.toFixed(6);
}

export function toNullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function writeSettingsAudit(args: {
  readonly userId: string;
  readonly action: string;
  readonly targetTable: string;
  readonly targetId: string;
  readonly originalState?: unknown;
  readonly newState?: unknown;
}): Promise<void> {
  await db.insert(auditLog).values({
    userId: args.userId,
    action: args.action,
    targetTable: args.targetTable,
    targetId: args.targetId,
    originalState: args.originalState ? JSON.stringify(args.originalState) : null,
    newState: args.newState ? JSON.stringify(args.newState) : null,
  });
}

export function mapItemLibraryRow(
  row: typeof itemPriceLibrary.$inferSelect & {
    readonly expenseCategory: typeof expenseCategory.$inferSelect;
    readonly material: typeof materialMaster.$inferSelect | null;
  },
): ItemPriceLibraryRow {
  return {
    id: row.id,
    expenseCategoryId: row.expenseCategoryId,
    expenseCategoryCode: row.expenseCategory.code,
    materialId: row.materialId,
    materialName: row.material?.name ?? null,
    code: row.code,
    itemType: row.itemType,
    itemCategory: row.itemCategory,
    name: row.name,
    description: row.description,
    unit: row.unit,
    defaultClientPrice: Number(row.defaultClientPrice),
    defaultInternalCost: Number(row.defaultInternalCost),
    isActive: row.isActive,
  };
}

export function mapBudgetSetting(setting: {
  readonly id: string;
  readonly name: string;
  readonly budgetCapRatio: string;
  readonly notes: string | null;
  readonly isActive: boolean;
  readonly categories: ReadonlyArray<
    typeof budgetAllocationSettingCategory.$inferSelect & {
      readonly expenseCategory: typeof expenseCategory.$inferSelect;
    }
  >;
}): BudgetAllocationSettingRow {
  return {
    id: setting.id,
    name: setting.name,
    budgetCapRatio: Number(setting.budgetCapRatio),
    notes: setting.notes,
    isActive: setting.isActive,
    categories: setting.categories.map((category) => ({
      id: category.id,
      expenseCategoryId: category.expenseCategoryId,
      code: category.expenseCategory.code,
      name: category.expenseCategory.name,
      ratioPercentage: Number(category.ratioPercentage),
      isEnabled: category.isEnabled,
      sortOrder: category.sortOrder,
    })),
  };
}

export function mapExpenseCategory(
  category: typeof expenseCategory.$inferSelect,
): ExpenseCategorySettingRow {
  return {
    id: category.id,
    code: category.code,
    name: category.name,
    description: category.description,
    defaultRatio: Number(category.defaultRatio),
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    isCore: CORE_EXPENSE_CATEGORY_CODES.has(category.code),
  };
}

export function mapMaterial(
  material: typeof materialMaster.$inferSelect & {
    readonly category: typeof materialCategory.$inferSelect;
    readonly defaultVendor: typeof vendor.$inferSelect | null;
    readonly inventory: ReadonlyArray<
      typeof materialInventory.$inferSelect & {
        readonly location: typeof inventoryLocation.$inferSelect;
      }
    >;
  },
): MaterialSettingRow {
  return {
    id: material.id,
    categoryId: material.categoryId,
    categoryName: material.category.name,
    defaultVendorId: material.defaultVendorId,
    defaultVendorName: material.defaultVendor?.name ?? null,
    name: material.name,
    specification: material.specification,
    brand: material.brand,
    code: material.code,
    color: material.color,
    unit: material.unit,
    isActive: material.isActive,
    inventory: material.inventory.map((inventory) => ({
      id: inventory.id,
      locationId: inventory.locationId,
      locationName: inventory.location.name,
      currentStock: Number(inventory.currentStock),
      reservedStock: Number(inventory.reservedStock),
      minimumStock: Number(inventory.minimumStock),
      averageCost: Number(inventory.averageCost),
      lastPurchasePrice: Number(inventory.lastPurchasePrice),
    })),
  };
}

export async function getSettingsContextForUser(user: SessionUser): Promise<SettingsContext> {
  return {
    roleName: await resolveRoleName(user.roleId ?? ""),
    permissions: {
      canManageBudgetSettings: await hasPermission(user, "manage:budget_settings"),
      canManageExpenseCategories: await hasPermission(user, "manage:expense_categories"),
      canManageItemLibrary: await hasPermission(user, "manage:item_library"),
      canManageMaterialSettings: await hasPermission(user, "manage:material_settings"),
      canManageUsers: await hasPermission(user, "manage:users"),
      canManageVendors: await hasPermission(user, "manage:vendors"),
    },
  };
}

export function revalidateSettings(): void {
  revalidatePath("/settings");
  revalidatePath("/settings/budget");
  revalidatePath("/settings/categories");
  revalidatePath("/settings/library");
  revalidatePath("/settings/materials");
}
