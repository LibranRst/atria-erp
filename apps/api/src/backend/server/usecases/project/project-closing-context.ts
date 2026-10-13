import { createHash } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import {
  project,
  projectBudgets,
  cashTransaction,
  clientInvoice,
  clientPayment,
  vendorBill,
  vendorPayment,
  projectCost,
  projectExpenses,
  rabEstimate,
  projectChangeOrder,
  stockMovement,
} from "@backend/db/schema";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import { calculateOutstandingProjectReservations } from "@backend/app/actions/material/inventory-utils";
import { readBudgetCategoryUsageTx } from "@backend/lib/budget/budget-sync";
export type ProjectClosingChecklist = {
  readonly projectId: string;
  readonly canComplete: boolean;
  readonly blockers: readonly string[];
  readonly contractValue: number;
  readonly invoicedValue: number;
  readonly clientReceipts: number;
  readonly actualCost: number;
  readonly cashOutflow: number;
  readonly realizedMargin: number;
  readonly realizedMarginPercentage: number;
  readonly cashPosition: number;
  readonly unresolvedReconciliationCount: number;
  readonly documentedReconciliationExceptionCount: number;
};

export async function readProjectClosingTx(
  tx: FinanceTransaction,
  projectId: string,
): Promise<{ checklist: ProjectClosingChecklist; fingerprint: string }> {
  await tx
    .select({ id: clientInvoice.id })
    .from(clientInvoice)
    .where(eq(clientInvoice.projectId, projectId))
    .orderBy(asc(clientInvoice.id))
    .for("update");
  await tx
    .select({ id: vendorBill.id })
    .from(vendorBill)
    .where(eq(vendorBill.projectId, projectId))
    .orderBy(asc(vendorBill.id))
    .for("update");
  await tx
    .select({ id: projectCost.id })
    .from(projectCost)
    .where(eq(projectCost.projectId, projectId))
    .orderBy(asc(projectCost.id))
    .for("update");
  await tx
    .select({ id: projectExpenses.id })
    .from(projectExpenses)
    .where(eq(projectExpenses.projectId, projectId))
    .orderBy(asc(projectExpenses.id))
    .for("update");
  await tx
    .select({ id: rabEstimate.id })
    .from(rabEstimate)
    .where(eq(rabEstimate.projectId, projectId))
    .orderBy(asc(rabEstimate.id))
    .for("update");
  await tx
    .select({ id: projectChangeOrder.id })
    .from(projectChangeOrder)
    .where(eq(projectChangeOrder.projectId, projectId))
    .orderBy(asc(projectChangeOrder.id))
    .for("update");
  await tx
    .select({ id: stockMovement.id })
    .from(stockMovement)
    .where(eq(stockMovement.projectId, projectId))
    .orderBy(asc(stockMovement.id))
    .for("update");
  const proj = await tx.query.project.findFirst({ where: eq(project.id, projectId) });
  if (!proj) throw new Error("PROJECT_NOT_FOUND");
  const invoices = await tx.query.clientInvoice.findMany({
    where: (table, { eq: equals }) => equals(table.projectId, projectId),
    with: { payments: true },
  });
  const bills = await tx.query.vendorBill.findMany({
    where: (table, { eq: equals }) => equals(table.projectId, projectId),
    with: { payments: true },
  });
  const costs = await tx.query.projectCost.findMany({
    where: (table, { eq: equals }) => equals(table.projectId, projectId),
  });
  const expenses = await tx.query.projectExpenses.findMany({
    where: (table, { eq: equals }) => equals(table.projectId, projectId),
  });
  const rabs = await tx.query.rabEstimate.findMany({
    where: (table, { eq: equals }) => equals(table.projectId, projectId),
  });
  const changeOrders = await tx.query.projectChangeOrder.findMany({
    where: (table, { eq: equals }) => equals(table.projectId, projectId),
  });
  const movements = await tx.query.stockMovement.findMany({
    where: (table, { eq: equals }) => equals(table.projectId, projectId),
    orderBy: (table) => [asc(table.createdAt), asc(table.id)],
  });
  const budget = await tx.query.projectBudgets.findFirst({
    where: eq(projectBudgets.projectId, projectId),
    with: { categories: true },
  });
  const projectCashTransactionIds = [
    ...invoices.flatMap((invoice) => invoice.payments.map((payment) => payment.cashTransactionId)),
    ...bills.flatMap((bill) =>
      bill.payments.flatMap((payment) =>
        payment.cashTransactionId ? [payment.cashTransactionId] : [],
      ),
    ),
    ...costs.flatMap((cost) => (cost.cashTransactionId ? [cost.cashTransactionId] : [])),
  ];
  const projectCashTransactions = projectCashTransactionIds.length
    ? await tx
        .select()
        .from(cashTransaction)
        .where(inArray(cashTransaction.id, [...new Set(projectCashTransactionIds)]))
        .orderBy(asc(cashTransaction.id))
        .for("update")
    : [];
  if (invoices.length)
    await tx
      .select({ id: clientPayment.id })
      .from(clientPayment)
      .where(
        inArray(
          clientPayment.clientInvoiceId,
          invoices.map((i) => i.id),
        ),
      )
      .orderBy(asc(clientPayment.id))
      .for("update");
  if (bills.length)
    await tx
      .select({ id: vendorPayment.id })
      .from(vendorPayment)
      .where(
        inArray(
          vendorPayment.vendorBillId,
          bills.map((b) => b.id),
        ),
      )
      .orderBy(asc(vendorPayment.id))
      .for("update");
  const blockers: string[] = [];
  if (proj.status !== "ACTIVE" && proj.status !== "ON_HOLD")
    blockers.push("Hanya proyek aktif atau ditunda yang dapat ditutup.");
  const contractValue = Number(proj.totalContractValue);
  const liveInvoices = invoices.filter((invoice) => invoice.status !== "VOID");
  const invoicedValue = liveInvoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
  const clientReceipts = liveInvoices.reduce(
    (sum, invoice) =>
      sum + invoice.payments.reduce((paid, payment) => paid + Number(payment.amountPaid), 0),
    0,
  );
  if (Math.abs(invoicedValue - contractValue) > 0.01)
    blockers.push("Total invoice client belum sama dengan nilai kontrak.");
  if (liveInvoices.some((invoice) => invoice.status !== "PAID"))
    blockers.push("Masih ada invoice client yang belum lunas atau belum di-void.");
  if (bills.some((bill) => bill.status !== "PAID" && bill.status !== "VOID"))
    blockers.push("Masih ada vendor bill outstanding.");
  if (
    bills.some((bill) =>
      bill.payments.some(
        (payment) => payment.status !== "COMPLETED" && payment.status !== "FAILED",
      ),
    )
  )
    blockers.push("Masih ada vendor payment yang belum final.");
  if (costs.some((cost) => !["PAID", "REJECTED"].includes(cost.status)))
    blockers.push("Masih ada expense request yang belum final.");
  if (expenses.some((expense) => ["SUBMITTED", "VERIFIED"].includes(expense.status)))
    blockers.push("Masih ada pengeluaran yang menunggu peninjauan.");
  if (
    expenses.some(
      (expense) =>
        expense.isCashImpact && expense.paymentStatus !== "PAID" && expense.status !== "REJECTED",
    )
  )
    blockers.push("Masih ada cash expense yang belum dibayar.");
  if (rabs.some((rab) => rab.status === "DRAFT")) blockers.push("Masih ada RAB revision DRAFT.");
  if (rabs.filter((rab) => rab.status === "APPROVED").length !== 1)
    blockers.push("Proyek harus memiliki tepat satu current approved RAB.");
  if (changeOrders.some((order) => !["APPROVED", "REJECTED", "CANCELLED"].includes(order.status)))
    blockers.push("Masih ada Change Order terbuka.");
  if (calculateOutstandingProjectReservations(movements) > 0.01) {
    blockers.push("Reservasi stock proyek belum diselesaikan.");
  }
  if (!budget || budget.status !== "APPROVED")
    blockers.push("Budget proyek belum disetujui atau belum sinkron.");
  const unresolvedReconciliationCount = projectCashTransactions.filter(
    (transaction) => !transaction.reconciled && !transaction.reconciliationExceptionAt,
  ).length;
  const documentedReconciliationExceptionCount = projectCashTransactions.filter(
    (transaction) => !transaction.reconciled && transaction.reconciliationExceptionAt,
  ).length;
  if (unresolvedReconciliationCount > 0) {
    blockers.push(
      `${unresolvedReconciliationCount} transaksi kas proyek belum cocok dengan mutasi bank atau belum memiliki pengecualian tercatat.`,
    );
  }

  const usage: Awaited<ReturnType<typeof readBudgetCategoryUsageTx>>[] = [];
  for (const category of budget?.categories ?? [])
    usage.push(await readBudgetCategoryUsageTx(tx, category.id));
  const actualCost = usage.reduce((sum, category) => sum + category.actualAmount, 0);
  const cashOutflow = usage.reduce((sum, category) => sum + category.paidAmount, 0);
  const realizedMargin = contractValue - actualCost;
  const checklist: ProjectClosingChecklist = {
    projectId,
    canComplete: blockers.length === 0,
    blockers,
    contractValue,
    invoicedValue,
    clientReceipts,
    actualCost,
    cashOutflow,
    realizedMargin,
    realizedMarginPercentage: contractValue > 0 ? (realizedMargin / contractValue) * 100 : 0,
    cashPosition: clientReceipts - cashOutflow,
    unresolvedReconciliationCount,
    documentedReconciliationExceptionCount,
  };
  return {
    checklist,
    fingerprint: createHash("sha256")
      .update(
        JSON.stringify({
          proj,
          invoices,
          bills,
          costs,
          expenses,
          rabs,
          changeOrders,
          movements,
          budget,
          projectCashTransactions,
          usage,
        }),
      )
      .digest("hex"),
  };
}
