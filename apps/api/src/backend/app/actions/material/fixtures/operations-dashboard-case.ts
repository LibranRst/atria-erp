import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { mock } from "bun:test";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@backend/db/schema";
import { withTestRequest } from "@backend/lib/testing/request";

// Fully disposable in-memory Postgres: no development or hosted data connections.
const postgres = new PGlite();
const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
await postgres.exec(statements.join(";\n"));
const database = drizzle(postgres, { schema });
mock.module("@backend/db", (): { db: typeof database } => ({ db: database }));
let sessionUser: typeof schema.user.$inferSelect | null = null;
mock.module("@backend/lib/auth", () => ({
  auth: {
    api: {
      getSession: async (): Promise<{ user: typeof sessionUser } | null> =>
        sessionUser ? { user: sessionUser } : null,
    },
  },
}));
const { getMaterialOperationsDashboard } = await import("../operations-dashboard");
const { getMaterialInventory } = await import("../inventory");
const load = withTestRequest(getMaterialOperationsDashboard);
const readInventory = withTestRequest(getMaterialInventory);
const alpha = { id: "00000000-0000-0000-0000-000000000101", name: "Gudang Alpha" };
const utama = { id: "00000000-0000-0000-0000-000000000102", name: "Gudang Utama" };

try {
  await database
    .insert(schema.tenant)
    .values({ id: schema.INSTANCE_TENANT_ID, name: "Disposable", slug: "disposable-material" });
  const roleId = crypto.randomUUID();
  await database
    .insert(schema.role)
    .values({ id: roleId, name: "INVENTORY_READER", dataScope: "GLOBAL" });
  await database.insert(schema.rolePermission).values({ roleId, permissionKey: "view:inventory" });
  const [reader] = await database
    .insert(schema.user)
    .values({ roleId, name: "Fixture reader", email: "material-reader@example.invalid" })
    .returning();
  assert.ok(reader);
  sessionUser = reader;
  // Deliberately insert in reverse order, with an inactive warehouse in between.
  await database
    .insert(schema.inventoryLocation)
    .values([utama, { name: "Gudang Arsip", isActive: false }, alpha]);
  const emptyInventory = await load();
  if (!emptyInventory.success) throw new Error(emptyInventory.error.message);
  assert.equal(emptyInventory.success, true);
  assert.deepEqual(emptyInventory.data.inventory, []);
  assert.deepEqual(
    emptyInventory.data.locations,
    [alpha, utama],
    "Configured empty warehouses are independent of material balances and sorted by name",
  );
  assert.deepEqual(
    Object.keys(emptyInventory.data.locations[0]).sort(),
    ["id", "name"],
    "Only public location identity is returned",
  );

  const categoryId = crypto.randomUUID();
  const materialId = crypto.randomUUID();
  await database
    .insert(schema.materialCategory)
    .values({ id: categoryId, name: "Material fixture" });
  await database
    .insert(schema.materialMaster)
    .values({ id: materialId, categoryId, name: "Papan", unit: "lembar" });
  await database
    .insert(schema.materialInventory)
    .values({ materialId, locationId: alpha.id, currentStock: "4", reservedStock: "1" });
  const existingInventory = await readInventory();
  if (!existingInventory.success) throw new Error(existingInventory.error.message);
  assert.equal(existingInventory.success, true);
  const populated = await load();
  if (!populated.success) throw new Error(populated.error.message);
  assert.equal(populated.success, true);
  assert.deepEqual(
    populated.data.inventory,
    existingInventory.data,
    "Existing material/balance projection is unchanged",
  );
  assert.deepEqual(populated.data.locations, [alpha, utama]);

  await database
    .update(schema.inventoryLocation)
    .set({ isActive: false })
    .where(eq(schema.inventoryLocation.id, alpha.id));
  const withArchivedBalance = await load();
  if (!withArchivedBalance.success) throw new Error(withArchivedBalance.error.message);
  assert.equal(withArchivedBalance.success, true);
  assert.deepEqual(
    withArchivedBalance.data.locations,
    [utama],
    "Archived locations are excluded from configured active choices",
  );
  assert.deepEqual(
    withArchivedBalance.data.inventory,
    existingInventory.data,
    "Archiving a choice does not silently remove inventory/history rows",
  );
  for (const field of [
    "movements",
    "receipts",
    "counts",
    "transfers",
    "projects",
    "bills",
  ] as const) {
    assert.deepEqual(
      withArchivedBalance.data[field],
      [],
      `${field} retains its empty response contract`,
    );
  }
  assert.deepEqual(await database.select().from(schema.stockMovement), []);
  assert.deepEqual(await database.select().from(schema.auditLog), []);

  const deniedRoleId = crypto.randomUUID();
  await database
    .insert(schema.role)
    .values({ id: deniedRoleId, name: "NO_INVENTORY", dataScope: "NONE" });
  const [denied] = await database
    .insert(schema.user)
    .values({
      roleId: deniedRoleId,
      name: "Denied fixture",
      email: "material-denied@example.invalid",
    })
    .returning();
  assert.ok(denied);
  sessionUser = denied;
  const forbidden = await load();
  assert.equal(forbidden.success, false);
  if (forbidden.success) throw new Error("Inventory read authorization was bypassed");
  assert.equal(forbidden.error.code, "FORBIDDEN");
  sessionUser = null;
  const anonymous = await load();
  assert.equal(anonymous.success, false);
  if (anonymous.success) throw new Error("Anonymous inventory access was allowed");
  assert.equal(anonymous.error.code, "UNAUTHORIZED");
  console.log("Material dashboard location checks passed");
} finally {
  await postgres.close();
}
