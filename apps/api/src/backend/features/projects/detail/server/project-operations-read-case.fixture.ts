import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { mock, spyOn } from "bun:test";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@backend/db/schema";
import { withTestRequest } from "@backend/lib/testing/request";
import type { PermissionKey } from "@atria/core/auth/permissions";

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
let failBudgetRead = false;
mock.module("@backend/app/actions/project/excel-budget", () => ({
  getProjectBudgetDashboard: async (projectId: string) => {
    if (failBudgetRead) throw new Error("Disposable budget source failure");
    const data = await buildProjectBudgetDashboard(projectId);
    return data
      ? { success: true, data }
      : { success: false, error: { code: "NOT_FOUND", message: "Budget belum tersedia" } };
  },
}));
const { getProjectDetailData } = await import("./get-project-detail-data");
const read = withTestRequest(getProjectDetailData);
const { getInvoicePrefillContext } =
  await import("@backend/app/actions/finance/get-invoice-prefill-context");
const readInvoicePrefill = withTestRequest(getInvoicePrefillContext);
const own = schema.INSTANCE_TENANT_ID;
const foreign = crypto.randomUUID();
const id = (): string => crypto.randomUUID();
const keys = {
  fullRole: id(),
  budgetRole: id(),
  stockRole: id(),
  assignedRole: id(),
  billRole: id(),
  full: id(),
  budget: id(),
  stock: id(),
  assigned: id(),
  billReader: id(),
  client: id(),
  project: id(),
  otherProject: id(),
  foreignProject: id(),
  emptyProject: id(),
  legacyProject: "77777777-7777-7777-7777-777777777771",
  materialCategory: id(),
  material: id(),
  foreignMaterial: id(),
  location: id(),
  foreignLocation: id(),
  expenseCategory: id(),
  budgetHeader: id(),
  budgetCategory: id(),
  rap: id(),
  item: id(),
  vendor: id(),
  foreignVendor: id(),
  account: id(),
  foreignAccount: id(),
  invoice: id(),
  invoiceLedger: id(),
  finalSnapshot: id(),
};
const costIds = Array.from({ length: 32 }, id);
const billIds = Array.from({ length: 32 }, id);
const paymentIds = Array.from({ length: 32 }, id);
const moveIds = Array.from({ length: 32 }, id);
const invoiceIds = [keys.invoice, ...Array.from({ length: 31 }, id)];
const permissions: readonly PermissionKey[] = [
  "view:budget",
  "view:rap",
  "view:rab",
  "view:inventory",
  "view:cost",
  "view:vendor_bill",
  "view:bank_account",
  "view:client_invoice",
  "view:profitability",
];

try {
  await database.insert(schema.tenant).values([
    { id: own, name: "Disposable operations", slug: "disposable-operations" },
    { id: foreign, name: "Foreign", slug: "foreign-operations" },
  ]);
  await database.insert(schema.role).values([
    { id: keys.fullRole, name: "OPERATIONS_READER", dataScope: "GLOBAL" },
    { id: keys.budgetRole, name: "BUDGET_ONLY", dataScope: "GLOBAL" },
    { id: keys.stockRole, name: "STOCK_ONLY", dataScope: "GLOBAL" },
    { id: keys.billRole, name: "BILL_ONLY", dataScope: "GLOBAL" },
    { id: keys.assignedRole, name: "ASSIGNED_OPERATIONS", dataScope: "ASSIGNED" },
  ]);
  await database
    .insert(schema.rolePermission)
    .values([
      ...permissions.map((permissionKey) => ({ roleId: keys.fullRole, permissionKey })),
      ...[
        "view:budget",
        "view:inventory",
        "view:cost",
        "view:vendor_bill",
        "view:client_invoice",
        "view:profitability",
      ].map((permissionKey) => ({ roleId: keys.assignedRole, permissionKey })),
      { roleId: keys.budgetRole, permissionKey: "view:budget" },
      { roleId: keys.stockRole, permissionKey: "view:budget" },
      { roleId: keys.stockRole, permissionKey: "view:inventory" },
      { roleId: keys.billRole, permissionKey: "view:budget" },
      { roleId: keys.billRole, permissionKey: "view:vendor_bill" },
      { roleId: keys.billRole, permissionKey: "view:profitability" },
    ]);
  await database.insert(schema.user).values([
    { id: keys.full, roleId: keys.fullRole, name: "Full", email: "full@example.invalid" },
    { id: keys.budget, roleId: keys.budgetRole, name: "Budget", email: "budget@example.invalid" },
    { id: keys.stock, roleId: keys.stockRole, name: "Stock", email: "stock@example.invalid" },
    {
      id: keys.assigned,
      roleId: keys.assignedRole,
      name: "Assigned",
      email: "assigned@example.invalid",
    },
    {
      id: keys.billReader,
      roleId: keys.billRole,
      name: "Bill reader",
      email: "bill@example.invalid",
    },
  ]);
  await database.insert(schema.client).values({
    id: keys.client,
    name: "Client",
    email: "client@example.invalid",
    phone: "0800000000",
  });
  await database.insert(schema.project).values([
    {
      id: keys.project,
      name: "Own project",
      clientId: keys.client,
      projectManagerId: keys.assigned,
      status: "ACTIVE",
      totalContractValue: "100.75",
    },
    {
      id: keys.otherProject,
      name: "Unassigned project",
      clientId: keys.client,
      status: "ACTIVE",
      totalContractValue: "0.00",
    },
    {
      id: keys.foreignProject,
      tenantId: foreign,
      name: "Foreign project secret",
      clientId: keys.client,
      projectManagerId: keys.assigned,
      status: "ACTIVE",
      totalContractValue: "0.00",
    },
    {
      id: keys.emptyProject,
      name: "Empty operational project",
      clientId: keys.client,
      status: "ACTIVE",
      totalContractValue: "0.00",
    },
    {
      id: keys.legacyProject,
      name: "Legacy Menteng project",
      clientId: keys.client,
      projectManagerId: keys.assigned,
      status: "ACTIVE",
      totalContractValue: "100.75",
    },
  ]);
  await database
    .insert(schema.expenseCategory)
    .values({ id: keys.expenseCategory, name: "Material", code: "MATERIAL" });
  await database.insert(schema.projectBudgets).values({
    id: keys.budgetHeader,
    projectId: keys.project,
    contractValue: "100.75",
    internalBudget: "90.50",
  });
  await database.insert(schema.projectBudgets).values({
    projectId: keys.emptyProject,
    contractValue: "0.00",
    internalBudget: "0.00",
  });
  await database.insert(schema.projectProfitabilitySnapshot).values([
    {
      id: keys.finalSnapshot,
      projectId: keys.project,
      projectBudgetId: keys.budgetHeader,
      snapshotType: "FINAL",
      snapshotAt: new Date("2026-10-01T00:00:00Z"),
      contractValue: "100.75",
      internalBudget: "90.50",
      actualCost: "60.25",
      remainingBudget: "30.25",
      targetGrossAmount: "10.25",
      realizedMarginAmount: "40.50",
      realizedMarginPercentage: "40.1985",
      cashPosition: "0.36",
    },
    {
      tenantId: foreign,
      projectId: keys.project,
      projectBudgetId: keys.budgetHeader,
      snapshotType: "FINAL",
      snapshotAt: new Date("2026-10-15T00:00:00Z"),
      realizedMarginAmount: "999.99",
    },
    {
      projectId: keys.project,
      projectBudgetId: keys.budgetHeader,
      snapshotType: "PERIODIC",
      snapshotAt: new Date("2026-10-14T00:00:00Z"),
      realizedMarginAmount: "888.88",
    },
    {
      projectId: keys.otherProject,
      projectBudgetId: keys.budgetHeader,
      snapshotType: "FINAL",
      snapshotAt: new Date("2026-10-15T00:00:00Z"),
      realizedMarginAmount: "777.77",
    },
  ]);
  await database.insert(schema.projectBudgetCategory).values({
    id: keys.budgetCategory,
    projectBudgetId: keys.budgetHeader,
    expenseCategoryId: keys.expenseCategory,
    allocatedAmount: "90.50",
    actualAmount: "60.25",
    paidAmount: "20.10",
    pendingAmount: "10.05",
  });
  await database
    .insert(schema.materialCategory)
    .values({ id: keys.materialCategory, name: "Boards" });
  await database.insert(schema.materialMaster).values([
    { id: keys.material, categoryId: keys.materialCategory, name: "Plywood", unit: "lembar" },
    {
      id: keys.foreignMaterial,
      tenantId: foreign,
      categoryId: keys.materialCategory,
      name: "Foreign material secret",
      unit: "lembar",
    },
  ]);
  await database.insert(schema.inventoryLocation).values([
    { id: keys.location, name: "Warehouse" },
    { id: keys.foreignLocation, tenantId: foreign, name: "Foreign warehouse secret" },
  ]);
  await database.insert(schema.materialInventory).values([
    {
      materialId: keys.material,
      locationId: keys.location,
      currentStock: "12.50",
      reservedStock: "2.00",
      averageCost: "10.25",
      lastPurchasePrice: "10.25",
    },
    {
      materialId: keys.material,
      tenantId: foreign,
      locationId: keys.foreignLocation,
      currentStock: "999.00",
    },
  ]);
  await database.insert(schema.projectRap).values({
    id: keys.rap,
    projectId: keys.project,
    status: "LOCKED",
    notes: "Private RAP note",
    setupStage: "REVIEW",
  });
  await database.insert(schema.projectRapItem).values({
    id: keys.item,
    projectRapId: keys.rap,
    materialId: keys.material,
    name: "Plywood kitchen",
    requiredQuantity: "3.00",
    totalQuantity: "3.00",
    unit: "lembar",
    estimatedUnitCost: "999.25",
    estimatedTotalCost: "2997.75",
    internalNote: "Private estimate note",
  });
  await database.insert(schema.vendor).values([
    { id: keys.vendor, name: "Own vendor", phone: "0800000000" },
    {
      id: keys.foreignVendor,
      tenantId: foreign,
      name: "Foreign vendor secret",
      phone: "0800000000",
    },
  ]);
  await database.insert(schema.bankAccount).values([
    {
      id: keys.account,
      name: "Own account",
      bankName: "Bank",
      holderName: "Own company",
      accountNumber: "123",
      balance: "100.75",
    },
    {
      id: keys.foreignAccount,
      tenantId: foreign,
      name: "Foreign account secret",
      bankName: "Foreign",
      holderName: "Foreign company",
      accountNumber: "999",
      balance: "999.00",
    },
  ]);
  await database.insert(schema.projectCost).values([
    ...costIds.map((costId, index) => ({
      id: costId,
      projectId: keys.project,
      requestedById: index % 2 === 0 ? keys.assigned : keys.full,
      projectBudgetCategoryId: keys.budgetCategory,
      projectRapItemId: keys.item,
      amount: "10.25",
      description: `Own cost ${index}`,
      status: "SUBMITTED",
      bankAccountId: keys.account,
    })),
    {
      tenantId: foreign,
      projectId: keys.project,
      requestedById: keys.full,
      projectBudgetCategoryId: keys.budgetCategory,
      amount: "999.00",
      description: "Foreign cost secret",
      status: "SUBMITTED",
    },
  ]);
  await database.insert(schema.cashTransaction).values({
    id: keys.invoiceLedger,
    bankAccountId: keys.account,
    type: "INFLOW",
    category: "client_payment",
    amount: "20.15",
    description: "Client receipt",
  });
  await database.insert(schema.clientInvoice).values([
    ...invoiceIds.map((invoiceId, index) => ({
      id: invoiceId,
      projectId: keys.project,
      invoiceNumber: `CLIENT-${index + 1}`,
      amount: "100.75",
      status: index === 0 ? "PARTIALLY_PAID" : "UNPAID",
      stage: "DP",
      dueDate: new Date(),
    })),
    {
      tenantId: foreign,
      projectId: keys.project,
      invoiceNumber: "Foreign invoice secret",
      amount: "999.00",
      stage: "DP",
      status: "UNPAID",
      dueDate: new Date(),
    },
    {
      projectId: keys.otherProject,
      invoiceNumber: "Other project invoice",
      amount: "777.00",
      stage: "DP",
      status: "UNPAID",
      dueDate: new Date(),
    },
    {
      projectId: keys.legacyProject,
      invoiceNumber: "LEGACY-DP",
      amount: "25.25",
      stage: "DP",
      status: "UNPAID",
      dueDate: new Date(),
    },
    {
      tenantId: foreign,
      projectId: keys.legacyProject,
      invoiceNumber: "Foreign legacy invoice secret",
      amount: "999.00",
      stage: "PROGRESS_1",
      status: "UNPAID",
      dueDate: new Date(),
    },
  ]);
  await database.insert(schema.clientPayment).values([
    {
      clientInvoiceId: keys.invoice,
      bankAccountId: keys.account,
      cashTransactionId: keys.invoiceLedger,
      receivedById: keys.full,
      amountPaid: "20.15",
      paymentDate: new Date(),
    },
    ...Array.from({ length: 31 }, (_, index) => ({
      clientInvoiceId: keys.invoice,
      bankAccountId: keys.account,
      cashTransactionId: keys.invoiceLedger,
      receivedById: keys.full,
      amountPaid: "0.01",
      paymentDate: new Date(),
      referenceNumber: `CLIENT-RECEIPT-${index + 2}`,
    })),
    {
      tenantId: foreign,
      clientInvoiceId: keys.invoice,
      bankAccountId: keys.foreignAccount,
      cashTransactionId: keys.invoiceLedger,
      receivedById: keys.full,
      amountPaid: "999.00",
      paymentDate: new Date(),
      referenceNumber: "Foreign receipt secret",
    },
  ]);
  await database.insert(schema.vendorBill).values([
    ...billIds.map((billId, index) => ({
      id: billId,
      projectId: keys.project,
      vendorId: index === 1 ? keys.foreignVendor : keys.vendor,
      projectBudgetCategoryId: keys.budgetCategory,
      billNumber: `BILL-${index}`,
      amount: "10.25",
      status: "PARTIALLY_PAID",
      dueDate: new Date("2026-11-01T00:00:00Z"),
    })),
    {
      tenantId: foreign,
      projectId: keys.project,
      vendorId: keys.vendor,
      projectBudgetCategoryId: keys.budgetCategory,
      billNumber: "Foreign bill secret",
      amount: "999.00",
      status: "UNPAID",
      dueDate: new Date(),
    },
  ]);
  await database.insert(schema.vendorPayment).values([
    ...paymentIds.map((paymentId, index) => ({
      id: paymentId,
      vendorBillId: billIds[index]!,
      bankAccountId: index === 1 ? keys.foreignAccount : keys.account,
      paidById: keys.full,
      amountPaid: "2.15",
      paymentDate: new Date(),
      status: "PENDING",
    })),
    {
      tenantId: foreign,
      vendorBillId: billIds[0]!,
      bankAccountId: keys.account,
      paidById: keys.full,
      amountPaid: "999.00",
      paymentDate: new Date(),
      referenceNumber: "Foreign payment secret",
    },
  ]);
  await database.insert(schema.approval).values([
    {
      referenceId: paymentIds[0]!,
      referenceType: "vendor_payment",
      approverId: keys.full,
      status: "PENDING",
    },
    {
      tenantId: foreign,
      referenceId: paymentIds[0]!,
      referenceType: "vendor_payment",
      approverId: keys.full,
      status: "Foreign approval secret",
    },
  ]);
  await database.insert(schema.stockMovement).values([
    ...moveIds.map((moveId) => ({
      id: moveId,
      materialId: keys.material,
      inventoryLocationId: keys.location,
      projectId: keys.project,
      projectRapItemId: keys.item,
      movementType: "RESERVE",
      quantity: "0.05",
      createdById: keys.full,
    })),
    {
      tenantId: foreign,
      materialId: keys.material,
      inventoryLocationId: keys.location,
      projectId: keys.project,
      projectRapItemId: keys.item,
      movementType: "RESERVE",
      quantity: "999.00",
      note: "Foreign movement secret",
      createdById: keys.full,
    },
    {
      materialId: keys.foreignMaterial,
      inventoryLocationId: keys.location,
      projectId: keys.project,
      projectRapItemId: keys.item,
      movementType: "RESERVE",
      quantity: "999.00",
      createdById: keys.full,
    },
    {
      materialId: keys.material,
      inventoryLocationId: keys.foreignLocation,
      projectId: keys.project,
      projectRapItemId: keys.item,
      movementType: "RESERVE",
      quantity: "999.00",
      createdById: keys.full,
    },
    {
      materialId: keys.material,
      inventoryLocationId: keys.location,
      projectId: keys.otherProject,
      projectRapItemId: keys.item,
      movementType: "RESERVE",
      quantity: "777.00",
      createdById: keys.full,
    },
  ]);

  sessionUser = { id: keys.full, roleId: keys.fullRole };
  const full = await read(keys.project);
  assert.equal(full.costs.length, 32, "complete costs precede pagination");
  assert.equal(full.vendorBills.length, 32, "complete bills precede pagination");
  assert.equal(full.vendorPayments.length, 32, "complete payments precede pagination");
  assert.equal(full.stockMovements.length, 32, "complete movements precede pagination");
  assert.equal(full.projectExpensesSource?.costs.status, "ready");
  assert.equal(full.projectExpensesSource?.vendorBills.status, "ready");
  assert.equal(full.projectStockData?.source.status, "ready");
  assert.equal(full.projectStockData?.rap?.items[0]?.needToBuy.toFixed(2), "1.40");
  assert.equal(full.projectStockData?.rap?.items[0]?.availableStock, 10.5);
  assert.equal(full.vendorBills.find((bill) => bill.id === billIds[0])?.payments?.length, 1);
  assert.equal(
    full.vendorPayments.find((payment) => payment.id === paymentIds[0])?.approvalStatus,
    "PENDING",
  );
  assert.equal(
    full.vendorPayments.find((payment) => payment.id === paymentIds[1])?.bankAccount,
    null,
  );
  assert.equal(full.vendorBills.find((bill) => bill.id === billIds[1])?.vendor, null);
  assert.equal(full.projectBudgetDashboard?.actualCost, 60.25);
  assert.equal(full.projectBudgetDashboard?.paidCost, 20.1);
  assert.equal(full.projectBudgetDashboard?.pendingCost, 10.05);
  assert.equal(full.projectMarginData?.source.status, "ready");
  assert.equal(full.projectMarginData?.cashSource.status, "ready");
  assert.deepEqual(full.projectMarginData?.cash, {
    received: 20.46,
    paid: 20.1,
    position: 0.36,
  });
  assert.equal(full.projectMarginData?.finalSnapshotSource.status, "ready");
  assert.equal(full.projectMarginData?.finalSnapshot?.id, keys.finalSnapshot);
  assert.equal(full.projectMarginData?.finalSnapshot?.realizedMarginAmount, "40.50");
  assert.ok(!JSON.stringify(full.projectMarginData).includes("999.99"));
  assert.ok(!JSON.stringify(full.projectMarginData).includes("888.88"));
  assert.ok(!JSON.stringify(full.projectMarginData).includes("777.77"));
  assert.ok(!("projectBudgetId" in (full.projectMarginData?.finalSnapshot ?? {})));
  assert.ok(
    !("clientInvoices" in full.project),
    "undeclared relation rows are not serialized through the project header",
  );
  assert.equal(full.projectInvoicesSource?.status, "ready");
  assert.equal(full.invoices.length, 32, "complete client invoices precede pagination");
  const receiptInvoice = full.invoices.find((invoice) => invoice.id === keys.invoice);
  assert.equal(receiptInvoice?.payments.length, 32, "all receipts are available for pagination");
  assert.ok(receiptInvoice?.payments.some((payment) => payment.amountPaid === "20.15"));
  assert.ok(!JSON.stringify(full.invoices).includes("secret"));
  assert.ok(
    !JSON.stringify(full.invoices).includes("bankAccountId") &&
      !JSON.stringify(full.invoices).includes("cashTransactionId"),
  );
  assert.ok(
    !JSON.stringify([
      full.costs,
      full.vendorBills,
      full.vendorPayments,
      full.stockMovements,
      full.projectStockData,
    ]).includes("secret"),
  );

  sessionUser = { id: keys.budget, roleId: keys.budgetRole };
  const budgetOnly = await read(keys.project);
  assert.deepEqual(
    [
      budgetOnly.costs,
      budgetOnly.vendorBills,
      budgetOnly.vendorPayments,
      budgetOnly.stockMovements,
    ],
    [[], [], [], []],
  );
  assert.equal(budgetOnly.projectStockData?.source.status, "restricted");
  assert.deepEqual(budgetOnly.invoices, [], "invoice documents need their own domain permission");
  assert.equal(budgetOnly.projectInvoicesSource?.status, "restricted");
  assert.equal(budgetOnly.projectMarginData?.source.status, "restricted");
  assert.equal(budgetOnly.projectMarginData?.cashSource.status, "restricted");
  assert.equal(budgetOnly.projectMarginData?.finalSnapshotSource.status, "restricted");
  assert.equal(budgetOnly.projectMarginData?.finalSnapshot, null);
  assert.equal(budgetOnly.projectMarginData?.cash, null);
  assert.equal(budgetOnly.projectExpensesSource?.costs.status, "restricted");
  assert.equal(budgetOnly.projectExpensesSource?.vendorBills.status, "restricted");
  assert.equal(
    budgetOnly.projectBudgetDashboard?.actualCost,
    60.25,
    "canonical finance facts remain domain-authorized",
  );

  sessionUser = { id: keys.stock, roleId: keys.stockRole };
  const stockOnly = await read(keys.project);
  assert.deepEqual(stockOnly.project.raps, []);
  assert.equal(
    stockOnly.projectStockData?.rap?.items.length,
    1,
    "inventory rights obtain safe planning quantity context without internal RAP access",
  );
  assert.equal(stockOnly.projectStockData?.materials.length, 1);
  assert.equal(stockOnly.stockMovements.length, 32);
  const stockJson = JSON.stringify(stockOnly.projectStockData);
  assert.ok(
    !stockJson.includes("estimatedUnitCost") &&
      !stockJson.includes("internalNote") &&
      !stockJson.includes("Private"),
  );

  sessionUser = { id: keys.billReader, roleId: keys.billRole };
  const billsOnly = await read(keys.project);
  assert.equal(billsOnly.projectMarginData?.source.status, "ready");
  assert.equal(billsOnly.projectMarginData?.cashSource.status, "restricted");
  assert.equal(billsOnly.projectMarginData?.cash, null);
  assert.equal(billsOnly.vendorPayments.length, 32);
  assert.deepEqual(billsOnly.bankAccounts, []);
  assert.ok(
    billsOnly.vendorPayments.every(
      (payment) => payment.bankAccountId === "" && payment.bankAccount === null,
    ),
  );
  assert.ok(
    billsOnly.vendorBills.every((bill) =>
      bill.payments?.every(
        (payment) => payment.bankAccountId === "" && payment.bankAccount === null,
      ),
    ),
  );
  assert.ok(
    !JSON.stringify([billsOnly.costs, billsOnly.vendorBills, billsOnly.vendorPayments]).includes(
      "cashTransactionId",
    ),
  );

  sessionUser = { id: keys.assigned, roleId: keys.assignedRole };
  const assigned = await read(keys.project);
  assert.equal(
    assigned.costs.length,
    16,
    "assigned scope sees only own field claims within an assigned project",
  );
  assert.equal(assigned.vendorBills.length, 32);
  assert.equal(assigned.invoices.length, 32);
  assert.deepEqual(assigned.projectMarginData?.cash, full.projectMarginData?.cash);
  assert.equal(assigned.projectMarginData?.finalSnapshot?.id, keys.finalSnapshot);
  assert.equal(assigned.projectStockData?.rap?.items.length, 1);
  assert.ok(assigned.costs.every((cost) => cost.requestedBy?.name === "Assigned"));
  await assert.rejects(read(keys.otherProject), { name: "RedirectControl" });
  await assert.rejects(read(keys.foreignProject));

  sessionUser = { id: keys.full, roleId: keys.fullRole };
  const empty = await read(keys.emptyProject);
  assert.equal(empty.projectStockData?.source.status, "missing");
  assert.equal(empty.projectExpensesSource?.costs.status, "ready");
  assert.equal(empty.projectExpensesSource?.vendorBills.status, "ready");
  assert.equal(empty.projectInvoicesSource?.status, "ready");
  assert.deepEqual(empty.invoices, []);
  assert.deepEqual(empty.costs, []);
  assert.equal(empty.projectMarginData?.source.status, "ready");
  assert.equal(empty.projectMarginData?.cashSource.status, "ready");
  assert.deepEqual(empty.projectMarginData?.cash, { received: 0, paid: 0, position: 0 });
  assert.equal(empty.projectMarginData?.finalSnapshotSource.status, "missing");
  const missingMarginBudget = await read(keys.otherProject);
  assert.equal(missingMarginBudget.projectMarginData?.source.status, "missing");
  assert.equal(missingMarginBudget.projectMarginData?.cash, null);
  failBudgetRead = true;
  const marginBudgetFailure = await read(keys.project);
  assert.equal(marginBudgetFailure.projectMarginData?.source.status, "unavailable");
  assert.equal(marginBudgetFailure.projectMarginData?.cashSource.status, "unavailable");
  assert.equal(marginBudgetFailure.projectMarginData?.cash, null);
  failBudgetRead = false;
  const failedFinalSnapshot = spyOn(
    database.query.projectProfitabilitySnapshot,
    "findMany",
  ).mockRejectedValueOnce(new Error("Snapshot source failure"));
  const marginSnapshotFailure = await read(keys.project);
  assert.equal(marginSnapshotFailure.projectMarginData?.source.status, "ready");
  assert.equal(marginSnapshotFailure.projectMarginData?.finalSnapshotSource.status, "unavailable");
  assert.equal(marginSnapshotFailure.projectMarginData?.finalSnapshot, null);
  failedFinalSnapshot.mockRestore();
  const failedCosts = spyOn(database.query.projectCost, "findMany").mockRejectedValueOnce(
    new Error("read failure"),
  );
  assert.equal((await read(keys.project)).projectExpensesSource?.costs.status, "unavailable");
  failedCosts.mockRestore();
  const failedStock = spyOn(database.query.stockMovement, "findMany").mockRejectedValueOnce(
    new Error("read failure"),
  );
  const stockFailure = await read(keys.project);
  assert.equal(stockFailure.projectStockData?.source.status, "unavailable");
  assert.equal(stockFailure.projectStockData?.rap, null);
  failedStock.mockRestore();
  const failedBills = spyOn(database.query.vendorBill, "findMany").mockRejectedValueOnce(
    new Error("read failure"),
  );
  assert.equal((await read(keys.project)).projectExpensesSource?.vendorBills.status, "unavailable");
  failedBills.mockRestore();
  const failedInvoices = spyOn(database.query.clientInvoice, "findMany").mockRejectedValueOnce(
    new Error("read failure"),
  );
  const invoiceFailure = await read(keys.project);
  assert.equal(invoiceFailure.projectInvoicesSource?.status, "unavailable");
  assert.equal(invoiceFailure.projectMarginData?.source.status, "ready");
  assert.equal(invoiceFailure.projectMarginData?.cashSource.status, "unavailable");
  assert.equal(invoiceFailure.projectMarginData?.cash, null);
  assert.deepEqual(invoiceFailure.invoices, []);
  assert.equal(invoiceFailure.project.id, keys.project);
  assert.equal(invoiceFailure.projectExpensesSource?.costs.status, "ready");
  failedInvoices.mockRestore();

  const legacyPrefill = await readInvoicePrefill({ projectId: keys.legacyProject });
  assert.ok(legacyPrefill.success, "canonical database UUIDs are accepted for invoice prefill");
  if (legacyPrefill.success) {
    assert.equal(legacyPrefill.data.remainingUnbilled, 75.5);
    assert.equal(legacyPrefill.data.activeInvoicesCount, 1);
    assert.equal(legacyPrefill.data.suggestedStage, "PROGRESS_1");
    assert.ok(legacyPrefill.data.suggestedInvoiceNumber.startsWith("INV/"));
  }
  assert.equal((await readInvoicePrefill({ projectId: "not-a-uuid" })).success, false);
  const foreignPrefill = await readInvoicePrefill({ projectId: keys.foreignProject });
  assert.ok(!foreignPrefill.success);
  if (!foreignPrefill.success) assert.equal(foreignPrefill.error.code, "NOT_FOUND");
  sessionUser = { id: keys.budget, roleId: keys.budgetRole };
  const restrictedPrefill = await readInvoicePrefill({ projectId: keys.legacyProject });
  assert.ok(!restrictedPrefill.success);
  if (!restrictedPrefill.success) assert.equal(restrictedPrefill.error.code, "FORBIDDEN");
  sessionUser = { id: keys.assigned, roleId: keys.assignedRole };
  assert.ok((await readInvoicePrefill({ projectId: keys.legacyProject })).success);
  const unassignedPrefill = await readInvoicePrefill({ projectId: keys.otherProject });
  assert.ok(!unassignedPrefill.success);
  if (!unassignedPrefill.success) assert.equal(unassignedPrefill.error.code, "FORBIDDEN");
  sessionUser = { id: keys.full, roleId: keys.fullRole };
  const failedPrefill = spyOn(database.query.project, "findFirst").mockRejectedValueOnce(
    new Error("Failed query: private database diagnostics"),
  );
  const prefillFailure = await readInvoicePrefill({ projectId: keys.legacyProject });
  assert.ok(!prefillFailure.success);
  if (!prefillFailure.success) {
    assert.equal(prefillFailure.error.code, "INTERNAL_SERVER_ERROR");
    assert.equal(prefillFailure.error.message, "Konteks invoice belum dapat dimuat. Coba lagi.");
  }
  failedPrefill.mockRestore();
  sessionUser = null;
  const anonymousPrefill = await readInvoicePrefill({ projectId: keys.legacyProject });
  assert.ok(!anonymousPrefill.success);
  if (!anonymousPrefill.success) assert.equal(anonymousPrefill.error.code, "UNAUTHORIZED");
  console.log("Project operations reads passed");
} finally {
  await postgres.close();
}
