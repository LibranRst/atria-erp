import { validateStockMovementLinksTx } from "@backend/lib/material/stock-movement-links";
import { recordNotificationEvent } from "@backend/server/services/notification-events";
import crypto from "crypto";
import { eq } from "drizzle-orm";

import { projectBudgetCategory, projectCost } from "@backend/db/schema";
import {
  assertCategoryPlanItemLinkAllowed,
  assertMaterialLinksAllowed,
  createCanonicalExpenseForProjectCost,
  resolveBudgetCategoryForExpense,
  syncProjectBudgetCategory,
} from "@backend/lib/budget/budget-sync";
import {
  applyExpenseStockHandling,
  type FieldRequestTx,
  type StockHandling,
} from "./field-request-stock";
import { decideExpenseApproval } from "@atria/core/finance/expense-approval-rule";
import { createProjectCostApprovalTx } from "./field-request-utils";

export type FieldRequestSubmissionItem = {
  readonly projectBudgetCategoryId: string;
  readonly materialId?: string | null;
  readonly projectRapItemId?: string | null;
  readonly projectCategoryPlanItemId?: string | null;
  readonly inventoryLocationId?: string | null;
  readonly stockHandling: StockHandling;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly amount: number;
  readonly description: string;
};

export async function createSubmittedFieldRequestTx(
  tx: FieldRequestTx,
  args: {
    readonly projectId: string;
    readonly requestedById: string;
    readonly receiptImageUrl?: string | null;
    readonly receiptGroupId?: string | null;
    readonly item: FieldRequestSubmissionItem;
    readonly includeApprovalCategoryLabel?: boolean;
    /** Ambang persetujuan Owner dalam rupiah, dibaca pemanggil dari konfigurasi. */
    readonly ownerApprovalThreshold: number;
  },
): Promise<typeof projectCost.$inferSelect> {
  const budgetContext = await resolveBudgetCategoryForExpense({
    tx,
    projectId: args.projectId,
    projectBudgetCategoryId: args.item.projectBudgetCategoryId,
  });
  assertMaterialLinksAllowed({
    categoryCode: budgetContext.categoryCode,
    materialId: args.item.materialId,
    projectRapItemId: args.item.projectRapItemId,
  });
  await validateStockMovementLinksTx(tx, {
    projectId: args.projectId,
    materialId: args.item.materialId,
    projectRapItemId: args.item.projectRapItemId,
  });
  await assertCategoryPlanItemLinkAllowed({
    tx,
    projectId: args.projectId,
    projectBudgetCategoryId: budgetContext.projectBudgetCategoryId,
    categoryCode: budgetContext.categoryCode,
    projectCategoryPlanItemId: args.item.projectCategoryPlanItemId,
  });
  if (budgetContext.categoryCode !== "MATERIAL" && args.item.stockHandling !== "EXPENSE_ONLY") {
    throw new Error("STOCK_HANDLING_ONLY_ALLOWED_FOR_MATERIAL_CATEGORY");
  }

  const budgetCategory = await tx.query.projectBudgetCategory.findFirst({
    where: eq(projectBudgetCategory.id, budgetContext.projectBudgetCategoryId),
    with: {
      expenseCategory: true,
    },
  });

  if (!budgetCategory) {
    throw new Error("PROJECT_BUDGET_CATEGORY_NOT_FOUND");
  }

  // Pengajuan ini belum masuk `pendingAmount`, jadi seluruh nilai pending yang
  // ada memang milik pengajuan lain.
  const { isOverrun, requiresOwnerApproval: requiresApproval } = decideExpenseApproval({
    amount: args.item.amount,
    allocatedAmount: Number(budgetCategory.allocatedAmount),
    actualAmount: Number(budgetCategory.actualAmount),
    otherPendingAmount: Number(budgetCategory.pendingAmount),
    ownerApprovalThreshold: args.ownerApprovalThreshold,
  });
  const projectCostId = crypto.randomUUID();

  if (requiresApproval) {
    await createProjectCostApprovalTx(tx, {
      projectCostId,
      isOverrun,
      label: args.includeApprovalCategoryLabel ? budgetCategory.expenseCategory.name : undefined,
    });
  }

  const [cost] = await tx
    .insert(projectCost)
    .values({
      id: projectCostId,
      projectId: args.projectId,
      projectBudgetCategoryId: budgetContext.projectBudgetCategoryId,
      projectBudgetItemId: null,
      materialId: args.item.materialId ?? null,
      projectRapItemId: args.item.projectRapItemId ?? null,
      requestedById: args.requestedById,
      ...(args.receiptGroupId ? { receiptGroupId: args.receiptGroupId } : {}),
      quantity: args.item.quantity.toString(),
      unitPrice: args.item.unitPrice.toString(),
      amount: args.item.amount.toFixed(2),
      description: args.item.description,
      receiptImageUrl: args.receiptImageUrl || null,
      status: "SUBMITTED",
      requiresOwnerApproval: requiresApproval,
      budgetOverrun: isOverrun,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const stockMovementId = await applyExpenseStockHandling({
    tx,
    stockHandling: args.item.stockHandling,
    materialId: args.item.materialId,
    inventoryLocationId: args.item.inventoryLocationId,
    projectId: args.projectId,
    projectRapItemId: args.item.projectRapItemId,
    projectCostId,
    quantity: args.item.quantity,
    unitPrice: args.item.unitPrice,
    description: args.item.description,
    userId: args.requestedById,
  });

  await createCanonicalExpenseForProjectCost({
    tx,
    projectCostId,
    projectId: args.projectId,
    projectBudgetCategoryId: budgetContext.projectBudgetCategoryId,
    projectBudgetId: budgetContext.projectBudgetId,
    expenseCategoryId: budgetContext.expenseCategoryId,
    requestedById: args.requestedById,
    description: args.item.description,
    quantity: args.item.quantity,
    unitCost: args.item.unitPrice,
    amount: args.item.amount,
    receiptImageUrl: args.receiptImageUrl,
    status: "SUBMITTED",
    materialId: args.item.materialId,
    projectRapItemId: args.item.projectRapItemId,
    projectCategoryPlanItemId: args.item.projectCategoryPlanItemId,
    stockMovementId,
  });

  await syncProjectBudgetCategory({
    tx,
    projectBudgetCategoryId: budgetContext.projectBudgetCategoryId,
  });

  await recordNotificationEvent(tx, {
    referenceType: "project_cost",
    referenceId: cost.id,
    projectId: cost.projectId,
    stage: "SUBMITTED",
    title: "Biaya menunggu verifikasi",
    message: cost.description,
    permission: "verify:cost",
    actionRequired: true,
    actionUrl: "/expenses?filter=NEEDS_VERIFICATION",
    actorId: args.requestedById,
  });
  return cost;
}
