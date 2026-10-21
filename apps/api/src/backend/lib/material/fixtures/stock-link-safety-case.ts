import { PGlite } from "@electric-sql/pglite";
import { expect, mock } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { eq, and } from "drizzle-orm";
import * as schema from "@backend/db/schema";
import { withCommitEffects } from "@backend/lib/db/commit-effects";
import type { PermissionKey } from "@atria/core/auth/permissions";

const postgres = new PGlite();
const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
await postgres.exec(statements.join(";\n"));
const database = drizzle(postgres, { schema });
database.transaction = withCommitEffects(database.transaction.bind(database), (): void => {});
mock.module("@backend/db", () => ({ db: database }));
mock.module("@backend/server/services/notification-service", () => ({
  scheduleNotificationPush: (): void => {},
}));
const userId = crypto.randomUUID();
const roleId = crypto.randomUUID();
const session = {
  user: {
    id: userId,
    roleId,
    name: "Stock fixture",
    email: "stock@example.invalid",
    isActive: true,
    mustChangePassword: false,
  },
  session: { id: "stock-fixture" },
};
mock.module("@backend/lib/auth", () => ({
  auth: { api: { getSession: async (): Promise<unknown> => session } },
}));
mock.module("@backend/lib/server/session", () => ({
  getServerSession: async (): Promise<unknown> => session,
  getSessionFromHeaders: async (): Promise<unknown> => session,
}));
await database
  .insert(schema.tenant)
  .values({ id: schema.INSTANCE_TENANT_ID, name: "Disposable", slug: "disposable" });
await database
  .insert(schema.role)
  .values({ id: roleId, name: "STOCK_FIXTURE", dataScope: "GLOBAL" });
const permissions: readonly PermissionKey[] = [
  "create:stock_movement",
  "reserve:stock",
  "use:stock",
  "waste:stock",
  "adjust:stock",
  "create:vendor_bill",
  "create:cost",
  "pay:vendor_bill",
  "view:material",
  "view:project",
];
await database
  .insert(schema.rolePermission)
  .values(permissions.map((permissionKey) => ({ roleId, permissionKey })));
await database.insert(schema.user).values(session.user);
const clientId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const foreignProjectId = crypto.randomUUID();
await database
  .insert(schema.client)
  .values({ id: clientId, name: "Fixture", email: "client@example.invalid", phone: "-" });
await database.insert(schema.project).values([
  {
    id: projectId,
    clientId,
    projectManagerId: userId,
    name: "Own project",
    status: "ACTIVE",
    totalContractValue: "100000.00",
  },
  {
    id: foreignProjectId,
    clientId,
    projectManagerId: userId,
    name: "Foreign project",
    status: "ACTIVE",
    totalContractValue: "100000.00",
  },
]);
const materialExpenseCategoryId = crypto.randomUUID();
const opsExpenseCategoryId = crypto.randomUUID();
await database.insert(schema.expenseCategory).values([
  { id: materialExpenseCategoryId, code: "MATERIAL", name: "Material" },
  { id: opsExpenseCategoryId, code: "OPERASIONAL", name: "Operasional" },
]);
const budgetId = crypto.randomUUID();
const foreignBudgetId = crypto.randomUUID();
await database.insert(schema.projectBudgets).values(
  [projectId, foreignProjectId].map((id, index) => ({
    id: index === 0 ? budgetId : foreignBudgetId,
    projectId: id,
    status: "APPROVED",
    contractValue: "100000.00",
    approvedRabValue: "100000.00",
    internalBudget: "90000.00",
    budgetCapRatio: "0.9",
    targetGrossAmount: "10000.00",
    targetGrossPercentage: "10",
  })),
);
const materialBudgetCategoryId = crypto.randomUUID();
const opsBudgetCategoryId = crypto.randomUUID();
const foreignCategoryId = crypto.randomUUID();
await database.insert(schema.projectBudgetCategory).values([
  {
    id: materialBudgetCategoryId,
    projectBudgetId: budgetId,
    expenseCategoryId: materialExpenseCategoryId,
    ratioPercentage: "0.8",
    allocatedAmount: "72000.00",
    remainingAmount: "72000.00",
  },
  {
    id: opsBudgetCategoryId,
    projectBudgetId: budgetId,
    expenseCategoryId: opsExpenseCategoryId,
    ratioPercentage: "0.2",
    allocatedAmount: "18000.00",
    remainingAmount: "18000.00",
  },
  {
    id: foreignCategoryId,
    projectBudgetId: foreignBudgetId,
    expenseCategoryId: materialExpenseCategoryId,
    ratioPercentage: "1",
    allocatedAmount: "90000.00",
    remainingAmount: "90000.00",
  },
]);
const materialCategoryId = crypto.randomUUID();
const materialId = crypto.randomUUID();
const otherMaterialId = crypto.randomUUID();
const locationId = crypto.randomUUID();
await database
  .insert(schema.materialCategory)
  .values({ id: materialCategoryId, name: "Catalog fixture" });
await database.insert(schema.materialMaster).values([
  { id: materialId, categoryId: materialCategoryId, name: "Fixture board", unit: "lembar" },
  { id: otherMaterialId, categoryId: materialCategoryId, name: "Other board", unit: "lembar" },
]);
await database
  .insert(schema.inventoryLocation)
  .values({ id: locationId, name: "Fixture warehouse" });
await database.insert(schema.materialInventory).values({
  materialId,
  locationId,
  currentStock: "0.00",
  reservedStock: "0.00",
  minimumStock: "0.00",
  averageCost: "100.00",
  lastPurchasePrice: "100.00",
});
const rapId = crypto.randomUUID();
const foreignRapId = crypto.randomUUID();
await database.insert(schema.projectRap).values([
  { id: rapId, projectId, status: "LOCKED", revision: 1, lockedById: userId },
  {
    id: foreignRapId,
    projectId: foreignProjectId,
    status: "LOCKED",
    revision: 1,
    lockedById: userId,
  },
]);
const wrongSkuRapId = crypto.randomUUID();
const foreignRapItemId = crypto.randomUUID();
const rightRapId = crypto.randomUUID();
const secondRightRapId = crypto.randomUUID();
await database.insert(schema.projectRapItem).values([
  {
    id: wrongSkuRapId,
    projectRapId: rapId,
    materialId: otherMaterialId,
    area: "Fixture",
    name: "Other SKU",
    requiredQuantity: "10",
    bufferQuantity: "0",
    totalQuantity: "10",
    unit: "lembar",
    estimatedUnitCost: "100",
    estimatedTotalCost: "1000",
    source: "WAREHOUSE",
  },
  {
    id: foreignRapItemId,
    projectRapId: foreignRapId,
    materialId,
    area: "Fixture",
    name: "Foreign",
    requiredQuantity: "10",
    bufferQuantity: "0",
    totalQuantity: "10",
    unit: "lembar",
    estimatedUnitCost: "100",
    estimatedTotalCost: "1000",
    source: "WAREHOUSE",
  },
  {
    id: rightRapId,
    projectRapId: rapId,
    materialId,
    area: "Fixture",
    name: "Right",
    requiredQuantity: "10",
    bufferQuantity: "0",
    totalQuantity: "10",
    unit: "lembar",
    estimatedUnitCost: "100",
    estimatedTotalCost: "1000",
    source: "WAREHOUSE",
  },
  {
    id: secondRightRapId,
    projectRapId: rapId,
    materialId,
    area: "Fixture",
    name: "Another",
    requiredQuantity: "10",
    bufferQuantity: "0",
    totalQuantity: "10",
    unit: "lembar",
    estimatedUnitCost: "100",
    estimatedTotalCost: "1000",
    source: "WAREHOUSE",
  },
]);
const validCostId = crypto.randomUUID();
const foreignCostId = crypto.randomUUID();
const wrongCategoryCostId = crypto.randomUUID();
const wrongSkuCostId = crypto.randomUUID();
const rapCostId = crypto.randomUUID();
const pendingCostId = crypto.randomUUID();
const costInputs = [
  {
    id: validCostId,
    projectId,
    projectBudgetCategoryId: materialBudgetCategoryId,
    materialId,
    status: "APPROVED",
  },
  {
    id: foreignCostId,
    projectId: foreignProjectId,
    projectBudgetCategoryId: foreignCategoryId,
    materialId,
    status: "APPROVED",
  },
  {
    id: wrongCategoryCostId,
    projectId,
    projectBudgetCategoryId: opsBudgetCategoryId,
    status: "APPROVED",
  },
  {
    id: wrongSkuCostId,
    projectId,
    projectBudgetCategoryId: materialBudgetCategoryId,
    materialId: otherMaterialId,
    status: "APPROVED",
  },
  {
    id: rapCostId,
    projectId,
    projectBudgetCategoryId: materialBudgetCategoryId,
    materialId,
    projectRapItemId: rightRapId,
    status: "APPROVED",
  },
  {
    id: pendingCostId,
    projectId,
    projectBudgetCategoryId: materialBudgetCategoryId,
    materialId,
    status: "SUBMITTED",
  },
];
for (const input of costInputs) {
  await database.insert(schema.projectCost).values({
    ...input,
    requestedById: userId,
    description: "Fixture claimed stock",
    quantity: "10.00",
    unitPrice: "100.00",
    amount: "1000.00",
  });
  await database.insert(schema.projectExpenses).values({
    projectId: input.projectId,
    projectBudgetId: input.projectId === projectId ? budgetId : foreignBudgetId,
    projectBudgetCategoryId: input.projectBudgetCategoryId,
    expenseCategoryId:
      input.projectBudgetCategoryId === opsBudgetCategoryId
        ? opsExpenseCategoryId
        : materialExpenseCategoryId,
    materialId: input.materialId,
    projectRapItemId: input.projectRapItemId,
    legacyProjectCostId: input.id,
    requestedById: userId,
    description: "Fixture claimed stock",
    quantity: "10.00",
    unitCost: "100.00",
    amount: "1000.00",
    status: input.status,
  });
}
const actions = await import("@backend/app/actions/material/inventory-movements");
const { withTestRequest } = await import("@backend/lib/testing/request");
const recordStockIn = withTestRequest(actions.recordStockIn);
const reserveMaterialForProject = withTestRequest(actions.reserveMaterialForProject);
const useMaterialForProject = withTestRequest(actions.useMaterialForProject);
const returnMaterialFromProject = withTestRequest(actions.returnMaterialFromProject);
const wasteMaterialForProject = withTestRequest(actions.wasteMaterialForProject);
const adjustMaterialStock = withTestRequest(actions.adjustMaterialStock);
const { db } = await import("@backend/db");
const { syncProjectBudgetCategory } = await import("@backend/lib/budget/budget-sync");
await db.transaction((tx) =>
  syncProjectBudgetCategory({ tx, projectBudgetCategoryId: materialBudgetCategoryId }),
);
expect(
  (
    await recordStockIn({
      materialId,
      inventoryLocationId: locationId,
      quantity: 100,
      unitCost: 100,
      note: "Fixture baseline stock",
    })
  ).success,
).toBe(true);
const stockInput = {
  materialId,
  inventoryLocationId: locationId,
  projectId,
  quantity: 1,
  note: "Fixture material operation",
};
async function snapshot(): Promise<unknown> {
  return {
    stock: await database.select().from(schema.materialInventory),
    movements: await database.select().from(schema.stockMovement),
    expenses: await database.select().from(schema.projectExpenses),
    categories: await database.select().from(schema.projectBudgetCategory),
    audits: await database.select().from(schema.auditLog),
    cash: await database.select().from(schema.cashTransaction),
    costs: await database.select().from(schema.projectCost),
  };
}
async function actual(): Promise<string> {
  return (
    (
      await database.query.projectBudgetCategory.findFirst({
        where: eq(schema.projectBudgetCategory.id, materialBudgetCategoryId),
      })
    )?.actualAmount ?? "missing"
  );
}
const initial = await snapshot();
for (const action of [
  recordStockIn,
  reserveMaterialForProject,
  useMaterialForProject,
  returnMaterialFromProject,
  wasteMaterialForProject,
]) {
  expect(await action({ ...stockInput, projectCostId: foreignCostId })).toMatchObject({
    success: false,
    error: { code: "VALIDATION_ERROR" },
  });
  expect(await snapshot()).toEqual(initial);
}
expect(
  await adjustMaterialStock({ ...stockInput, direction: "DECREASE", projectCostId: foreignCostId }),
).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
expect(await snapshot()).toEqual(initial);
for (const links of [
  { projectCostId: wrongCategoryCostId },
  { projectCostId: wrongSkuCostId },
  { projectRapItemId: foreignRapItemId },
  { projectRapItemId: wrongSkuRapId },
  { projectCostId: rapCostId, projectRapItemId: secondRightRapId },
  { projectCostId: pendingCostId },
]) {
  expect(await useMaterialForProject({ ...stockInput, ...links })).toMatchObject({
    success: false,
    error: { code: "VALIDATION_ERROR" },
  });
  expect(await snapshot()).toEqual(initial);
}
expect(
  await recordStockIn({ ...stockInput, projectId: undefined, projectCostId: validCostId }),
).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
expect(await snapshot()).toEqual(initial);
const costedInput = { ...stockInput, projectCostId: validCostId };
const initialActual = await actual();
expect((await useMaterialForProject({ ...costedInput, quantity: 3 })).success).toBe(true);
expect(await actual()).toBe(initialActual);
expect((await returnMaterialFromProject(costedInput)).success).toBe(true);
expect(Number(await actual())).toBe(Number(initialActual) - 100);
expect((await useMaterialForProject(costedInput)).success).toBe(true);
expect(await actual()).toBe(initialActual);
expect((await wasteMaterialForProject({ ...costedInput, quantity: 2 })).success).toBe(true);
expect(await actual()).toBe(initialActual);
// An unlinked credit must not be silently hidden by borrowing a paid expense ID.
expect((await returnMaterialFromProject(stockInput)).success).toBe(true);
expect(Number(await actual())).toBe(Number(initialActual) - 100);
const beforeAmbiguousReuse = await snapshot();
expect(await useMaterialForProject(costedInput)).toMatchObject({
  success: false,
  error: { code: "VALIDATION_ERROR" },
});
expect(await snapshot()).toEqual(beforeAmbiguousReuse);
expect((await useMaterialForProject(stockInput)).success).toBe(true);
expect(await actual()).toBe(initialActual);
const beforeExhausted = await snapshot();
expect(await useMaterialForProject({ ...costedInput, quantity: 6 })).toMatchObject({
  success: false,
  error: { code: "VALIDATION_ERROR" },
});
expect(await snapshot()).toEqual(beforeExhausted);
expect((await database.select().from(schema.cashTransaction)).length).toBe(0);

// Expense-origin stock is checked too; invalid RAP links roll back expense creation.
const { submitFieldRequest } = await import("@backend/app/actions/finance/field-requests");
const beforeBadExpense = await snapshot();
expect(
  await submitFieldRequest({
    projectId,
    projectBudgetCategoryId: materialBudgetCategoryId,
    materialId,
    projectRapItemId: foreignRapItemId,
    inventoryLocationId: locationId,
    quantity: 1,
    unitPrice: 100,
    amount: 100,
    description: "Foreign RAP stock fixture",
    stockHandling: "STOCK_IN",
  }),
).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
expect(await snapshot()).toEqual(beforeBadExpense);
const direct = await submitFieldRequest({
  projectId,
  projectBudgetCategoryId: materialBudgetCategoryId,
  materialId,
  inventoryLocationId: locationId,
  quantity: 1,
  unitPrice: 100,
  amount: 100,
  description: "Direct stock fixture",
  stockHandling: "DIRECT_USE",
});
expect(direct.success).toBe(true);
if (!direct.success) throw new Error(JSON.stringify(direct.error));
const directMovements = await database
  .select()
  .from(schema.stockMovement)
  .where(eq(schema.stockMovement.projectCostId, direct.data.id));
expect(
  directMovements.map((movement) => [movement.movementType, movement.movementDirection]).sort(),
).toEqual([
  ["STOCK_IN", "IN"],
  ["USE", "OUT"],
]);
expect(await actual()).toBe(initialActual);

// A paid Material purchase remains an inventory asset; standalone use adds actual once.
const vendorId = crypto.randomUUID();
const accountId = crypto.randomUUID();
await database
  .insert(schema.vendor)
  .values({ id: vendorId, name: "Fixture vendor", phone: "-", email: "vendor@example.invalid" });
await database.insert(schema.bankAccount).values({
  id: accountId,
  name: "Fixture account",
  accountNumber: "STOCK-FIXTURE",
  bankName: "Fixture",
  holderName: "Fixture",
  balance: "10000.00",
});
const { submitVendorBill } = await import("@backend/app/actions/finance/submit-vendor-bill");
const { scheduleVendorBillPayment } =
  await import("@backend/app/actions/finance/schedule-vendor-bill");
const { payVendorBill } = await import("@backend/app/actions/finance/pay-vendor-bill");
const { postGoodsReceipt } = await import("@backend/app/actions/material/goods-receipt");
const bill = await submitVendorBill({
  vendorId,
  projectId,
  projectBudgetCategoryId: materialBudgetCategoryId,
  billNumber: "STOCK-FIXTURE-BILL",
  amount: 2000,
  dueDate: new Date(),
});
expect(bill.success).toBe(true);
if (!bill.success) throw new Error(JSON.stringify(bill.error));
expect(await actual()).toBe(initialActual);
const scheduled = await scheduleVendorBillPayment({
  vendorBillId: bill.data.id,
  bankAccountId: accountId,
  paymentDate: new Date(),
  amountPaid: 2000,
});
expect(scheduled.success).toBe(true);
if (!scheduled.success) throw new Error(JSON.stringify(scheduled.error));
expect(
  (
    await payVendorBill({
      vendorPaymentId: scheduled.data.id,
      bankAccountId: accountId,
      referenceNumber: "STOCK-FIXTURE-PAYMENT",
    })
  ).success,
).toBe(true);
expect(await actual()).toBe(initialActual);
expect(
  (
    await postGoodsReceipt({
      projectId,
      vendorBillId: bill.data.id,
      inventoryLocationId: locationId,
      receiptNumber: "STOCK-FIXTURE-GRN",
      receivedAt: new Date(),
      items: [{ materialId, quantity: 10, unitCost: 200 }],
    })
  ).success,
).toBe(true);
expect(await actual()).toBe(initialActual);
const average = Number(
  (
    await database.query.materialInventory.findFirst({
      where: eq(schema.materialInventory.materialId, materialId),
    })
  )?.averageCost,
);
const warehouseUsage = { ...stockInput, vendorBillId: bill.data.id, quantity: 2 };
expect((await useMaterialForProject(warehouseUsage)).success).toBe(true);
expect(Number(await actual())).toBe(Number(initialActual) + Number((average * 2).toFixed(2)));
expect((await database.select().from(schema.cashTransaction)).length).toBe(1);
expect(
  (await database.query.bankAccount.findFirst({ where: eq(schema.bankAccount.id, accountId) }))
    ?.balance,
).toBe("8000.00");
expect((await returnMaterialFromProject({ ...warehouseUsage, quantity: 1 })).success).toBe(true);
expect(Number(await actual())).toBe(Number(initialActual) + average);
expect((await wasteMaterialForProject({ ...warehouseUsage, quantity: 1 })).success).toBe(true);
expect(Number(await actual())).toBe(Number(initialActual) + Number((average * 2).toFixed(2)));
expect((await database.select().from(schema.cashTransaction)).length).toBe(1);

// A mismatched vendor SKU and a non-Material bill are not stock linkage shortcuts.
await database
  .update(schema.vendorBill)
  .set({ materialId: otherMaterialId })
  .where(eq(schema.vendorBill.id, bill.data.id));
const beforeBadBill = await snapshot();
expect(
  await reserveMaterialForProject({ ...stockInput, vendorBillId: bill.data.id }),
).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
expect(await snapshot()).toEqual(beforeBadBill);
await database
  .update(schema.vendorBill)
  .set({ materialId: null, projectBudgetCategoryId: opsBudgetCategoryId })
  .where(eq(schema.vendorBill.id, bill.data.id));
const beforeNonMaterialBill = await snapshot();
expect(
  await reserveMaterialForProject({ ...stockInput, vendorBillId: bill.data.id }),
).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
expect(await snapshot()).toEqual(beforeNonMaterialBill);
const adjustments = await database
  .select()
  .from(schema.projectExpenses)
  .where(
    and(
      eq(schema.projectExpenses.sourceType, "STOCK_USAGE"),
      eq(schema.projectExpenses.projectId, projectId),
    ),
  );
expect(adjustments.length).toBe(3);
// Both adjustment signs remain reconstructible from the stock ledger.
await database
  .update(schema.vendorBill)
  .set({ projectBudgetCategoryId: materialBudgetCategoryId })
  .where(eq(schema.vendorBill.id, bill.data.id));
const decrease = await adjustMaterialStock({
  ...costedInput,
  quantity: 0.5,
  direction: "DECREASE",
});
const increase = await adjustMaterialStock({
  ...costedInput,
  quantity: 0.5,
  direction: "INCREASE",
});
expect(decrease).toMatchObject({ success: true, data: { movementDirection: "OUT" } });
expect(increase).toMatchObject({ success: true, data: { movementDirection: "IN" } });
const allMovements = await database
  .select()
  .from(schema.stockMovement)
  .where(eq(schema.stockMovement.materialId, materialId));
const reconstructed = allMovements.reduce(
  (sum, movement) =>
    sum +
    (movement.movementDirection === "IN"
      ? Number(movement.quantity)
      : movement.movementDirection === "OUT"
        ? -Number(movement.quantity)
        : 0),
  0,
);
expect(
  Number(
    (
      await database.query.materialInventory.findFirst({
        where: eq(schema.materialInventory.materialId, materialId),
      })
    )?.currentStock,
  ),
).toBe(reconstructed);
expect((await database.select().from(schema.cashTransaction)).length).toBe(1);
await postgres.close();
console.log("Stock link safety checks passed");
