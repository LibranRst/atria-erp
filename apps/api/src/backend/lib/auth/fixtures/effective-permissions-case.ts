import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { expect, mock } from "bun:test";
import { eq } from "drizzle-orm";
import * as schema from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";

const client = new PGlite();
const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
await client.exec(statements.join(";\n"));
const database = drizzle(client, { schema });
mock.module("@backend/db", () => ({ db: database }));
const { getRoleAccess, getRoleDataScopeByName, roleNameHasPermission } =
  await import("@backend/lib/auth/role-access");
const roleId = crypto.randomUUID();
await database
  .insert(schema.role)
  .values({ id: roleId, name: "finance_admin", dataScope: "GLOBAL" });
await database.insert(schema.rolePermission).values({ roleId, permissionKey: "pay:cost" });
expect((await getRoleAccess(roleId))?.permissions).toEqual(["pay:cost"]);
await database.delete(schema.rolePermission).where(eq(schema.rolePermission.roleId, roleId));
expect((await getRoleAccess(roleId))?.permissions).toEqual([]);
expect(await getRoleAccess(crypto.randomUUID())).toBeNull();
expect(await getRoleDataScopeByName("owner")).toBe("NONE");
await database
  .insert(schema.tenant)
  .values({ id: schema.INSTANCE_TENANT_ID, name: "Test", slug: "test" });
const userId = crypto.randomUUID();
await database
  .insert(schema.user)
  .values({ id: userId, name: "Test", email: "test@example.invalid", roleId });
const actor: Actor = {
  userId,
  roleId,
  roleName: "FINANCE_ADMIN",
  permissions: [],
  dataScope: "GLOBAL",
  name: "Test",
  email: "test@example.invalid",
  isActive: true,
  mustChangePassword: false,
  sessionId: "test",
  developerActorUserId: null,
};
const { listManagedRolesUseCase } = await import("@backend/server/usecases/administration/roles");
const listed = await listManagedRolesUseCase({ ...actor, permissions: ["manage:roles"] });
expect(listed.success).toBe(true);
if (!listed.success) throw new Error("Role list denied");
expect(listed.data.find((entry) => entry.id === roleId)?.permissions).toEqual([]);

const { assertPermission } = await import("@backend/lib/auth/permissions");
await expect(assertPermission({ id: userId, roleId }, "pay:cost")).rejects.toThrow("FORBIDDEN");
await expect(assertPermission({ id: userId, role: "finance_admin" }, "pay:cost")).rejects.toThrow(
  "FORBIDDEN",
);
expect(await roleNameHasPermission("FINANCE_ADMIN", "pay:cost")).toBe(false);

// Read/write melalui use-case asli, bukan hanya menghapus baris fixture.
const { updateRolePermissionsUseCase } =
  await import("@backend/server/usecases/administration/roles");
const manager: Actor = { ...actor, permissions: ["manage:roles", "pay:cost", "view:cost"] };
expect(
  (await updateRolePermissionsUseCase(manager, { roleId, permissions: ["pay:cost", "view:cost"] }))
    .success,
).toBe(true);
await expect(assertPermission({ id: userId, roleId }, "pay:cost")).resolves.toBeUndefined();
expect(
  (await updateRolePermissionsUseCase(manager, { roleId, permissions: ["view:cost"] })).success,
).toBe(true);
await expect(assertPermission({ id: userId, roleId }, "pay:cost")).rejects.toThrow("FORBIDDEN");
expect((await updateRolePermissionsUseCase(manager, { roleId, permissions: [] })).success).toBe(
  true,
);
expect((await getRoleAccess(roleId))?.permissions).toEqual([]);

const input = {
  projectCostId: crypto.randomUUID(),
  bankAccountId: crypto.randomUUID(),
  referenceNumber: "AUTH-TEST",
};
const { payFieldRequestUseCase } =
  await import("@backend/server/usecases/finance/pay-field-request");
expect(await payFieldRequestUseCase(actor, input)).toMatchObject({
  success: false,
  error: { code: "FORBIDDEN" },
});
expect(
  await payFieldRequestUseCase({ ...actor, permissions: ["pay:cost"], dataScope: "NONE" }, input),
).toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
expect(
  await payFieldRequestUseCase({ ...actor, permissions: ["pay:cost"], isActive: false }, input),
).toMatchObject({ success: false, error: { code: "FORBIDDEN" } });

mock.module("@backend/lib/server/session", () => ({
  getServerSession: async () => ({ user: { id: userId, roleId, isActive: true } }),
  getSessionFromHeaders: async () => ({ user: { id: userId, roleId, isActive: true } }),
}));
const { payFieldRequest } = await import("@backend/app/actions/finance/field-request-payment");
const { resolveActorFromHeaders } = await import("@backend/server/actor");
const { financeRouter } = await import("@backend/server/trpc/routers/finance");
expect(
  await payFieldRequest(input.projectCostId, input.bankAccountId, input.referenceNumber),
).toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
const resolved = await resolveActorFromHeaders(new Headers());
await expect(
  financeRouter.createCaller({ actor: resolved, headers: new Headers() }).payFieldRequest(input),
).rejects.toMatchObject({ code: "FORBIDDEN" });
expect(await database.select().from(schema.cashTransaction)).toEqual([]);

const customId = crypto.randomUUID();
await database
  .insert(schema.role)
  .values({ id: customId, name: "CUSTOM_FINANCE", dataScope: "ASSIGNED" });
expect((await getRoleAccess(customId))?.permissions).toEqual([]);
await database
  .insert(schema.rolePermission)
  .values({ roleId: customId, permissionKey: "pay:cost" });
await expect(
  assertPermission({ id: userId, roleId: customId }, "pay:cost"),
).resolves.toBeUndefined();
expect(await roleNameHasPermission("CUSTOM_FINANCE", "pay:cost")).toBe(true);
expect(await getRoleDataScopeByName("CUSTOM_FINANCE")).toBe("ASSIGNED");
const { assertProjectAccess } = await import("@backend/lib/auth/scoping");
await expect(assertProjectAccess(crypto.randomUUID(), userId, "CUSTOM_FINANCE")).rejects.toThrow(
  "UNAUTHORIZED",
);
await database
  .update(schema.role)
  .set({ dataScope: "INVALID" })
  .where(eq(schema.role.id, customId));
expect((await getRoleAccess(customId))?.dataScope).toBe("NONE");

const clientId = crypto.randomUUID();
const assignedProjectId = crypto.randomUUID();
const otherProjectId = crypto.randomUUID();
await database
  .insert(schema.client)
  .values({ id: clientId, name: "Fixture", email: "client@example.invalid", phone: "-" });
await database.insert(schema.project).values([
  {
    id: assignedProjectId,
    clientId,
    name: "Assigned",
    projectManagerId: userId,
    status: "ACTIVE",
    totalContractValue: "1000.00",
  },
  { id: otherProjectId, clientId, name: "Other", status: "ACTIVE", totalContractValue: "1000.00" },
]);
await database
  .update(schema.role)
  .set({ dataScope: "ASSIGNED" })
  .where(eq(schema.role.id, customId));
await database
  .insert(schema.rolePermission)
  .values({ roleId: customId, permissionKey: "create:stock_movement" });
const { assertProjectScopeForMaterialAction } =
  await import("@backend/app/actions/material/inventory-utils");
await expect(
  assertProjectScopeForMaterialAction(assignedProjectId, userId, "CUSTOM_FINANCE"),
).resolves.toBeUndefined();
await expect(
  assertProjectScopeForMaterialAction(otherProjectId, userId, "CUSTOM_FINANCE"),
).rejects.toThrow("UNAUTHORIZED");

// Payment yang memiliki izin tetap tunduk pada penugasan proyek.
const budgetId = crypto.randomUUID();
const expenseCategoryId = crypto.randomUUID();
const budgetCategoryId = crypto.randomUUID();
const costId = crypto.randomUUID();
await database.insert(schema.projectBudgets).values({
  id: budgetId,
  projectId: otherProjectId,
  contractValue: "1000.00",
  internalBudget: "900.00",
});
await database
  .insert(schema.expenseCategory)
  .values({ id: expenseCategoryId, code: "OPERASIONAL", name: "Operasional" });
await database
  .insert(schema.projectBudgetCategory)
  .values({ id: budgetCategoryId, projectBudgetId: budgetId, expenseCategoryId });
await database.insert(schema.projectCost).values({
  id: costId,
  projectId: otherProjectId,
  projectBudgetCategoryId: budgetCategoryId,
  requestedById: userId,
  amount: "100.00",
  description: "Scope fixture",
  status: "APPROVED",
});
const scopedActor: Actor = {
  ...actor,
  roleId: customId,
  roleName: "CUSTOM_FINANCE",
  permissions: ["pay:cost"],
  dataScope: "ASSIGNED",
};
const scopedInput = { ...input, projectCostId: costId };
const auditBefore = await database.select().from(schema.auditLog);
expect(await payFieldRequestUseCase(scopedActor, scopedInput)).toMatchObject({
  success: false,
  error: { code: "FORBIDDEN" },
});
expect(await database.select().from(schema.cashTransaction)).toEqual([]);
expect(await database.select().from(schema.auditLog)).toEqual(auditBefore);
await database
  .update(schema.project)
  .set({ projectManagerId: userId })
  .where(eq(schema.project.id, otherProjectId));
// Setelah ditugaskan, guard lolos sampai validasi rekening (fixture sengaja tanpa rekening).
expect(await payFieldRequestUseCase(scopedActor, scopedInput)).toMatchObject({
  success: false,
  error: { code: "NOT_FOUND" },
});
expect(
  (await database.query.projectCost.findFirst({ where: eq(schema.projectCost.id, costId) }))
    ?.status,
).toBe("APPROVED");

// Purchasing tidak membaca seluruh proyek, tetapi izin gudang tetap lintas proyek.
const purchasingRoleId = crypto.randomUUID();
await database
  .insert(schema.role)
  .values({ id: purchasingRoleId, name: "purchasing", dataScope: "NONE" });
await database
  .insert(schema.rolePermission)
  .values({ roleId: purchasingRoleId, permissionKey: "create:stock_movement" });
await expect(
  assertProjectScopeForMaterialAction(otherProjectId, userId, "PURCHASING"),
).resolves.toBeUndefined();
await database
  .delete(schema.rolePermission)
  .where(eq(schema.rolePermission.roleId, purchasingRoleId));
await expect(
  assertProjectScopeForMaterialAction(otherProjectId, userId, "PURCHASING"),
).rejects.toThrow("UNAUTHORIZED");

// Mixed casing and LIKE metacharacters preserve literal role identity/scope.
const mixedRoleId = crypto.randomUUID();
const wildcardDecoyId = crypto.randomUUID();
const mixedOtherProjectId = crypto.randomUUID();
await database
  .insert(schema.project)
  .values({
    id: mixedOtherProjectId,
    clientId,
    name: "Mixed role foreign project",
    status: "ACTIVE",
    totalContractValue: "1000.00",
  });
await database.insert(schema.role).values([
  { id: mixedRoleId, name: "MiXeD_Pm_%_Reviewer", dataScope: "ASSIGNED" },
  { id: wildcardDecoyId, name: "MIXEDAPMBANYCREVIEWER", dataScope: "GLOBAL" },
]);
await database.insert(schema.rolePermission).values([
  { roleId: mixedRoleId, permissionKey: "create:stock_movement" },
  { roleId: wildcardDecoyId, permissionKey: "create:stock_movement" },
]);
expect(await getRoleDataScopeByName("mixed_pm_%_reviewer")).toBe("ASSIGNED");
expect(await roleNameHasPermission("MIXED_PM_%_REVIEWER", "create:stock_movement")).toBe(true);
await expect(
  assertProjectScopeForMaterialAction(assignedProjectId, userId, "MIXED_PM_%_REVIEWER"),
).resolves.toBeUndefined();
await expect(
  assertProjectScopeForMaterialAction(mixedOtherProjectId, userId, "MIXED_PM_%_REVIEWER"),
).rejects.toThrow("UNAUTHORIZED");
const ambiguousId = crypto.randomUUID();
await database
  .insert(schema.role)
  .values({ id: ambiguousId, name: "MIXED_PM_%_REVIEWER", dataScope: "GLOBAL" });
await database
  .insert(schema.rolePermission)
  .values({ roleId: ambiguousId, permissionKey: "create:stock_movement" });
expect(await getRoleDataScopeByName("MIXED_PM_%_REVIEWER")).toBe("NONE");
expect(await roleNameHasPermission("MIXED_PM_%_REVIEWER", "create:stock_movement")).toBe(false);
await expect(
  assertProjectScopeForMaterialAction(mixedOtherProjectId, userId, "MIXED_PM_%_REVIEWER"),
).rejects.toThrow("UNAUTHORIZED");

// Lookup gagal tidak menghidupkan kembali izin/cakupan seed.
await client.close();
const originalError = console.error;
const errors: unknown[][] = [];
console.error = (...args: unknown[]): void => {
  errors.push(args);
};
try {
  expect(await getRoleAccess(roleId)).toBeNull();
  expect(await roleNameHasPermission("finance_admin", "pay:cost")).toBe(false);
  expect(await getRoleDataScopeByName("finance_admin")).toBe("NONE");
  expect(errors.length).toBeGreaterThan(0);
} finally {
  console.error = originalError;
}
console.log("Effective permission checks passed");
