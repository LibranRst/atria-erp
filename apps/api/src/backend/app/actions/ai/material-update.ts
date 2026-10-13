import {
  readOwnedStoredProposal,
  StoredProposalError,
} from "@backend/server/usecases/ai/stored-proposal";
import { db } from "@backend/db";
import { aiProposalConfirmation, INSTANCE_TENANT_ID } from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import {
  MaterialEditError,
  materialEditFailure,
  setMaterialActiveTx,
  updateMaterialMasterTx,
} from "@backend/server/usecases/material/master-editor";
import {
  readMaterialEditTarget,
  readMaterialEditReferences,
} from "@backend/server/usecases/material/master-edit-reader";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import {
  MATERIAL_UPDATE_PROPOSAL,
  isMaterialStatusOnly,
  materialUpdateIdentitySchema,
  materialUpdateProposalSchema,
  materialUpdateDiff,
  type MaterialUpdateProposal,
  type MaterialUpdateView,
  type MaterialUpdateReceipt,
} from "@atria/core/ai/material-update";
import type { ActionResponse } from "@atria/core/types/action-response";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

type Identity = z.infer<typeof materialUpdateIdentitySchema>;
const accessDenied: ActionResponse<never> = {
  success: false,
  error: { code: "FORBIDDEN", message: "Akses chat dan pengaturan Material Master diperlukan." },
};
async function ownedProposal(
  connection: Pick<FinanceTransaction, "query">,
  actor: Actor,
  identity: Identity,
): Promise<{ proposal: MaterialUpdateProposal; expiresAt: number }> {
  try {
    return await readOwnedStoredProposal(
      connection,
      actor,
      identity,
      "proposeUpdateMaterial",
      materialUpdateProposalSchema,
    );
  } catch (error: unknown) {
    if (error instanceof StoredProposalError)
      throw new MaterialEditError("NOT_FOUND", error.message);
    throw error;
  }
}
export async function getAiMaterialUpdateProposal(
  input: unknown,
): Promise<ActionResponse<MaterialUpdateView>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!actorCan(actor, "use:ai_chat") || !actorCan(actor, "manage:material_settings"))
    return accessDenied;
  const identity = materialUpdateIdentitySchema.safeParse(input);
  if (!identity.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas usulan tidak valid." },
    };
  try {
    const owned = await ownedProposal(db, actor, identity.data);
    const confirmation = await db.query.aiProposalConfirmation.findFirst({
      where: and(
        eq(aiProposalConfirmation.tenantId, INSTANCE_TENANT_ID),
        eq(aiProposalConfirmation.toolCallId, identity.data.toolCallId),
        eq(aiProposalConfirmation.conversationId, identity.data.conversationId),
        eq(aiProposalConfirmation.userId, actor.userId),
        eq(aiProposalConfirmation.proposalType, MATERIAL_UPDATE_PROPOSAL),
      ),
    });
    if (confirmation)
      return {
        success: true,
        data: {
          proposal: owned.proposal,
          status: "CONFIRMED",
          confirmedAt: confirmation.createdAt.toISOString(),
        },
      };
    if (owned.expiresAt <= Date.now())
      return {
        success: true,
        data: { proposal: owned.proposal, status: "EXPIRED", confirmedAt: null },
      };
    const current = await readMaterialEditTarget(owned.proposal.materialId);
    if (current.updatedAt === owned.proposal.expectedUpdatedAt) {
      const refs = await readMaterialEditReferences(
        owned.proposal.after.categoryId,
        owned.proposal.after.defaultVendorId,
      );
      if (
        owned.proposal.after.defaultVendorId &&
        owned.proposal.after.defaultVendorId !== owned.proposal.before.defaultVendorId &&
        !refs.vendorIsActive
      )
        throw new MaterialEditError(
          "VALIDATION_ERROR",
          "Vendor usulan sudah nonaktif. Pilih vendor aktif atau tanpa vendor melalui koreksi chat.",
        );
    }
    return {
      success: true,
      data: {
        proposal: owned.proposal,
        status: current.updatedAt === owned.proposal.expectedUpdatedAt ? "READY" : "STALE",
        confirmedAt: null,
      },
    };
  } catch (error: unknown) {
    return materialEditFailure(error);
  }
}
export async function confirmAiMaterialUpdateProposal(
  input: unknown,
): Promise<ActionResponse<MaterialUpdateReceipt>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!actorCan(actor, "use:ai_chat") || !actorCan(actor, "manage:material_settings"))
    return accessDenied;
  const identity = materialUpdateIdentitySchema.safeParse(input);
  if (!identity.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Identitas usulan tidak valid. Nilai perubahan harus berasal dari usulan server.",
      },
    };
  const result = await confirmMutation(
    actor,
    identity.data,
    MATERIAL_UPDATE_PROPOSAL,
    async (tx) => {
      const owned = await ownedProposal(tx, actor, identity.data);
      if (owned.expiresAt <= Date.now())
        throw new MaterialEditError(
          "CONFLICT",
          "Usulan sudah kedaluwarsa. Minta asisten membuat usulan terbaru.",
        );
      const proposal = owned.proposal;
      if (!materialUpdateDiff(proposal.before, proposal.after).length)
        throw new MaterialEditError("VALIDATION_ERROR", "Usulan tidak berisi perubahan.");
      const options = { expectedUpdatedAt: proposal.expectedUpdatedAt, source: identity.data };
      const material = isMaterialStatusOnly(proposal)
        ? await setMaterialActiveTx(
            tx,
            actor.userId,
            { materialId: proposal.materialId, isActive: proposal.after.isActive },
            options,
          )
        : await updateMaterialMasterTx(
            tx,
            actor.userId,
            { materialId: proposal.materialId, ...proposal.after },
            options,
          );
      return { documentId: material.id, result: { id: material.id } };
    },
    materialEditFailure,
  );
  if (!result.success) return result;
  revalidateWorkspacePath("/settings");
  revalidateWorkspacePath("/materials");
  return {
    success: true,
    data: { materialId: result.data.documentId, alreadyConfirmed: result.data.kind === "already" },
  };
}
