import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { mock } from "bun:test";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@backend/db/schema";
import { withTestRequest } from "@backend/lib/testing/request";
import type { PermissionKey } from "@atria/core/auth/permissions";

// A disposable in-memory database exercises real Drizzle relation filters.
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
const { buildProjectBudgetDashboard } =
  await import("@backend/app/actions/project/excel-budget-utils");
mock.module("@backend/app/actions/project/excel-budget", () => ({
  getProjectBudgetDashboard: async (projectId: string) => {
    const data = await buildProjectBudgetDashboard(projectId);
    return data
      ? { success: true, data }
      : { success: false, error: { code: "NOT_FOUND", message: "Budget belum tersedia" } };
  },
}));
const { getProjectDetailData } = await import("./get-project-detail-data");
const read = withTestRequest(getProjectDetailData);
const own = schema.INSTANCE_TENANT_ID;
const foreign = crypto.randomUUID();
const ids = {
  fullRole: crypto.randomUUID(),
  budgetRole: crypto.randomUUID(),
  rabRole: crypto.randomUUID(),
  assignedRole: crypto.randomUUID(),
  full: crypto.randomUUID(),
  budget: crypto.randomUUID(),
  rabReader: crypto.randomUUID(),
  assigned: crypto.randomUUID(),
  client: crypto.randomUUID(),
  project: crypto.randomUUID(),
  otherProject: crypto.randomUUID(),
  foreignProject: crypto.randomUUID(),
  category: crypto.randomUUID(),
  foreignCategory: crypto.randomUUID(),
  material: crypto.randomUUID(),
  foreignMaterial: crypto.randomUUID(),
  location: crypto.randomUUID(),
  foreignLocation: crypto.randomUUID(),
  expense: crypto.randomUUID(),
  foreignExpense: crypto.randomUUID(),
  foreignVendor: crypto.randomUUID(),
  budgetHeader: crypto.randomUUID(),
  budgetCategory: crypto.randomUUID(),
  rap: crypto.randomUUID(),
  foreignRap: crypto.randomUUID(),
  rab: crypto.randomUUID(),
  revision: crypto.randomUUID(),
  foreignRab: crypto.randomUUID(),
  foreignRevision: crypto.randomUUID(),
  bundle: crypto.randomUUID(),
  foreignBundle: crypto.randomUUID(),
  item: crypto.randomUUID(),
};
const rapIds = Array.from({ length: 32 }, () => crypto.randomUUID());
const rabIds = Array.from({ length: 32 }, () => crypto.randomUUID());
const permissions: readonly PermissionKey[] = ["view:budget", "view:rap", "view:rab"];

try {
  await database.insert(schema.tenant).values([
    { id: own, name: "Disposable", slug: "disposable-planning" },
    { id: foreign, name: "Foreign", slug: "foreign-planning" },
  ]);
  await database.insert(schema.role).values([
    { id: ids.fullRole, name: "PLANNING_READER", dataScope: "GLOBAL" },
    { id: ids.budgetRole, name: "BUDGET_ONLY", dataScope: "GLOBAL" },
    { id: ids.rabRole, name: "RAB_ONLY", dataScope: "GLOBAL" },
    { id: ids.assignedRole, name: "ASSIGNED_PLANNING", dataScope: "ASSIGNED" },
  ]);
  await database
    .insert(schema.rolePermission)
    .values([
      ...permissions.map((permissionKey) => ({ roleId: ids.fullRole, permissionKey })),
      ...permissions.map((permissionKey) => ({ roleId: ids.assignedRole, permissionKey })),
      { roleId: ids.budgetRole, permissionKey: "view:budget" },
      { roleId: ids.rabRole, permissionKey: "view:budget" },
      { roleId: ids.rabRole, permissionKey: "view:rab" },
    ]);
  await database.insert(schema.user).values([
    { id: ids.full, roleId: ids.fullRole, name: "Full reader", email: "full@example.invalid" },
    {
      id: ids.budget,
      roleId: ids.budgetRole,
      name: "Budget reader",
      email: "budget@example.invalid",
    },
    { id: ids.rabReader, roleId: ids.rabRole, name: "RAB reader", email: "rab@example.invalid" },
    {
      id: ids.assigned,
      roleId: ids.assignedRole,
      name: "Assigned reader",
      email: "assigned@example.invalid",
    },
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
      name: "Own project",
      clientId: ids.client,
      projectManagerId: ids.assigned,
      status: "ACTIVE",
      totalContractValue: "0.00",
    },
    {
      id: ids.otherProject,
      name: "Unassigned project",
      clientId: ids.client,
      status: "ACTIVE",
      totalContractValue: "0.00",
    },
    {
      id: ids.foreignProject,
      tenantId: foreign,
      name: "Foreign project",
      clientId: ids.client,
      projectManagerId: ids.assigned,
      status: "ACTIVE",
      totalContractValue: "0.00",
    },
  ]);
  await database.insert(schema.materialCategory).values([
    { id: ids.category, name: "Own category" },
    { id: ids.foreignCategory, tenantId: foreign, name: "Foreign category secret" },
  ]);
  await database.insert(schema.materialMaster).values([
    { id: ids.material, categoryId: ids.category, name: "Plywood", unit: "lembar" },
    {
      id: ids.foreignMaterial,
      tenantId: foreign,
      categoryId: ids.foreignCategory,
      name: "Foreign material secret",
      unit: "m2",
    },
  ]);
  await database.insert(schema.inventoryLocation).values([
    { id: ids.location, name: "Own warehouse" },
    { id: ids.foreignLocation, tenantId: foreign, name: "Foreign warehouse secret" },
  ]);
  await database.insert(schema.materialInventory).values([
    {
      materialId: ids.material,
      locationId: ids.location,
      currentStock: "12.50",
      reservedStock: "2.00",
      averageCost: "10.25",
      lastPurchasePrice: "10.25",
    },
    {
      tenantId: foreign,
      materialId: ids.material,
      locationId: ids.foreignLocation,
      currentStock: "999.00",
    },
  ]);
  await database.insert(schema.expenseCategory).values([
    { id: ids.expense, name: "Tukang", code: "TUKANG" },
    { id: ids.foreignExpense, tenantId: foreign, name: "Foreign category secret", code: "TUKANG" },
  ]);
  await database.insert(schema.vendor).values({
    id: ids.foreignVendor,
    tenantId: foreign,
    name: "Foreign vendor secret",
    phone: "0800000000",
  });
  await database.insert(schema.projectBudgets).values({
    id: ids.budgetHeader,
    projectId: ids.project,
    contractValue: "0.00",
    internalBudget: "0.00",
    approvedRabValue: "100.75",
  });
  await database.insert(schema.projectBudgetCategory).values({
    id: ids.budgetCategory,
    projectBudgetId: ids.budgetHeader,
    expenseCategoryId: ids.expense,
  });
  await database.insert(schema.projectRap).values([
    { id: ids.rap, projectId: ids.project, status: "LOCKED", setupStage: "REVIEW" },
    { id: ids.foreignRap, tenantId: foreign, projectId: ids.project, notes: "Foreign RAP secret" },
  ]);
  await database.insert(schema.projectRapItem).values([
    ...rapIds.map((id, index) => ({
      id,
      projectRapId: ids.rap,
      materialId: index === 1 ? ids.foreignMaterial : ids.material,
      name: `Material ${index}`,
      requiredQuantity: "2.50",
      totalQuantity: "3.00",
      unit: "lembar",
      estimatedUnitCost: "10.25",
      estimatedTotalCost: "30.75",
      internalNote: "Internal only",
    })),
    {
      tenantId: foreign,
      projectRapId: ids.rap,
      name: "Foreign RAP item secret",
      requiredQuantity: "999.00",
      totalQuantity: "999.00",
      unit: "m2",
    },
  ]);
  await database.insert(schema.stockMovement).values([
    {
      materialId: ids.material,
      inventoryLocationId: ids.location,
      projectId: ids.project,
      projectRapItemId: rapIds[0],
      movementType: "RESERVE",
      quantity: "1.25",
      createdById: ids.full,
    },
    {
      tenantId: foreign,
      materialId: ids.material,
      inventoryLocationId: ids.location,
      projectId: ids.project,
      projectRapItemId: rapIds[0],
      movementType: "RESERVE",
      quantity: "999.00",
      createdById: ids.full,
    },
    {
      materialId: ids.material,
      inventoryLocationId: ids.location,
      projectId: ids.otherProject,
      projectRapItemId: rapIds[0],
      movementType: "RESERVE",
      quantity: "777.00",
      createdById: ids.full,
    },
  ]);
  await database.insert(schema.projectCategoryPlanItem).values([
    {
      projectId: ids.project,
      projectBudgetId: ids.budgetHeader,
      projectBudgetCategoryId: ids.budgetCategory,
      expenseCategoryId: ids.expense,
      vendorId: ids.foreignVendor,
      name: "Paket pemasangan",
      quantity: "1.00",
      unit: "ls",
      estimatedUnitCost: "20.25",
      estimatedTotalCost: "20.25",
    },
    {
      tenantId: foreign,
      projectId: ids.project,
      projectBudgetId: ids.budgetHeader,
      projectBudgetCategoryId: ids.budgetCategory,
      expenseCategoryId: ids.expense,
      name: "Foreign package secret",
      quantity: "1.00",
      unit: "ls",
      estimatedUnitCost: "999.00",
      estimatedTotalCost: "999.00",
    },
  ]);
  await database.insert(schema.rabEstimate).values([
    {
      id: ids.rab,
      projectId: ids.project,
      sourceProjectRapId: ids.rap,
      status: "APPROVED",
      revision: 1,
      title: "Client RAB",
      approvedValue: "100.75",
    },
    {
      id: ids.revision,
      projectId: ids.project,
      sourceProjectRapId: ids.rap,
      revision: 2,
      title: "Client RAB revision",
    },
    {
      id: ids.foreignRab,
      tenantId: foreign,
      projectId: ids.project,
      sourceProjectRapId: ids.foreignRap,
      title: "Foreign RAB secret",
    },
    { id: ids.foreignRevision, projectId: ids.otherProject, title: "Unassigned revision secret" },
  ]);
  await database.insert(schema.rabEstimateBundle).values([
    {
      id: ids.bundle,
      rabEstimateId: ids.rab,
      clientLabel: "Paket kabinet",
      unitPrice: "100.75",
      lineTotal: "100.75",
    },
    {
      id: ids.foreignBundle,
      tenantId: foreign,
      rabEstimateId: ids.rab,
      clientLabel: "Foreign bundle secret",
      unitPrice: "999.00",
      lineTotal: "999.00",
    },
  ]);
  await database.insert(schema.rabEstimateItem).values([
    ...rabIds.map((id, index) => ({
      id,
      rabEstimateId: ids.rab,
      bundleId: index === 0 ? ids.bundle : null,
      clientLabel: `Client line ${index}`,
      sourceProjectRapItemId: rapIds[index],
      quantity: "2.50",
      unit: "lembar",
      unitPrice: "11.25",
      lineTotal: "28.13",
    })),
    {
      tenantId: foreign,
      rabEstimateId: ids.rab,
      bundleId: ids.bundle,
      clientLabel: "Foreign RAB line secret",
      quantity: "1.00",
      unit: "ls",
      unitPrice: "999.00",
      lineTotal: "999.00",
    },
    {
      rabEstimateId: ids.foreignRevision,
      bundleId: ids.bundle,
      clientLabel: "Unassigned bundle member secret",
      quantity: "1.00",
      unit: "ls",
      unitPrice: "777.00",
      lineTotal: "777.00",
    },
  ]);
  await database.insert(schema.projectChangeOrder).values([
    {
      projectId: ids.project,
      baseRabEstimateId: ids.rab,
      revisedRabEstimateId: ids.revision,
      reason: "Client change",
      scopeSummary: "Kabinet tambahan",
      previousContractValue: "100.75",
      valueDelta: "20.25",
      revisedContractValue: "121.00",
      createdById: ids.full,
    },
    {
      projectId: ids.project,
      baseRabEstimateId: ids.foreignRab,
      revisedRabEstimateId: ids.foreignRevision,
      reason: "Foreign linked change order secret",
      scopeSummary: "Secret",
      previousContractValue: "999.00",
      valueDelta: "999.00",
      revisedContractValue: "1998.00",
      createdById: ids.full,
    },
  ]);

  sessionUser = { id: ids.full, roleId: ids.fullRole };
  const full = await read(ids.project);
  assert.equal(full.project.raps.length, 1);
  assert.equal(
    full.project.raps[0]?.items.length,
    32,
    "RAP source is complete before UI pagination",
  );
  assert.equal(full.project.raps[0]?.items[0]?.estimatedTotalCost, "30.75");
  assert.equal(full.project.raps[0]?.items[0]?.stockMovements?.length, 1);
  assert.equal(
    full.project.raps[0]?.items[1]?.material,
    null,
    "foreign one-to-one material is masked",
  );
  assert.equal(full.project.raps[0]?.items[0]?.material?.inventory?.length, 1);
  assert.equal(full.project.rabEstimates.length, 2);
  const approved = full.project.rabEstimates.find((rab) => rab.id === ids.rab);
  assert.equal(approved?.items.length, 32, "RAB source is complete before UI pagination");
  assert.equal(approved?.bundles.length, 1);
  assert.equal(approved?.bundles[0]?.items.length, 1);
  assert.equal(full.project.categoryPlanItems.length, 1);
  assert.equal(full.project.categoryPlanItems[0]?.vendor, null);
  assert.equal(
    full.project.changeOrders.length,
    1,
    "foreign or unassigned relation cannot leak through a change order",
  );
  assert.equal(full.materialMasterCatalog[0]?.availableStock, 10.5);
  assert.ok(!JSON.stringify(full.project).includes("secret"));

  sessionUser = { id: ids.budget, roleId: ids.budgetRole };
  const budgetOnly = await read(ids.project);
  assert.deepEqual(budgetOnly.project.raps, []);
  assert.deepEqual(budgetOnly.project.rabEstimates, []);
  assert.deepEqual(budgetOnly.project.categoryPlanItems, []);
  assert.deepEqual(budgetOnly.project.changeOrders, []);
  assert.deepEqual(budgetOnly.materialMasterCatalog, []);
  assert.deepEqual(budgetOnly.pricingTemplateCatalog, []);
  assert.ok(budgetOnly.projectsForForms.every((row) => !row.categoryPlanItems?.length));
  assert.ok(!JSON.stringify(budgetOnly.projectsForForms).includes("Material 0"));
  assert.equal(
    budgetOnly.project.totalContractValue,
    "0.00",
    "project finance header remains available",
  );
  assert.equal(budgetOnly.projectBudgetSource?.status, "ready");
  assert.equal(
    budgetOnly.projectBudgetDashboard?.approvedRabValue,
    100.75,
    "the approved client-value finance snapshot does not require RAB draft access",
  );

  sessionUser = { id: ids.rabReader, roleId: ids.rabRole };
  const rabOnly = await read(ids.project);
  assert.equal(rabOnly.project.rabEstimates.length, 2);
  assert.deepEqual(rabOnly.project.raps, []);
  assert.deepEqual(rabOnly.project.categoryPlanItems, []);
  assert.equal(rabOnly.project.changeOrders[0]?.revisedRab.sourceRap, null);
  assert.deepEqual(rabOnly.materialMasterCatalog, []);

  sessionUser = { id: ids.assigned, roleId: ids.assignedRole };
  assert.equal((await read(ids.project)).project.raps[0]?.items.length, 32);
  await assert.rejects(read(ids.otherProject), { name: "RedirectControl" });
  await assert.rejects(read(ids.foreignProject));
  console.log("Project planning reads passed");
} finally {
  await postgres.close();
}
