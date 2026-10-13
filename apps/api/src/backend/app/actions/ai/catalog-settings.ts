import { and, eq } from "drizzle-orm";
import { db } from "@backend/db";
import { aiProposalConfirmation } from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { readOwnedStoredProposal } from "@backend/server/usecases/ai/stored-proposal";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import {
  prepareCatalogSettingsTx,
  writeCatalogSettingsTx,
  assertCatalogRights,
  CatalogSettingsError,
  type CatalogTx,
} from "@backend/server/usecases/settings/catalog-settings-writer";
import {
  CATALOG_SETTINGS_KIND,
  catalogSettingsIdentitySchema,
  catalogSettingsProposalSchema,
  type CatalogSettingsView,
  type CatalogSettingsReceipt,
  type CatalogSettingsProposal,
} from "@atria/core/ai/catalog-settings";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import type { z } from "zod";
type Identity = z.infer<typeof catalogSettingsIdentitySchema>;
function failure(error: unknown): ActionResponse<never> {
  return {
    success: false,
    error: {
      code: error instanceof CatalogSettingsError ? error.code : "CONFLICT",
      message:
        error instanceof CatalogSettingsError
          ? error.message
          : "Data berubah atau sumber tidak valid. Periksa pengaturan dan minta preview terbaru.",
    },
  };
}
async function owned(
  tx: Pick<CatalogTx, "query">,
  actor: Actor,
  identity: Identity,
): Promise<{ proposal: CatalogSettingsProposal; expiresAt: number }> {
  return readOwnedStoredProposal(
    tx,
    actor,
    identity,
    "proposeCatalogSettings",
    catalogSettingsProposalSchema,
  );
}
function rights(actor: Actor, proposal: CatalogSettingsProposal): void {
  if (!actorCan(actor, "use:ai_chat"))
    throw new CatalogSettingsError("FORBIDDEN", "Akses chat tidak tersedia.");
  assertCatalogRights(actor, proposal.input);
}
export async function getAiCatalogSettingsProposal(
  raw: unknown,
): Promise<ActionResponse<CatalogSettingsView>> {
  const actor = await resolveActor(),
    identity = catalogSettingsIdentitySchema.safeParse(raw);
  if (!actor || !actorCan(actor, "use:ai_chat"))
    return failure(new CatalogSettingsError("FORBIDDEN", "Akses chat tidak tersedia."));
  if (!identity.success)
    return failure(new CatalogSettingsError("VALIDATION_ERROR", "Identitas usulan tidak valid."));
  try {
    const stored = await owned(db, actor, identity.data);
    rights(actor, stored.proposal);
    const receipt = await db.query.aiProposalConfirmation.findFirst({
      where: and(
        eq(aiProposalConfirmation.userId, actor.userId),
        eq(aiProposalConfirmation.conversationId, identity.data.conversationId),
        eq(aiProposalConfirmation.toolCallId, identity.data.toolCallId),
        eq(aiProposalConfirmation.proposalType, CATALOG_SETTINGS_KIND),
      ),
    });
    if (receipt)
      return {
        success: true,
        data: { proposal: stored.proposal, status: "CONFIRMED", resultId: receipt.documentId },
      };
    let status: CatalogSettingsView["status"] =
      stored.expiresAt <= Date.now() ? "EXPIRED" : "STALE";
    if (status !== "EXPIRED")
      try {
        const fresh = await db.transaction((tx) =>
          prepareCatalogSettingsTx(tx, actor, stored.proposal.input),
        );
        if (JSON.stringify(fresh) === JSON.stringify(stored.proposal)) status = "READY";
      } catch (error: unknown) {
        if (error instanceof CatalogSettingsError && error.code === "FORBIDDEN") throw error;
      }
    return { success: true, data: { proposal: stored.proposal, status, resultId: null } };
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function confirmAiCatalogSettingsProposal(
  raw: unknown,
): Promise<ActionResponse<CatalogSettingsReceipt>> {
  const actor = await resolveActor(),
    identity = catalogSettingsIdentitySchema.safeParse(raw);
  if (!actor || !actorCan(actor, "use:ai_chat"))
    return failure(new CatalogSettingsError("FORBIDDEN", "Akses chat tidak tersedia."));
  if (!identity.success)
    return failure(
      new CatalogSettingsError(
        "VALIDATION_ERROR",
        "Konfirmasi hanya menerima identitas usulan tersimpan.",
      ),
    );
  try {
    rights(actor, (await owned(db, actor, identity.data)).proposal);
  } catch (error: unknown) {
    return failure(error);
  }
  const result = await confirmMutation(
    actor,
    identity.data,
    CATALOG_SETTINGS_KIND,
    async (tx) => {
      const stored = await owned(tx, actor, identity.data);
      rights(actor, stored.proposal);
      if (stored.expiresAt <= Date.now())
        throw new CatalogSettingsError("CONFLICT", "Usulan kedaluwarsa. Minta preview terbaru.");
      const fresh = await prepareCatalogSettingsTx(tx, actor, stored.proposal.input);
      if (JSON.stringify(fresh) !== JSON.stringify(stored.proposal))
        throw new CatalogSettingsError(
          "CONFLICT",
          "Pengaturan atau referensi berubah sejak preview. Minta preview terbaru.",
        );
      return {
        documentId: await writeCatalogSettingsTx(tx, actor, fresh.input),
        result: { action: fresh.action },
      };
    },
    failure,
  );
  if (!result.success) return result;
  for (const path of ["/settings", "/settings/library", "/materials"])
    revalidateWorkspacePath(path);
  return {
    success: true,
    data: { resultId: result.data.documentId, alreadyConfirmed: result.data.kind === "already" },
  };
}
