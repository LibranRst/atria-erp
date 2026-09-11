import { recordNotificationEvent } from "@/server/services/notification-events";
import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { approval, bankAccount, cashTransaction, projectCost } from "@/db/schema";
import {
  ensureCanonicalExpenseForProjectCost,
  syncProjectBudgetCategory,
} from "@/lib/budget/budget-sync";
import { mutateBalance, parseNumericToCents } from "@/lib/finance/balance-mutation";
import type { Actor } from "@/server/actor";
import {
  mapPayFieldRequestError,
  writeFieldRequestAuditTx,
} from "@/app/actions/finance/field-request-utils";
import { actorHasPermission } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { PayFieldRequestInput } from "@atria/core/validations/finance";

/**
 * Realisasi pembayaran biaya lapangan.
 *
 * Badan transaksinya dipindah apa adanya dari Server Action lama — lock baris
 * pesimistik, gerbang approval untuk nominal >= Rp 5.000.000 atau budget
 * overrun, penjagaan duplikasi referensi bank, mutasi saldo, sinkronisasi
 * kategori budget, lalu penulisan audit. Tidak ada logika finansial yang
 * ditulis ulang di sini.
 */
export async function payFieldRequestUseCase(
  actor: Actor,
  input: PayFieldRequestInput,
): Promise<ActionResponse<{ costId: string; nextBalance: number }>> {
  const { projectCostId, bankAccountId, referenceNumber } = input;

  if (!actorHasPermission(actor.roleName, "pay:cost")) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: `FORBIDDEN: Peran ${actor.roleName} tidak memiliki izin pay:cost`,
      },
    };
  }

  try {
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
        userId: actor.userId,
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
          paidById: actor.userId,
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
        userId: actor.userId,
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

      await recordNotificationEvent(tx, {
        referenceType: "project_cost",
        referenceId: cost.id,
        projectId: cost.projectId,
        stage: "PAID",
        title: "Biaya telah dibayar",
        message: cost.description,
        recipients: [cost.requestedById],
        actionUrl: `/projects/${cost.projectId}?tab=budget`,
        actorId: actor.userId,
      });
      return {
        costId: cost.id,
        nextBalance: newBalance,
        requestedById: cost.requestedById,
        description: cost.description,
        amount: Number(cost.amount),
        projectId: cost.projectId,
      };
    });

    return {
      success: true,
      data: { costId: result.costId, nextBalance: result.nextBalance },
    };
  } catch (error: unknown) {
    return mapPayFieldRequestError(error);
  }
}
