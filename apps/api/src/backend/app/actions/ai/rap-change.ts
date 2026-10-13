import { db } from "@backend/db";
import {
  aiProposalConfirmation,
  expenseCategory,
  inventoryLocation,
  materialInventory,
  projectBudgetCategory,
  projectBudgets,
  projectRapItem,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import { readOwnedStoredProposal } from "@backend/server/usecases/ai/stored-proposal";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import {
  canPrepareRap,
  RapDraftError,
  rapDraftFailure,
} from "@backend/server/usecases/material/rap-context";
import {
  assertRapChangeScope,
  readRapChangeContext,
  buildRapChangeProposal,
  rapProposalChangeInput,
} from "@backend/server/usecases/material/rap-change-reader";
import {
  lockRapProjectTx,
  lockProjectRapTx,
  lockRapMaterialReferencesTx,
  updateProjectRapItemTx,
  deleteProjectRapItemTx,
} from "@backend/server/usecases/material/rap-writer";
import {
  RAP_CHANGE_KIND,
  rapChangeIdentitySchema,
  rapChangeProposalSchema,
  type RapChangeProposal,
  type RapChangeView,
  type RapChangeReceipt,
} from "@atria/core/ai/rap-change";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import type { ActionResponse } from "@atria/core/types/action-response";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

type Identity = z.infer<typeof rapChangeIdentitySchema>;
const denied: ActionResponse<never> = {
  success: false,
  error: { code: "FORBIDDEN", message: "Akses chat, edit RAP, budget dan material diperlukan." },
};
async function owned(
  connection: Pick<FinanceTransaction, "query">,
  actor: Actor,
  identity: Identity,
): Promise<{ proposal: RapChangeProposal; expiresAt: number }> {
  try {
    return await readOwnedStoredProposal(
      connection,
      actor,
      identity,
      "proposeRapMaterialChanges",
      rapChangeProposalSchema,
    );
  } catch {
    throw new RapDraftError("NOT_FOUND", "Usulan tersimpan tidak ditemukan pada percakapan Anda.");
  }
}
export async function getAiRapChangeProposal(
  input: unknown,
): Promise<ActionResponse<RapChangeView>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!canPrepareRap(actor)) return denied;
  const identity = rapChangeIdentitySchema.safeParse(input);
  if (!identity.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas usulan tidak valid." },
    };
  try {
    const stored = await owned(db, actor, identity.data);
    await assertRapChangeScope(actor, stored.proposal.projectId);
    const receipt = await db.query.aiProposalConfirmation.findFirst({
      where: and(
        eq(aiProposalConfirmation.tenantId, INSTANCE_TENANT_ID),
        eq(aiProposalConfirmation.userId, actor.userId),
        eq(aiProposalConfirmation.conversationId, identity.data.conversationId),
        eq(aiProposalConfirmation.toolCallId, identity.data.toolCallId),
        eq(aiProposalConfirmation.proposalType, RAP_CHANGE_KIND),
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
    let status: RapChangeView["status"] = "STALE";
    try {
      const context = await readRapChangeContext(actor, rapProposalChangeInput(stored.proposal));
      status =
        context.contextVersion === stored.proposal.expectedContext &&
        context.rap?.id === stored.proposal.projectRapId
          ? "READY"
          : "STALE";
    } catch (error: unknown) {
      if (error instanceof RapDraftError && error.code === "FORBIDDEN") throw error;
    }
    return { success: true, data: { proposal: stored.proposal, status, confirmedAt: null } };
  } catch (error: unknown) {
    return rapDraftFailure(error);
  }
}
export async function confirmAiRapChangeProposal(
  input: unknown,
): Promise<ActionResponse<RapChangeReceipt>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!canPrepareRap(actor)) return denied;
  const identity = rapChangeIdentitySchema.safeParse(input);
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
    await assertRapChangeScope(actor, stored.proposal.projectId);
  } catch (error: unknown) {
    return rapDraftFailure(error);
  }
  const result = await confirmMutation(
    actor,
    identity.data,
    RAP_CHANGE_KIND,
    async (tx) => {
      const fresh = await owned(tx, actor, identity.data);
      const proposal = fresh.proposal;
      if (fresh.expiresAt <= Date.now())
        throw new RapDraftError("CONFLICT", "Usulan kedaluwarsa. Minta usulan terbaru.");
      await lockRapProjectTx(tx, actor, proposal.projectId, "update:rap");
      await lockProjectRapTx(tx, actor, proposal.projectRapId);
      const [budget] = await tx
        .select({ id: projectBudgets.id })
        .from(projectBudgets)
        .where(eq(projectBudgets.projectId, proposal.projectId))
        .for("share");
      if (!budget) throw new RapDraftError("CONFLICT", "Budget proyek berubah sejak preview.");
      const categories = await tx
        .select()
        .from(projectBudgetCategory)
        .where(eq(projectBudgetCategory.projectBudgetId, budget.id))
        .orderBy(asc(projectBudgetCategory.id))
        .for("share");
      const categoryIds = categories.map((row) => row.expenseCategoryId);
      if (categoryIds.length)
        await tx
          .select({ id: expenseCategory.id })
          .from(expenseCategory)
          .where(inArray(expenseCategory.id, categoryIds))
          .orderBy(asc(expenseCategory.id))
          .for("share");
      const materialIds = [
        ...new Set(
          proposal.rows
            .filter((row) => row.action === "UPDATE")
            .flatMap((row) =>
              [row.before.materialId, row.after?.materialId].filter((id): id is string =>
                Boolean(id),
              ),
            ),
        ),
      ].sort();
      await lockRapMaterialReferencesTx(tx, materialIds);
      if (materialIds.length) {
        const inventories = await tx
          .select({ locationId: materialInventory.locationId })
          .from(materialInventory)
          .where(inArray(materialInventory.materialId, materialIds))
          .orderBy(asc(materialInventory.id))
          .for("share");
        const locations = [...new Set(inventories.map((row) => row.locationId))].sort();
        if (locations.length)
          await tx
            .select({ id: inventoryLocation.id })
            .from(inventoryLocation)
            .where(inArray(inventoryLocation.id, locations))
            .orderBy(asc(inventoryLocation.id))
            .for("share");
      }
      const context = await readRapChangeContext(actor, rapProposalChangeInput(proposal), tx);
      if (
        context.contextVersion !== proposal.expectedContext ||
        context.rap?.id !== proposal.projectRapId
      )
        throw new RapDraftError(
          "CONFLICT",
          "Data proyek, RAP, budget atau referensi berubah sejak preview. Minta usulan terbaru.",
        );
      const rebuilt = buildRapChangeProposal(rapProposalChangeInput(proposal), context);
      if (
        JSON.stringify(rebuilt.rows) !== JSON.stringify(proposal.rows) ||
        JSON.stringify(rebuilt.budget) !== JSON.stringify(proposal.budget)
      )
        throw new RapDraftError("CONFLICT", "Isi preview tidak cocok dengan data saat ini.");
      const itemIds = proposal.rows.map((row) => row.before.itemId).sort();
      await tx
        .select({ id: projectRapItem.id })
        .from(projectRapItem)
        .where(inArray(projectRapItem.id, itemIds))
        .orderBy(asc(projectRapItem.id))
        .for("update");
      for (const row of [...proposal.rows].sort((a, b) =>
        a.before.itemId.localeCompare(b.before.itemId),
      )) {
        if (row.action === "DELETE") await deleteProjectRapItemTx(tx, actor, row.before.itemId);
        else {
          const current = context.rap?.items.find((item) => item.id === row.before.itemId);
          if (!current || !row.after) throw new RapDraftError("CONFLICT", "Item RAP berubah.");
          await updateProjectRapItemTx(tx, actor, {
            projectRapItemId: current.id,
            materialId: row.after.materialId,
            name: row.after.name,
            unit: row.after.unit,
            description: row.after.description,
            internalNote: row.after.internalNote,
            source: z
              .enum(["STOCK", "PURCHASE", "STOCK_AND_PURCHASE", "VENDOR"])
              .parse(row.after.source),
            area: row.after.area,
            requiredQuantity: row.after.requiredQuantity,
            bufferQuantity: row.after.bufferQuantity,
            estimatedUnitCost: row.after.estimatedUnitCost,
          });
        }
      }
      return { documentId: proposal.projectRapId, result: { id: proposal.projectRapId } };
    },
    rapDraftFailure,
  );
  if (!result.success) return result;
  revalidateWorkspacePath(`/projects/${stored.proposal.projectId}`);
  revalidateWorkspacePath("/materials");
  return {
    success: true,
    data: {
      projectRapId: result.data.documentId,
      updatedIds: stored.proposal.rows
        .filter((row) => row.action === "UPDATE")
        .map((row) => row.before.itemId),
      deletedIds: stored.proposal.rows
        .filter((row) => row.action === "DELETE")
        .map((row) => row.before.itemId),
      alreadyConfirmed: result.data.kind === "already",
    },
  };
}
