"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  approval,
  bankAccount,
  cashTransaction,
  projectBudgetItem,
  projectCost,
} from "@/db/schema";
import {
  ensureCanonicalExpenseForProjectCost,
  syncProjectBudgetCategory,
} from "@/lib/budget/budget-sync";
import type { ActionResponse } from "@/lib/types/action-response";
import { authorizeFieldRequestAction } from "./field-request-auth";
import {
  mapPayFieldRequestError,
  writeFieldRequestAuditTx,
} from "./field-request-utils";

export async function payFieldRequest(
  projectCostId: string,
  bankAccountId: string,
  referenceNumber: string
): Promise<ActionResponse<{ costId: string; nextBalance: number }>> {
  try {
    const authResult = await authorizeFieldRequestAction({
      permission: "pay:cost",
    });
    if (!authResult.success) return authResult;
    const currentUser = authResult.data.user;

    const result = await db.transaction(async (tx) => {
      const [cost] = await tx
        .select()
        .from(projectCost)
        .where(eq(projectCost.id, projectCostId))
        .for("update");

      if (!cost) {
        throw new Error("PROJECT_COST_NOT_FOUND");
      }

      if (cost.status === "PAID") {
        throw new Error("COST_ALREADY_PAID");
      }

      if (cost.status !== "APPROVED") {
        throw new Error("COST_NOT_APPROVED");
      }

      const amount = Number(cost.amount);
      const requiresApproval = amount >= 5000000 || cost.budgetOverrun;

      if (requiresApproval) {
        const appRecord = await tx.query.approval.findFirst({
          where: and(
            eq(approval.referenceType, "project_cost"),
            eq(approval.referenceId, projectCostId)
          ),
        });

        if (!appRecord || appRecord.status !== "APPROVED") {
          throw new Error("APPROVAL_REQUIRED_BUT_PENDING");
        }
      }

      const [account] = await tx
        .select()
        .from(bankAccount)
        .where(eq(bankAccount.id, bankAccountId))
        .for("update");

      if (!account) {
        throw new Error("BANK_ACCOUNT_NOT_FOUND");
      }

      const oldBalance = Number(account.balance);
      if (oldBalance < amount) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      const newBalance = oldBalance - amount;

      const updatedRows = await tx
        .update(bankAccount)
        .set({
          balance: newBalance.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(bankAccount.id, bankAccountId))
        .returning();

      if (updatedRows.length !== 1) {
        throw new Error("BALANCE_UPDATE_MISMATCH");
      }

      const [ledgerTx] = await tx
        .insert(cashTransaction)
        .values({
          bankAccountId,
          type: "CREDIT",
          category: "field_claim",
          amount: amount.toFixed(2),
          description: `Realisasi biaya lapangan: ${cost.description} (Ref: ${referenceNumber})`,
          reconciled: true,
          reconciliationDate: new Date(),
          reconciledById: currentUser.id,
          referenceType: "project_cost",
          referenceId: cost.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      await tx
        .update(projectCost)
        .set({
          status: "PAID",
          bankAccountId,
          cashTransactionId: ledgerTx.id,
          paidById: currentUser.id,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectCost.id, projectCostId));

      const budgetItem = cost.projectBudgetItemId
        ? await tx.query.projectBudgetItem.findFirst({
          where: eq(projectBudgetItem.id, cost.projectBudgetItemId),
        })
        : null;
      const currentSpent = budgetItem ? Number(budgetItem.actualSpent) : 0;
      const nextSpent = budgetItem ? currentSpent + amount : 0;

      if (budgetItem && cost.projectBudgetItemId) {
        await tx
          .update(projectBudgetItem)
          .set({
            actualSpent: nextSpent.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(projectBudgetItem.id, cost.projectBudgetItemId));
      }

      const syncedCategoryId = await ensureCanonicalExpenseForProjectCost({
        tx,
        costId: projectCostId,
      });
      await syncProjectBudgetCategory({
        tx,
        projectBudgetCategoryId: syncedCategoryId,
      });

      await writeFieldRequestAuditTx(tx, {
        userId: currentUser.id,
        action: "PAY_FIELD_REQUEST",
        targetTable: "project_cost",
        targetId: projectCostId,
        originalState: {
          balance: oldBalance.toFixed(2),
          costStatus: cost.status,
          actualSpent: budgetItem ? currentSpent.toFixed(2) : null,
        },
        newState: {
          balance: newBalance.toFixed(2),
          costStatus: "PAID",
          actualSpent: budgetItem ? nextSpent.toFixed(2) : null,
          cashTransactionId: ledgerTx.id,
        },
      });

      return { costId: cost.id, nextBalance: newBalance };
    });

    return {
      success: true,
      data: result,
    };
  } catch (error: unknown) {
    return mapPayFieldRequestError(error);
  }
}
