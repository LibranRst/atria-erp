import { db } from "@/db";
import { projectBudgetCategory, projectBudgets } from "@/db/schema";
import { calculateTargetGross } from "@atria/core/budget/excel-budget";

type BudgetCreationTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type BudgetAllocationInput = {
  readonly budgetCapRatio: number;
  readonly categories: readonly {
    readonly expenseCategoryId: string;
    readonly ratioPercentage: number;
    readonly sortOrder: number;
  }[];
};

export async function insertCanonicalProjectBudgetTx(args: {
  readonly tx: BudgetCreationTx;
  readonly projectId: string;
  readonly contractValue: number;
  readonly approvedRabValue?: number;
  readonly allocation: BudgetAllocationInput;
  readonly notes?: string | null;
}): Promise<typeof projectBudgets.$inferSelect> {
  if (args.allocation.categories.length === 0) throw new Error("EXPENSE_CATEGORY_NOT_CONFIGURED");
  const internalBudget = args.contractValue * args.allocation.budgetCapRatio;
  const gross = calculateTargetGross(args.contractValue, internalBudget);
  const [budget] = await args.tx
    .insert(projectBudgets)
    .values({
      projectId: args.projectId,
      status: "DRAFT",
      contractValue: args.contractValue.toFixed(2),
      approvedRabValue: (args.approvedRabValue ?? args.contractValue).toFixed(2),
      internalBudget: internalBudget.toFixed(2),
      budgetCapRatio: args.allocation.budgetCapRatio.toFixed(6),
      targetGrossAmount: gross.amount.toFixed(2),
      targetGrossPercentage: gross.percentage.toFixed(4),
      projectProgressPercentage: "0.0000",
      notes: args.notes ?? null,
    })
    .returning();
  await args.tx.insert(projectBudgetCategory).values(
    args.allocation.categories.map((category) => {
      const allocatedAmount = internalBudget * category.ratioPercentage;
      return {
        projectBudgetId: budget.id,
        expenseCategoryId: category.expenseCategoryId,
        ratioPercentage: category.ratioPercentage.toFixed(6),
        allocatedAmount: allocatedAmount.toFixed(2),
        pendingAmount: "0.00",
        actualAmount: "0.00",
        paidAmount: "0.00",
        remainingAmount: allocatedAmount.toFixed(2),
        usedPercentage: "0.0000",
        status: "SAFE",
        sortOrder: category.sortOrder,
      };
    }),
  );
  return budget;
}
