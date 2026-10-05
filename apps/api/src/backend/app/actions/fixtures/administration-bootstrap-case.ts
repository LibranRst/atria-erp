import { PGlite } from "@electric-sql/pglite";
import { expect, mock } from "bun:test";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { ROLE_PERMISSIONS, type PermissionKey } from "@atria/core/auth/permissions";
import { OWNER_ROLE_ID, SYSTEM_ROLES } from "@atria/core/auth/role-constants";
import type { BootstrapOwnerInput } from "@atria/core/validations/administration";
import * as schema from "@backend/db/schema";

const postgres = new PGlite();
const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
await postgres.exec(statements.join(";\n"));
const database = drizzle(postgres, { schema });
mock.module("@backend/db", () => ({ db: database }));
const { bootstrapFirstOwner, getBootstrapStatus } =
  await import("@backend/app/actions/administration-bootstrap");
const { getRoleAccess } = await import("@backend/lib/auth/role-access");
const { assertPermission } = await import("@backend/lib/auth/permissions");

const input: BootstrapOwnerInput = {
  bootstrapSecret: "bootstrap-fixture-only-secret",
  name: "Bootstrap Fixture",
  email: "owner@bootstrap.example.invalid",
  password: "BootstrapFixture123",
};
const financeRoleId = SYSTEM_ROLES[1].id;
const projectManagerRoleId = SYSTEM_ROLES[2].id;
const purchasingRoleId = SYSTEM_ROLES[3].id;
const caseName = process.argv[2];

async function permissionKeys(roleId: string): Promise<readonly PermissionKey[]> {
  return [...((await getRoleAccess(roleId))?.permissions ?? [])].sort();
}

function defaultKeys(roleName: string): readonly PermissionKey[] {
  return [...(ROLE_PERMISSIONS[roleName.toUpperCase()] ?? [])].sort();
}

async function expectNoBootstrapData(): Promise<void> {
  for (const table of [
    schema.user,
    schema.account,
    schema.role,
    schema.rolePermission,
    schema.expenseCategory,
    schema.budgetAllocationSetting,
    schema.budgetAllocationSettingCategory,
    schema.appConfig,
    schema.auditLog,
  ]) {
    expect(await database.select().from(table)).toEqual([]);
  }
  expect((await database.select().from(schema.tenant)).length).toBe(1);
}

try {
  await database
    .insert(schema.tenant)
    .values({ id: schema.INSTANCE_TENANT_ID, name: "Disposable", slug: "disposable" });

  if (caseName === "forbidden") {
    expect(
      await bootstrapFirstOwner({ ...input, bootstrapSecret: "wrong-fixture-secret" }),
    ).toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
    expect(await bootstrapFirstOwner({ ...input, password: "too-short" })).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
    await expectNoBootstrapData();
  } else if (caseName === "rollback") {
    // Reject the final audit to prove the complete preceding transaction rolls back.
    await postgres.exec(
      `ALTER TABLE "audit_log" ADD CONSTRAINT "reject_bootstrap_audit"
       CHECK ("action" <> 'BOOTSTRAP_PRODUCTION_FOUNDATION')`,
    );
    expect(await bootstrapFirstOwner(input)).toMatchObject({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
    await expectNoBootstrapData();
  } else if (caseName === "scaffold" || caseName === "existing") {
    await database.insert(schema.role).values([...SYSTEM_ROLES].slice(0, 3));
    const customRoleId = crypto.randomUUID();
    await database
      .insert(schema.role)
      .values({ id: customRoleId, name: "CUSTOM_BOOTSTRAP", dataScope: "ASSIGNED" });
    await database.insert(schema.rolePermission).values([
      { roleId: financeRoleId, permissionKey: "view:ledger" },
      { roleId: customRoleId, permissionKey: "view:cost" },
    ]);
    if (caseName === "existing") {
      // An inactive former Owner still indicates initialized permission settings.
      await database.insert(schema.rolePermission).values({
        roleId: OWNER_ROLE_ID,
        permissionKey: "manage:roles",
      });
      await database.insert(schema.user).values({
        roleId: OWNER_ROLE_ID,
        name: "Inactive Fixture",
        email: "inactive@bootstrap.example.invalid",
        isActive: false,
      });
    }
    const result = await bootstrapFirstOwner(input);
    expect(result.success).toBe(true);
    expect(await permissionKeys(financeRoleId)).toEqual(["view:ledger"]);
    expect(await permissionKeys(customRoleId)).toEqual(["view:cost"]);
    expect(await permissionKeys(purchasingRoleId)).toEqual(defaultKeys("PURCHASING"));
    expect(await permissionKeys(OWNER_ROLE_ID)).toEqual(
      caseName === "scaffold" ? defaultKeys("OWNER") : ["manage:roles"],
    );
    expect(await permissionKeys(projectManagerRoleId)).toEqual(
      caseName === "scaffold" ? defaultKeys("PROJECT_MANAGER") : [],
    );
    expect((await getRoleAccess(customRoleId))?.dataScope).toBe("ASSIGNED");
  } else if (caseName === "fresh" || caseName === "repeat") {
    expect(await getBootstrapStatus()).toMatchObject({ success: true, data: { required: true } });
    const result = await bootstrapFirstOwner(input);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Fixture bootstrap failed");
    for (const systemRole of SYSTEM_ROLES) {
      expect(await permissionKeys(systemRole.id)).toEqual(defaultKeys(systemRole.name));
      expect((await getRoleAccess(systemRole.id))?.dataScope).toBe(systemRole.dataScope);
    }
    const ownerIdentity = { id: result.data.userId, roleId: OWNER_ROLE_ID };
    for (const permission of ["manage:onboarding", "manage:roles", "use:desktop_admin"] as const) {
      await expect(assertPermission(ownerIdentity, permission)).resolves.toBeUndefined();
    }
    expect(await permissionKeys(financeRoleId)).toContain("use:desktop_admin");
    expect(await permissionKeys(projectManagerRoleId)).not.toContain("use:desktop_admin");
    expect(await permissionKeys(purchasingRoleId)).not.toContain("use:desktop_admin");
    expect((await database.select().from(schema.expenseCategory)).length).toBe(5);
    expect((await database.select().from(schema.budgetAllocationSettingCategory)).length).toBe(5);
    const credentials = await database.select().from(schema.account);
    expect(credentials.length).toBe(1);
    expect(credentials[0]?.userId).toBe(result.data.userId);
    expect(credentials[0]?.password).toBeTruthy();
    expect(credentials[0]?.password).not.toBe(input.password);
    expect((await database.select().from(schema.auditLog)).length).toBe(1);
    expect(await getBootstrapStatus()).toMatchObject({ success: true, data: { required: false } });

    if (caseName === "repeat") {
      await database
        .delete(schema.rolePermission)
        .where(
          and(
            eq(schema.rolePermission.roleId, financeRoleId),
            eq(schema.rolePermission.permissionKey, "pay:cost"),
          ),
        );
      const before = await database.select().from(schema.rolePermission);
      expect(
        await bootstrapFirstOwner({ ...input, email: "another@bootstrap.example.invalid" }),
      ).toMatchObject({ success: false, error: { code: "CONFLICT" } });
      expect(await database.select().from(schema.rolePermission)).toEqual(before);
      expect(await permissionKeys(financeRoleId)).not.toContain("pay:cost");
      expect((await database.select().from(schema.user)).length).toBe(1);
      expect((await database.select().from(schema.auditLog)).length).toBe(1);
    }
  } else {
    throw new Error("Unknown bootstrap fixture case");
  }
  console.log(`Bootstrap ${caseName} checks passed`);
} finally {
  await postgres.close();
}
