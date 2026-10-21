import { and, eq } from "drizzle-orm";
import { db } from "@backend/db";
import { aiProposalConfirmation } from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import {
  readOwnedStoredProposal,
  StoredProposalError,
} from "@backend/server/usecases/ai/stored-proposal";
import {
  inspectBudgetSummaryTx,
  writeBudgetSummaryTx,
  assertBudgetSummaryRights,
  BudgetSummaryError,
} from "@backend/server/usecases/project/budget-summary-writer";
import {
  BUDGET_SYNC_KIND,
  budgetSyncProposalSchema,
  budgetSyncIdentitySchema,
  budgetSummaryChanges,
  type BudgetSyncView,
} from "@atria/core/ai/budget-sync";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
function failure(error: unknown): ActionResponse<never> {
  return {
    success: false,
    error: {
      code:
        error instanceof BudgetSummaryError || error instanceof StoredProposalError
          ? error.code
          : "TRANSACTION_FAILED",
      message:
        error instanceof BudgetSummaryError || error instanceof StoredProposalError
          ? error.message
          : "Pemeriksaan budget belum selesai. Periksa lagi sebelum mencoba sinkronisasi.",
    },
  };
}
function rights(actor: Actor, write = false): void {
  if (!actorCan(actor, "use:ai_chat"))
    throw new BudgetSummaryError("FORBIDDEN", "Akses chat tidak tersedia.");
  assertBudgetSummaryRights(actor, write);
}
export async function getAiBudgetSyncProposal(
  raw: unknown,
): Promise<ActionResponse<BudgetSyncView>> {
  const actor = await resolveActor(),
    identity = budgetSyncIdentitySchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!identity.success)
    return failure(
      new BudgetSummaryError("VALIDATION_ERROR", "Identitas pemeriksaan tidak valid."),
    );
  try {
    rights(actor);
    const stored = await readOwnedStoredProposal(
      db,
      actor,
      identity.data,
      "inspectProjectBudgetSummary",
      budgetSyncProposalSchema,
    );
    const current = await db.transaction((tx) =>
      inspectBudgetSummaryTx(tx, actor, stored.proposal.input.projectId),
    );
    const receipt = await db.query.aiProposalConfirmation.findFirst({
      where: and(
        eq(aiProposalConfirmation.userId, actor.userId),
        eq(aiProposalConfirmation.conversationId, identity.data.conversationId),
        eq(aiProposalConfirmation.toolCallId, identity.data.toolCallId),
        eq(aiProposalConfirmation.proposalType, BUDGET_SYNC_KIND),
      ),
    });
    if (receipt)
      return {
        success: true,
        data: {
          proposal: current,
          status: "CONFIRMED",
          verified: current.categories.every((c) => !budgetSummaryChanges(c).length),
          confirmedAt: receipt.createdAt.toISOString(),
        },
      };
    return {
      success: true,
      data: {
        proposal: stored.proposal,
        status:
          stored.expiresAt <= Date.now()
            ? "EXPIRED"
            : JSON.stringify(current) === JSON.stringify(stored.proposal)
              ? "READY"
              : "STALE",
        verified: false,
        confirmedAt: null,
      },
    };
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function confirmAiBudgetSyncProposal(
  raw: unknown,
): Promise<ActionResponse<{ readonly resultId: string; readonly alreadyConfirmed: boolean }>> {
  const actor = await resolveActor(),
    identity = budgetSyncIdentitySchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!identity.success)
    return failure(
      new BudgetSummaryError(
        "VALIDATION_ERROR",
        "Konfirmasi hanya menerima identitas pemeriksaan tersimpan.",
      ),
    );
  let projectId: string;
  try {
    rights(actor, true);
    const stored = await readOwnedStoredProposal(
      db,
      actor,
      identity.data,
      "inspectProjectBudgetSummary",
      budgetSyncProposalSchema,
    );
    projectId = stored.proposal.input.projectId;
    // Read scope again even when a previous confirmation receipt is returned.
    await db.transaction((tx) => inspectBudgetSummaryTx(tx, actor, projectId));
  } catch (error: unknown) {
    return failure(error);
  }
  const result = await confirmMutation(
    actor,
    identity.data,
    BUDGET_SYNC_KIND,
    async (tx) => {
      const stored = await readOwnedStoredProposal(
        tx,
        actor,
        identity.data,
        "inspectProjectBudgetSummary",
        budgetSyncProposalSchema,
      );
      rights(actor, true);
      if (stored.expiresAt <= Date.now())
        throw new BudgetSummaryError(
          "CONFLICT",
          "Pemeriksaan kedaluwarsa. Minta pemeriksaan terbaru.",
        );
      const fresh = await inspectBudgetSummaryTx(tx, actor, stored.proposal.input.projectId);
      if (JSON.stringify(fresh) !== JSON.stringify(stored.proposal))
        throw new BudgetSummaryError(
          "CONFLICT",
          "Data budget atau transaksi berubah sejak pemeriksaan. Periksa ulang sebelum sinkronisasi.",
        );
      if (fresh.categories.every((c) => !budgetSummaryChanges(c).length))
        throw new BudgetSummaryError(
          "CONFLICT",
          "Ringkasan sudah sesuai. Tidak ada selisih untuk disinkronkan.",
        );
      await writeBudgetSummaryTx(tx, actor, fresh);
      return { documentId: fresh.projectBudgetId, result: { verified: true } };
    },
    failure,
  );
  if (!result.success) return result;
  for (const path of ["/ledger", "/projects", `/projects/${projectId}`, "/expenses"])
    revalidateWorkspacePath(path);
  return {
    success: true,
    data: { resultId: result.data.documentId, alreadyConfirmed: result.data.kind === "already" },
  };
}
