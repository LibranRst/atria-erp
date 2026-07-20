"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  approval,
  bankAccount,
  projectCost,
} from "@/db/schema";
import {
  ensureCanonicalExpenseForProjectCost,
  syncProjectBudgetCategory,
} from "@/lib/budget/budget-sync";
import type { ActionResponse } from "@/lib/types/action-response";
import { mutateBalance } from "@/lib/finance/balance-mutation";
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

      const accountBefore = await tx.query.bankAccount.findFirst({ where: eq(bankAccount.id, bankAccountId) });
      if (!accountBefore) throw new Error("BANK_ACCOUNT_NOT_FOUND");
      const oldBalance = Number(accountBefore.balance);
      const ledgerTx = await mutateBalance({
        tx,
        bankAccountId,
        type: "CREDIT",
        amount: amount.toFixed(2),
        category: "field_claim",
        description: `Realisasi biaya lapangan: ${cost.description} (Ref: ${referenceNumber})`,
        referenceType: "project_cost",
        referenceId: cost.id,
        userId: currentUser.id,
      });
      const accountAfter = await tx.query.bankAccount.findFirst({ where: eq(bankAccount.id, bankAccountId) });
      if (!accountAfter) throw new Error("BANK_ACCOUNT_NOT_FOUND");
      const newBalance = Number(accountAfter.balance);

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
        },
        newState: {
          balance: newBalance.toFixed(2),
          costStatus: "PAID",
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
