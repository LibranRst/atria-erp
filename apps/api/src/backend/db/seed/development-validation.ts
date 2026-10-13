import type { db } from "@backend/db";
import * as schema from "@backend/db/schema";
import { calculateQuotationTotal } from "@atria/core/project/quotation-total";
import { calculateOutstandingProjectReservations } from "@atria/core/material/project-material-projection";
import { getBudgetCategoryStatus, calculateUsedPercentage } from "@atria/core/budget/excel-budget";
import {
  normalizeNotificationReferenceType,
  safeNotificationUrl,
} from "@atria/core/notifications/types";
import { DEMO_IDS, parseMoneyToMinor } from "./demo-contract";

type DevelopmentSeedData = {
  accounts: (typeof schema.bankAccount.$inferSelect)[];
  cash: (typeof schema.cashTransaction.$inferSelect)[];
  invoices: (typeof schema.clientInvoice.$inferSelect)[];
  clientPayments: (typeof schema.clientPayment.$inferSelect)[];
  bills: (typeof schema.vendorBill.$inferSelect)[];
  vendorPayments: (typeof schema.vendorPayment.$inferSelect)[];
  costs: (typeof schema.projectCost.$inferSelect)[];
  expenses: (typeof schema.projectExpenses.$inferSelect)[];
  budgets: (typeof schema.projectBudgets.$inferSelect)[];
  categories: (typeof schema.projectBudgetCategory.$inferSelect)[];
  expenseCategories: (typeof schema.expenseCategory.$inferSelect)[];
  projects: (typeof schema.project.$inferSelect)[];
  raps: (typeof schema.projectRap.$inferSelect)[];
  rapItems: (typeof schema.projectRapItem.$inferSelect)[];
  packages: (typeof schema.projectCategoryPlanItem.$inferSelect)[];
  rabs: (typeof schema.rabEstimate.$inferSelect)[];
  rabItems: (typeof schema.rabEstimateItem.$inferSelect)[];
  bundles: (typeof schema.rabEstimateBundle.$inferSelect)[];
  movements: (typeof schema.stockMovement.$inferSelect)[];
  inventories: (typeof schema.materialInventory.$inferSelect)[];
  materials: (typeof schema.materialMaster.$inferSelect)[];
  library: (typeof schema.itemPriceLibrary.$inferSelect)[];
  notifications: (typeof schema.notification.$inferSelect)[];
  audits: (typeof schema.auditLog.$inferSelect)[];
  snapshots: (typeof schema.projectProfitabilitySnapshot.$inferSelect)[];
  imports: (typeof schema.bankStatementImport.$inferSelect)[];
  statements: (typeof schema.bankStatementRow.$inferSelect)[];
  changeOrders: (typeof schema.projectChangeOrder.$inferSelect)[];
  receipts: (typeof schema.goodsReceipt.$inferSelect)[];
  receiptItems: (typeof schema.goodsReceiptItem.$inferSelect)[];
  counts: (typeof schema.stockCount.$inferSelect)[];
  conversations: (typeof schema.aiConversation.$inferSelect)[];
  messages: (typeof schema.aiMessage.$inferSelect)[];
};

export type DevelopmentVerificationReport = {
  readonly projects: number;
  readonly budgets: number;
  readonly rapDocuments: number;
  readonly rapItems: number;
  readonly workPackages: number;
  readonly rabDocuments: number;
  readonly rabBundles: number;
  readonly rabItems: number;
  readonly libraryItems: number;
  readonly vendorBills: number;
  readonly expenses: number;
  readonly cashTransactions: number;
  readonly stockMovements: number;
  readonly notifications: number;
  readonly aiConversations: number;
};

async function readDevelopmentSeed(
  connection: Pick<typeof db, "select">,
): Promise<DevelopmentSeedData> {
  // A transaction has one PostgreSQL client; finish each read before the next.
  return {
    accounts: await connection.select().from(schema.bankAccount),
    cash: await connection.select().from(schema.cashTransaction),
    invoices: await connection.select().from(schema.clientInvoice),
    clientPayments: await connection.select().from(schema.clientPayment),
    bills: await connection.select().from(schema.vendorBill),
    vendorPayments: await connection.select().from(schema.vendorPayment),
    costs: await connection.select().from(schema.projectCost),
    expenses: await connection.select().from(schema.projectExpenses),
    budgets: await connection.select().from(schema.projectBudgets),
    categories: await connection.select().from(schema.projectBudgetCategory),
    expenseCategories: await connection.select().from(schema.expenseCategory),
    projects: await connection.select().from(schema.project),
    raps: await connection.select().from(schema.projectRap),
    rapItems: await connection.select().from(schema.projectRapItem),
    packages: await connection.select().from(schema.projectCategoryPlanItem),
    rabs: await connection.select().from(schema.rabEstimate),
    rabItems: await connection.select().from(schema.rabEstimateItem),
    bundles: await connection.select().from(schema.rabEstimateBundle),
    movements: await connection.select().from(schema.stockMovement),
    inventories: await connection.select().from(schema.materialInventory),
    materials: await connection.select().from(schema.materialMaster),
    library: await connection.select().from(schema.itemPriceLibrary),
    notifications: await connection.select().from(schema.notification),
    audits: await connection.select().from(schema.auditLog),
    snapshots: await connection.select().from(schema.projectProfitabilitySnapshot),
    imports: await connection.select().from(schema.bankStatementImport),
    statements: await connection.select().from(schema.bankStatementRow),
    changeOrders: await connection.select().from(schema.projectChangeOrder),
    receipts: await connection.select().from(schema.goodsReceipt),
    receiptItems: await connection.select().from(schema.goodsReceiptItem),
    counts: await connection.select().from(schema.stockCount),
    conversations: await connection.select().from(schema.aiConversation),
    messages: await connection.select().from(schema.aiMessage),
  };
}

/** Read-only validation, also run inside the seed transaction before COMMIT. */
export async function verifyDevelopmentDataset(
  connection: Pick<typeof db, "select">,
): Promise<DevelopmentVerificationReport> {
  const d = await readDevelopmentSeed(connection);
  const errors: string[] = [];
  const check = (condition: boolean, message: string): void => {
    if (!condition) errors.push(message);
  };
  const money = parseMoneyToMinor;
  const sum = (values: readonly string[]): bigint =>
    values.reduce((total, value) => total + money(value), 0n);
  const product = (quantity: string, unitCost: string): bigint =>
    (money(quantity) * money(unitCost)) / 100n;
  const budgetById = new Map(d.budgets.map((r) => [r.id, r]));
  const categoryById = new Map(d.categories.map((r) => [r.id, r]));
  const categoryCode = new Map(d.expenseCategories.map((r) => [r.id, r.code]));
  const rapById = new Map(d.raps.map((r) => [r.id, r]));
  const rapItemById = new Map(d.rapItems.map((r) => [r.id, r]));
  const packageById = new Map(d.packages.map((r) => [r.id, r]));
  const cashById = new Map(d.cash.map((r) => [r.id, r]));
  const rabById = new Map(d.rabs.map((r) => [r.id, r]));

  for (const account of d.accounts) {
    const balance = d.cash
      .filter((r) => r.bankAccountId === account.id)
      .reduce((total, r) => total + (r.type === "INFLOW" ? money(r.amount) : -money(r.amount)), 0n);
    check(
      balance === money(account.balance) && balance >= 0n,
      `Saldo rekening ${account.name} tidak cocok dengan ledger.`,
    );
  }
  for (const cash of d.cash) {
    check(
      money(cash.amount) > 0n && ["INFLOW", "OUTFLOW"].includes(cash.type),
      `Ledger ${cash.id} memiliki arah/nominal tidak valid.`,
    );
    check(
      d.audits.some(
        (a) =>
          a.targetTable === "bank_account" &&
          a.targetId === cash.bankAccountId &&
          a.newState?.includes(cash.id),
      ),
      `Ledger ${cash.id} tidak memiliki audit perubahan saldo.`,
    );
    if (cash.reconciled)
      check(
        d.statements.some((s) => s.isReconciled && s.matchedCashTransactionId === cash.id),
        `Ledger ${cash.id} direkonsiliasi tanpa evidence.`,
      );
  }
  for (const statement of d.statements.filter((r) => r.isReconciled)) {
    const cash = statement.matchedCashTransactionId
      ? cashById.get(statement.matchedCashTransactionId)
      : undefined;
    const imported = d.imports.find((r) => r.id === statement.importId);
    check(
      cash?.reconciled === true &&
        cash.bankAccountId === imported?.bankAccountId &&
        cash.type === statement.type &&
        money(cash.amount) === money(statement.amount),
      `Mutasi ${statement.id} tidak sesuai pasangan rekonsiliasi.`,
    );
  }
  for (const invoice of d.invoices) {
    const paid = sum(
      d.clientPayments.filter((r) => r.clientInvoiceId === invoice.id).map((r) => r.amountPaid),
    );
    const amount = money(invoice.amount);
    check(
      paid <= amount &&
        invoice.status === (paid === 0n ? "UNPAID" : paid === amount ? "PAID" : "PARTIALLY_PAID"),
      `Invoice ${invoice.invoiceNumber} tidak sesuai pembayaran.`,
    );
  }
  for (const payment of d.clientPayments) {
    const cash = payment.cashTransactionId ? cashById.get(payment.cashTransactionId) : undefined;
    check(
      cash?.type === "INFLOW" &&
        cash.bankAccountId === payment.bankAccountId &&
        cash.referenceType === "client_payment" &&
        cash.referenceId === payment.id &&
        money(cash.amount) === money(payment.amountPaid),
      `Pembayaran klien ${payment.id} tidak cocok dengan ledger.`,
    );
  }
  for (const bill of d.bills) {
    const payments = d.vendorPayments.filter((p) => p.vendorBillId === bill.id);
    const paid = sum(payments.filter((p) => p.status === "COMPLETED").map((p) => p.amountPaid));
    const committed = sum(
      payments.filter((p) => ["COMPLETED", "PENDING"].includes(p.status)).map((p) => p.amountPaid),
    );
    const amount = money(bill.amount);
    check(
      committed <= amount &&
        bill.status === (paid === 0n ? "UNPAID" : paid === amount ? "PAID" : "PARTIALLY_PAID"),
      `Tagihan ${bill.billNumber} tidak sesuai pembayaran.`,
    );
    check(
      budgetById.get(categoryById.get(bill.projectBudgetCategoryId)?.projectBudgetId ?? "")
        ?.projectId === bill.projectId,
      `Tagihan ${bill.billNumber} memakai kategori proyek lain.`,
    );
  }
  for (const payment of d.vendorPayments.filter((p) => p.status === "COMPLETED")) {
    const cash = payment.cashTransactionId ? cashById.get(payment.cashTransactionId) : undefined;
    check(
      cash?.type === "OUTFLOW" &&
        cash.bankAccountId === payment.bankAccountId &&
        cash.referenceType === "vendor_payment" &&
        cash.referenceId === payment.id &&
        money(cash.amount) === money(payment.amountPaid),
      `Pembayaran vendor ${payment.id} tidak cocok dengan ledger.`,
    );
  }
  for (const expense of d.expenses) {
    const category = categoryById.get(expense.projectBudgetCategoryId);
    check(
      category?.projectBudgetId === expense.projectBudgetId &&
        category.expenseCategoryId === expense.expenseCategoryId &&
        budgetById.get(expense.projectBudgetId)?.projectId === expense.projectId,
      `Expense ${expense.id} memakai budget/kategori proyek lain.`,
    );
    check(
      product(expense.quantity, expense.unitCost) === money(expense.amount),
      `Expense ${expense.id} quantity × cost tidak cocok.`,
    );
    if (expense.legacyProjectCostId) {
      const legacy = d.costs.find((r) => r.id === expense.legacyProjectCostId);
      check(
        legacy?.projectId === expense.projectId &&
          legacy.projectBudgetCategoryId === expense.projectBudgetCategoryId &&
          legacy.status === expense.status &&
          legacy.quantity === expense.quantity &&
          legacy.unitPrice === expense.unitCost &&
          legacy.amount === expense.amount,
        `Expense ${expense.id} drift dari legacy project_cost.`,
      );
    }
    if (expense.materialId || expense.projectRapItemId || expense.stockMovementId)
      check(
        categoryCode.get(expense.expenseCategoryId) === "MATERIAL",
        `Expense ${expense.id} memakai link material di kategori lain.`,
      );
    if (expense.projectRapItemId) {
      const item = rapItemById.get(expense.projectRapItemId);
      check(
        rapById.get(item?.projectRapId ?? "")?.projectId === expense.projectId &&
          (!expense.materialId || item?.materialId === expense.materialId),
        `Expense ${expense.id} memakai RAP/material yang berbeda.`,
      );
    }
    if (expense.projectCategoryPlanItemId) {
      const item = packageById.get(expense.projectCategoryPlanItemId);
      check(
        item?.projectId === expense.projectId &&
          item.expenseCategoryId === expense.expenseCategoryId,
        `Expense ${expense.id} memakai paket kategori/proyek lain.`,
      );
    }
  }
  for (const cost of d.costs.filter((r) => r.status === "PAID")) {
    const cash = cost.cashTransactionId ? cashById.get(cost.cashTransactionId) : undefined;
    check(
      cash?.type === "OUTFLOW" && money(cash.amount) === money(cost.amount),
      `Expense paid ${cost.id} tidak memiliki kas keluar yang cocok.`,
    );
  }
  for (const category of d.categories) {
    const expenses = d.expenses.filter((r) => r.projectBudgetCategoryId === category.id);
    const actual = sum(
      expenses.filter((r) => ["APPROVED", "PAID"].includes(r.status)).map((r) => r.amount),
    );
    const pending = sum(
      expenses.filter((r) => ["SUBMITTED", "VERIFIED"].includes(r.status)).map((r) => r.amount),
    );
    const paid = expenses.reduce((total, r) => {
      if (r.status === "PAID") return total + money(r.amount);
      if (!r.vendorBillId) return total;
      const billPaid = sum(
        d.vendorPayments
          .filter((p) => p.vendorBillId === r.vendorBillId && p.status === "COMPLETED")
          .map((p) => p.amountPaid),
      );
      return total + (billPaid > money(r.amount) ? money(r.amount) : billPaid);
    }, 0n);
    check(
      actual === money(category.actualAmount) &&
        pending === money(category.pendingAmount) &&
        paid === money(category.paidAmount) &&
        money(category.remainingAmount) === money(category.allocatedAmount) - actual,
      `Agregasi kategori ${category.id} tidak sesuai detail expense.`,
    );
    check(
      category.status ===
        getBudgetCategoryStatus(
          calculateUsedPercentage(Number(category.actualAmount), Number(category.allocatedAmount)),
        ),
      `Risk kategori ${category.id} tidak sesuai penggunaan.`,
    );
  }
  for (const budget of d.budgets)
    check(
      sum(
        d.categories.filter((c) => c.projectBudgetId === budget.id).map((c) => c.allocatedAmount),
      ) <= money(budget.internalBudget),
      `Alokasi budget ${budget.id} melebihi cap.`,
    );
  for (const item of d.rapItems) {
    check(
      money(item.requiredQuantity) + money(item.bufferQuantity) === money(item.totalQuantity) &&
        product(item.totalQuantity, item.estimatedUnitCost) === money(item.estimatedTotalCost),
      `RAP ${item.id} buffer/quantity/cost tidak cocok.`,
    );
    check(
      d.materials.some((r) => r.id === item.materialId && r.unit === item.unit),
      `RAP ${item.id} material atau unit tidak cocok.`,
    );
  }
  for (const item of d.packages) {
    check(
      product(item.quantity, item.estimatedUnitCost) === money(item.estimatedTotalCost),
      `Paket ${item.id} quantity × cost tidak cocok.`,
    );
    check(
      ["TUKANG", "SUBCON"].includes(categoryCode.get(item.expenseCategoryId) ?? "") &&
        budgetById.get(item.projectBudgetId)?.projectId === item.projectId &&
        categoryById.get(item.projectBudgetCategoryId)?.expenseCategoryId ===
          item.expenseCategoryId,
      `Paket ${item.id} kategori/proyek tidak cocok.`,
    );
  }
  for (const item of d.rabItems) {
    const estimate = rabById.get(item.rabEstimateId);
    check(
      product(item.quantity, item.unitPrice) === money(item.lineTotal),
      `RAB item ${item.id} quantity × price tidak cocok.`,
    );
    if (item.sourceProjectRapItemId)
      check(
        rapById.get(rapItemById.get(item.sourceProjectRapItemId)?.projectRapId ?? "")?.projectId ===
          estimate?.projectId && item.sourceType === "RAP_MATERIAL",
        `RAB item ${item.id} sumber RAP/proyek tidak cocok.`,
      );
    if (item.sourceProjectCategoryPlanItemId)
      check(
        packageById.get(item.sourceProjectCategoryPlanItemId)?.projectId === estimate?.projectId &&
          item.sourceType === "CATEGORY_PLAN",
        `RAB item ${item.id} sumber paket/proyek tidak cocok.`,
      );
    if (item.bundleId)
      check(
        d.bundles.some((b) => b.id === item.bundleId && b.rabEstimateId === item.rabEstimateId),
        `RAB item ${item.id} bundle dari dokumen lain.`,
      );
    check(Boolean(item.clientLabel.trim()), `RAB item ${item.id} label kosong.`);
  }
  for (const bundle of d.bundles)
    check(
      product(bundle.quantity, bundle.unitPrice) === money(bundle.lineTotal) &&
        d.rabItems.some((r) => r.bundleId === bundle.id),
      `Bundle ${bundle.id} kosong atau total tidak cocok.`,
    );
  for (const rab of d.rabs) {
    const items = d.rabItems.filter((r) => r.rabEstimateId === rab.id);
    const bundles = d.bundles.filter((r) => r.rabEstimateId === rab.id);
    if (rab.status === "APPROVED")
      check(
        money(rab.approvedValue) === money(calculateQuotationTotal(items, bundles).toFixed(2)),
        `RAB approved ${rab.id} total tidak sesuai isi.`,
      );
    if (rab.supersedesRabEstimateId)
      check(
        rabById.get(rab.supersedesRabEstimateId)?.projectId === rab.projectId &&
          (rabById.get(rab.supersedesRabEstimateId)?.revision ?? 0) < rab.revision,
        `RAB ${rab.id} rantai revisi tidak valid.`,
      );
  }
  for (const order of d.changeOrders) {
    const items = d.rabItems.filter((r) => r.rabEstimateId === order.revisedRabEstimateId);
    const bundles = d.bundles.filter((r) => r.rabEstimateId === order.revisedRabEstimateId);
    check(
      money(order.revisedContractValue) - money(order.previousContractValue) ===
        money(order.valueDelta) &&
        money(calculateQuotationTotal(items, bundles).toFixed(2)) ===
          money(order.revisedContractValue),
      `Change Order ${order.id} nilai revisi/delta tidak cocok.`,
    );
  }
  for (const inventory of d.inventories) {
    const movements = d.movements.filter(
      (r) =>
        r.materialId === inventory.materialId && r.inventoryLocationId === inventory.locationId,
    );
    const stock = movements.reduce(
      (total, r) =>
        total +
        (r.movementDirection === "IN"
          ? money(r.quantity)
          : r.movementDirection === "OUT"
            ? -money(r.quantity)
            : 0n),
      0n,
    );
    const projectIds = new Set(movements.map((r) => r.projectId));
    const reserved = Array.from(projectIds).reduce(
      (total, projectId) =>
        total +
        calculateOutstandingProjectReservations(movements.filter((r) => r.projectId === projectId)),
      0,
    );
    check(
      stock === money(inventory.currentStock) &&
        money(reserved.toFixed(2)) === money(inventory.reservedStock) &&
        stock >= money(inventory.reservedStock) &&
        money(inventory.reservedStock) >= 0n,
      `Stok ${inventory.id} tidak cocok dengan movement/reservasi.`,
    );
  }
  for (const movement of d.movements) {
    check(money(movement.quantity) > 0n, `Movement ${movement.id} memiliki quantity tidak valid.`);
    if (movement.movementType === "RESERVE")
      check(
        movement.movementDirection === "NEUTRAL",
        `Reservasi ${movement.id} mengubah stock fisik.`,
      );
    if (["USE", "WASTE"].includes(movement.movementType))
      check(
        movement.movementDirection === "OUT" && Boolean(movement.projectId),
        `Usage/waste ${movement.id} arah/proyek tidak valid.`,
      );
    if (["RETURN", "GOODS_RECEIPT", "OPENING_BALANCE"].includes(movement.movementType))
      check(movement.movementDirection === "IN", `Penerimaan ${movement.id} arah tidak valid.`);
    if (["WASTE", "ADJUSTMENT"].includes(movement.movementType))
      check(
        Boolean(movement.note?.trim()),
        `Adjustment/waste ${movement.id} tidak memiliki catatan audit.`,
      );
    if (movement.id.startsWith("68686868"))
      check(
        d.audits.some((a) => a.targetTable === "stock_movement" && a.targetId === movement.id),
        `Movement development ${movement.id} tidak memiliki audit.`,
      );
    if (movement.projectRapItemId) {
      const item = rapItemById.get(movement.projectRapItemId);
      check(
        item?.materialId === movement.materialId &&
          rapById.get(item.projectRapId)?.projectId === movement.projectId,
        `Movement ${movement.id} RAP/material/proyek tidak cocok.`,
      );
    }
  }
  for (const receipt of d.receipts) {
    const items = d.receiptItems.filter((r) => r.goodsReceiptId === receipt.id);
    check(items.length > 0, `Penerimaan ${receipt.id} tidak memiliki item.`);
    if (receipt.status === "POSTED")
      check(
        items.every(
          (r) =>
            r.stockMovementId &&
            d.movements.some(
              (m) =>
                m.id === r.stockMovementId &&
                m.materialId === r.materialId &&
                m.quantity === r.quantity,
            ),
        ),
        `Penerimaan ${receipt.id} tidak memiliki movement yang cocok.`,
      );
  }
  for (const snapshot of d.snapshots) {
    const actual = sum(
      d.categories
        .filter((r) => r.projectBudgetId === snapshot.projectBudgetId)
        .map((r) => r.actualAmount),
    );
    check(
      actual === money(snapshot.actualCost) &&
        money(snapshot.remainingBudget) === money(snapshot.internalBudget) - actual,
      `Snapshot ${snapshot.id} drift dari budget.`,
    );
  }
  check(
    d.projects.length >= 9 && d.budgets.length >= 8,
    "Profil development / budget tidak lengkap.",
  );
  for (const projectId of [
    DEMO_IDS.projects.menteng,
    DEMO_IDS.projects.sudirman,
    DEMO_IDS.projects.brawijaya,
    DEMO_IDS.projects.senopati,
    DEMO_IDS.projects.bsd,
    DEMO_IDS.projects.kemang,
    DEMO_IDS.projects.cipete,
  ]) {
    const rap = d.raps.find((r) => r.projectId === projectId && r.revision === 1);
    check(
      Boolean(rap) &&
        d.rapItems.filter((r) => r.projectRapId === rap?.id).length >= 18 &&
        d.packages.filter((r) => r.projectId === projectId).length >= 6,
      `Rincian RAP/paket proyek ${projectId} belum lengkap.`,
    );
  }
  for (const projectId of [DEMO_IDS.projects.bsd, DEMO_IDS.projects.senopati]) {
    check(
      d.bills.some((r) => r.projectId === projectId && r.status === "PAID") &&
        d.expenses.filter((r) => r.projectId === projectId).length >= 8 &&
        d.invoices.some((r) => r.projectId === projectId && r.status === "PAID"),
      `Histori proyek selesai ${projectId} belum lengkap.`,
    );
  }
  for (const userId of Object.values(DEMO_IDS.users))
    check(
      d.notifications.filter((r) => r.userId === userId).length >= 2,
      `Notifikasi role ${userId} belum lengkap.`,
    );
  check(
    d.notifications.every(
      (r) =>
        normalizeNotificationReferenceType(r.referenceType) !== null &&
        safeNotificationUrl(r.actionUrl) !== null &&
        (!r.read || Boolean(r.readAt)),
    ),
    "Notifikasi memiliki tujuan/reference/read timestamp yang tidak valid.",
  );
  check(
    d.library.length >= 20 &&
      d.receipts.some((r) => r.status === "DRAFT") &&
      d.counts.some((r) => r.status === "DRAFT"),
    "Library atau draft stok belum lengkap.",
  );
  check(
    d.conversations.length >= 3 &&
      d.conversations.every((c) => d.messages.some((m) => m.conversationId === c.id)),
    "Histori percakapan development belum lengkap.",
  );
  if (errors.length)
    throw new Error(`Development seed verification failed:\n- ${errors.join("\n- ")}`);
  return {
    projects: d.projects.length,
    budgets: d.budgets.length,
    rapDocuments: d.raps.length,
    rapItems: d.rapItems.length,
    workPackages: d.packages.length,
    rabDocuments: d.rabs.length,
    rabBundles: d.bundles.length,
    rabItems: d.rabItems.length,
    libraryItems: d.library.length,
    vendorBills: d.bills.length,
    expenses: d.expenses.length,
    cashTransactions: d.cash.length,
    stockMovements: d.movements.length,
    notifications: d.notifications.length,
    aiConversations: d.conversations.length,
  };
}
