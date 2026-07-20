"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { and, asc, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  account,
  appConfig,
  auditLog,
  bankAccount,
  budgetAllocationSetting,
  budgetAllocationSettingCategory,
  expenseCategory,
  inventoryLocation,
  role,
  session,
  materialMaster,
  user,
  vendor,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { OWNER_ROLE_ID, STAFF_ROLE_IDS, SYSTEM_ROLES } from "@/lib/auth/role-constants";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { DEFAULT_EXPENSE_CATEGORIES, EXCEL_BUDGET_CAP_RATIO } from "@/lib/budget/excel-budget";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  bootstrapOwnerSchema,
  changeTemporaryPasswordSchema,
  createStaffUserSchema,
  setVendorActiveSchema,
  updateStaffUserSchema,
  vendorAdministrationSchema,
  type BootstrapOwnerInput,
  type ChangeTemporaryPasswordInput,
  type CreateStaffUserInput,
  type UpdateStaffUserInput,
  type VendorAdministrationInput,
} from "@/lib/validations/administration";

const CATEGORY_IDS = [
  "31313131-3131-3131-3131-313131313101",
  "31313131-3131-3131-3131-313131313102",
  "31313131-3131-3131-3131-313131313103",
  "31313131-3131-3131-3131-313131313104",
  "31313131-3131-3131-3131-313131313105",
] as const;
const SETTING_ID = "41414141-4141-4141-4141-414141414101";
const SETTING_CATEGORY_IDS = [
  "42424242-4242-4242-4242-424242424101",
  "42424242-4242-4242-4242-424242424102",
  "42424242-4242-4242-4242-424242424103",
  "42424242-4242-4242-4242-424242424104",
  "42424242-4242-4242-4242-424242424105",
] as const;

type AdministrationUser = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly isActive: boolean;
  readonly mustChangePassword: boolean;
};

export type AdministrationVendor = typeof vendor.$inferSelect;
export type AdministrationOverview = {
  readonly users: readonly AdministrationUser[];
  readonly vendors: readonly AdministrationVendor[];
  readonly roles: readonly { id: string; name: string }[];
};
export type ProductionReadinessItem = { readonly id: string; readonly label: string; readonly ready: boolean; readonly detail: string };

function secureEqual(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

async function currentUser(): Promise<{ id: string; roleId: string } | null> {
  const authSession = await auth.api.getSession({
    headers: { cookie: (await cookies()).toString() },
  });
  return authSession?.user
    ? { id: authSession.user.id, roleId: authSession.user.roleId }
    : null;
}

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export async function getBootstrapStatus(): Promise<ActionResponse<{ readonly required: boolean }>> {
  const existingOwner = await db.query.user.findFirst({
    where: and(eq(user.roleId, OWNER_ROLE_ID), eq(user.isActive, true)),
    columns: { id: true },
  });
  return { success: true, data: { required: !existingOwner } };
}

export async function bootstrapFirstOwner(
  input: BootstrapOwnerInput,
): Promise<ActionResponse<{ readonly userId: string }>> {
  const validation = bootstrapOwnerSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: validation.error.issues[0]?.message ?? "Setup tidak valid." } };
  }
  const configuredSecret = process.env.ATRIA_BOOTSTRAP_SECRET;
  if (!configuredSecret || !secureEqual(validation.data.bootstrapSecret, configuredSecret)) {
    return { success: false, error: { code: "FORBIDDEN", message: "Bootstrap secret tidak valid." } };
  }

  try {
    const passwordHash = await auth.$context.then((context) => context.password.hash(validation.data.password));
    const createdUserId = await db.transaction(async (tx) => {
      await tx.insert(appConfig).values({
        key: "production_bootstrap_lock",
        value: "locked",
        description: "Serialization lock for first Owner provisioning.",
      }).onConflictDoNothing();
      await tx.select({ id: appConfig.id }).from(appConfig)
        .where(eq(appConfig.key, "production_bootstrap_lock"))
        .for("update");
      const existingOwner = await tx.query.user.findFirst({
        where: and(eq(user.roleId, OWNER_ROLE_ID), eq(user.isActive, true)),
      });
      if (existingOwner) throw new Error("BOOTSTRAP_ALREADY_COMPLETED");

      await tx.insert(role).values([...SYSTEM_ROLES]).onConflictDoNothing();
      const [created] = await tx.insert(user).values({
        name: validation.data.name,
        email: validation.data.email,
        emailVerified: true,
        roleId: OWNER_ROLE_ID,
        isActive: true,
        mustChangePassword: false,
      }).returning();
      await tx.insert(account).values({
        id: `credential-${created.id}`,
        accountId: created.id,
        providerId: "credential",
        userId: created.id,
        password: passwordHash,
      });

      await tx.insert(expenseCategory).values(DEFAULT_EXPENSE_CATEGORIES.map((category, index) => ({
        id: CATEGORY_IDS[index],
        code: category.code,
        name: category.name,
        description: category.description,
        defaultRatio: category.defaultRatio.toFixed(6),
        sortOrder: category.sortOrder,
      }))).onConflictDoNothing();
      await tx.insert(budgetAllocationSetting).values({
        id: SETTING_ID,
        name: "Default Project Budget Allocation",
        status: "ACTIVE",
        budgetCapRatio: EXCEL_BUDGET_CAP_RATIO.toFixed(6),
        notes: "Default canonical untuk project baru.",
        isActive: true,
        updatedById: created.id,
      }).onConflictDoNothing();
      await tx.insert(budgetAllocationSettingCategory).values(DEFAULT_EXPENSE_CATEGORIES.map((category, index) => ({
        id: SETTING_CATEGORY_IDS[index],
        budgetAllocationSettingId: SETTING_ID,
        expenseCategoryId: CATEGORY_IDS[index],
        ratioPercentage: category.defaultRatio.toFixed(6),
        isEnabled: true,
        sortOrder: category.sortOrder,
      }))).onConflictDoNothing();
      await tx.insert(appConfig).values({
        key: "production_bootstrap_completed",
        value: new Date().toISOString(),
        description: "First Owner dan canonical settings telah diprovision.",
        updatedById: created.id,
      }).onConflictDoUpdate({
        target: appConfig.key,
        set: { value: new Date().toISOString(), updatedById: created.id, updatedAt: new Date() },
      });
      await tx.insert(auditLog).values({
        userId: created.id,
        action: "BOOTSTRAP_PRODUCTION_FOUNDATION",
        targetTable: "user",
        targetId: created.id,
        newState: JSON.stringify({ email: created.email, roleId: created.roleId, canonicalSettingsInitialized: true }),
      });
      return created.id;
    });
    return { success: true, data: { userId: createdUserId } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Setup production gagal.";
    if (message.includes("BOOTSTRAP_ALREADY_COMPLETED")) {
      return { success: false, error: { code: "CONFLICT", message: "Setup awal sudah pernah diselesaikan." } };
    }
    if (message.includes("unique")) {
      return { success: false, error: { code: "CONFLICT", message: "Email atau setup canonical sudah digunakan." } };
    }
    return { success: false, error: { code: "INTERNAL_SERVER_ERROR", message } };
  }
}

export async function getAdministrationOverview(): Promise<ActionResponse<AdministrationOverview>> {
  const actor = await currentUser();
  if (!actor) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const roleName = await resolveRoleName(actor.roleId);
  if (roleName !== "OWNER" && roleName !== "FINANCE_ADMIN") {
    return { success: false, error: { code: "FORBIDDEN", message: "Administrasi hanya tersedia untuk Owner dan Finance." } };
  }
  const [users, vendors, roles] = await Promise.all([
    db.query.user.findMany({ with: { role: true }, orderBy: [asc(user.name)] }),
    db.query.vendor.findMany({ orderBy: [asc(vendor.name)] }),
    db.query.role.findMany({ orderBy: [asc(role.name)] }),
  ]);
  return {
    success: true,
    data: {
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
      roles: roles.filter((row) => STAFF_ROLE_IDS.has(row.id)).map((row) => ({ id: row.id, name: row.name.toUpperCase() })),
    },
  };
}

export async function getProductionReadiness(): Promise<ActionResponse<readonly ProductionReadinessItem[]>> {
  const actor = await currentUser();
  if (!actor) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  await assertPermission(actor, "view:settings");
  const [users, categories, setting, vendors, locations, accounts, materials] = await Promise.all([
    db.query.user.findMany({ where: eq(user.isActive, true), columns: { roleId: true } }),
    db.query.expenseCategory.findMany({ where: eq(expenseCategory.isActive, true), columns: { code: true } }),
    db.query.budgetAllocationSetting.findFirst({ where: eq(budgetAllocationSetting.isActive, true), columns: { id: true } }),
    db.query.vendor.findMany({ where: eq(vendor.isActive, true), columns: { id: true } }),
    db.query.inventoryLocation.findMany({ where: eq(inventoryLocation.isActive, true), columns: { id: true } }),
    db.query.bankAccount.findMany({ where: eq(bankAccount.isActive, true), columns: { id: true } }),
    db.query.materialMaster.findMany({ where: eq(materialMaster.isActive, true), columns: { id: true } }),
  ]);
  const roleIds = new Set(users.map((row) => row.roleId));
  const categoryCodes = new Set(categories.map((row) => row.code));
  return { success: true, data: [
    { id: "owner", label: "Owner aktif", ready: roleIds.has(OWNER_ROLE_ID), detail: "Approver dan pengelola akses utama." },
    { id: "team", label: "Tim minimum", ready: SYSTEM_ROLES.slice(1).every((row) => roleIds.has(row.id)), detail: "Finance, PM, dan Purchasing aktif." },
    { id: "categories", label: "Kategori canonical", ready: DEFAULT_EXPENSE_CATEGORIES.every((row) => categoryCodes.has(row.code)), detail: "Lima bucket budget tersedia." },
    { id: "budget", label: "Default budget", ready: Boolean(setting), detail: "Formula untuk project baru tersedia." },
    { id: "vendor", label: "Vendor aktif", ready: vendors.length > 0, detail: "Diperlukan untuk vendor bill." },
    { id: "location", label: "Lokasi inventory", ready: locations.length > 0, detail: "Diperlukan untuk Material Master." },
    { id: "bank", label: "Rekening aktif", ready: accounts.length > 0, detail: "Diperlukan untuk cash-in dan cash-out." },
    { id: "material", label: "Material Master", ready: materials.length > 0, detail: "Diperlukan untuk RAP dan stok." },
  ] };
}

export async function createStaffUser(input: CreateStaffUserInput): Promise<ActionResponse<{ readonly id: string }>> {
  const validation = createStaffUserSchema.safeParse(input);
  if (!validation.success) return { success: false, error: { code: "VALIDATION_ERROR", message: validation.error.issues[0]?.message ?? "User tidak valid." } };
  const actor = await currentUser();
  if (!actor) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  await assertPermission(actor, "manage:users");
  if (!STAFF_ROLE_IDS.has(validation.data.roleId)) return { success: false, error: { code: "VALIDATION_ERROR", message: "Role tidak diizinkan." } };
  try {
    const passwordHash = await auth.$context.then((context) => context.password.hash(validation.data.temporaryPassword));
    const created = await db.transaction(async (tx) => {
      const [row] = await tx.insert(user).values({
        name: validation.data.name,
        email: validation.data.email,
        emailVerified: true,
        roleId: validation.data.roleId,
        mustChangePassword: true,
        temporaryPasswordIssuedAt: new Date(),
      }).returning();
      await tx.insert(account).values({ id: `credential-${row.id}`, accountId: row.id, providerId: "credential", userId: row.id, password: passwordHash });
      await tx.insert(auditLog).values({ userId: actor.id, action: "CREATE_STAFF_USER", targetTable: "user", targetId: row.id, newState: JSON.stringify({ name: row.name, email: row.email, roleId: row.roleId, mustChangePassword: true }) });
      return row;
    });
    revalidatePath("/settings");
    return { success: true, data: { id: created.id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat user.";
    return { success: false, error: { code: message.includes("unique") ? "CONFLICT" : "INTERNAL_SERVER_ERROR", message: message.includes("unique") ? "Email sudah digunakan." : message } };
  }
}

export async function updateStaffUser(input: UpdateStaffUserInput): Promise<ActionResponse<{ readonly id: string }>> {
  const validation = updateStaffUserSchema.safeParse(input);
  if (!validation.success) return { success: false, error: { code: "VALIDATION_ERROR", message: validation.error.issues[0]?.message ?? "User tidak valid." } };
  const actor = await currentUser();
  if (!actor) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  await assertPermission(actor, "manage:users");
  try {
    await db.transaction(async (tx) => {
      const existing = await tx.query.user.findFirst({ where: eq(user.id, validation.data.userId) });
      if (!existing) throw new Error("USER_NOT_FOUND");
      const keepsExistingOwnerRole = existing.roleId === OWNER_ROLE_ID && validation.data.roleId === OWNER_ROLE_ID;
      if (!STAFF_ROLE_IDS.has(validation.data.roleId) && !keepsExistingOwnerRole) throw new Error("ROLE_NOT_ALLOWED");
      if (existing.roleId === OWNER_ROLE_ID && (validation.data.roleId !== OWNER_ROLE_ID || !validation.data.isActive)) {
        const otherOwner = await tx.query.user.findFirst({ where: and(eq(user.roleId, OWNER_ROLE_ID), eq(user.isActive, true), ne(user.id, existing.id)) });
        if (!otherOwner) throw new Error("LAST_ACTIVE_OWNER");
      }
      const [updated] = await tx.update(user).set({ name: validation.data.name, roleId: validation.data.roleId, isActive: validation.data.isActive, updatedAt: new Date() }).where(eq(user.id, existing.id)).returning();
      if (!updated.isActive) await tx.delete(session).where(eq(session.userId, updated.id));
      await tx.insert(auditLog).values({ userId: actor.id, action: "UPDATE_STAFF_USER", targetTable: "user", targetId: updated.id, originalState: JSON.stringify(existing), newState: JSON.stringify(updated) });
    });
    revalidatePath("/settings");
    return { success: true, data: { id: validation.data.userId } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memperbarui user.";
    if (message === "LAST_ACTIVE_OWNER") return { success: false, error: { code: "FORBIDDEN", message: "Owner aktif terakhir tidak dapat dinonaktifkan atau diubah rolenya." } };
    if (message === "ROLE_NOT_ALLOWED") return { success: false, error: { code: "VALIDATION_ERROR", message: "Role tidak diizinkan." } };
    if (message === "USER_NOT_FOUND") return { success: false, error: { code: "NOT_FOUND", message: "User tidak ditemukan." } };
    return { success: false, error: { code: "INTERNAL_SERVER_ERROR", message } };
  }
}

export async function changeTemporaryPassword(input: ChangeTemporaryPasswordInput): Promise<ActionResponse<{ readonly changed: true }>> {
  const validation = changeTemporaryPasswordSchema.safeParse(input);
  if (!validation.success) return { success: false, error: { code: "VALIDATION_ERROR", message: validation.error.issues[0]?.message ?? "Password tidak valid." } };
  const actor = await currentUser();
  if (!actor) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const credential = await db.query.account.findFirst({ where: and(eq(account.userId, actor.id), eq(account.providerId, "credential")) });
  if (!credential?.password) return { success: false, error: { code: "NOT_FOUND", message: "Credential user tidak ditemukan." } };
  const context = await auth.$context;
  const valid = await context.password.verify({ hash: credential.password, password: validation.data.currentPassword });
  if (!valid) return { success: false, error: { code: "FORBIDDEN", message: "Password sementara tidak sesuai." } };
  const newHash = await context.password.hash(validation.data.newPassword);
  await db.transaction(async (tx) => {
    await tx.update(account).set({ password: newHash, updatedAt: new Date() }).where(eq(account.id, credential.id));
    await tx.update(user).set({ mustChangePassword: false, temporaryPasswordIssuedAt: null, updatedAt: new Date() }).where(eq(user.id, actor.id));
    await tx.delete(session).where(and(eq(session.userId, actor.id), ne(session.id, "")));
    await tx.insert(auditLog).values({ userId: actor.id, action: "CHANGE_TEMPORARY_PASSWORD", targetTable: "user", targetId: actor.id, newState: JSON.stringify({ mustChangePassword: false }) });
  });
  return { success: true, data: { changed: true } };
}

export async function saveVendor(input: VendorAdministrationInput): Promise<ActionResponse<{ readonly id: string }>> {
  const validation = vendorAdministrationSchema.safeParse(input);
  if (!validation.success) return { success: false, error: { code: "VALIDATION_ERROR", message: validation.error.issues[0]?.message ?? "Vendor tidak valid." } };
  const actor = await currentUser();
  if (!actor) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  await assertPermission(actor, "manage:vendors");
  const values = { name: validation.data.name, email: clean(validation.data.email), phone: validation.data.phone, address: clean(validation.data.address), bankName: clean(validation.data.bankName), bankAccountNumber: clean(validation.data.bankAccountNumber), bankAccountHolder: clean(validation.data.bankAccountHolder), isActive: validation.data.isActive, updatedAt: new Date() };
  try {
    const result = await db.transaction(async (tx) => {
      if (validation.data.vendorId) {
        const existing = await tx.query.vendor.findFirst({ where: eq(vendor.id, validation.data.vendorId) });
        if (!existing) throw new Error("VENDOR_NOT_FOUND");
        const [updated] = await tx.update(vendor).set(values).where(eq(vendor.id, existing.id)).returning();
        await tx.insert(auditLog).values({ userId: actor.id, action: "UPDATE_VENDOR", targetTable: "vendor", targetId: updated.id, originalState: JSON.stringify(existing), newState: JSON.stringify(updated) });
        return updated;
      }
      const [created] = await tx.insert(vendor).values(values).returning();
      await tx.insert(auditLog).values({ userId: actor.id, action: "CREATE_VENDOR", targetTable: "vendor", targetId: created.id, newState: JSON.stringify(created) });
      return created;
    });
    revalidatePath("/settings");
    return { success: true, data: { id: result.id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan vendor.";
    return { success: false, error: { code: message === "VENDOR_NOT_FOUND" ? "NOT_FOUND" : message.includes("unique") ? "CONFLICT" : "INTERNAL_SERVER_ERROR", message: message === "VENDOR_NOT_FOUND" ? "Vendor tidak ditemukan." : message.includes("unique") ? "Email vendor sudah digunakan." : message } };
  }
}

export async function setVendorActive(input: unknown): Promise<ActionResponse<{ readonly id: string }>> {
  const validation = setVendorActiveSchema.safeParse(input);
  if (!validation.success) return { success: false, error: { code: "VALIDATION_ERROR", message: "Vendor tidak valid." } };
  const existing = await db.query.vendor.findFirst({ where: eq(vendor.id, validation.data.vendorId) });
  if (!existing) return { success: false, error: { code: "NOT_FOUND", message: "Vendor tidak ditemukan." } };
  return saveVendor({ ...existing, vendorId: existing.id, isActive: validation.data.isActive });
}
