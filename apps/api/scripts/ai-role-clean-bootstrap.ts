import { db, pool } from "../src/backend/db";
import { eq, inArray } from "drizzle-orm";
import { SYSTEM_ROLES } from "@atria/core/auth/role-constants";
import { ROLE_PERMISSIONS } from "@atria/core/auth/permissions";
import {
  tenant,
  expenseCategory,
  materialCategory,
  INSTANCE_TENANT_ID,
  role,
  rolePermission,
  user,
  tenantMember,
} from "../src/backend/db/schema";

const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_role_clean" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Exact empty role-test database only");
const rolesOnly = process.argv[2] === "system-roles";
async function seedOwner(): Promise<void> {
  if (await db.query.user.findFirst({ where: eq(user.roleId, SYSTEM_ROLES[0].id) }))
    throw new Error("Existing owner must not be overwritten");
  await db.transaction(async (tx) => {
    const [owner] = await tx
      .insert(user)
      .values({
        roleId: SYSTEM_ROLES[0].id,
        name: "QA Clean Owner",
        email: "role-clean-owner@fixture.invalid",
        emailVerified: true,
      })
      .returning();
    await tx.insert(tenantMember).values({
      tenantId: INSTANCE_TENANT_ID,
      userId: owner.id,
      roleId: owner.roleId,
      isActive: true,
    });
  });
}
if (process.argv[2] === "owner") {
  const company = await db.query.tenant.findFirst({ where: eq(tenant.id, INSTANCE_TENANT_ID) });
  if (company?.name !== "Perusahaan Role QA bersih")
    throw new Error("Expected this acceptance's clean fixture");
  await seedOwner();
  console.log("Clean fixture owner ready");
  await pool.end();
  process.exit(0);
}
if (
  !rolesOnly &&
  ((await db.select().from(tenant)).length || (await db.select().from(expenseCategory)).length)
)
  throw new Error("Expected empty schema-only QA database");
await db.transaction(async (tx) => {
  if (
    (
      await tx
        .select()
        .from(role)
        .where(
          inArray(
            role.id,
            SYSTEM_ROLES.map((r) => r.id),
          ),
        )
    ).length
  )
    throw new Error("Existing canonical roles must not be overwritten");
  await tx.insert(role).values([...SYSTEM_ROLES]);
  await tx.insert(rolePermission).values(
    SYSTEM_ROLES.flatMap((r) =>
      (ROLE_PERMISSIONS[r.name.toUpperCase()] ?? []).map((permissionKey) => ({
        roleId: r.id,
        permissionKey,
      })),
    ),
  );
  if (rolesOnly) return;
  await tx
    .insert(tenant)
    .values({ id: INSTANCE_TENANT_ID, name: "Perusahaan Role QA bersih", slug: "role-qa-clean" });
  await tx.insert(expenseCategory).values(
    [
      { code: "MATERIAL", name: "Material" },
      { code: "TUKANG", name: "Tukang" },
      { code: "OPERASIONAL", name: "Operasional" },
      { code: "LAIN_LAIN", name: "Lain-lain" },
      { code: "SUBCON", name: "Subcon" },
    ].map((c, i) => ({
      ...c,
      tenantId: INSTANCE_TENANT_ID,
      isActive: true,
      sortOrder: i,
      defaultRatio: "0.200000",
    })),
  );
  await tx
    .insert(materialCategory)
    .values({ name: "Material Role QA bersih", tenantId: INSTANCE_TENANT_ID });
});
if (!rolesOnly) await seedOwner();
console.log("Minimal clean role-test fixture ready");
await pool.end();
