import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { mock } from "bun:test";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "@backend/db/schema";
import { withTestRequest } from "@backend/lib/testing/request";
import type { Actor } from "@backend/server/actor";
import type {
  MaterialDesktopActivityRequest,
  MaterialDesktopActivityData,
} from "@atria/core/material/material-desktop";

const postgres = new PGlite();
await postgres.exec(
  (await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))).join(";\n"),
);
const database = drizzle(postgres, { schema });
mock.module("@backend/db", () => ({ db: database }));
let sessionUser: { id: string; roleId: string } | null = null;
mock.module("@backend/lib/auth", () => ({
  auth: { api: { getSession: async () => (sessionUser ? { user: sessionUser } : null) } },
}));
const { getMaterialOperationsDashboard } =
  await import("@backend/app/actions/material/operations-dashboard");
const loadDashboard = withTestRequest(getMaterialOperationsDashboard);
const { getMaterialDesktopActivityUseCase: read } = await import("./material-desktop");
const own = schema.INSTANCE_TENANT_ID,
  foreign = crypto.randomUUID();
const ids = {
  role: crypto.randomUUID(),
  user: crypto.randomUUID(),
  otherUser: crypto.randomUUID(),
  category: crypto.randomUUID(),
  material: crypto.randomUUID(),
  location: "14141414-1414-1414-1414-141414141401",
  destination: crypto.randomUUID(),
  client: crypto.randomUUID(),
  project: "77777777-7777-7777-7777-777777777771",
  otherProject: crypto.randomUUID(),
};
const actor: Actor = {
  userId: ids.user,
  roleId: ids.role,
  roleName: "READER",
  permissions: ["view:inventory"],
  dataScope: "GLOBAL",
  name: "Reader",
  email: "reader@example.invalid",
  isActive: true,
  mustChangePassword: false,
  sessionId: "",
  developerActorUserId: null,
};
async function page(
  input: MaterialDesktopActivityRequest,
  acting: Actor = actor,
): Promise<MaterialDesktopActivityData> {
  const result = await read(acting, input);
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}
try {
  await database.insert(schema.tenant).values([
    { id: own, name: "Disposable", slug: "disposable" },
    { id: foreign, name: "Other", slug: "other" },
  ]);
  await database
    .insert(schema.role)
    .values({ id: ids.role, name: "MATERIAL_READER", dataScope: "GLOBAL" });
  await database.insert(schema.rolePermission).values([
    { roleId: ids.role, permissionKey: "view:inventory" },
    { roleId: ids.role, permissionKey: "view:rap" },
  ]);
  await database.insert(schema.user).values([
    { id: ids.user, roleId: ids.role, name: "Reader", email: "reader@example.invalid" },
    { id: ids.otherUser, roleId: ids.role, name: "Other", email: "other@example.invalid" },
  ]);
  await database.insert(schema.materialCategory).values({ id: ids.category, name: "Papan" });
  await database.insert(schema.materialMaster).values({
    id: ids.material,
    categoryId: ids.category,
    name: "Papan 100%_literal",
    unit: "lembar",
  });
  await database.insert(schema.inventoryLocation).values([
    { id: ids.location, name: "Alpha" },
    { id: ids.destination, name: "Beta" },
  ]);
  await database.insert(schema.client).values({
    id: ids.client,
    name: "Client",
    email: "client@example.invalid",
    phone: "0800000000",
  });
  await database.insert(schema.project).values([
    {
      id: ids.project,
      name: "Assigned",
      clientId: ids.client,
      projectManagerId: ids.user,
      status: "ACTIVE",
      totalContractValue: "100",
    },
    {
      id: ids.otherProject,
      name: "Other project",
      clientId: ids.client,
      projectManagerId: ids.otherUser,
      status: "ACTIVE",
      totalContractValue: "100",
    },
  ]);
  const rapIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  await database.insert(schema.projectRap).values([
    { id: rapIds[0], projectId: ids.project },
    { id: rapIds[1], projectId: ids.otherProject },
    { id: rapIds[2], projectId: ids.project, tenantId: foreign },
  ]);
  await database.insert(schema.projectRapItem).values(
    rapIds.map((id, i) => ({
      projectRapId: id,
      tenantId: i === 2 ? foreign : own,
      name: `Need ${i}`,
      requiredQuantity: "10",
      totalQuantity: "10",
      unit: "lembar",
      materialId: ids.material,
    })),
  );
  const now = new Date();
  const secondMaterial = crypto.randomUUID();
  await database
    .insert(schema.materialMaster)
    .values({ id: secondMaterial, categoryId: ids.category, name: "Kain", unit: "meter" });
  const createdAt = (i: number): Date => new Date(now.getTime() - (i % 20) * 86_400_000);
  const movementRows = Array.from({ length: 67 }, (_, i) => ({
    id: crypto.randomUUID(),
    materialId: ids.material,
    inventoryLocationId: ids.location,
    projectId: i < 40 ? ids.project : ids.otherProject,
    movementType: i % 2 ? "USE" : "GOODS_RECEIPT",
    quantity: String(i + 0.25),
    unitCost: "2.50",
    note: `Activity ${i}`,
    createdById: ids.user,
    createdAt: createdAt(i),
  }));
  await database
    .insert(schema.stockMovement)
    .values([
      ...movementRows,
      { ...movementRows[0], id: crypto.randomUUID(), tenantId: foreign, quantity: "9999" },
    ]);
  const receipts = Array.from({ length: 54 }, (_, i) => ({
    id: crypto.randomUUID(),
    receiptNumber: `GR-${String(i).padStart(3, "0")}`,
    projectId: i < 30 ? ids.project : ids.otherProject,
    inventoryLocationId: ids.location,
    status: i % 2 ? "REVERSAL_REQUESTED" : "POSTED",
    receivedAt: createdAt(i),
    receivedById: ids.user,
  }));
  await database
    .insert(schema.goodsReceipt)
    .values([
      ...receipts,
      { ...receipts[0], id: crypto.randomUUID(), tenantId: foreign, receiptNumber: "OTHER" },
    ]);
  await database.insert(schema.goodsReceiptItem).values(
    receipts.map((r, i) => ({
      goodsReceiptId: r.id,
      materialId: ids.material,
      quantity: String(i + 0.5),
      unitCost: "2.50",
    })),
  );
  const transfers = Array.from({ length: 52 }, (_, i) => ({
    id: crypto.randomUUID(),
    transferNumber: `TR-${String(i).padStart(3, "0")}`,
    fromLocationId: ids.location,
    toLocationId: ids.destination,
    transferredAt: createdAt(i),
    note: "Transfer fixture",
    createdById: ids.user,
  }));
  await database
    .insert(schema.stockTransfer)
    .values([
      ...transfers,
      { ...transfers[0], id: crypto.randomUUID(), tenantId: foreign, transferNumber: "OTHER" },
    ]);
  const counts = Array.from({ length: 53 }, (_, i) => ({
    id: crypto.randomUUID(),
    countNumber: `SC-${String(i).padStart(3, "0")}`,
    inventoryLocationId: ids.location,
    countedAt: createdAt(i),
    createdById: i % 2 ? ids.user : ids.otherUser,
    status: i % 2 ? "DRAFT" : "PENDING_APPROVAL",
  }));
  await database
    .insert(schema.stockCount)
    .values([
      ...counts,
      { ...counts[0], id: crypto.randomUUID(), tenantId: foreign, countNumber: "OTHER" },
    ]);
  await database.insert(schema.stockTransferItem).values([
    { stockTransferId: transfers[0].id, materialId: ids.material, quantity: "999", unitCost: "1" },
    { stockTransferId: transfers[1].id, materialId: ids.material, quantity: "1", unitCost: "1" },
    { stockTransferId: transfers[1].id, materialId: secondMaterial, quantity: "1", unitCost: "1" },
  ]);
  await database.insert(schema.stockCountItem).values([
    {
      stockCountId: counts[0].id,
      materialId: ids.material,
      systemQuantity: "999",
      countedQuantity: "999",
      varianceQuantity: "0",
      unitCost: "1",
    },
    {
      stockCountId: counts[1].id,
      materialId: ids.material,
      systemQuantity: "1",
      countedQuantity: "1",
      varianceQuantity: "0",
      unitCost: "1",
    },
    {
      stockCountId: counts[1].id,
      materialId: secondMaterial,
      systemQuantity: "1",
      countedQuantity: "1",
      varianceQuantity: "0",
      unitCost: "1",
    },
  ]);
  for (const [kind, total] of [
    ["movements", 67],
    ["receipts", 54],
    ["transfers", 52],
    ["counts", 53],
  ] as const) {
    const first = await page({ kind });
    assert.equal(first.total, total);
    assert.equal(first.rows.length, 10);
    assert.equal(first.pageSize, 10);
    const last = await page({ kind, page: 999, pageSize: 25 });
    assert.equal(last.total, total);
    assert.equal(last.page, 3);
    assert.equal(last.rows.length, total - 50);
    assert.equal(
      new Set([...(await page({ kind, pageSize: 50 })).rows, ...last.rows].map((r) => r.id)).size,
      total,
    );
  }
  const sorted = await page({
    kind: "movements",
    sort: "quantity",
    direction: "descending",
    page: 2,
  });
  assert.equal(sorted.kind, "movements");
  if (sorted.kind !== "movements") throw new Error("wrong kind");
  assert.equal(sorted.rows[0].quantity, 56.25);
  assert.equal(sorted.rows[9].quantity, 47.25);
  const literal = await page({ kind: "movements", search: "100%_literal" });
  assert.equal(literal.total, 67);
  assert.equal((await page({ kind: "movements", search: "missing" })).total, 0);
  assert.equal((await page({ kind: "movements", status: "USE" })).total, 33);
  assert.equal(
    (
      await page({
        kind: "movements",
        projectId: ids.project,
        locationId: ids.location,
        status: "USE",
      })
    ).total,
    20,
    "legacy project/location filters are preserved before full-source paging",
  );
  const malformedId = await read(actor, { kind: "movements", projectId: "not-an-id" });
  assert.equal(malformedId.success, false);
  if (malformedId.success) throw new Error("Malformed filter was broadened");
  assert.equal(malformedId.error.code, "VALIDATION_ERROR");
  assert.equal((await page({ kind: "movements", locationId: crypto.randomUUID() })).total, 0);
  const recent = await page({ kind: "movements", period: "7" });
  assert.ok(recent.total > 0 && recent.total < 67);
  const valued = await page({ kind: "receipts", sort: "value", direction: "descending" });
  assert.equal(valued.kind, "receipts");
  if (valued.kind !== "receipts") throw new Error("wrong kind");
  assert.equal(valued.rows[0].total, 53.5 * 2.5);
  assert.equal(valued.rows[0].items[0].unit, "lembar");
  assert.equal(
    (await page({ kind: "transfers", sort: "quantity", direction: "descending" })).rows[0].id,
    transfers[1].id,
    "Document quantity sorts by item count, never adds incompatible units",
  );
  const countPage = await page({ kind: "counts", sort: "quantity", direction: "descending" });
  assert.equal(countPage.rows[0].id, counts[1].id);
  if (countPage.kind !== "counts") throw new Error("wrong kind");
  assert.equal(countPage.rows[0].canEdit, true);
  assert.equal(
    (await page({ kind: "receipts", sort: "name", direction: "descending" })).rows[0].id,
    receipts[53].id,
    "Rows after legacy preview cap remain reachable",
  );
  assert.deepEqual(
    (await page({ kind: "movements" })).rows.map((r) => r.id),
    (await page({ kind: "movements" })).rows.map((r) => r.id),
    "Date ties retain deterministic ID order",
  );
  const assigned = { ...actor, dataScope: "ASSIGNED" as const };
  assert.equal((await page({ kind: "movements" }, assigned)).total, 40);
  assert.equal((await page({ kind: "receipts" }, assigned)).total, 30);
  assert.equal((await page({ kind: "receipts", projectId: ids.otherProject }, assigned)).total, 0);
  const warehouse: Actor = {
    ...actor,
    dataScope: "NONE",
    permissions: ["view:inventory", "create:stock_movement"],
  };
  assert.equal((await page({ kind: "receipts" }, warehouse)).total, 54);
  assert.equal((await page({ kind: "receipts" }, { ...actor, dataScope: "NONE" })).total, 0);
  assert.equal(
    (await page({ kind: "counts" }, assigned)).total,
    53,
    "Warehouse documents remain domain-readable",
  );
  const denied = await read({ ...actor, permissions: [] }, { kind: "movements" });
  assert.equal(denied.success, false);
  const invalid = await read(actor, { kind: "movements", page: 0 });
  assert.equal(invalid.success, false);
  sessionUser = { id: ids.user, roleId: ids.role };
  const fullDashboard = await loadDashboard();
  if (!fullDashboard.success) throw new Error(fullDashboard.error.message);
  assert.equal(fullDashboard.data.shortagesSource?.status, "ready");
  assert.equal(fullDashboard.data.shortages.length, 2, "Initial needs excludes foreign RAP data");
  assert.equal(
    fullDashboard.data.receipts.length,
    50,
    "Mobile receipt preview cap remains unchanged",
  );
  assert.equal(fullDashboard.data.activitySummary?.receipts, 54);
  const assignedRoleId = crypto.randomUUID();
  await database
    .insert(schema.role)
    .values({ id: assignedRoleId, name: "ASSIGNED_MATERIAL_READER", dataScope: "ASSIGNED" });
  await database.insert(schema.rolePermission).values([
    { roleId: assignedRoleId, permissionKey: "view:inventory" },
    { roleId: assignedRoleId, permissionKey: "view:rap" },
  ]);
  sessionUser = { id: ids.user, roleId: assignedRoleId };
  const assignedDashboard = await loadDashboard();
  if (!assignedDashboard.success) throw new Error(assignedDashboard.error.message);
  assert.equal(assignedDashboard.data.projects.length, 1);
  assert.equal(assignedDashboard.data.shortages.length, 1);
  assert.equal(assignedDashboard.data.receipts.length, 30);
  assert.equal(assignedDashboard.data.activitySummary?.receipts, 30);
  const details = await import("@backend/app/actions/activity-detail-inventory-resolvers");
  const foreignMovement = await database.query.stockMovement.findFirst({
    where: eq(schema.stockMovement.tenantId, foreign),
  });
  const foreignReceipt = await database.query.goodsReceipt.findFirst({
    where: eq(schema.goodsReceipt.tenantId, foreign),
  });
  const foreignTransfer = await database.query.stockTransfer.findFirst({
    where: eq(schema.stockTransfer.tenantId, foreign),
  });
  const foreignCount = await database.query.stockCount.findFirst({
    where: eq(schema.stockCount.tenantId, foreign),
  });
  assert.ok(foreignMovement && foreignReceipt && foreignTransfer && foreignCount);
  const activityUser = { id: ids.user, roleId: ids.role };
  assert.equal(
    await details.resolveStockMovement(foreignMovement.id, activityUser, "MATERIAL_READER"),
    null,
  );
  assert.equal(
    await details.resolveGoodsReceipt(foreignReceipt.id, activityUser, "MATERIAL_READER"),
    null,
  );
  assert.equal(await details.resolveStockTransfer(foreignTransfer.id), null);
  assert.equal(await details.resolveStockCount(foreignCount.id), null);
  assert.ok(
    await details.resolveStockMovement(movementRows[0].id, activityUser, "MATERIAL_READER"),
  );
  assert.ok(await details.resolveGoodsReceipt(receipts[0].id, activityUser, "MATERIAL_READER"));
  assert.ok(await details.resolveStockTransfer(transfers[0].id));
  assert.ok(await details.resolveStockCount(counts[0].id));
  const closedProjectId = crypto.randomUUID(),
    closedRapId = crypto.randomUUID(),
    draftRapId = crypto.randomUUID();
  await database.insert(schema.project).values({
    id: closedProjectId,
    name: "Closed source",
    clientId: ids.client,
    projectManagerId: ids.user,
    status: "COMPLETED",
    totalContractValue: "100",
  });
  await database.insert(schema.projectRap).values([
    { id: closedRapId, projectId: closedProjectId, status: "LOCKED" },
    { id: draftRapId, projectId: ids.project, revision: 2, status: "DRAFT" },
  ]);
  await database.insert(schema.projectRapItem).values([
    {
      projectRapId: closedRapId,
      name: "Closed need",
      requiredQuantity: "2.5",
      totalQuantity: "2.5",
      unit: "m²",
      materialId: ids.material,
    },
    {
      projectRapId: draftRapId,
      name: "New draft need",
      requiredQuantity: "3",
      totalQuantity: "3",
      unit: "kg",
      materialId: ids.material,
    },
  ]);
  sessionUser = { id: ids.user, roleId: ids.role };
  const sourceDashboard = await loadDashboard();
  if (!sourceDashboard.success) throw new Error(sourceDashboard.error.message);
  const baselineNeed = sourceDashboard.data.shortages.find((row) => row.projectRapId === rapIds[0]);
  const closedNeed = sourceDashboard.data.shortages.find((row) => row.projectRapId === closedRapId);
  assert.ok(baselineNeed && closedNeed);
  assert.equal(baselineNeed.projectId, ids.project);
  assert.equal(baselineNeed.projectName, "Assigned");
  assert.equal(
    baselineNeed.unit,
    "lembar",
    "read context keeps the baseline unit when a newer RAP draft exists",
  );
  assert.equal(closedNeed.projectId, closedProjectId);
  assert.equal(closedNeed.projectName, "Closed source");
  assert.equal(closedNeed.unit, "m²");
  assert.equal(
    sourceDashboard.data.projects.some((row) => row.id === closedProjectId),
    false,
    "read metadata does not broaden active write choices",
  );
  assert.equal(
    sourceDashboard.data.projects
      .find((row) => row.id === ids.project)
      ?.rapItems.some((row) => row.id === baselineNeed.projectRapItemId),
    false,
    "current form choices remain on the latest revision",
  );
  assert.equal(
    sourceDashboard.data.shortages.some((row) => row.projectRapId === rapIds[2]),
    false,
  );
  sessionUser = { id: ids.user, roleId: assignedRoleId };
  const scopedSource = await loadDashboard();
  if (!scopedSource.success) throw new Error(scopedSource.error.message);
  assert.equal(
    scopedSource.data.shortages.some((row) => row.projectRapId === rapIds[1]),
    false,
    "metadata retains assigned-project fencing",
  );
  assert.equal(
    scopedSource.data.shortages.find((row) => row.projectRapId === closedRapId)?.projectId,
    closedProjectId,
  );
  assert.deepEqual(await database.select().from(schema.cashTransaction), []);
  assert.deepEqual(await database.select().from(schema.auditLog), []);
  console.log("Material desktop checks passed");
} finally {
  await postgres.close();
}
