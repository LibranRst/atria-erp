import { assertProjectStatusIsOperational } from "@backend/lib/auth/scoping";
import {
  assertFinancePermission,
  lockFinanceProject,
  type FinanceTransaction,
} from "./mutation-access";
import { actorCan } from "@backend/lib/auth/permissions";
import { recordNotificationEvent } from "@backend/server/services/notification-events";
import { and, eq } from "drizzle-orm";

import { db } from "@backend/db";
import { approval, bankAccount, cashTransaction, projectCost } from "@backend/db/schema";
import {
  ensureCanonicalExpenseForProjectCost,
  syncProjectBudgetCategory,
} from "@backend/lib/budget/budget-sync";
import { mutateBalance } from "@backend/lib/finance/balance-mutation";
import type { Actor } from "@backend/server/actor";
import {
  mapPayFieldRequestError,
  writeFieldRequestAuditTx,
} from "@backend/app/actions/finance/field-request-utils";

import type { ActionResponse } from "@atria/core/types/action-response";
import type { PayFieldRequestInput } from "@atria/core/validations/finance";

/**
 * Realisasi pembayaran biaya lapangan.
 *
 * Badan transaksinya dipindah apa adanya dari Server Action lama — lock baris
 * pesimistik, gerbang approval yang dibekukan saat pengajuan atau budget
 * overrun, penjagaan duplikasi referensi bank, mutasi saldo, sinkronisasi
 * kategori budget, lalu penulisan audit. Tidak ada logika finansial yang
 * ditulis ulang di sini.
 */
export async function payFieldRequestUseCase(
  actor: Actor,
  input: PayFieldRequestInput,
): Promise<ActionResponse<{ costId: string; nextBalance: number }>> {
  if (!actorCan(actor, "pay:cost") || actor.dataScope === "NONE") {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: `FORBIDDEN: Peran ${actor.roleName} tidak memiliki izin pay:cost`,
      },
    };
  }

  try {
    const result = await db.transaction((tx) => payFieldRequestTx(tx, actor, input));

    return {
      success: true,
      data: { costId: result.costId, nextBalance: result.nextBalance },
    };
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.message.startsWith("UNAUTHORIZED:") ||
        error.message.startsWith("FORBIDDEN:") ||
        error.message.startsWith("PROJECT_NOT_ACTIVE:"))
    ) {
      return { success: false, error: { code: "FORBIDDEN", message: "Akses proyek ditolak." } };
    }
    return mapPayFieldRequestError(error);
  }
}

export async function payFieldRequestTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: PayFieldRequestInput,
): Promise<{
  costId: string;
  nextBalance: number;
  projectId: string;
  requestedById: string;
  description: string;
  amount: number;
}> {
  assertFinancePermission(actor, "pay:cost");
  const { projectCostId, bankAccountId, referenceNumber } = input;

  const [cost] = await tx
    .select()
    .from(projectCost)
    .where(eq(projectCost.id, projectCostId))
    .for("update");

  if (!cost) {
    throw new Error("PROJECT_COST_NOT_FOUND");
  }

  const currentProject = await lockFinanceProject(tx, actor, cost.projectId);
  assertProjectStatusIsOperational(currentProject.status);

  if (cost.status === "PAID") {
    throw new Error("COST_ALREADY_PAID");
  }

  if (cost.status !== "APPROVED") {
    throw new Error("COST_NOT_APPROVED");
  }

  const requiresApproval = cost.requiresOwnerApproval || cost.budgetOverrun;

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
}
