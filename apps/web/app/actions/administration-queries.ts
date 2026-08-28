"use server";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  bankAccount,
  budgetAllocationSetting,
  expenseCategory,
  inventoryLocation,
  materialMaster,
  role,
  user,
  vendor,
} from "@/db/schema";
import { getAdministrationCapabilities } from "@atria/core/auth/administration-access";
import { assertPermission } from "@/lib/auth/permissions";
import { getRolePermissions } from "@/lib/auth/role-access";
import { OWNER_ROLE_ID, SYSTEM_ROLES } from "@atria/core/auth/role-constants";
import { DEFAULT_EXPENSE_CATEGORIES } from "@atria/core/budget/excel-budget";
import type { ActionResponse } from "@atria/core/types/action-response";
import { getAdministrationActor as currentUser } from "./administration-action-utils";
import type { AdministrationOverview, ProductionReadinessItem } from "./administration-types";
export async function getAdministrationOverview(): Promise<ActionResponse<AdministrationOverview>> {
  const actor = await currentUser();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const permissions = new Set(await getRolePermissions(actor.roleId));
  const capabilities = getAdministrationCapabilities((permission) => permissions.has(permission));
  if (!capabilities.canViewUsers && !capabilities.canViewVendors && !capabilities.canManageRoles) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Peran Anda tidak memiliki akses administrasi." },
    };
  }
  const [users, vendors, roles] = await Promise.all([
    capabilities.canViewUsers
      ? db.query.user.findMany({ with: { role: true }, orderBy: [asc(user.name)] })
      : Promise.resolve([]),
    capabilities.canViewVendors
      ? db.query.vendor.findMany({ orderBy: [asc(vendor.name)] })
      : Promise.resolve([]),
    capabilities.canManageUsers
      ? db.query.role.findMany({ orderBy: [asc(role.name)] })
      : Promise.resolve([]),
  ]);
  return {
    success: true,
    data: {
      capabilities,
      users: users.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        roleId: row.roleId,
        roleName: row.role.name.toUpperCase(),
        isActive: row.isActive,
        mustChangePassword: row.mustChangePassword,
      })),
      vendors,
      // Setiap peran yang ada di database bisa ditugaskan — termasuk peran
      // buatan Owner. Menyaringnya ke empat peran bawaan akan membuat peran
      // baru bisa dibuat tetapi tidak pernah bisa dipakai siapa pun.
      roles: roles.map((row) => ({ id: row.id, name: row.name.toUpperCase() })),
    },
  };
}

export async function getProductionReadiness(): Promise<
  ActionResponse<readonly ProductionReadinessItem[]>
> {
  const actor = await currentUser();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  await assertPermission(actor, "view:settings");
  const [users, categories, setting, vendors, locations, accounts, materials] = await Promise.all([
    db.query.user.findMany({ where: eq(user.isActive, true), columns: { roleId: true } }),
    db.query.expenseCategory.findMany({
      where: eq(expenseCategory.isActive, true),
      columns: { code: true },
    }),
    db.query.budgetAllocationSetting.findFirst({
      where: eq(budgetAllocationSetting.isActive, true),
      columns: { id: true },
    }),
    db.query.vendor.findMany({ where: eq(vendor.isActive, true), columns: { id: true } }),
    db.query.inventoryLocation.findMany({
      where: eq(inventoryLocation.isActive, true),
      columns: { id: true },
    }),
    db.query.bankAccount.findMany({ where: eq(bankAccount.isActive, true), columns: { id: true } }),
    db.query.materialMaster.findMany({
      where: eq(materialMaster.isActive, true),
      columns: { id: true },
    }),
  ]);
  const roleIds = new Set(users.map((row) => row.roleId));
  const categoryCodes = new Set(categories.map((row) => row.code));
  return {
    success: true,
    data: [
      {
        id: "owner",
        label: "Owner aktif",
        ready: roleIds.has(OWNER_ROLE_ID),
        detail: "Approver dan pengelola akses utama.",
      },
      {
        id: "team",
        label: "Tim minimum",
        ready: SYSTEM_ROLES.slice(1).every((row) => roleIds.has(row.id)),
        detail: "Finance, PM, dan Purchasing aktif.",
      },
      {
        id: "categories",
        label: "Kategori biaya utama",
        ready: DEFAULT_EXPENSE_CATEGORIES.every((row) => categoryCodes.has(row.code)),
        detail: "Lima bucket budget tersedia.",
      },
      {
        id: "budget",
        label: "Default budget",
        ready: Boolean(setting),
        detail: "Formula untuk project baru tersedia.",
      },
      {
        id: "vendor",
        label: "Vendor aktif",
        ready: vendors.length > 0,
        detail: "Diperlukan untuk vendor bill.",
      },
      {
        id: "location",
        label: "Lokasi inventory",
        ready: locations.length > 0,
        detail: "Diperlukan untuk Material Master.",
      },
      {
        id: "bank",
        label: "Rekening aktif",
        ready: accounts.length > 0,
        detail: "Diperlukan untuk cash-in dan cash-out.",
      },
      {
        id: "material",
        label: "Material Master",
        ready: materials.length > 0,
        detail: "Diperlukan untuk RAP dan stok.",
      },
    ],
  };
}
