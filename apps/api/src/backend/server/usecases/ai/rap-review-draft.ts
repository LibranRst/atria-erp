import {
  aiConversation,
  aiProposalConfirmation,
  formDraft,
  INSTANCE_TENANT_ID,
  project,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import { readOwnedStoredProposal } from "./stored-proposal";
import { RapDraftError, readRapPlanningContext } from "../material/rap-context";
import {
  rapDraftProposalSchema,
  rapReviewPayloadSchema,
  type RapDraftProposal,
  type RapDraftView,
  type RapReviewPayload,
} from "@atria/core/ai/rap-draft";
import { applyRapDraftPatches } from "@atria/core/ai/rap-review";
import { and, eq } from "drizzle-orm";

export type RapReviewIdentity = { readonly conversationId: string; readonly toolCallId: string };
export type OwnedRapReview = {
  readonly source: RapDraftProposal;
  readonly proposal: RapDraftProposal;
  readonly payload: RapReviewPayload;
  readonly row: typeof formDraft.$inferSelect | null;
  readonly expiresAt: number;
  readonly confirmedAt: string | null;
};

/** Conversation → draft is the same lock order used by edit and business confirmation. */
export async function loadOwnedRapReview(
  tx: FinanceTransaction,
  actor: Actor,
  identity: RapReviewIdentity,
): Promise<OwnedRapReview> {
  const [conversation] = await tx
    .select({ id: aiConversation.id })
    .from(aiConversation)
    .where(
      and(
        eq(aiConversation.id, identity.conversationId),
        eq(aiConversation.tenantId, INSTANCE_TENANT_ID),
        eq(aiConversation.userId, actor.userId),
      ),
    )
    .for("update");
  if (!conversation) throw new RapDraftError("NOT_FOUND", "Percakapan tidak ditemukan.");
  const stored = await readOwnedStoredProposal(
    tx,
    actor,
    identity,
    "proposeRapMaterialDraft",
    rapDraftProposalSchema,
  );
  const accessible = await tx.query.project.findFirst({
    where: and(
      eq(project.id, stored.proposal.projectId),
      eq(project.tenantId, INSTANCE_TENANT_ID),
      actor.dataScope === "ASSIGNED" ? eq(project.projectManagerId, actor.userId) : undefined,
    ),
    columns: { id: true },
  });
  if (!accessible)
    throw new RapDraftError("FORBIDDEN", "Proyek tidak ditemukan atau di luar akses Anda.");
  const receipt = await tx.query.aiProposalConfirmation.findFirst({
    where: and(
      eq(aiProposalConfirmation.tenantId, INSTANCE_TENANT_ID),
      eq(aiProposalConfirmation.conversationId, identity.conversationId),
      eq(aiProposalConfirmation.userId, actor.userId),
      eq(aiProposalConfirmation.toolCallId, identity.toolCallId),
      eq(aiProposalConfirmation.proposalType, "RAP_MATERIAL_DRAFT"),
    ),
  });
  const candidates = await tx
    .select()
    .from(formDraft)
    .where(
      and(
        eq(formDraft.tenantId, INSTANCE_TENANT_ID),
        eq(formDraft.ownerUserId, actor.userId),
        eq(formDraft.formType, "RAP_MATERIAL_DRAFT"),
        eq(formDraft.submissionGroupId, identity.conversationId),
      ),
    )
    .for("update");
  let row: typeof formDraft.$inferSelect | null = null;
  let payload: RapReviewPayload = { ...identity, rows: [] };
  for (const candidate of candidates) {
    const parsed = rapReviewPayloadSchema.safeParse(candidate.payload);
    if (!parsed.success)
      throw new RapDraftError("CONFLICT", "Draft review tidak valid. Minta usulan terbaru.");
    if (parsed.data.toolCallId !== identity.toolCallId) continue;
    if (
      row ||
      parsed.data.conversationId !== identity.conversationId ||
      candidate.projectId !== stored.proposal.projectId
    )
      throw new RapDraftError("CONFLICT", "Identitas draft tidak sesuai dengan usulan.");
    row = candidate;
    payload = parsed.data;
  }
  if (!row && !receipt && stored.expiresAt > Date.now()) {
    const [created] = await tx
      .insert(formDraft)
      .values({
        ownerUserId: actor.userId,
        formType: "RAP_MATERIAL_DRAFT",
        projectId: stored.proposal.projectId,
        submissionGroupId: identity.conversationId,
        payload,
        expiresAt: new Date(stored.expiresAt),
      })
      .returning();
    row = created;
  }
  let proposal: RapDraftProposal;
  try {
    proposal = applyRapDraftPatches(stored.proposal, payload.rows);
  } catch {
    throw new RapDraftError(
      "VALIDATION_ERROR",
      "Koreksi baris belum valid. Periksa area, jumlah, buffer dan harga.",
    );
  }
  return {
    source: stored.proposal,
    proposal,
    payload,
    row,
    expiresAt: Math.min(stored.expiresAt, row?.expiresAt.getTime() ?? stored.expiresAt),
    confirmedAt: receipt?.createdAt.toISOString() ?? null,
  };
}

export async function rapReviewView(
  tx: FinanceTransaction,
  actor: Actor,
  review: OwnedRapReview,
): Promise<RapDraftView> {
  const base = {
    proposal: review.proposal,
    draftId: review.row?.id ?? null,
    revision: review.row?.revision ?? 1,
    confirmedAt: review.confirmedAt,
  };
  if (review.confirmedAt) return { ...base, status: "CONFIRMED" };
  if (review.expiresAt <= Date.now()) return { ...base, status: "EXPIRED" };
  if (review.row?.status !== "ACTIVE") return { ...base, status: "STALE" };
  try {
    const current = await readRapPlanningContext(
      actor,
      review.proposal.projectId,
      review.proposal.rows.map((row) => row.materialId),
      tx,
    );
    return {
      ...base,
      status: current.contextVersion === review.proposal.expectedContext ? "READY" : "STALE",
    };
  } catch (error: unknown) {
    if (error instanceof RapDraftError && error.code !== "FORBIDDEN")
      return { ...base, status: "STALE" };
    throw error;
  }
}
