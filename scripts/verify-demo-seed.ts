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
  project,
  projectBudgetCategory,
  projectBudgets,
  projectCost,
  projectExpenses,
  projectProfitabilitySnapshot,
  rabEstimate,
  stockMovement,
  user,
  vendorBill,
  vendorPayment,
} from "@/db/schema";
import { DEMO_IDS, parseMoneyToMinor } from "@/db/seed/demo-contract";

type VerificationReport = {
  readonly accounts: number;
  readonly cashTransactions: number;
  readonly openReconciliationPairs: number;
  readonly projectsWithBudgets: number;
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
  ]);
  const errors: string[] = [];

  expectInvariant(
    errors,
    users.some((row) => row.id === DEMO_IDS.users.owner) &&
      users.some((row) => row.id === DEMO_IDS.users.finance) &&
      users.some((row) => row.id === DEMO_IDS.users.purchasing),
    "Akun role inti demo tidak lengkap.",
  );

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

  if (errors.length > 0) {
    throw new Error(`Demo seed verification failed:\n- ${errors.join("\n- ")}`);
  }
  return {
    accounts: accounts.length,
    cashTransactions: cashRows.length,
    openReconciliationPairs: cashRows.filter((row) => !row.reconciled).length,
    projectsWithBudgets: budgets.length,
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
