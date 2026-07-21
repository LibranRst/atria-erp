"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLog,
  project,
  projectBudgetCategory,
  projectBudgets,
  projectProfitabilitySnapshot,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { assertProjectAccess } from "@/lib/auth/scoping";
import { syncProjectBudgetCategory } from "@/lib/budget/budget-sync";
import { calculateOutstandingProjectReservations } from "@/app/actions/material/inventory-utils";
import type { ActionResponse } from "@/lib/types/action-response";
import { completeProjectSchema } from "@/lib/validations/workflow-governance";

type SessionUser = { readonly id: string; readonly roleId?: string };
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
};

async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: { cookie: (await cookies()).toString() } });
  return session?.user ? (session.user as SessionUser) : null;
}

async function assertClosingAccess(user: SessionUser, projectId: string): Promise<void> {
  await assertPermission(user, "update:budget");
  await assertPermission(user, "view:profitability");
  const roleName = await resolveRoleName(user.roleId ?? "");
  if (roleName !== "OWNER" && roleName !== "FINANCE_ADMIN")
    throw new Error("FORBIDDEN: Project closing hanya untuk Owner/Finance.");
  await assertProjectAccess(projectId, user.id, roleName);
}

async function buildClosingChecklist(projectId: string): Promise<ProjectClosingChecklist> {
  const proj = await db.query.project.findFirst({ where: eq(project.id, projectId) });
  if (!proj) throw new Error("PROJECT_NOT_FOUND");
  const invoices = await db.query.clientInvoice.findMany({
    where: (table, { eq: equals }) => equals(table.projectId, projectId),
    with: { payments: true },
  });
  const bills = await db.query.vendorBill.findMany({
    where: (table, { eq: equals }) => equals(table.projectId, projectId),
    with: { payments: true },
  });
  const costs = await db.query.projectCost.findMany({
    where: (table, { eq: equals }) => equals(table.projectId, projectId),
  });
  const expenses = await db.query.projectExpenses.findMany({
    where: (table, { eq: equals }) => equals(table.projectId, projectId),
  });
  const rabs = await db.query.rabEstimate.findMany({
    where: (table, { eq: equals }) => equals(table.projectId, projectId),
  });
  const changeOrders = await db.query.projectChangeOrder.findMany({
    where: (table, { eq: equals }) => equals(table.projectId, projectId),
  });
  const movements = await db.query.stockMovement.findMany({
    where: (table, { eq: equals }) => equals(table.projectId, projectId),
    orderBy: (table) => [asc(table.createdAt), asc(table.id)],
  });
  const budget = await db.query.projectBudgets.findFirst({
    where: eq(projectBudgets.projectId, projectId),
    with: { categories: true },
  });
  const blockers: string[] = [];
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
    blockers.push("Masih ada canonical expense pending review.");
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
    blockers.push("Canonical project budget belum approved/sinkron.");

  const actualCost =
    budget?.categories.reduce((sum, category) => sum + Number(category.actualAmount), 0) ?? 0;
  const cashOutflow =
    budget?.categories.reduce((sum, category) => sum + Number(category.paidAmount), 0) ?? 0;
  const realizedMargin = contractValue - actualCost;
  return {
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
  };
}

export async function getProjectClosingChecklist(
  projectId: string,
): Promise<ActionResponse<ProjectClosingChecklist>> {
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertClosingAccess(user, projectId);
    return { success: true, data: await buildClosingChecklist(projectId) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membaca closing checklist.";
    return {
      success: false,
      error: {
        code: message.includes("FORBIDDEN") ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR",
        message,
      },
    };
  }
}

export async function completeProject(
  input: unknown,
): Promise<ActionResponse<ProjectClosingChecklist>> {
  const validation = completeProjectSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Data closing tidak valid.",
      },
    };
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertClosingAccess(user, validation.data.projectId);
    const budget = await db.query.projectBudgets.findFirst({
      where: eq(projectBudgets.projectId, validation.data.projectId),
      with: { categories: true },
    });
    if (!budget) throw new Error("PROJECT_BUDGET_NOT_FOUND");
    await db.transaction(async (tx) => {
      for (const category of budget.categories)
        await syncProjectBudgetCategory({ tx, projectBudgetCategoryId: category.id });
    });
    const checklist = await buildClosingChecklist(validation.data.projectId);
    if (!checklist.canComplete) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Project belum dapat ditutup: ${checklist.blockers.join(" ")}`,
        },
      };
    }
    await db.transaction(async (tx) => {
      const categories = await tx.query.projectBudgetCategory.findMany({
        where: eq(projectBudgetCategory.projectBudgetId, budget.id),
        with: { expenseCategory: true },
      });
      const material = categories.find((category) => category.expenseCategory.code === "MATERIAL");
      await tx.insert(projectProfitabilitySnapshot).values({
        projectId: checklist.projectId,
        projectBudgetId: budget.id,
        contractValue: checklist.contractValue.toFixed(2),
        approvedRabValue: budget.approvedRabValue,
        internalBudget: budget.internalBudget,
        actualCost: checklist.actualCost.toFixed(2),
        remainingBudget: (Number(budget.internalBudget) - checklist.actualCost).toFixed(2),
        budgetUsedPercentage:
          Number(budget.internalBudget) > 0
            ? ((checklist.actualCost / Number(budget.internalBudget)) * 100).toFixed(4)
            : "0.0000",
        targetGrossAmount: budget.targetGrossAmount,
        targetGrossPercentage: budget.targetGrossPercentage,
        projectedFinalCost: checklist.actualCost.toFixed(2),
        projectedMarginAmount: checklist.realizedMargin.toFixed(2),
        projectedMarginPercentage: checklist.realizedMarginPercentage.toFixed(4),
        realizedMarginAmount: checklist.realizedMargin.toFixed(2),
        realizedMarginPercentage: checklist.realizedMarginPercentage.toFixed(4),
        cashPosition: checklist.cashPosition.toFixed(2),
        snapshotType: "FINAL",
        materialBudget: material?.allocatedAmount ?? "0.00",
        materialActual: material?.actualAmount ?? "0.00",
        materialRemaining: material?.remainingAmount ?? "0.00",
        materialUsedPercentage: material?.usedPercentage ?? "0.0000",
        riskStatus: checklist.realizedMargin >= 0 ? "SAFE" : "CRITICAL",
      });
      await tx
        .update(project)
        .set({ status: "COMPLETED", endDate: new Date(), updatedAt: new Date() })
        .where(eq(project.id, checklist.projectId));
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "COMPLETE_PROJECT",
        targetTable: "project",
        targetId: checklist.projectId,
        newState: JSON.stringify({ checklist, closingNote: validation.data.closingNote }),
      });
    });
    revalidatePath(`/projects/${checklist.projectId}`);
    return { success: true, data: checklist };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyelesaikan project closing.";
    return {
      success: false,
      error: { code: message.includes("FORBIDDEN") ? "FORBIDDEN" : "TRANSACTION_FAILED", message },
    };
  }
}
