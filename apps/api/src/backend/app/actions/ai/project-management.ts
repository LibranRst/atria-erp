import { and, eq } from "drizzle-orm";
import { db } from "@backend/db";
import { aiProposalConfirmation, projectBudgets } from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { readOwnedStoredProposal } from "@backend/server/usecases/ai/stored-proposal";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import {
  prepareProjectManagementTx,
  writeProjectManagementTx,
  assertProjectManagementRights,
  lockManagedProjectTx,
  ProjectManagementError,
  type ProjectManagementTx,
} from "@backend/server/usecases/project/project-management-writer";
import {
  PROJECT_MANAGEMENT_KIND,
  projectManagementIdentitySchema,
  projectManagementProposalSchema,
  type ProjectManagementView,
  type ProjectManagementReceipt,
  type ProjectManagementProposal,
} from "@atria/core/ai/project-management";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import type { z } from "zod";
type Identity = z.infer<typeof projectManagementIdentitySchema>;
function failure(error: unknown): ActionResponse<never> {
  return {
    success: false,
    error: {
      code: error instanceof ProjectManagementError ? error.code : "CONFLICT",
      message:
        error instanceof ProjectManagementError
          ? error.message
          : "Data berubah atau sumber tidak valid. Periksa proyek dan minta preview terbaru.",
    },
  };
}
async function owned(
  tx: Pick<ProjectManagementTx, "query">,
  actor: Actor,
  identity: Identity,
): Promise<{ proposal: ProjectManagementProposal; expiresAt: number }> {
  return readOwnedStoredProposal(
    tx,
    actor,
    identity,
    "proposeProjectManagement",
    projectManagementProposalSchema,
  );
}
function rights(actor: Actor, proposal: ProjectManagementProposal): void {
  if (!actorCan(actor, "use:ai_chat"))
    throw new ProjectManagementError("FORBIDDEN", "Akses chat tidak tersedia.");
  assertProjectManagementRights(actor, proposal.input);
}
async function scopedRights(actor: Actor, proposal: ProjectManagementProposal): Promise<void> {
  rights(actor, proposal);
  await db.transaction(async (tx) => {
    await lockManagedProjectTx(tx, actor, proposal.projectId);
    if (proposal.action === "REALLOCATE_BUDGET") {
      const budget = await tx.query.projectBudgets.findFirst({
        where: eq(projectBudgets.projectId, proposal.projectId),
      });
      if (budget?.status === "APPROVED" && !actorCan(actor, "approve:budget"))
        throw new ProjectManagementError(
          "FORBIDDEN",
          "Realokasi budget yang disetujui memerlukan izin persetujuan budget.",
        );
    }
  });
}
export async function getAiProjectManagementProposal(
  raw: unknown,
): Promise<ActionResponse<ProjectManagementView>> {
  const actor = await resolveActor(),
    identity = projectManagementIdentitySchema.safeParse(raw);
  if (!actor || !actorCan(actor, "use:ai_chat"))
    return failure(new ProjectManagementError("FORBIDDEN", "Akses chat tidak tersedia."));
  if (!identity.success)
    return failure(new ProjectManagementError("VALIDATION_ERROR", "Identitas usulan tidak valid."));
  try {
    const stored = await owned(db, actor, identity.data);
    await scopedRights(actor, stored.proposal);
    const receipt = await db.query.aiProposalConfirmation.findFirst({
      where: and(
        eq(aiProposalConfirmation.userId, actor.userId),
        eq(aiProposalConfirmation.conversationId, identity.data.conversationId),
        eq(aiProposalConfirmation.toolCallId, identity.data.toolCallId),
        eq(aiProposalConfirmation.proposalType, PROJECT_MANAGEMENT_KIND),
      ),
    });
    if (receipt)
      return {
        success: true,
        data: { proposal: stored.proposal, status: "CONFIRMED", resultId: receipt.documentId },
      };
    let status: ProjectManagementView["status"] =
      stored.expiresAt <= Date.now() ? "EXPIRED" : "STALE";
    if (status !== "EXPIRED")
      try {
        const fresh = await db.transaction((tx) =>
          prepareProjectManagementTx(tx, actor, stored.proposal.input),
        );
        if (JSON.stringify(fresh) === JSON.stringify(stored.proposal))
          status = fresh.blockers.length ? "BLOCKED" : "READY";
      } catch (error: unknown) {
        if (error instanceof ProjectManagementError && error.code === "FORBIDDEN") throw error;
      }
    return { success: true, data: { proposal: stored.proposal, status, resultId: null } };
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function confirmAiProjectManagementProposal(
  raw: unknown,
): Promise<ActionResponse<ProjectManagementReceipt>> {
  const actor = await resolveActor(),
    identity = projectManagementIdentitySchema.safeParse(raw);
  if (!actor || !actorCan(actor, "use:ai_chat"))
    return failure(new ProjectManagementError("FORBIDDEN", "Akses chat tidak tersedia."));
  if (!identity.success)
    return failure(
      new ProjectManagementError(
        "VALIDATION_ERROR",
        "Konfirmasi hanya menerima identitas usulan tersimpan.",
      ),
    );
  let projectId: string | null = null;
  try {
    const stored = await owned(db, actor, identity.data);
    projectId = stored.proposal.projectId;
    await scopedRights(actor, stored.proposal);
  } catch (error: unknown) {
    return failure(error);
  }
  const result = await confirmMutation(
    actor,
    identity.data,
    PROJECT_MANAGEMENT_KIND,
    async (tx) => {
      const stored = await owned(tx, actor, identity.data);
      rights(actor, stored.proposal);
      if (stored.expiresAt <= Date.now())
        throw new ProjectManagementError("CONFLICT", "Usulan kedaluwarsa. Minta preview terbaru.");
      const fresh = await prepareProjectManagementTx(tx, actor, stored.proposal.input);
      if (JSON.stringify(fresh) !== JSON.stringify(stored.proposal))
        throw new ProjectManagementError(
          "CONFLICT",
          "Proyek, budget atau referensi berubah sejak preview. Minta preview terbaru.",
        );
      return {
        documentId: await writeProjectManagementTx(tx, actor, fresh),
        result: { action: fresh.action },
      };
    },
    failure,
  );
  if (!result.success) return result;
  if (projectId) revalidateWorkspacePath(`/projects/${projectId}`);
  for (const path of ["/projects", "/approvals", "/ledger"]) revalidateWorkspacePath(path);
  return {
    success: true,
    data: { resultId: result.data.documentId, alreadyConfirmed: result.data.kind === "already" },
  };
}
