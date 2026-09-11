import "server-only";

import { recordNotificationEvent } from "@/server/services/notification-events";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { auditLog, projectExpenses, vendorBill } from "@/db/schema";
import {
  assertCategoryPlanItemLinkAllowed,
  resolveBudgetCategoryForExpense,
  syncProjectBudgetCategory,
} from "@/lib/budget/budget-sync";

type FinanceTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type VendorBillWriteInput = {
  readonly vendorId: string;
  readonly projectId: string;
  readonly projectBudgetCategoryId: string;
  readonly projectCategoryPlanItemId?: string | null;
  readonly billNumber: string;
  readonly amount: number;
  readonly dueDate: Date;
  readonly notes?: string;
  readonly requestedById: string;
};

export async function createVendorBillTx(
  tx: FinanceTx,
  input: VendorBillWriteInput,
): Promise<typeof vendorBill.$inferSelect> {
  const existing = await tx.query.vendorBill.findFirst({
    where: eq(vendorBill.billNumber, input.billNumber),
  });
  if (existing) throw new Error("VENDOR_BILL_NUMBER_EXISTS");

  const budgetContext = await resolveBudgetCategoryForExpense({
    tx,
    projectId: input.projectId,
    projectBudgetCategoryId: input.projectBudgetCategoryId,
  });
  await assertCategoryPlanItemLinkAllowed({
    tx,
    projectId: input.projectId,
    projectBudgetCategoryId: budgetContext.projectBudgetCategoryId,
    categoryCode: budgetContext.categoryCode,
    projectCategoryPlanItemId: input.projectCategoryPlanItemId,
  });

  const [created] = await tx
    .insert(vendorBill)
    .values({
      vendorId: input.vendorId,
      projectId: input.projectId,
      projectBudgetCategoryId: budgetContext.projectBudgetCategoryId,
      projectBudgetItemId: null,
      projectCategoryPlanItemId: input.projectCategoryPlanItemId ?? null,
      billNumber: input.billNumber,
      amount: input.amount.toFixed(2),
      status: "UNPAID",
      dueDate: input.dueDate,
      notes: input.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  if (!created) throw new Error("VENDOR_BILL_CREATE_FAILED");

  await tx.insert(projectExpenses).values({
    projectId: input.projectId,
    projectBudgetId: budgetContext.projectBudgetId,
    projectBudgetCategoryId: budgetContext.projectBudgetCategoryId,
    expenseCategoryId: budgetContext.expenseCategoryId,
    vendorId: input.vendorId,
    vendorBillId: created.id,
    projectCategoryPlanItemId: input.projectCategoryPlanItemId ?? null,
    requestedById: input.requestedById,
    description: input.notes || `Tagihan vendor ${input.billNumber}`,
    quantity: "1.00",
    unitCost: input.amount.toFixed(2),
    amount: input.amount.toFixed(2),
    sourceType: budgetContext.categoryCode === "MATERIAL" ? "INVENTORY_PURCHASE" : "VENDOR_BILL",
    isCashImpact: true,
    paymentStatus: "UNPAID",
    status: budgetContext.categoryCode === "MATERIAL" ? "INVENTORY_ASSET" : "APPROVED",
  });

  await syncProjectBudgetCategory({
    tx,
    projectBudgetCategoryId: budgetContext.projectBudgetCategoryId,
  });
  await tx.insert(auditLog).values({
    userId: input.requestedById,
    action: "CREATE_VENDOR_BILL",
    targetTable: "vendor_bill",
    targetId: created.id,
    newState: JSON.stringify({
      projectId: input.projectId,
      vendorId: input.vendorId,
      amount: created.amount,
      billNumber: created.billNumber,
      status: created.status,
    }),
  });
  await recordNotificationEvent(tx, {
    referenceType: "vendor_bill",
    referenceId: created.id,
    projectId: created.projectId,
    stage: "CREATED",
    title: "Tagihan vendor siap dijadwalkan",
    message: created.billNumber,
    permission: "pay:vendor_bill",
    actionRequired: true,
    actionUrl: `/projects/${created.projectId}?tab=budget`,
    actorId: input.requestedById,
  });
  return created;
}
