import { and, eq } from "drizzle-orm";
import { db } from "@backend/db";
import { aiProposalConfirmation } from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { readOwnedStoredProposal } from "@backend/server/usecases/ai/stored-proposal";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import { prepareAdministrationProposal } from "@backend/server/usecases/ai/administration-context";
import {
  lockAdministrationTx,
  writeAdministrationChangeTx,
  assertAdministrationRights,
  AdministrationChangeError,
  administrationChangeFailure,
} from "@backend/server/usecases/administration/change-writer";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import {
  ADMINISTRATION_KIND,
  administrationIdentitySchema,
  administrationProposalSchema,
  type AdministrationProposal,
  type AdministrationView,
} from "@atria/core/ai/administration";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { z } from "zod";
type Identity = z.infer<typeof administrationIdentitySchema>;
async function owned(
  reader: Pick<FinanceTransaction, "query">,
  actor: Actor,
  identity: Identity,
): Promise<{ proposal: AdministrationProposal; expiresAt: number }> {
  for (const [name, action] of [
    ["proposeStaffChanges", "STAFF_CHANGES"],
    ["proposeRoleDetails", "ROLE_DETAILS"],
    ["proposeRoleDeletion", "ROLE_DELETE"],
  ] as const) {
    try {
      const found = await readOwnedStoredProposal(
        reader,
        actor,
        identity,
        name,
        administrationProposalSchema,
      );
      if (found.proposal.input.action === action) return found;
    } catch {
      /* Exact registered contracts only. */
    }
  }
  throw new AdministrationChangeError(
    "NOT_FOUND",
    "Usulan belum tersimpan atau bukan milik percakapan Anda.",
  );
}
export async function getAiAdministrationProposal(
  raw: unknown,
): Promise<ActionResponse<AdministrationView>> {
  const actor = await resolveActor(),
    id = administrationIdentitySchema.safeParse(raw);
  if (!actor || !actorCan(actor, "use:ai_chat"))
    return { success: false, error: { code: "FORBIDDEN", message: "Akses chat tidak tersedia." } };
  if (!id.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas usulan tidak valid." },
    };
  try {
    const stored = await owned(db, actor, id.data);
    assertAdministrationRights(actor, stored.proposal.input, "AI_PROPOSAL");
    const receipt = await db.query.aiProposalConfirmation.findFirst({
      where: and(
        eq(aiProposalConfirmation.userId, actor.userId),
        eq(aiProposalConfirmation.conversationId, id.data.conversationId),
        eq(aiProposalConfirmation.toolCallId, id.data.toolCallId),
        eq(aiProposalConfirmation.proposalType, ADMINISTRATION_KIND),
      ),
    });
    if (receipt)
      return {
        success: true,
        data: { proposal: stored.proposal, status: "CONFIRMED", resultId: receipt.documentId },
      };
    let status: AdministrationView["status"] = stored.expiresAt <= Date.now() ? "EXPIRED" : "STALE";
    if (status !== "EXPIRED")
      try {
        if (
          JSON.stringify(await prepareAdministrationProposal(actor, stored.proposal.input)) ===
          JSON.stringify(stored.proposal)
        )
          status = "READY";
      } catch (error: unknown) {
        if (error instanceof AdministrationChangeError && error.code !== "VALIDATION_ERROR")
          throw error;
      }
    return { success: true, data: { proposal: stored.proposal, status, resultId: null } };
  } catch (error: unknown) {
    return administrationChangeFailure(error);
  }
}
export async function confirmAiAdministrationProposal(
  raw: unknown,
): Promise<ActionResponse<{ readonly resultId: string; readonly alreadyConfirmed: boolean }>> {
  const actor = await resolveActor(),
    id = administrationIdentitySchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!id.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Konfirmasi hanya menerima identitas usulan tersimpan.",
      },
    };
  try {
    const initial = await owned(db, actor, id.data);
    assertAdministrationRights(actor, initial.proposal.input, "AI_PROPOSAL");
  } catch (error: unknown) {
    return administrationChangeFailure(error);
  }
  const outcome = await confirmMutation(
    actor,
    id.data,
    ADMINISTRATION_KIND,
    async (tx) => {
      const stored = await owned(tx, actor, id.data);
      assertAdministrationRights(actor, stored.proposal.input, "AI_PROPOSAL");
      if (stored.expiresAt <= Date.now())
        throw new AdministrationChangeError(
          "CONFLICT",
          "Usulan kedaluwarsa. Minta preview terbaru.",
        );
      await lockAdministrationTx(tx);
      const fresh = await prepareAdministrationProposal(actor, stored.proposal.input, tx);
      if (JSON.stringify(fresh) !== JSON.stringify(stored.proposal))
        throw new AdministrationChangeError(
          "CONFLICT",
          "Data atau dampak akses berubah. Minta preview terbaru sebelum menyimpan.",
        );
      const documentId = await writeAdministrationChangeTx(tx, actor, stored.proposal.input);
      return { documentId, result: { action: stored.proposal.input.action } };
    },
    administrationChangeFailure,
  );
  if (!outcome.success) return outcome;
  revalidateWorkspacePath("/settings");
  revalidateWorkspacePath("/profile");
  return {
    success: true,
    data: { resultId: outcome.data.documentId, alreadyConfirmed: outcome.data.kind === "already" },
  };
}
