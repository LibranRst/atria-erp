import { db } from "@backend/db";
import { eq, asc } from "drizzle-orm";
import { projectBudgets, projectBudgetCategory, expenseCategory } from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { readBudgetCategoryUsageTx } from "@backend/lib/budget/budget-sync";
import { lockManagedProjectTx } from "./project-management-writer";
export type ManagedProjectContext = {
  project: {
    id: string;
    name: string;
    clientId: string;
    projectManagerId: string | null;
    status: string;
    startDate: string | null;
    endDate: string | null;
    location: string | null;
    roomArea: string | null;
    projectType: string | null;
    notes: string | null;
  };
  budget: {
    id: string;
    status: string;
    contractValue: string;
    internalBudget: string;
    categories: {
      id: string;
      name: string;
      ratioPercentage: string;
      allocatedAmount: string;
      actualAmount: number;
      pendingAmount: number;
      paidAmount: number;
    }[];
  } | null;
};
export async function readManagedProjectContext(
  actor: Actor,
  projectId: string,
): Promise<ManagedProjectContext> {
  return db.transaction(async (tx) => {
    const p = await lockManagedProjectTx(tx, actor, projectId);
    const budget = actorCan(actor, "view:budget")
      ? await tx.query.projectBudgets.findFirst({
          where: eq(projectBudgets.projectId, p.id),
        })
      : null;
    const rows = budget
      ? await tx
          .select({ category: projectBudgetCategory, name: expenseCategory.name })
          .from(projectBudgetCategory)
          .innerJoin(
            expenseCategory,
            eq(expenseCategory.id, projectBudgetCategory.expenseCategoryId),
          )
          .where(eq(projectBudgetCategory.projectBudgetId, budget.id))
          .orderBy(asc(projectBudgetCategory.sortOrder), asc(projectBudgetCategory.id))
      : [];
    const categories = await Promise.all(
      rows.map(async ({ category, name }) => ({
        id: category.id,
        name,
        ratioPercentage: category.ratioPercentage,
        allocatedAmount: category.allocatedAmount,
        ...(await readBudgetCategoryUsageTx(tx, category.id)),
      })),
    );
    return {
      project: {
        id: p.id,
        name: p.name,
        clientId: p.clientId,
        projectManagerId: p.projectManagerId,
        status: p.status,
        startDate: p.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: p.endDate?.toISOString().slice(0, 10) ?? null,
        location: p.location,
        roomArea: p.roomArea,
        projectType: p.projectType,
        notes: p.notes,
      },
      budget: budget
        ? {
            id: budget.id,
            status: budget.status,
            contractValue: budget.contractValue,
            internalBudget: budget.internalBudget,
            categories,
          }
        : null,
    };
  });
}
