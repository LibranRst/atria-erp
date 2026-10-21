import { budgetUsageSummary } from "@atria/core/budget/usage-summary";
import { eq, inArray } from "drizzle-orm";

import { db } from "@backend/db";
import {
  projectBudgetCategory,
  projectBudgetItem,
  projectBudgets,
  projectCategoryPlanItem,
  projectCost,
  projectExpenses,
  vendorPayment,
} from "@backend/db/schema";
import { type ExpenseCategoryCode } from "@atria/core/budget/excel-budget";

type BudgetTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CanonicalBudgetCategoryContext = {
  readonly projectBudgetId: string;
  readonly projectBudgetCategoryId: string;
  readonly expenseCategoryId: string;
  readonly categoryCode: ExpenseCategoryCode;
};

function toCategoryCode(value: string): ExpenseCategoryCode {
  switch (value) {
    case "MATERIAL":
    case "TUKANG":
    case "OPERASIONAL":
    case "LAIN_LAIN":
    case "SUBCON":
      return value;
    default:
      throw new Error(`UNKNOWN_EXPENSE_CATEGORY:${value}`);
  }
}

function mapLegacyCategoryToCanonicalCode(input: {
  readonly legacyCategoryName?: string | null;
  readonly budgetItemName?: string | null;
  readonly budgetCategory?: string | null;
}): ExpenseCategoryCode {
  const normalized = [input.legacyCategoryName, input.budgetCategory, input.budgetItemName]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toUpperCase();

  if (
    normalized.includes("MATERIAL") ||
    normalized.includes("BAHAN") ||
    normalized.includes("KAYU") ||
    normalized.includes("KACA")
  ) {
    return "MATERIAL";
  }
  if (
    normalized.includes("TUKANG") ||
    normalized.includes("LABOR") ||
    normalized.includes("PEKERJA")
  ) {
    return "TUKANG";
  }
  if (
    normalized.includes("OPERASIONAL") ||
    normalized.includes("OPERATIONAL") ||
    normalized.includes("BENSIN") ||
    normalized.includes("TOLL")
  ) {
    return "OPERASIONAL";
  }
  if (normalized.includes("SUBCON") || normalized.includes("SUBKON")) {
    return "SUBCON";
  }
  return "LAIN_LAIN";
}

export async function resolveBudgetCategoryForExpense(input: {
  readonly tx: BudgetTx;
  readonly projectId: string;
  readonly projectBudgetCategoryId?: string | null;
  readonly projectBudgetItemId?: string | null;
}): Promise<CanonicalBudgetCategoryContext> {
  const { tx, projectId, projectBudgetCategoryId, projectBudgetItemId } = input;

  if (projectBudgetCategoryId) {
    const category = await tx.query.projectBudgetCategory.findFirst({
      where: eq(projectBudgetCategory.id, projectBudgetCategoryId),
      with: {
        budget: true,
        expenseCategory: true,
      },
    });

    if (!category || category.budget.projectId !== projectId) {
      throw new Error("PROJECT_BUDGET_CATEGORY_NOT_FOUND");
    }

    return {
      projectBudgetId: category.projectBudgetId,
      projectBudgetCategoryId: category.id,
      expenseCategoryId: category.expenseCategoryId,
      categoryCode: toCategoryCode(category.expenseCategory.code),
    };
  }

  if (!projectBudgetItemId) {
    throw new Error("PROJECT_BUDGET_CATEGORY_REQUIRED");
  }

  const legacyItem = await tx.query.projectBudgetItem.findFirst({
    where: eq(projectBudgetItem.id, projectBudgetItemId),
    with: {
      budget: true,
      costCategory: true,
    },
  });

  if (!legacyItem || legacyItem.budget.projectId !== projectId) {
    throw new Error("BUDGET_ITEM_NOT_FOUND");
  }

  const canonicalBudget = await tx.query.projectBudgets.findFirst({
    where: eq(projectBudgets.projectId, projectId),
  });

  if (!canonicalBudget) {
    throw new Error("PROJECT_BUDGET_NOT_FOUND");
  }

  const categoryCode = mapLegacyCategoryToCanonicalCode({
    legacyCategoryName: legacyItem.costCategory?.name,
    budgetCategory: legacyItem.budgetCategory,
    budgetItemName: legacyItem.name,
  });

  const categories = await tx.query.projectBudgetCategory.findMany({
    where: eq(projectBudgetCategory.projectBudgetId, canonicalBudget.id),
    with: {
      expenseCategory: true,
    },
  });
  const matchedCategory = categories.find((item) => item.expenseCategory.code === categoryCode);

  if (!matchedCategory) {
    throw new Error("PROJECT_BUDGET_CATEGORY_NOT_FOUND");
  }

  return {
    projectBudgetId: canonicalBudget.id,
    projectBudgetCategoryId: matchedCategory.id,
    expenseCategoryId: matchedCategory.expenseCategoryId,
    categoryCode: toCategoryCode(matchedCategory.expenseCategory.code),
  };
}

export function assertMaterialLinksAllowed(input: {
  readonly categoryCode: ExpenseCategoryCode;
  readonly materialId?: string | null;
  readonly projectRapItemId?: string | null;
  readonly stockMovementId?: string | null;
}): void {
  const hasMaterialLink = Boolean(
    input.materialId || input.projectRapItemId || input.stockMovementId,
  );
  if (input.categoryCode !== "MATERIAL" && hasMaterialLink) {
    throw new Error("MATERIAL_LINKS_ONLY_ALLOWED_FOR_MATERIAL_CATEGORY");
  }
}

export async function assertCategoryPlanItemLinkAllowed(input: {
  readonly tx: BudgetTx;
  readonly projectId: string;
  readonly projectBudgetCategoryId: string;
  readonly categoryCode: ExpenseCategoryCode;
  readonly projectCategoryPlanItemId?: string | null;
}): Promise<void> {
  if (!input.projectCategoryPlanItemId) return;
  if (input.categoryCode !== "TUKANG" && input.categoryCode !== "SUBCON") {
    throw new Error("CATEGORY_PLAN_ONLY_ALLOWED_FOR_TUKANG_OR_SUBCON");
  }

  const planItem = await input.tx.query.projectCategoryPlanItem.findFirst({
    where: eq(projectCategoryPlanItem.id, input.projectCategoryPlanItemId),
    with: {
      expenseCategory: true,
    },
  });

  if (!planItem || planItem.projectId !== input.projectId) {
    throw new Error("CATEGORY_PLAN_ITEM_NOT_FOUND");
  }
  if (planItem.projectBudgetCategoryId !== input.projectBudgetCategoryId) {
    throw new Error("CATEGORY_PLAN_ITEM_CATEGORY_MISMATCH");
  }
  if (planItem.expenseCategory.code !== input.categoryCode) {
    throw new Error("CATEGORY_PLAN_ITEM_EXPENSE_CATEGORY_MISMATCH");
  }
}

export async function createCanonicalExpenseForProjectCost(input: {
  readonly tx: BudgetTx;
  readonly projectCostId: string;
  readonly projectId: string;
  readonly projectBudgetCategoryId: string;
  readonly projectBudgetId: string;
  readonly expenseCategoryId: string;
  readonly requestedById: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitCost: number;
  readonly amount: number;
  readonly receiptImageUrl?: string | null;
  readonly status: string;
  readonly materialId?: string | null;
  readonly projectRapItemId?: string | null;
  readonly projectCategoryPlanItemId?: string | null;
  readonly stockMovementId?: string | null;
}): Promise<void> {
  const existing = await input.tx.query.projectExpenses.findFirst({
    where: eq(projectExpenses.legacyProjectCostId, input.projectCostId),
  });

  if (existing) {
    await input.tx
      .update(projectExpenses)
      .set({
        status: input.status,
        paymentStatus: input.status === "PAID" ? "PAID" : "UNPAID",
        projectCategoryPlanItemId:
          input.projectCategoryPlanItemId ?? existing.projectCategoryPlanItemId,
        updatedAt: new Date(),
      })
      .where(eq(projectExpenses.id, existing.id));
    return;
  }

  await input.tx.insert(projectExpenses).values({
    projectId: input.projectId,
    projectBudgetId: input.projectBudgetId,
    projectBudgetCategoryId: input.projectBudgetCategoryId,
    expenseCategoryId: input.expenseCategoryId,
    legacyProjectCostId: input.projectCostId,
    materialId: input.materialId ?? null,
    projectRapItemId: input.projectRapItemId ?? null,
    projectCategoryPlanItemId: input.projectCategoryPlanItemId ?? null,
    stockMovementId: input.stockMovementId ?? null,
    requestedById: input.requestedById,
    description: input.description,
    quantity: input.quantity.toFixed(2),
    unitCost: input.unitCost.toFixed(2),
    amount: input.amount.toFixed(2),
    receiptImageUrl: input.receiptImageUrl ?? null,
    status: input.status,
    paymentStatus: input.status === "PAID" ? "PAID" : "UNPAID",
  });
}

export async function ensureCanonicalExpenseForProjectCost(input: {
  readonly tx: BudgetTx;
  readonly costId: string;
}): Promise<string> {
  const cost = await input.tx.query.projectCost.findFirst({
    where: eq(projectCost.id, input.costId),
  });

  if (!cost) {
    throw new Error("PROJECT_COST_NOT_FOUND");
  }

  const budgetContext = await resolveBudgetCategoryForExpense({
    tx: input.tx,
    projectId: cost.projectId,
    projectBudgetCategoryId: cost.projectBudgetCategoryId,
    projectBudgetItemId: cost.projectBudgetItemId,
  });

  await createCanonicalExpenseForProjectCost({
    tx: input.tx,
    projectCostId: cost.id,
    projectId: cost.projectId,
    projectBudgetCategoryId: budgetContext.projectBudgetCategoryId,
    projectBudgetId: budgetContext.projectBudgetId,
    expenseCategoryId: budgetContext.expenseCategoryId,
    requestedById: cost.requestedById,
    description: cost.description,
    quantity: Number(cost.quantity),
    unitCost: Number(cost.unitPrice),
    amount: Number(cost.amount),
    receiptImageUrl: cost.receiptImageUrl,
    status: cost.status,
    materialId: cost.materialId,
    projectRapItemId: cost.projectRapItemId,
  });

  return budgetContext.projectBudgetCategoryId;
}

export async function readBudgetCategorySourceTx(
  tx: BudgetTx,
  categoryId: string,
): Promise<{
  expenses: (typeof projectExpenses.$inferSelect)[];
  payments: (typeof vendorPayment.$inferSelect)[];
}> {
  const expenses = await tx.query.projectExpenses.findMany({
    where: eq(projectExpenses.projectBudgetCategoryId, categoryId),
    orderBy: [projectExpenses.id],
  });
  const ids = [...new Set(expenses.flatMap((e) => (e.vendorBillId ? [e.vendorBillId] : [])))];
  const payments = ids.length
    ? await tx.query.vendorPayment.findMany({
        where: inArray(vendorPayment.vendorBillId, ids),
        orderBy: [vendorPayment.id],
      })
    : [];
  return { expenses, payments };
}
export async function readBudgetCategoryUsageTx(
  tx: BudgetTx,
  categoryId: string,
): Promise<{ pendingAmount: number; actualAmount: number; paidAmount: number }> {
  const summary = budgetUsageSummary("0.00", await readBudgetCategorySourceTx(tx, categoryId));
  return {
    pendingAmount: Number(summary.pendingAmount),
    actualAmount: Number(summary.actualAmount),
    paidAmount: Number(summary.paidAmount),
  };
}

export async function syncProjectBudgetCategory(input: {
  readonly tx: BudgetTx;
  readonly projectBudgetCategoryId: string;
}): Promise<void> {
  const category = await input.tx.query.projectBudgetCategory.findFirst({
    where: eq(projectBudgetCategory.id, input.projectBudgetCategoryId),
  });

  if (!category) {
    throw new Error("PROJECT_BUDGET_CATEGORY_NOT_FOUND");
  }

  const summary = budgetUsageSummary(
    category.allocatedAmount,
    await readBudgetCategorySourceTx(input.tx, input.projectBudgetCategoryId),
  );
  await input.tx
    .update(projectBudgetCategory)
    .set({
      ...summary,
      updatedAt: new Date(),
    })
    .where(eq(projectBudgetCategory.id, input.projectBudgetCategoryId));
}

export async function syncProjectBudgetCategories(input: {
  readonly tx: BudgetTx;
  readonly projectBudgetCategoryIds: readonly string[];
}): Promise<void> {
  const uniqueCategoryIds = Array.from(new Set(input.projectBudgetCategoryIds));
  for (const projectBudgetCategoryId of uniqueCategoryIds) {
    await syncProjectBudgetCategory({ tx: input.tx, projectBudgetCategoryId });
  }
}
