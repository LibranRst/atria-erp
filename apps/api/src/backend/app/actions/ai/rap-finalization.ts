import { db } from "@backend/db";
import {
  aiProposalConfirmation,
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { resolveActor, type Actor } from "@backend/server/actor";
import { readOwnedStoredProposal } from "@backend/server/usecases/ai/stored-proposal";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import {
  assertSetupScope,
  canReadSetup,
  readSetupContext,
  buildSetupProposal,
  setupFailure,
  SetupError,
} from "@backend/server/usecases/ai/rap-finalization-context";
import {
  lockSetupRowsTx,
  applyRapSetupStepTx,
} from "@backend/server/usecases/project/rap-setup-writer";
import { actorCan } from "@backend/lib/auth/permissions";
import {
  RAP_SETUP_KIND,
  setupIdentitySchema,
  setupProposalSchema,
  type SetupProposal,
  type SetupView,
  type SetupReceipt,
} from "@atria/core/ai/rap-finalization";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { z } from "zod";
type Identity = z.infer<typeof setupIdentitySchema>;
async function owned(
  connection: Pick<FinanceTransaction, "query">,
  actor: Actor,
  input: Identity,
): Promise<{ proposal: SetupProposal; expiresAt: number }> {
  try {
    return await readOwnedStoredProposal(
      connection,
      actor,
      input,
      "proposeRapSetupActions",
      setupProposalSchema,
    );
  } catch {
    throw new SetupError("NOT_FOUND", "Usulan RAP tidak ditemukan pada percakapan Anda.");
  }
}
const denied: ActionResponse<never> = {
  success: false,
  error: { code: "FORBIDDEN", message: "Akses chat, RAP dan budget proyek diperlukan." },
};
export async function getAiRapSetupProposal(input: unknown): Promise<ActionResponse<SetupView>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!canReadSetup(actor)) return denied;
  const identity = setupIdentitySchema.safeParse(input);
  if (!identity.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas usulan tidak valid." },
    };
  try {
    const stored = await owned(db, actor, identity.data);
    await assertSetupScope(actor, stored.proposal.projectId);
    const receipt = await db.query.aiProposalConfirmation.findFirst({
      where: and(
        eq(aiProposalConfirmation.tenantId, INSTANCE_TENANT_ID),
        eq(aiProposalConfirmation.userId, actor.userId),
        eq(aiProposalConfirmation.conversationId, identity.data.conversationId),
        eq(aiProposalConfirmation.toolCallId, identity.data.toolCallId),
        eq(aiProposalConfirmation.proposalType, RAP_SETUP_KIND),
      ),
    });
    if (receipt)
      return {
        success: true,
        data: {
          proposal: stored.proposal,
          status: "CONFIRMED",
          confirmedAt: receipt.createdAt.toISOString(),
        },
      };
    if (stored.expiresAt <= Date.now())
      return {
        success: true,
        data: { proposal: stored.proposal, status: "EXPIRED", confirmedAt: null },
      };
    let status: SetupView["status"] = "STALE";
    try {
      const context = await readSetupContext(actor, stored.proposal.projectId);
      if (
        context.fingerprint === stored.proposal.expectedContext &&
        JSON.stringify(buildSetupProposal(actor, stored.proposal.request, context)) ===
          JSON.stringify(stored.proposal)
      )
        status = "READY";
    } catch (error: unknown) {
      if (error instanceof SetupError && error.code === "FORBIDDEN") throw error;
    }
    return { success: true, data: { proposal: stored.proposal, status, confirmedAt: null } };
  } catch (error: unknown) {
    return setupFailure(error);
  }
}
export async function confirmAiRapSetupProposal(
  input: unknown,
): Promise<ActionResponse<SetupReceipt>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!canReadSetup(actor)) return denied;
  const identity = setupIdentitySchema.safeParse(input);
  if (!identity.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Konfirmasi hanya menerima identitas usulan server.",
      },
    };
  let stored: Awaited<ReturnType<typeof owned>>;
  try {
    stored = await owned(db, actor, identity.data);
    await assertSetupScope(actor, stored.proposal.projectId);
    if (stored.proposal.steps.some((s) => !actorCan(actor, s.permission)))
      throw new SetupError("FORBIDDEN", "Izin untuk langkah RAP telah berubah.");
  } catch (error: unknown) {
    return setupFailure(error);
  }
  const result = await confirmMutation(
    actor,
    identity.data,
    RAP_SETUP_KIND,
    async (tx) => {
      const fresh = await owned(tx, actor, identity.data),
        proposal = fresh.proposal;
      if (fresh.expiresAt <= Date.now())
        throw new SetupError("CONFLICT", "Usulan RAP kedaluwarsa. Minta usulan terbaru.");
      await lockSetupRowsTx(tx, actor, proposal.projectRapId, proposal.steps[0].permission);
      const [budget] = await tx
        .select()
        .from(projectBudgets)
        .where(
          and(
            eq(projectBudgets.projectId, proposal.projectId),
            eq(projectBudgets.tenantId, INSTANCE_TENANT_ID),
          ),
        )
        .for("share");
      if (!budget) throw new SetupError("CONFLICT", "Budget proyek berubah.");
      const categories = await tx
        .select()
        .from(projectBudgetCategory)
        .where(eq(projectBudgetCategory.projectBudgetId, budget.id))
        .orderBy(asc(projectBudgetCategory.id))
        .for("share");
      const ids = categories.map((c) => c.expenseCategoryId);
      if (ids.length)
        await tx
          .select({ id: expenseCategory.id })
          .from(expenseCategory)
          .where(inArray(expenseCategory.id, ids))
          .orderBy(asc(expenseCategory.id))
          .for("share");
      const context = await readSetupContext(actor, proposal.projectId, tx);
      if (
        context.fingerprint !== proposal.expectedContext ||
        JSON.stringify(buildSetupProposal(actor, proposal.request, context)) !==
          JSON.stringify(proposal)
      )
        throw new SetupError("CONFLICT", "RAP, paket atau budget berubah. Minta preview terbaru.");
      for (const item of proposal.steps)
        await applyRapSetupStepTx(tx, actor, proposal.projectRapId, item.step);
      return { documentId: proposal.projectRapId, result: { id: proposal.projectRapId } };
    },
    setupFailure,
  );
  if (!result.success) return result;
  revalidateWorkspacePath(`/projects/${stored.proposal.projectId}`);
  return {
    success: true,
    data: {
      projectRapId: result.data.documentId,
      stage: stored.proposal.after.stage,
      status: stored.proposal.after.status,
      alreadyConfirmed: result.data.kind === "already",
    },
  };
}
