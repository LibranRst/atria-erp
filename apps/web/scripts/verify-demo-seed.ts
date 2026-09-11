import { db, pool } from "@/db";
import {
  approval,
  bankAccount,
  bankStatementImport,
  bankStatementRow,
  cashTransaction,
  clientInvoice,
  clientPayment,
  materialInventory,
  notification,
  project,
  projectBudgetCategory,
  projectBudgets,
  projectCategoryPlanItem,
  projectChangeOrder,
  projectCost,
  projectExpenses,
  projectProfitabilitySnapshot,
  projectRap,
  projectRapItem,
  rabEstimate,
  rabEstimateBundle,
  rabEstimateItem,
  role,
  rolePermission,
  stockMovement,
  user,
  vendorBill,
  vendorPayment,
} from "@/db/schema";
import { calculateQuotationTotal } from "@atria/core/project/quotation-total";
import {
  normalizeNotificationReferenceType,
  safeNotificationUrl,
} from "@atria/core/notifications/types";
import { ROLE_PERMISSIONS } from "@atria/core/auth/permissions";
import { SYSTEM_ROLES } from "@atria/core/auth/role-constants";
import { DEMO_IDS, parseMoneyToMinor } from "@/db/seed/demo-contract";

type VerificationReport = {
  readonly accounts: number;
  readonly cashTransactions: number;
  readonly openReconciliationPairs: number;
  readonly projectsWithBudgets: number;
  readonly rapDocuments: number;
  readonly rabDocuments: number;
  readonly pendingApprovals: number;
  readonly notifications: number;
  readonly unreadNotifications: number;
  readonly inventoryRows: number;
};

function expectInvariant(errors: string[], condition: boolean, message: string): void {
  if (!condition) errors.push(message);
}

export async function verifyDemoSeed(): Promise<VerificationReport> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL wajib tersedia.");
  const [
    users,
    accounts,
    cashRows,
    statementImports,
    statementRows,
    invoices,
    clientPayments,
    bills,
    vendorPayments,
    costs,
    expenses,
    budgets,
    categories,
    inventories,
    movements,
    approvals,
    snapshots,
    projects,
    rabs,
    rapDocuments,
    rapItems,
    categoryPlanItems,
    rabItems,
    rabBundles,
    changeOrders,
    notifications,
    roles,
    rolePermissions,
  ] = await Promise.all([
    db.select().from(user),
    db.select().from(bankAccount),
    db.select().from(cashTransaction),
    db.select().from(bankStatementImport),
    db.select().from(bankStatementRow),
    db.select().from(clientInvoice),
    db.select().from(clientPayment),
    db.select().from(vendorBill),
    db.select().from(vendorPayment),
    db.select().from(projectCost),
    db.select().from(projectExpenses),
    db.select().from(projectBudgets),
    db.select().from(projectBudgetCategory),
    db.select().from(materialInventory),
    db.select().from(stockMovement),
    db.select().from(approval),
    db.select().from(projectProfitabilitySnapshot),
    db.select().from(project),
    db.select().from(rabEstimate),
    db.select().from(projectRap),
    db.select().from(projectRapItem),
    db.select().from(projectCategoryPlanItem),
    db.select().from(rabEstimateItem),
    db.select().from(rabEstimateBundle),
    db.select().from(projectChangeOrder),
    db.select().from(notification),
    db.select().from(role),
    db.select().from(rolePermission),
  ]);
  const errors: string[] = [];

  expectInvariant(
    errors,
    users.some((row) => row.id === DEMO_IDS.users.owner) &&
      users.some((row) => row.id === DEMO_IDS.users.finance) &&
      users.some((row) => row.id === DEMO_IDS.users.purchasing),
    "Akun role inti demo tidak lengkap.",
  );

  expectInvariant(
    errors,
    SYSTEM_ROLES.every((sr) => roles.some((r) => r.id === sr.id && r.name === sr.name)),
    "Daftar role sistem demo tidak lengkap.",
  );

  for (const systemRole of SYSTEM_ROLES) {
    const expectedPerms = ROLE_PERMISSIONS[systemRole.name.toUpperCase()] ?? [];
    const actualPerms = rolePermissions
      .filter((rp) => rp.roleId === systemRole.id)
      .map((rp) => rp.permissionKey);
    expectInvariant(
      errors,
      actualPerms.length === expectedPerms.length &&
        expectedPerms.every((key) => actualPerms.includes(key)),
      `Izin default role ${systemRole.name} tidak lengkap di database (${actualPerms.length}/${expectedPerms.length}).`,
    );
  }

  for (const account of accounts) {
    const calculated = cashRows
      .filter((row) => row.bankAccountId === account.id)
      .reduce(
        (sum, row) =>
          sum +
          (row.type === "INFLOW" ? parseMoneyToMinor(row.amount) : -parseMoneyToMinor(row.amount)),
        0n,
      );
    expectInvariant(
      errors,
      calculated === parseMoneyToMinor(account.balance),
      `Saldo ${account.name} tidak sama dengan ledger.`,
    );
  }

  const importAccount = new Map(statementImports.map((row) => [row.id, row.bankAccountId]));
  for (const transaction of cashRows.filter((row) => !row.reconciled)) {
    const candidates = statementRows.filter(
      (row) =>
        !row.isReconciled &&
        importAccount.get(row.importId) === transaction.bankAccountId &&
        row.type === transaction.type &&
        parseMoneyToMinor(row.amount) === parseMoneyToMinor(transaction.amount),
    );
    expectInvariant(
      errors,
      candidates.length === 1,
      `Catatan Atria ${transaction.id} memiliki ${candidates.length} kandidat, bukan satu.`,
    );
  }
  for (const row of statementRows.filter((item) => !item.isReconciled)) {
    const candidates = cashRows.filter(
      (transaction) =>
        !transaction.reconciled &&
        transaction.bankAccountId === importAccount.get(row.importId) &&
        transaction.type === row.type &&
        parseMoneyToMinor(transaction.amount) === parseMoneyToMinor(row.amount),
    );
    expectInvariant(
      errors,
      candidates.length === 1,
      `Mutasi bank ${row.id} memiliki ${candidates.length} kandidat, bukan satu.`,
    );
  }
  for (const row of statementRows.filter((item) => item.isReconciled)) {
    const transaction = cashRows.find((item) => item.id === row.matchedCashTransactionId);
    expectInvariant(
      errors,
      transaction?.reconciled === true &&
        transaction.bankAccountId === importAccount.get(row.importId) &&
        transaction.type === row.type &&
        parseMoneyToMinor(transaction.amount) === parseMoneyToMinor(row.amount),
      `Riwayat rekonsiliasi ${row.id} tidak konsisten.`,
    );
  }

  for (const invoice of invoices) {
    const paid = clientPayments
      .filter((payment) => payment.clientInvoiceId === invoice.id)
      .reduce((sum, payment) => sum + parseMoneyToMinor(payment.amountPaid), 0n);
    const amount = parseMoneyToMinor(invoice.amount);
    const expected = paid === 0n ? "UNPAID" : paid === amount ? "PAID" : "PARTIALLY_PAID";
    expectInvariant(
      errors,
      paid <= amount && invoice.status === expected,
      `Invoice ${invoice.invoiceNumber} tidak sesuai agregasi payment.`,
    );
  }
  for (const bill of bills) {
    const payments = vendorPayments.filter((payment) => payment.vendorBillId === bill.id);
    const completed = payments
      .filter((payment) => payment.status === "COMPLETED")
      .reduce((sum, payment) => sum + parseMoneyToMinor(payment.amountPaid), 0n);
    const committed = payments
      .filter((payment) => payment.status === "PENDING" || payment.status === "COMPLETED")
      .reduce((sum, payment) => sum + parseMoneyToMinor(payment.amountPaid), 0n);
    const amount = parseMoneyToMinor(bill.amount);
    const expected = completed === 0n ? "UNPAID" : completed === amount ? "PAID" : "PARTIALLY_PAID";
    expectInvariant(
      errors,
      committed <= amount && bill.status === expected,
      `Vendor bill ${bill.billNumber} tidak sesuai agregasi payment.`,
    );
  }

  for (const expense of expenses.filter((row) => row.legacyProjectCostId)) {
    const legacy = costs.find((row) => row.id === expense.legacyProjectCostId);
    expectInvariant(
      errors,
      legacy !== undefined &&
        legacy.projectId === expense.projectId &&
        legacy.projectBudgetCategoryId === expense.projectBudgetCategoryId &&
        legacy.status === expense.status &&
        parseMoneyToMinor(legacy.amount) === parseMoneyToMinor(expense.amount) &&
        parseMoneyToMinor(legacy.unitPrice) === parseMoneyToMinor(expense.unitCost),
      `Canonical expense ${expense.id} drift dari project_cost.`,
    );
  }

  for (const inventory of inventories) {
    const calculated = movements
      .filter(
        (row) =>
          row.materialId === inventory.materialId &&
          row.inventoryLocationId === inventory.locationId,
      )
      .reduce((sum, row) => {
        if (row.movementDirection === "IN") return sum + parseMoneyToMinor(row.quantity);
        if (row.movementDirection === "OUT") return sum - parseMoneyToMinor(row.quantity);
        return sum;
      }, 0n);
    expectInvariant(
      errors,
      calculated === parseMoneyToMinor(inventory.currentStock),
      `Stock ${inventory.id} tidak sama dengan stock movement.`,
    );
  }

  const transferRows = cashRows.filter(
    (row) => row.referenceType === "bank_transfer" && row.referenceId === DEMO_IDS.internalTransfer,
  );
  expectInvariant(
    errors,
    transferRows.length === 2 &&
      transferRows.some((row) => row.type === "INFLOW") &&
      transferRows.some((row) => row.type === "OUTFLOW") &&
      parseMoneyToMinor(transferRows[0]?.amount ?? "0") ===
        parseMoneyToMinor(transferRows[1]?.amount ?? "-1"),
    "Transfer rekening demo tidak membentuk pasangan net-zero.",
  );
  expectInvariant(
    errors,
    !approvals.some((row) => row.referenceId === "34043404-3404-3404-3404-340434043401") &&
      approvals.some(
        (row) =>
          row.referenceId === "34043404-3404-3404-3404-340434043402" && row.status === "PENDING",
      ),
    "Skenario threshold approval vendor tidak akurat.",
  );

  const mentengBudget = budgets.find((row) => row.projectId === DEMO_IDS.projects.menteng);
  const mentengSnapshot = snapshots.find((row) => row.projectId === DEMO_IDS.projects.menteng);
  const categoryActual = categories
    .filter((row) => row.projectBudgetId === mentengBudget?.id)
    .reduce((sum, row) => sum + parseMoneyToMinor(row.actualAmount), 0n);
  expectInvariant(
    errors,
    mentengSnapshot !== undefined &&
      parseMoneyToMinor(mentengSnapshot.actualCost) === categoryActual,
    "Snapshot profitability Menteng tidak sama dengan kategori budget.",
  );

  const senopati = projects.find((row) => row.id === DEMO_IDS.projects.senopati);
  const senopatiInvoices = invoices.filter((row) => row.projectId === DEMO_IDS.projects.senopati);
  const senopatiInvoiceTotal = senopatiInvoices.reduce(
    (sum, row) => sum + parseMoneyToMinor(row.amount),
    0n,
  );
  expectInvariant(
    errors,
    senopati?.status === "ACTIVE" &&
      budgets.some(
        (row) => row.projectId === DEMO_IDS.projects.senopati && row.status === "APPROVED",
      ) &&
      rabs.filter(
        (row) => row.projectId === DEMO_IDS.projects.senopati && row.status === "APPROVED",
      ).length === 1 &&
      senopatiInvoices.every((row) => row.status === "PAID") &&
      senopatiInvoiceTotal === parseMoneyToMinor(senopati.totalContractValue) &&
      !bills.some((row) => row.projectId === DEMO_IDS.projects.senopati) &&
      !costs.some((row) => row.projectId === DEMO_IDS.projects.senopati) &&
      !expenses.some((row) => row.projectId === DEMO_IDS.projects.senopati) &&
      !movements.some((row) => row.projectId === DEMO_IDS.projects.senopati),
    "Senopati belum memenuhi baseline siap closing.",
  );

  const budgetByProject = new Map(budgets.map((row) => [row.projectId, row]));
  const rapById = new Map(rapDocuments.map((row) => [row.id, row]));
  const planById = new Map(categoryPlanItems.map((row) => [row.id, row]));
  const rabById = new Map(rabs.map((row) => [row.id, row]));

  for (const item of rapItems) {
    expectInvariant(
      errors,
      rapById.has(item.projectRapId),
      `RAP item ${item.id} tidak memiliki dokumen RAP induk.`,
    );
  }
  for (const item of rabItems) {
    const estimate = rabById.get(item.rabEstimateId);
    const sourceRapItem = item.sourceProjectRapItemId
      ? rapItems.find((row) => row.id === item.sourceProjectRapItemId)
      : null;
    const sourceRap = sourceRapItem ? rapById.get(sourceRapItem.projectRapId) : null;
    const sourcePlan = item.sourceProjectCategoryPlanItemId
      ? planById.get(item.sourceProjectCategoryPlanItemId)
      : null;
    expectInvariant(
      errors,
      estimate !== undefined &&
        (!item.sourceProjectRapItemId || sourceRap?.projectId === estimate.projectId) &&
        (!item.sourceProjectCategoryPlanItemId || sourcePlan?.projectId === estimate.projectId),
      `RAB item ${item.id} memakai sumber dari project lain.`,
    );
  }

  const pakubuwonoBudget = budgetByProject.get(DEMO_IDS.projects.pakubuwono);
  expectInvariant(
    errors,
    projects.some((row) => row.id === DEMO_IDS.projects.pakubuwono && row.status === "DRAFT") &&
      pakubuwonoBudget?.status === "PENDING_APPROVAL" &&
      !rapDocuments.some((row) => row.projectId === DEMO_IDS.projects.pakubuwono) &&
      !rabs.some((row) => row.projectId === DEMO_IDS.projects.pakubuwono),
    "Skenario Pakubuwono untuk approval Project Budget tidak lengkap.",
  );

  const cipeteRap = rapDocuments.find((row) => row.projectId === DEMO_IDS.projects.cipete);
  const cipetePlans = categoryPlanItems.filter((row) => row.projectId === DEMO_IDS.projects.cipete);
  expectInvariant(
    errors,
    budgetByProject.get(DEMO_IDS.projects.cipete)?.status === "APPROVED" &&
      cipeteRap?.status === "DRAFT" &&
      cipeteRap.setupStage === "REVIEW" &&
      rapItems.filter((row) => row.projectRapId === cipeteRap.id).length >= 3 &&
      cipetePlans.some(
        (row) =>
          row.expenseCategoryId === "31313131-3131-3131-3131-313131313101" &&
          row.status === "ACTIVE",
      ) &&
      cipetePlans.some(
        (row) =>
          row.expenseCategoryId === "31313131-3131-3131-3131-313131313105" &&
          row.status === "ACTIVE",
      ) &&
      !rabs.some((row) => row.projectId === DEMO_IDS.projects.cipete),
    "Skenario Cipete untuk final review RAP tidak lengkap.",
  );

  const brawijayaRap = rapDocuments.find((row) => row.projectId === DEMO_IDS.projects.brawijaya);
  const brawijayaRab = rabs.find(
    (row) => row.projectId === DEMO_IDS.projects.brawijaya && row.status === "DRAFT",
  );
  const brawijayaRabItems = rabItems.filter((row) => row.rabEstimateId === brawijayaRab?.id);
  const brawijayaBundles = rabBundles.filter((row) => row.rabEstimateId === brawijayaRab?.id);
  expectInvariant(
    errors,
    budgetByProject.get(DEMO_IDS.projects.brawijaya)?.status === "APPROVED" &&
      brawijayaRap?.status === "LOCKED" &&
      brawijayaRap.setupStage === "COMPLETE" &&
      brawijayaRab !== undefined &&
      new Set(brawijayaRabItems.map((row) => row.sourceType)).size === 3 &&
      brawijayaRabItems.some((row) => row.isHidden) &&
      brawijayaBundles.length === 1 &&
      calculateQuotationTotal(brawijayaRabItems, brawijayaBundles) === 950000000,
    "Skenario Brawijaya untuk RAB draft campuran tidak lengkap atau nilainya berubah.",
  );

  const sudirmanRabs = rabs.filter((row) => row.projectId === DEMO_IDS.projects.sudirman);
  const sudirmanOrder = changeOrders.find((row) => row.projectId === DEMO_IDS.projects.sudirman);
  const sudirmanRevisedItems = rabItems.filter(
    (row) => row.rabEstimateId === sudirmanOrder?.revisedRabEstimateId,
  );
  expectInvariant(
    errors,
    sudirmanRabs.some((row) => row.status === "APPROVED" && row.revision === 1) &&
      sudirmanRabs.some((row) => row.status === "DRAFT" && row.revision === 2) &&
      sudirmanOrder?.status === "PENDING_APPROVAL" &&
      Boolean(sudirmanOrder.clientConfirmedAt && sudirmanOrder.clientConfirmationReference) &&
      calculateQuotationTotal(sudirmanRevisedItems) ===
        Number(sudirmanOrder.revisedContractValue) &&
      Number(sudirmanOrder.revisedContractValue) - Number(sudirmanOrder.previousContractValue) ===
        Number(sudirmanOrder.valueDelta),
    "Skenario Sudirman untuk Change Order R2 tidak konsisten.",
  );

  const mentengVoid = rabs.find(
    (row) =>
      row.projectId === DEMO_IDS.projects.menteng && row.status === "VOID" && row.revision === 2,
  );
  expectInvariant(
    errors,
    Boolean(mentengVoid?.voidReason && mentengVoid.voidedAt && mentengVoid.voidedById) &&
      changeOrders.some(
        (row) => row.revisedRabEstimateId === mentengVoid?.id && row.status === "CANCELLED",
      ),
    "Histori pembatalan revisi RAB Menteng tidak lengkap.",
  );

  expectInvariant(
    errors,
    ["f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f009", "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f010"].every(
      (referenceId) =>
        costs.some((row) => row.id === referenceId && row.status === "VERIFIED") &&
        approvals.some((row) => row.referenceId === referenceId && row.status === "PENDING"),
    ),
    "Antrean approval baseline Cipete tidak lengkap.",
  );

  const notificationKeys = notifications.map((row) => row.eventKey);
  expectInvariant(
    errors,
    notifications.length >= 12 &&
      notificationKeys.every(Boolean) &&
      new Set(notificationKeys).size === notificationKeys.length &&
      notifications.every(
        (row) =>
          (!row.read || Boolean(row.readAt)) &&
          normalizeNotificationReferenceType(row.referenceType) !== null &&
          safeNotificationUrl(row.actionUrl) !== null,
      ) &&
      notifications
        .filter((row) => row.category === "ACTION_REQUIRED" && !row.isResolved)
        .every(
          (row) =>
            Boolean(row.referenceType && row.referenceId) &&
            row.eventKey?.startsWith(`${row.referenceType}:${row.referenceId}:lifecycle:`),
        ),
    "Notifikasi demo tidak mempunyai identity, read timestamp, reference type, atau tujuan aman yang lengkap.",
  );

  if (errors.length > 0) {
    throw new Error(`Demo seed verification failed:\n- ${errors.join("\n- ")}`);
  }
  return {
    accounts: accounts.length,
    cashTransactions: cashRows.length,
    openReconciliationPairs: cashRows.filter((row) => !row.reconciled).length,
    projectsWithBudgets: budgets.length,
    rapDocuments: rapDocuments.length,
    rabDocuments: rabs.length,
    pendingApprovals: approvals.filter((row) => row.status === "PENDING").length,
    notifications: notifications.length,
    unreadNotifications: notifications.filter((row) => !row.read).length,
    inventoryRows: inventories.length,
  };
}

if (import.meta.main) {
  verifyDemoSeed()
    .then((report) => {
      console.log("Connected demo seed verification passed.");
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}
