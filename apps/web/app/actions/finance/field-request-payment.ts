"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { approval, bankAccount, cashTransaction, projectCost } from "@/db/schema";
import {
  ensureCanonicalExpenseForProjectCost,
  syncProjectBudgetCategory,
} from "@/lib/budget/budget-sync";
import type { ActionResponse } from "@/lib/types/action-response";
import { mutateBalance, parseNumericToCents } from "@/lib/finance/balance-mutation";
import { authorizeFieldRequestAction } from "./field-request-auth";
import { mapPayFieldRequestError, writeFieldRequestAuditTx } from "./field-request-utils";

export async function payFieldRequest(
  projectCostId: string,
  bankAccountId: string,
  referenceNumber: string,
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

      const amountCents = parseNumericToCents(cost.amount);
      const requiresApproval = amountCents >= BigInt(500_000_000) || cost.budgetOverrun;

      if (requiresApproval) {
        const appRecord = await tx.query.approval.findFirst({
          where: and(
            eq(approval.referenceType, "project_cost"),
            eq(approval.referenceId, projectCostId),
          ),
        });

        if (!appRecord || appRecord.status !== "APPROVED") {
          throw new Error("APPROVAL_REQUIRED_BUT_PENDING");
        }
      }

      const accountBefore = await tx.query.bankAccount.findFirst({
        where: eq(bankAccount.id, bankAccountId),
      });
      if (!accountBefore) throw new Error("BANK_ACCOUNT_NOT_FOUND");
      const duplicateReference = await tx.query.cashTransaction.findFirst({
        where: and(
          eq(cashTransaction.bankAccountId, bankAccountId),
          eq(cashTransaction.bankReference, referenceNumber),
        ),
      });
      if (duplicateReference) throw new Error("DUPLICATE_BANK_REFERENCE");
      const ledgerTx = await mutateBalance({
        tx,
        bankAccountId,
        type: "OUTFLOW",
        amount: cost.amount,
        category: "field_claim",
        description: `Realisasi biaya lapangan: ${cost.description} (Ref: ${referenceNumber})`,
        referenceType: "project_cost",
        referenceId: cost.id,
        bankReference: referenceNumber,
        userId: currentUser.id,
      });
      const accountAfter = await tx.query.bankAccount.findFirst({
        where: eq(bankAccount.id, bankAccountId),
      });
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
          balance: accountBefore.balance,
          costStatus: cost.status,
        },
        newState: {
          balance: accountAfter.balance,
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
