import { assertExpenseProjectAccess } from "@backend/server/usecases/ai/expense-batch-context";
import { and, eq, inArray, asc } from "drizzle-orm";
import { db } from "@backend/db";
import {
  projectCost,
  bankAccount,
  projectBudgetCategory,
  aiProposalConfirmation,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import {
  lockFinanceProject,
  type FinanceTransaction,
} from "@backend/server/usecases/finance/mutation-access";
import { readOwnedStoredProposal } from "@backend/server/usecases/ai/stored-proposal";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import {
  assertExpenseActionRights,
  prepareExpenseBatchAction,
} from "@backend/server/usecases/ai/expense-batch-action-context";
import {
  verifyFieldRequestTx,
  approveFieldRequestTx,
} from "@backend/server/usecases/finance/review-field-request";
import { payFieldRequestTx } from "@backend/server/usecases/finance/pay-field-request";
import { FinanceInputError } from "@backend/server/usecases/ai/finance-input-context";
import {
  expenseBatchIdentitySchema,
  expenseBatchActionProposalSchema,
  EXPENSE_BATCH_ACTION_KIND,
  type ExpenseBatchActionProposal,
} from "@atria/core/ai/expense-batch";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import type { z } from "zod";
type Identity = z.infer<typeof expenseBatchIdentitySchema>;
function fail(error: unknown): ActionResponse<never> {
  if (error instanceof FinanceInputError)
    return { success: false, error: { code: error.code, message: error.message } };
  return {
    success: false,
    error: {
      code: "TRANSACTION_FAILED",
      message:
        "Seluruh tindakan dibatalkan. Periksa status, persetujuan, saldo dan referensi bank lalu minta preview terbaru.",
    },
  };
}
async function owned(
  actor: Actor,
  identity: Identity,
  reader: Pick<FinanceTransaction, "query"> = db,
): Promise<{ proposal: ExpenseBatchActionProposal; expiresAt: number }> {
  for (const name of [
    "proposeExpenseBatchVerify",
    "proposeExpenseBatchDecision",
    "proposeExpenseBatchPayment",
  ]) {
    try {
      const s = await readOwnedStoredProposal(
        reader,
        actor,
        identity,
        name,
        expenseBatchActionProposalSchema,
      );
      const expected =
        s.proposal.input.action === "VERIFY"
          ? "proposeExpenseBatchVerify"
          : s.proposal.input.action === "PAY"
            ? "proposeExpenseBatchPayment"
            : "proposeExpenseBatchDecision";
      if (name !== expected) continue;
      assertExpenseActionRights(actor, s.proposal.input);
      await assertExpenseProjectAccess(actor, s.proposal.input.projectId, reader);
      return s;
    } catch (error: unknown) {
      if (error instanceof FinanceInputError) throw error;
    }
  }
  throw new FinanceInputError(
    "NOT_FOUND",
    "Usulan belum tersimpan atau bukan milik percakapan Anda.",
  );
}

export async function getAiExpenseBatchAction(raw: unknown): Promise<
  ActionResponse<{
    proposal: ExpenseBatchActionProposal;
    status: "READY" | "STALE" | "EXPIRED" | "CONFIRMED";
  }>
> {
  const actor = await resolveActor(),
    i = expenseBatchIdentitySchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!i.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas usulan tidak valid." },
    };
  try {
    const s = await owned(actor, i.data),
      receipt = await db.query.aiProposalConfirmation.findFirst({
        where: and(
          eq(aiProposalConfirmation.conversationId, i.data.conversationId),
          eq(aiProposalConfirmation.toolCallId, i.data.toolCallId),
          eq(aiProposalConfirmation.userId, actor.userId),
          eq(aiProposalConfirmation.proposalType, EXPENSE_BATCH_ACTION_KIND),
        ),
      });
    if (receipt) return { success: true, data: { proposal: s.proposal, status: "CONFIRMED" } };
    let status: "READY" | "STALE" | "EXPIRED" = s.expiresAt <= Date.now() ? "EXPIRED" : "STALE";
    if (status !== "EXPIRED")
      try {
        if (
          JSON.stringify(await prepareExpenseBatchAction(actor, s.proposal.input)) ===
          JSON.stringify(s.proposal)
        )
          status = "READY";
      } catch {
        /* Changed eligibility remains blocked until a fresh proposal. */
      }
    return { success: true, data: { proposal: s.proposal, status } };
  } catch (error: unknown) {
    return fail(error);
  }
}
export async function confirmAiExpenseBatchAction(
  raw: unknown,
): Promise<ActionResponse<{ costIds: readonly string[]; alreadyConfirmed: boolean }>> {
  const actor = await resolveActor(),
    i = expenseBatchIdentitySchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!i.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Konfirmasi hanya menerima identitas usulan tersimpan.",
      },
    };
  let proposal: ExpenseBatchActionProposal;
  try {
    proposal = (await owned(actor, i.data)).proposal;
  } catch (error: unknown) {
    return fail(error);
  }
  const result = await confirmMutation(
    actor,
    i.data,
    EXPENSE_BATCH_ACTION_KIND,
    async (tx) => {
      const s = await owned(actor, i.data, tx),
        input = s.proposal.input;
      if (s.expiresAt <= Date.now()) throw new FinanceInputError("CONFLICT", "Usulan kedaluwarsa.");
      const costs = await tx
        .select()
        .from(projectCost)
        .where(
          and(eq(projectCost.tenantId, INSTANCE_TENANT_ID), inArray(projectCost.id, input.costIds)),
        )
        .orderBy(asc(projectCost.id))
        .for("update");
      await lockFinanceProject(tx, actor, input.projectId);
      if (input.bankAccountId)
        await tx
          .select()
          .from(bankAccount)
          .where(eq(bankAccount.id, input.bankAccountId))
          .for("update");
      const categories = [
        ...new Set(
          costs.map((c) => c.projectBudgetCategoryId).filter((id): id is string => Boolean(id)),
        ),
      ];
      if (categories.length)
        await tx
          .select()
          .from(projectBudgetCategory)
          .where(inArray(projectBudgetCategory.id, categories))
          .orderBy(asc(projectBudgetCategory.id))
          .for("update");
      if (
        JSON.stringify(await prepareExpenseBatchAction(actor, input, tx)) !==
        JSON.stringify(s.proposal)
      )
        throw new FinanceInputError(
          "CONFLICT",
          "Pengeluaran, budget, approval atau saldo berubah. Minta preview terbaru.",
        );
      for (const cost of costs) {
        if (input.action === "VERIFY") await verifyFieldRequestTx(tx, actor, cost.id);
        else if (input.action === "PAY")
          await payFieldRequestTx(tx, actor, {
            projectCostId: cost.id,
            bankAccountId: input.bankAccountId!,
            referenceNumber: input.references!.find((r) => r.costId === cost.id)!.referenceNumber,
          });
        else
          await approveFieldRequestTx(tx, actor, {
            projectCostId: cost.id,
            status: input.action === "APPROVE" ? "APPROVED" : "REJECTED",
            notes: input.notes,
            emergencyOverride: false,
          });
      }
      return { documentId: costs[0].id, result: { costIds: costs.map((c) => c.id) } };
    },
    fail,
  );
  if (!result.success) return result;
  for (const path of [
    "/expenses",
    "/approvals",
    "/ledger",
    "/reconciliation",
    `/projects/${proposal.input.projectId}`,
  ])
    revalidateWorkspacePath(path);
  return {
    success: true,
    data: { costIds: proposal.input.costIds, alreadyConfirmed: result.data.kind === "already" },
  };
}
