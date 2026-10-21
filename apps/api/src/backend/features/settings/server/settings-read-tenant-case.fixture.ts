import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { mock } from "bun:test";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@backend/db/schema";
import { withTestRequest } from "@backend/lib/testing/request";
import type { Actor } from "@backend/server/actor";

const postgres = new PGlite();
await postgres.exec(
  (await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))).join(";\n"),
);
const database = drizzle(postgres, { schema });
mock.module("@backend/db", () => ({ db: database }));
const own = schema.INSTANCE_TENANT_ID;
const foreign = crypto.randomUUID();
const ids = {
  role: crypto.randomUUID(),
  actor: crypto.randomUUID(),
  foreignUser: crypto.randomUUID(),
  material: crypto.randomUUID(),
  location: crypto.randomUUID(),
  category: crypto.randomUUID(),
  inventory: crypto.randomUUID(),
  ownBatch: crypto.randomUUID(),
  foreignPending: crypto.randomUUID(),
};
mock.module("@backend/lib/auth", () => ({
  auth: { api: { getSession: async () => ({ user: { id: ids.actor, roleId: ids.role } }) } },
}));
const actor: Actor = {
  userId: ids.actor,
  roleId: ids.role,
  roleName: "SETTINGS_READER",
  permissions: ["view:settings"],
  dataScope: "GLOBAL",
  name: "Reader",
  email: "reader@example.invalid",
  isActive: true,
  mustChangePassword: false,
  sessionId: "",
  developerActorUserId: null,
};
try {
  await database.insert(schema.tenant).values([
    { id: own, name: "Disposable", slug: "settings-own" },
    { id: foreign, name: "Foreign", slug: "settings-foreign" },
  ]);
  await database
    .insert(schema.role)
    .values({ id: ids.role, name: actor.roleName, dataScope: "GLOBAL" });
  await database
    .insert(schema.rolePermission)
    .values(
      ["view:settings", "view:inventory", "manage:users", "manage:vendors"].map(
        (permissionKey) => ({ roleId: ids.role, permissionKey }),
      ),
    );
  await database.insert(schema.user).values([
    { id: ids.actor, roleId: ids.role, name: "Own reader", email: actor.email },
    {
      id: ids.foreignUser,
      roleId: ids.role,
      name: "Foreign user",
      email: "foreign@example.invalid",
    },
  ]);
  await database.insert(schema.tenantMember).values([
    { tenantId: own, userId: ids.actor, roleId: ids.role },
    { tenantId: foreign, userId: ids.foreignUser, roleId: ids.role },
  ]);
  await database
    .insert(schema.vendor)
    .values({ tenantId: foreign, name: "Foreign vendor", phone: "0" });
  await database.insert(schema.bankAccount).values({
    tenantId: foreign,
    name: "Foreign bank",
    accountNumber: "1",
    bankName: "Bank",
    holderName: "Foreign",
  });
  await database.insert(schema.materialCategory).values({ id: ids.category, name: "Own category" });
  await database
    .insert(schema.materialMaster)
    .values({ id: ids.material, categoryId: ids.category, name: "Own material", unit: "set" });
  await database
    .insert(schema.inventoryLocation)
    .values({ id: ids.location, name: "Own location" });
  await database
    .insert(schema.materialInventory)
    .values({ id: ids.inventory, materialId: ids.material, locationId: ids.location });
  await database.insert(schema.inventoryOpeningBatch).values([
    {
      id: ids.ownBatch,
      batchNumber: "OWN",
      cutoverDate: new Date(),
      note: "Own",
      requestedById: ids.actor,
      status: "REJECTED",
    },
    {
      id: ids.foreignPending,
      tenantId: foreign,
      batchNumber: "FOREIGN-PENDING",
      cutoverDate: new Date(),
      note: "Foreign",
      requestedById: ids.foreignUser,
    },
    {
      tenantId: foreign,
      batchNumber: "FOREIGN-POSTED",
      cutoverDate: new Date(),
      note: "Foreign",
      requestedById: ids.foreignUser,
      status: "POSTED",
    },
  ]);
  const foreignCategory = crypto.randomUUID();
  const foreignMaterial = crypto.randomUUID();
  const foreignExpense = crypto.randomUUID();
  await database
    .insert(schema.materialCategory)
    .values({ id: foreignCategory, tenantId: foreign, name: "Foreign category" });
  await database.insert(schema.materialMaster).values({
    id: foreignMaterial,
    tenantId: foreign,
    categoryId: foreignCategory,
    name: "Foreign material",
    unit: "unit",
  });
  await database
    .insert(schema.inventoryLocation)
    .values({ tenantId: foreign, name: "Foreign location" });
  await database.insert(schema.expenseCategory).values({
    id: foreignExpense,
    tenantId: foreign,
    code: "MATERIAL",
    name: "Foreign expense category",
  });
  await database
    .insert(schema.budgetAllocationSetting)
    .values({ tenantId: foreign, name: "Foreign default budget" });
  await database.insert(schema.itemPriceLibrary).values({
    tenantId: foreign,
    expenseCategoryId: foreignExpense,
    materialId: foreignMaterial,
    name: "Foreign library item",
    unit: "unit",
  });
  await database.insert(schema.inventoryOpeningItem).values({
    tenantId: foreign,
    batchId: ids.foreignPending,
    materialInventoryId: ids.inventory,
    quantity: "99",
    unitCost: "99",
  });
  await database.insert(schema.stockMovement).values({
    tenantId: foreign,
    materialId: ids.material,
    inventoryLocationId: ids.location,
    movementType: "ADJUSTMENT",
    quantity: "99",
    createdById: ids.foreignUser,
  });

  const { getAdministrationOverview } = await import("@backend/app/actions/administration-queries");
  const { listManagedRolesUseCase } = await import("@backend/server/usecases/administration/roles");
  const { getOrganizationSetupOverviewUseCase } =
    await import("@backend/server/usecases/onboarding/organization-setup-overview");
  const { getInitialStockCandidates, getInventoryOpeningBatches } =
    await import("@backend/app/actions/material/opening-inventory-queries");
  const administration = await withTestRequest(getAdministrationOverview)();
  const managedRoles = await listManagedRolesUseCase({ ...actor, permissions: ["manage:roles"] });
  const readiness = await getOrganizationSetupOverviewUseCase(actor);
  const candidates = await withTestRequest(getInitialStockCandidates)();
  const batches = await withTestRequest(getInventoryOpeningBatches)();
  const {
    getSettingsOverview,
    getMaterialSettings,
    getItemLibrarySettings,
    getExpenseCategorySettings,
    getBudgetSettings,
    getSettingsHubOverview,
    getItemPriceLibrary,
  } = await import("@backend/app/actions/settings/system-read");
  const { getPricingTemplates } = await import("@backend/app/actions/settings/pricing-library");
  const settings = await withTestRequest(getSettingsOverview)();
  const pricing = await withTestRequest(getPricingTemplates)(true);
  const materialRefresh = await withTestRequest(getMaterialSettings)();
  const libraryRefresh = await withTestRequest(getItemLibrarySettings)();
  const categoriesRefresh = await withTestRequest(getExpenseCategorySettings)();
  const budgetRefresh = await withTestRequest(getBudgetSettings)();
  const hub = await withTestRequest(getSettingsHubOverview)();
  const libraryLookup = await withTestRequest(getItemPriceLibrary)({ includeInactive: true });
  assert(administration.success && readiness.success && candidates.success && batches.success);
  assert(managedRoles.success);
  assert.equal(
    managedRoles.data.find((row) => row.id === ids.role)?.userCount,
    administration.data.users.filter((row) => row.roleId === ids.role).length,
    "Role holders count the same instance members as Team, excluding a foreign member with the same global role",
  );
  assert.equal(managedRoles.data.find((row) => row.id === ids.role)?.userCount, 1);
  assert(settings.success && pricing.success);
  assert(
    materialRefresh.success &&
      libraryRefresh.success &&
      categoriesRefresh.success &&
      budgetRefresh.success &&
      hub.success &&
      libraryLookup.success,
  );
  assert.deepEqual(
    materialRefresh.data.materials.map((row) => row.id),
    [ids.material],
    "An ordinary post-save material reload keeps the same instance fence",
  );
  assert.equal(materialRefresh.data.materialCategories.length, 1);
  assert.equal(materialRefresh.data.vendors.length, 0);
  assert.equal(materialRefresh.data.inventoryLocations.length, 1);
  assert.equal(libraryRefresh.data.itemLibrary.length, 0);
  assert.equal(libraryRefresh.data.expenseCategories.length, 0);
  assert.equal(libraryRefresh.data.materials.length, 1);
  assert.equal(libraryRefresh.data.vendors.length, 0);
  assert.equal(categoriesRefresh.data.expenseCategories.length, 0);
  assert.equal(budgetRefresh.data.budgetAllocationSetting, null);
  assert.equal(hub.data.activeMaterialCount, 1);
  assert.equal(hub.data.activeCategoryCount, 0);
  assert.equal(hub.data.activeItemCount, 0);
  assert.equal(libraryLookup.data.length, 0);
  const leaks = [
    ...(administration.data.users.some((row) => row.id === ids.foreignUser)
      ? ["foreign staff"]
      : []),
    ...(administration.data.vendors.length ? ["foreign vendor"] : []),
    ...(readiness.data.requiredReadiness.some((row) => row.id === "bank_account" && row.ready)
      ? ["foreign bank readiness"]
      : []),
    ...(readiness.data.requiredReadiness.some((row) => row.id === "initial_stock" && row.ready)
      ? ["foreign opening readiness"]
      : []),
    ...(readiness.data.recommendedReadiness.some((row) => row.id === "vendor" && row.ready)
      ? ["foreign vendor readiness"]
      : []),
    ...(batches.data.some((row) => row.batchNumber.startsWith("FOREIGN"))
      ? ["foreign opening history"]
      : []),
    ...(candidates.data.find((row) => row.inventoryId === ids.inventory)?.eligible !== true
      ? ["foreign opening/movement eligibility"]
      : []),
    ...(settings.data.budgetAllocationSetting ? ["foreign default budget"] : []),
    ...(settings.data.expenseCategories.length ? ["foreign expense category"] : []),
    ...(settings.data.itemLibrary.length ? ["foreign item library"] : []),
    ...(settings.data.materialCategories.some((row) => row.id === foreignCategory)
      ? ["foreign material category"]
      : []),
    ...(settings.data.materials.some((row) => row.id === foreignMaterial)
      ? ["foreign material master"]
      : []),
    ...(settings.data.inventoryLocations.some((row) => row.name === "Foreign location")
      ? ["foreign settings location"]
      : []),
    ...(settings.data.vendors.length ? ["foreign settings vendor"] : []),
    ...(pricing.data.length ? ["foreign pricing template"] : []),
  ];
  assert.deepEqual(leaks, []);
  assert.deepEqual(
    administration.data.users.map((row) => row.id),
    [ids.actor],
  );
  assert.deepEqual(
    batches.data.map((row) => row.id),
    [ids.ownBatch],
  );
  console.log("Settings tenant reads passed");
} finally {
  await postgres.close();
}
