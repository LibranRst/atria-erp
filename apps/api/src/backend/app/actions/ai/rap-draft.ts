import {
  loadOwnedRapReview,
  rapReviewView,
  type OwnedRapReview,
} from "@backend/server/usecases/ai/rap-review-draft";
import { applyRapDraftPatches } from "@atria/core/ai/rap-review";
import { db } from "@backend/db";
import {
  formDraft,
  expenseCategory,
  inventoryLocation,
  materialInventory,
  materialMaster,
  projectBudgetCategory,
  projectBudgets,
} from "@backend/db/schema";
import { resolveActor } from "@backend/server/actor";
import {
  canPrepareRap,
  readRapPlanningContext,
  RapDraftError,
  rapDraftFailure,
} from "@backend/server/usecases/material/rap-context";
import {
  addProjectRapItemsTx,
  createProjectRapTx,
  lockProjectRapTx,
  lockRapProjectTx,
} from "@backend/server/usecases/material/rap-writer";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import { StoredProposalError } from "@backend/server/usecases/ai/stored-proposal";
import {
  rapDraftIdentitySchema,
  rapDraftPatchSchema,
  rapDraftSaveSchema,
  type RapDraftView,
  type RapDraftReceipt,
  type RapDraftRowPatch,
  type RapDraftProposal,
} from "@atria/core/ai/rap-draft";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import { asc, eq, inArray } from "drizzle-orm";

function failure(error: unknown): ActionResponse<never> {
  if (error instanceof StoredProposalError)
    return { success: false, error: { code: "NOT_FOUND", message: error.message } };
  return rapDraftFailure(error);
}
export async function getAiRapDraftProposal(input: unknown): Promise<ActionResponse<RapDraftView>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!canPrepareRap(actor))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses draft RAP dan budget Material diperlukan." },
    };
  const identity = rapDraftIdentitySchema.safeParse(input);
  if (!identity.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas usulan RAP tidak valid." },
    };
  try {
    const data = await db.transaction(async (tx) =>
      rapReviewView(tx, actor, await loadOwnedRapReview(tx, actor, identity.data)),
    );
    return { success: true, data };
  } catch (error: unknown) {
    return failure(error);
  }
}

export async function patchAiRapDraftProposal(
  input: unknown,
): Promise<ActionResponse<RapDraftView>> {
  const actor = await resolveActor();
  if (!actor || !canPrepareRap(actor))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses draft RAP dan budget Material diperlukan." },
    };
  const parsed = rapDraftPatchSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Periksa area, jumlah, buffer dan harga koreksi.",
      },
    };
  try {
    const data = await db.transaction(async (tx) => {
      const review = await loadOwnedRapReview(tx, actor, parsed.data);
      const current = await rapReviewView(tx, actor, review);
      if (!review.row || current.status !== "READY")
        throw new RapDraftError(
          "CONFLICT",
          "Draft tidak dapat dikoreksi. Periksa status atau minta usulan terbaru.",
        );
      if (review.row.revision !== parsed.data.expectedRevision)
        throw new RapDraftError(
          "CONFLICT",
          "Draft berubah di tab lain. Muat draft terbaru sebelum menerapkan koreksi.",
        );
      const corrections = new Map<string, RapDraftRowPatch>(
        review.payload.rows.map((row) => [row.rowId, row]),
      );
      if (new Set(parsed.data.rows.map((row) => row.rowId)).size !== parsed.data.rows.length)
        throw new RapDraftError("VALIDATION_ERROR", "Baris koreksi berulang.");
      for (const patch of parsed.data.rows) {
        if (!review.source.rows.some((row) => row.rowId === patch.rowId))
          throw new RapDraftError("VALIDATION_ERROR", "Baris koreksi bukan bagian dari draft ini.");
        corrections.set(patch.rowId, patch);
      }
      let proposal: RapDraftProposal;
      try {
        proposal = applyRapDraftPatches(review.source, [...corrections.values()]);
      } catch (error: unknown) {
        throw new RapDraftError(
          "VALIDATION_ERROR",
          error instanceof Error ? error.message : "Koreksi belum valid.",
        );
      }
      const payload = { ...review.payload, rows: [...corrections.values()] };
      const [saved] = await tx
        .update(formDraft)
        .set({
          payload,
          revision: review.row.revision + 1,
          lastSavedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(formDraft.id, review.row.id))
        .returning();
      return { ...current, proposal, draftId: saved.id, revision: saved.revision };
    });
    return { success: true, data };
  } catch (error: unknown) {
    return failure(error);
  }
}

export async function confirmAiRapDraftProposal(
  input: unknown,
): Promise<ActionResponse<RapDraftReceipt>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!canPrepareRap(actor))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses draft RAP dan budget Material diperlukan." },
    };
  const identity = rapDraftSaveSchema.safeParse(input);
  if (!identity.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Konfirmasi hanya menerima identitas usulan server.",
      },
    };
  let reviewed: OwnedRapReview;
  try {
    reviewed = await db.transaction((tx) => loadOwnedRapReview(tx, actor, identity.data));
  } catch (error: unknown) {
    return failure(error);
  }
  let affectedProject: string | null = null;
  const result = await confirmMutation(
    actor,
    identity.data,
    "RAP_MATERIAL_DRAFT",
    async (tx) => {
      const stored = await loadOwnedRapReview(tx, actor, identity.data);
      const proposal = stored.proposal;
      affectedProject = proposal.projectId;
      if (stored.expiresAt <= Date.now())
        throw new RapDraftError("CONFLICT", "Usulan RAP sudah kedaluwarsa. Minta usulan terbaru.");
      if (!stored.row || stored.row.status !== "ACTIVE")
        throw new RapDraftError("CONFLICT", "Draft tidak tersedia untuk disimpan.");
      if ((identity.data.expectedRevision ?? 1) !== stored.row.revision)
        throw new RapDraftError(
          "CONFLICT",
          "Koreksi draft berubah. Muat dan periksa versi terbaru sebelum menyimpan.",
        );
      await lockRapProjectTx(tx, actor, proposal.projectId, "update:rap");
      if (proposal.projectRapId) await lockProjectRapTx(tx, actor, proposal.projectRapId);
      await tx
        .select({ id: projectBudgets.id })
        .from(projectBudgets)
        .where(eq(projectBudgets.projectId, proposal.projectId))
        .for("share");
      await tx
        .select({ id: projectBudgetCategory.id })
        .from(projectBudgetCategory)
        .where(eq(projectBudgetCategory.id, proposal.budget.categoryId))
        .for("share");
      const ids = [...new Set(proposal.rows.map((row) => row.materialId))].sort();
      await tx
        .select({ id: materialMaster.id })
        .from(materialMaster)
        .where(inArray(materialMaster.id, ids))
        .orderBy(asc(materialMaster.id))
        .for("share");
      const inventory = await tx
        .select({ locationId: materialInventory.locationId })
        .from(materialInventory)
        .where(inArray(materialInventory.materialId, ids))
        .orderBy(asc(materialInventory.id))
        .for("share");
      const locations = [...new Set(inventory.map((row) => row.locationId))].sort();
      if (locations.length)
        await tx
          .select({ id: inventoryLocation.id })
          .from(inventoryLocation)
          .where(inArray(inventoryLocation.id, locations))
          .orderBy(asc(inventoryLocation.id))
          .for("share");
      // Protect the displayed category name while the reviewed proposal commits.
      const category = await tx.query.projectBudgetCategory.findFirst({
        where: eq(projectBudgetCategory.id, proposal.budget.categoryId),
      });
      if (category)
        await tx
          .select({ id: expenseCategory.id })
          .from(expenseCategory)
          .where(eq(expenseCategory.id, category.expenseCategoryId))
          .for("share");
      const current = await readRapPlanningContext(actor, proposal.projectId, ids, tx);
      if (
        current.contextVersion !== proposal.expectedContext ||
        (current.rap?.id ?? null) !== proposal.projectRapId
      )
        throw new RapDraftError(
          "CONFLICT",
          "Proyek, RAP, budget atau referensi material berubah sejak review. Minta usulan terbaru.",
        );
      const rap =
        current.rap ??
        (await createProjectRapTx(tx, actor, {
          projectId: proposal.projectId,
          notes: proposal.notes,
        }));
      const rows = await addProjectRapItemsTx(
        tx,
        actor,
        rap.id,
        proposal.rows.map((row) => ({
          projectRapId: rap.id,
          materialId: row.materialId,
          area: row.area,
          name: row.name,
          description: row.description,
          requiredQuantity: row.requiredQuantity,
          bufferQuantity: row.bufferQuantity,
          unit: row.unit,
          estimatedUnitCost: row.estimatedUnitCost,
          source: row.source,
          internalNote: row.internalNote,
        })),
        proposal.rows.map((row) => row.rowId),
      );
      await tx
        .update(formDraft)
        .set({ status: "CONSUMED", consumedAt: new Date(), updatedAt: new Date() })
        .where(eq(formDraft.id, stored.row.id));
      return { documentId: rap.id, result: rows.map((row) => row.id) };
    },
    failure,
  );
  if (!result.success) return result;
  if (affectedProject) revalidateWorkspacePath(`/projects/${affectedProject}`);
  return {
    success: true,
    data: {
      projectRapId: result.data.documentId,
      itemIds: reviewed.proposal.rows.map((row) => row.rowId),
      alreadyConfirmed: result.data.kind === "already",
    },
  };
}
