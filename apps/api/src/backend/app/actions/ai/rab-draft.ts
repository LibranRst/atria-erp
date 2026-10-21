import { and, eq } from "drizzle-orm";
import { db } from "@backend/db";
import {
  aiConversation,
  aiProposalConfirmation,
  formDraft,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import {
  readOwnedStoredProposal,
  StoredProposalError,
} from "@backend/server/usecases/ai/stored-proposal";
import {
  assertRabScope,
  canPrepareRab,
  rabFailure,
  RabReviewError,
  readRabContext,
} from "@backend/server/usecases/ai/rab-context";
import {
  generateRabFromSelectedSourcesTx,
  lockRabGenerationTx,
} from "@backend/server/usecases/project/rab-generation-writer";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import {
  applyRabReview,
  RAB_DRAFT_KIND,
  rabDraftIdentitySchema,
  rabDraftPatchSchema,
  rabDraftPayloadSchema,
  rabDraftProposalSchema,
  rabDraftSaveSchema,
  type RabDraftPayload,
  type RabDraftProposal,
  type RabDraftReceipt,
  type RabDraftView,
} from "@atria/core/ai/rab-draft";
import type { ActionResponse } from "@atria/core/types/action-response";

type Identity = { readonly conversationId: string; readonly toolCallId: string };
type Owned = {
  readonly source: RabDraftProposal;
  readonly proposal: RabDraftProposal;
  readonly payload: RabDraftPayload;
  readonly row: typeof formDraft.$inferSelect | null;
  readonly expiresAt: number;
  readonly rabEstimateId: string | null;
};
function failure(error: unknown): ActionResponse<never> {
  if (error instanceof StoredProposalError)
    return { success: false, error: { code: "NOT_FOUND", message: error.message } };
  return rabFailure(error);
}
async function loadReview(
  tx: FinanceTransaction,
  actor: Actor,
  identity: Identity,
): Promise<Owned> {
  const [conversation] = await tx
    .select({ id: aiConversation.id })
    .from(aiConversation)
    .where(
      and(
        eq(aiConversation.id, identity.conversationId),
        eq(aiConversation.userId, actor.userId),
        eq(aiConversation.tenantId, INSTANCE_TENANT_ID),
      ),
    )
    .for("update");
  if (!conversation) throw new RabReviewError("NOT_FOUND", "Percakapan tidak ditemukan.");
  const stored = await readOwnedStoredProposal(
    tx,
    actor,
    identity,
    "proposeRabDraft",
    rabDraftProposalSchema,
  );
  await assertRabScope(actor, stored.proposal.projectId, tx);
  const receipt = await tx.query.aiProposalConfirmation.findFirst({
    where: and(
      eq(aiProposalConfirmation.userId, actor.userId),
      eq(aiProposalConfirmation.conversationId, identity.conversationId),
      eq(aiProposalConfirmation.toolCallId, identity.toolCallId),
      eq(aiProposalConfirmation.proposalType, RAB_DRAFT_KIND),
      eq(aiProposalConfirmation.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  const candidates = await tx
    .select()
    .from(formDraft)
    .where(
      and(
        eq(formDraft.tenantId, INSTANCE_TENANT_ID),
        eq(formDraft.ownerUserId, actor.userId),
        eq(formDraft.formType, RAB_DRAFT_KIND),
        eq(formDraft.submissionGroupId, identity.conversationId),
      ),
    )
    .for("update");
  let row: typeof formDraft.$inferSelect | null = null;
  let payload: RabDraftPayload = {
    ...identity,
    title: stored.proposal.title,
    clientNotes: stored.proposal.clientNotes,
    rows: stored.proposal.rows.map((r) => ({
      rowId: r.rowId,
      selected: r.selected,
      clientLabel: r.clientLabel,
      description: r.description,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
    })),
  };
  for (const candidate of candidates) {
    const parsed = rabDraftPayloadSchema.safeParse(candidate.payload);
    if (!parsed.success)
      throw new RabReviewError("CONFLICT", "Draft RAB tidak valid. Minta usulan terbaru.");
    if (parsed.data.toolCallId !== identity.toolCallId) continue;
    if (
      row ||
      parsed.data.conversationId !== identity.conversationId ||
      candidate.projectId !== stored.proposal.projectId
    )
      throw new RabReviewError("CONFLICT", "Identitas draft tidak sesuai.");
    row = candidate;
    payload = parsed.data;
  }
  if (!row && !receipt && stored.expiresAt > Date.now()) {
    const [created] = await tx
      .insert(formDraft)
      .values({
        ownerUserId: actor.userId,
        formType: RAB_DRAFT_KIND,
        projectId: stored.proposal.projectId,
        submissionGroupId: identity.conversationId,
        payload,
        expiresAt: new Date(stored.expiresAt),
      })
      .returning();
    row = created;
  }
  return {
    source: stored.proposal,
    proposal: applyRabReview(stored.proposal, payload),
    payload,
    row,
    expiresAt: Math.min(stored.expiresAt, row?.expiresAt.getTime() ?? stored.expiresAt),
    rabEstimateId: receipt?.documentId ?? null,
  };
}
async function view(tx: FinanceTransaction, actor: Actor, review: Owned): Promise<RabDraftView> {
  const base = {
    proposal: review.proposal,
    draftId: review.row?.id ?? null,
    revision: review.row?.revision ?? 1,
    rabEstimateId: review.rabEstimateId,
  };
  if (review.rabEstimateId) return { ...base, status: "CONFIRMED" };
  if (review.expiresAt <= Date.now()) return { ...base, status: "EXPIRED" };
  if (review.row?.status !== "ACTIVE") return { ...base, status: "STALE" };
  try {
    const current = await readRabContext(actor, review.proposal.projectId, tx);
    return {
      ...base,
      status:
        !current.openDraftId && current.expectedContext === review.source.expectedContext
          ? "READY"
          : "STALE",
    };
  } catch (error: unknown) {
    if (error instanceof RabReviewError && error.code === "FORBIDDEN") throw error;
    return { ...base, status: "STALE" };
  }
}
const denied: ActionResponse<never> = {
  success: false,
  error: { code: "FORBIDDEN", message: "Akses chat, RAP dan pembuatan RAB diperlukan." },
};
export async function getAiRabDraftProposal(input: unknown): Promise<ActionResponse<RabDraftView>> {
  const actor = await resolveActor();
  if (!actor || !canPrepareRab(actor)) return denied;
  const parsed = rabDraftIdentitySchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas usulan RAB tidak valid." },
    };
  try {
    return {
      success: true,
      data: await db.transaction(async (tx) =>
        view(tx, actor, await loadReview(tx, actor, parsed.data)),
      ),
    };
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function patchAiRabDraftProposal(
  input: unknown,
): Promise<ActionResponse<RabDraftView>> {
  const actor = await resolveActor();
  if (!actor || !canPrepareRab(actor)) return denied;
  const parsed = rabDraftPatchSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Periksa judul, label, deskripsi, jumlah dan harga jual.",
      },
    };
  try {
    const result = await db.transaction(async (tx) => {
      const review = await loadReview(tx, actor, parsed.data);
      const current = await view(tx, actor, review);
      if (!review.row || current.status !== "READY")
        throw new RabReviewError("CONFLICT", "Draft belum dapat dikoreksi. Minta usulan terbaru.");
      if (review.row.revision !== parsed.data.expectedRevision)
        throw new RabReviewError(
          "CONFLICT",
          "Draft berubah di tab lain. Muat ulang sebelum menerapkan koreksi.",
        );
      const payload = rabDraftPayloadSchema.parse({
        conversationId: parsed.data.conversationId,
        toolCallId: parsed.data.toolCallId,
        title: parsed.data.title,
        clientNotes: parsed.data.clientNotes,
        rows: parsed.data.rows,
      });
      const proposal = applyRabReview(review.source, payload);
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
      return { ...current, proposal, revision: saved.revision };
    });
    return { success: true, data: result };
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function confirmAiRabDraftProposal(
  input: unknown,
): Promise<ActionResponse<RabDraftReceipt>> {
  const actor = await resolveActor();
  if (!actor || !canPrepareRab(actor)) return denied;
  const parsed = rabDraftSaveSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Konfirmasi hanya menerima identitas dan revisi draft server.",
      },
    };
  let source: RabDraftProposal;
  try {
    source = (
      await readOwnedStoredProposal(
        db,
        actor,
        parsed.data,
        "proposeRabDraft",
        rabDraftProposalSchema,
      )
    ).proposal;
    await assertRabScope(actor, source.projectId);
  } catch (error: unknown) {
    return failure(error);
  }
  const result = await confirmMutation(
    actor,
    parsed.data,
    RAB_DRAFT_KIND,
    async (tx) => {
      const review = await loadReview(tx, actor, parsed.data);
      if (!review.row || review.expiresAt <= Date.now() || review.row.status !== "ACTIVE")
        throw new RabReviewError(
          "CONFLICT",
          "Draft kedaluwarsa atau tidak aktif. Minta usulan terbaru.",
        );
      if (review.row.revision !== parsed.data.expectedRevision)
        throw new RabReviewError(
          "CONFLICT",
          "Revisi draft berubah. Periksa koreksi terbaru sebelum simpan.",
        );
      const selected = review.proposal.rows.filter((row) => row.selected);
      if (!selected.length)
        throw new RabReviewError("VALIDATION_ERROR", "Pilih minimal satu baris untuk RAB.");
      const materialIds = selected
        .filter((r) => r.sourceKind === "MATERIAL")
        .map((r) => r.sourceId);
      const packageIds = selected.filter((r) => r.sourceKind !== "MATERIAL").map((r) => r.sourceId);
      await lockRabGenerationTx(tx, actor, source.projectId, materialIds, packageIds);
      const fresh = await readRabContext(actor, source.projectId, tx);
      if (fresh.openDraftId || fresh.expectedContext !== source.expectedContext)
        throw new RabReviewError(
          "CONFLICT",
          "Sumber, harga atau RAB proyek berubah. Minta preview terbaru.",
        );
      const created = await generateRabFromSelectedSourcesTx(
        tx,
        actor,
        {
          projectId: source.projectId,
          projectRapItemIds: materialIds,
          projectCategoryPlanItemIds: packageIds,
          selectedBaselineManualItemIds: [],
          manualLines: [],
          title: review.proposal.title,
          clientNotes: review.proposal.clientNotes,
        },
        selected,
      );
      await tx
        .update(formDraft)
        .set({ status: "CONSUMED", consumedAt: new Date(), updatedAt: new Date() })
        .where(eq(formDraft.id, review.row.id));
      return { documentId: created.id, result: { id: created.id } };
    },
    failure,
  );
  if (!result.success) return result;
  revalidateWorkspacePath(`/projects/${source.projectId}`);
  revalidateWorkspacePath("/projects");
  return {
    success: true,
    data: {
      rabEstimateId: result.data.documentId,
      alreadyConfirmed: result.data.kind === "already",
    },
  };
}
