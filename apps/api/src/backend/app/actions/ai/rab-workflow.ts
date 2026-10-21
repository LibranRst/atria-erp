import { and, eq } from "drizzle-orm";
import { db } from "@backend/db";
import { aiProposalConfirmation } from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { readOwnedStoredProposal } from "@backend/server/usecases/ai/stored-proposal";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import {
  canReadRabWorkflow,
  readRabWorkflowContext,
  buildRabWorkflowProposal,
} from "@backend/server/usecases/ai/rab-workflow-context";
import { RabReviewError } from "@backend/server/usecases/ai/rab-context";
import {
  refreshRabLinkedSourcesTx,
  lockRabWorkflowProjectTx,
  updateRabEstimateItemTx,
  addRabManualItemTx,
  createRabBundleTx,
  updateRabBundleTx,
  deleteRabBundleTx,
  updateRabHeaderTx,
  createRabRevisionTx,
  approveRabEstimateTx,
  createProjectChangeOrderTx,
  confirmChangeOrderClientTx,
  approveProjectChangeOrderTx,
  rejectChangeOrderTx,
  voidRabRevisionTx,
} from "@backend/server/usecases/project/rab-workflow-writer";
import {
  RAB_WORKFLOW_KIND,
  rabWorkflowIdentitySchema,
  rabWorkflowProposalSchema,
  rabWorkflowPermission,
  type RabWorkflowProposal,
  type RabWorkflowView,
  type RabWorkflowReceipt,
} from "@atria/core/ai/rab-workflow";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { z } from "zod";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";

type Identity = z.infer<typeof rabWorkflowIdentitySchema>;
function failure(error: unknown): ActionResponse<never> {
  if (error instanceof RabReviewError)
    return { success: false, error: { code: error.code, message: error.message } };
  if (
    error instanceof Error &&
    (error.message.startsWith("FORBIDDEN:") || error.message.startsWith("MAKER_CHECKER_REQUIRED:"))
  )
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Izin atau aturan pemeriksa tidak mengizinkan tindakan ini.",
      },
    };
  return {
    success: false,
    error: {
      code: "TRANSACTION_FAILED",
      message: "Tindakan RAB belum tersimpan. Periksa status dan minta preview terbaru.",
    },
  };
}
async function owned(
  connection: Pick<FinanceTransaction, "query">,
  actor: Actor,
  identity: Identity,
): Promise<{ proposal: RabWorkflowProposal; expiresAt: number }> {
  try {
    return await readOwnedStoredProposal(
      connection,
      actor,
      identity,
      "proposeRabWorkflow",
      rabWorkflowProposalSchema,
    );
  } catch {
    throw new RabReviewError(
      "NOT_FOUND",
      "Usulan RAB belum tersimpan atau bukan milik percakapan Anda.",
    );
  }
}
function assertRights(actor: Actor, proposal: RabWorkflowProposal): void {
  if (!canReadRabWorkflow(actor) || !actorCan(actor, rabWorkflowPermission(proposal.request)))
    throw new RabReviewError("FORBIDDEN", "Izin tindakan RAB telah berubah.");
}
export async function getAiRabWorkflowProposal(
  input: unknown,
): Promise<ActionResponse<RabWorkflowView>> {
  const actor = await resolveActor(),
    identity = rabWorkflowIdentitySchema.safeParse(input);
  if (!actor || !canReadRabWorkflow(actor))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses chat dan RAB diperlukan." },
    };
  if (!identity.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas usulan tidak valid." },
    };
  try {
    const stored = await owned(db, actor, identity.data);
    assertRights(actor, stored.proposal);
    const context = await readRabWorkflowContext(
      actor,
      stored.proposal.projectId,
      stored.proposal.rabEstimateId,
    );
    const receipt = await db.query.aiProposalConfirmation.findFirst({
      where: and(
        eq(aiProposalConfirmation.userId, actor.userId),
        eq(aiProposalConfirmation.conversationId, identity.data.conversationId),
        eq(aiProposalConfirmation.toolCallId, identity.data.toolCallId),
        eq(aiProposalConfirmation.proposalType, RAB_WORKFLOW_KIND),
      ),
    });
    const proposal = actorCan(actor, "view:budget")
      ? stored.proposal
      : { ...stored.proposal, budgetImpact: null };
    if (receipt)
      return {
        success: true,
        data: { proposal, status: "CONFIRMED", resultId: receipt.documentId },
      };
    let status: RabWorkflowView["status"] = stored.expiresAt <= Date.now() ? "EXPIRED" : "STALE";
    if (status !== "EXPIRED") {
      try {
        if (
          context.fingerprint === stored.proposal.expectedContext &&
          JSON.stringify(
            buildRabWorkflowProposal(
              actor,
              {
                projectId: stored.proposal.projectId,
                rabEstimateId: stored.proposal.rabEstimateId,
                request: stored.proposal.request,
              },
              context,
            ),
          ) === JSON.stringify(stored.proposal)
        )
          status = "READY";
      } catch (error: unknown) {
        if (error instanceof RabReviewError && error.code === "FORBIDDEN") throw error;
      }
    }
    return { success: true, data: { proposal, status, resultId: null } };
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function confirmAiRabWorkflowProposal(
  input: unknown,
): Promise<ActionResponse<RabWorkflowReceipt>> {
  const actor = await resolveActor(),
    identity = rabWorkflowIdentitySchema.safeParse(input);
  if (!actor || !canReadRabWorkflow(actor))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses chat dan RAB diperlukan." },
    };
  if (!identity.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Konfirmasi hanya menerima identitas usulan tersimpan.",
      },
    };
  let stored: Awaited<ReturnType<typeof owned>>;
  try {
    stored = await owned(db, actor, identity.data);
    assertRights(actor, stored.proposal);
    await readRabWorkflowContext(actor, stored.proposal.projectId, stored.proposal.rabEstimateId);
  } catch (error: unknown) {
    return failure(error);
  }
  const result = await confirmMutation(
    actor,
    identity.data,
    RAB_WORKFLOW_KIND,
    async (tx) => {
      const fresh = await owned(tx, actor, identity.data),
        proposal = fresh.proposal,
        request = proposal.request;
      assertRights(actor, proposal);
      if (fresh.expiresAt <= Date.now())
        throw new RabReviewError("CONFLICT", "Usulan kedaluwarsa. Minta preview terbaru.");
      await lockRabWorkflowProjectTx(tx, actor, proposal.projectId, rabWorkflowPermission(request));
      const context = await readRabWorkflowContext(
        actor,
        proposal.projectId,
        proposal.rabEstimateId,
        tx,
      );
      if (
        context.fingerprint !== proposal.expectedContext ||
        JSON.stringify(
          buildRabWorkflowProposal(
            actor,
            { projectId: proposal.projectId, rabEstimateId: proposal.rabEstimateId, request },
            context,
          ),
        ) !== JSON.stringify(proposal)
      )
        throw new RabReviewError(
          "CONFLICT",
          "RAB, budget atau Change Order berubah. Minta preview terbaru.",
        );
      let resultId = proposal.rabEstimateId;
      if (request.action === "REFRESH_SOURCES")
        await refreshRabLinkedSourcesTx(tx, actor, { rabEstimateId: resultId });
      else if (request.action === "EDIT_DRAFT") {
        if (request.title !== undefined || request.clientNotes !== undefined)
          await updateRabHeaderTx(tx, actor, {
            rabEstimateId: resultId,
            title: request.title ?? context.records.rab.title,
            clientNotes: request.clientNotes ?? context.records.rab.clientNotes ?? "",
          });
        for (const row of request.rows) {
          if (row.action === "ADD")
            await addRabManualItemTx(tx, actor, { ...row.fields, rabEstimateId: resultId });
          else {
            const before = context.items.find((item) => item.id === row.itemId);
            if (!before) throw new RabReviewError("CONFLICT", "Baris RAB tidak tersedia.");
            await updateRabEstimateItemTx(tx, actor, {
              rabEstimateItemId: row.itemId,
              ...before,
              ...(row.action === "UPDATE" ? row.fields : { isHidden: row.action === "EXCLUDE" }),
            });
          }
        }
      } else if (request.action === "CREATE_BUNDLE")
        await createRabBundleTx(tx, actor, {
          ...request.fields,
          rabEstimateId: resultId,
          itemIds: request.itemIds,
        });
      else if (request.action === "UPDATE_BUNDLE")
        await updateRabBundleTx(tx, actor, { ...request.fields, bundleId: request.bundleId });
      else if (request.action === "DISSOLVE_BUNDLE")
        await deleteRabBundleTx(tx, actor, { bundleId: request.bundleId });
      else if (request.action === "APPROVE_INITIAL")
        await approveRabEstimateTx(tx, actor, { rabEstimateId: resultId });
      else if (request.action === "CREATE_REVISION")
        resultId = (
          await createRabRevisionTx(tx, actor, { rabEstimateId: resultId, reason: request.reason })
        ).id;
      else if (request.action === "VOID_REVISION")
        await voidRabRevisionTx(tx, actor, { rabEstimateId: resultId, reason: request.reason });
      else if (request.action === "CREATE_CHANGE_ORDER") {
        const baseId = context.records.rab.supersedesRabEstimateId;
        if (!baseId) throw new RabReviewError("CONFLICT", "Baseline revisi tidak tersedia.");
        resultId = (
          await createProjectChangeOrderTx(tx, actor, {
            baseRabEstimateId: baseId,
            revisedRabEstimateId: resultId,
            reason: request.reason,
            scopeSummary: request.scopeSummary,
          })
        ).id;
      } else if (request.action === "CONFIRM_CLIENT") {
        await confirmChangeOrderClientTx(tx, actor, {
          changeOrderId: request.changeOrderId,
          confirmedAt: new Date(request.confirmedAt),
          confirmationReference: request.confirmationReference,
        });
        resultId = request.changeOrderId;
      } else if (request.action === "APPROVE_CHANGE_ORDER") {
        await approveProjectChangeOrderTx(tx, actor, {
          changeOrderId: request.changeOrderId,
          emergencyOverride: request.emergencyOverride,
          reason: request.reason,
        });
        resultId = request.changeOrderId;
      } else if (request.action === "REJECT_CHANGE_ORDER") {
        await rejectChangeOrderTx(tx, actor, {
          changeOrderId: request.changeOrderId,
          reason: request.reason,
        });
        resultId = request.changeOrderId;
      }
      return { documentId: resultId, result: { resultId } };
    },
    failure,
  );
  if (!result.success) return result;
  revalidateWorkspacePath(`/projects/${stored.proposal.projectId}`);
  return {
    success: true,
    data: { resultId: result.data.documentId, alreadyConfirmed: result.data.kind === "already" },
  };
}
