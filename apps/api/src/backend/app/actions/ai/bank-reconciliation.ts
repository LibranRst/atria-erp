import { and, eq } from "drizzle-orm";
import { db } from "@backend/db";
import {
  aiConversation,
  aiProposalConfirmation,
  formDraft,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import { readOwnedStoredProposal } from "@backend/server/usecases/ai/stored-proposal";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import {
  assertReconciliationRights,
  prepareReconciliationProposal,
} from "@backend/server/usecases/ai/reconciliation-context";
import {
  importStatementRowsTx,
  lockReconciliationAccount,
  reconcilePairTx,
  ReconciliationError,
  setReconciliationExceptionTx,
} from "@backend/server/usecases/finance/reconciliation-writer";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import {
  applyReconciliationReview,
  RECONCILIATION_KIND,
  reconciliationIdentitySchema,
  reconciliationPatchSchema,
  reconciliationPayloadSchema,
  reconciliationProposalSchema,
  reconciliationSaveSchema,
  type ReconciliationIdentity,
  type ReconciliationPayload,
  type ReconciliationProposal,
  type ReconciliationReceipt,
  type ReconciliationView,
} from "@atria/core/ai/bank-reconciliation";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
type Owned = {
  source: ReconciliationProposal;
  proposal: ReconciliationProposal;
  payload: ReconciliationPayload;
  row: typeof formDraft.$inferSelect | null;
  expiresAt: number;
  resultId: string | null;
};
function failure(error: unknown): ActionResponse<never> {
  return {
    success: false,
    error: {
      code: error instanceof ReconciliationError ? error.code : "VALIDATION_ERROR",
      message:
        error instanceof ReconciliationError
          ? error.message
          : "Usulan belum dapat diperiksa. Periksa sumber atau minta preview terbaru.",
    },
  };
}
function reviewedProposal(
  source: ReconciliationProposal,
  payload: ReconciliationPayload,
): ReconciliationProposal {
  try {
    return applyReconciliationReview(source, payload);
  } catch (error: unknown) {
    throw new ReconciliationError(
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "Pilihan draft tidak valid.",
    );
  }
}
async function sourceProposal(
  connection: Pick<FinanceTransaction, "query">,
  actor: Actor,
  identity: ReconciliationIdentity,
): Promise<{ proposal: ReconciliationProposal; expiresAt: number }> {
  const found: { proposal: ReconciliationProposal; expiresAt: number }[] = [];
  for (const toolName of ["proposeBankReconciliation", "analyzeBankStatementAttachment"]) {
    try {
      found.push(
        await readOwnedStoredProposal(
          connection,
          actor,
          identity,
          toolName,
          reconciliationProposalSchema,
        ),
      );
    } catch {
      /* Require exactly one owned proof across the allowed tools. */
    }
  }
  if (found.length !== 1)
    throw new ReconciliationError(
      "NOT_FOUND",
      "Usulan belum tersimpan atau identitasnya tidak tunggal. Tunggu jawaban selesai lalu periksa lagi.",
    );
  return found[0]!;
}
async function load(
  tx: FinanceTransaction,
  actor: Actor,
  identity: ReconciliationIdentity,
): Promise<Owned> {
  assertReconciliationRights(actor);
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
  if (!conversation) throw new ReconciliationError("NOT_FOUND", "Percakapan tidak ditemukan.");
  const stored = await sourceProposal(tx, actor, identity);
  const receipt = await tx.query.aiProposalConfirmation.findFirst({
    where: and(
      eq(aiProposalConfirmation.toolCallId, identity.toolCallId),
      eq(aiProposalConfirmation.conversationId, identity.conversationId),
      eq(aiProposalConfirmation.userId, actor.userId),
      eq(aiProposalConfirmation.proposalType, RECONCILIATION_KIND),
      eq(aiProposalConfirmation.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  const drafts = await tx
    .select()
    .from(formDraft)
    .where(
      and(
        eq(formDraft.tenantId, INSTANCE_TENANT_ID),
        eq(formDraft.ownerUserId, actor.userId),
        eq(formDraft.formType, RECONCILIATION_KIND),
        eq(formDraft.submissionGroupId, identity.conversationId),
      ),
    )
    .for("update");
  let row: typeof formDraft.$inferSelect | null = null;
  let payload: ReconciliationPayload = {
    ...identity,
    rows: stored.proposal.rows.map((r) => ({
      rowId: r.rowId,
      selected: r.selected,
      mutation: r.mutation,
      chosenCashId: r.chosenCashId,
    })),
  };
  for (const draft of drafts) {
    const parsed = reconciliationPayloadSchema.safeParse(draft.payload);
    if (!parsed.success || parsed.data.toolCallId !== identity.toolCallId) continue;
    if (row || parsed.data.conversationId !== identity.conversationId)
      throw new ReconciliationError("CONFLICT", "Identitas draft tidak sesuai.");
    row = draft;
    payload = parsed.data;
  }
  if (!row && !receipt && stored.expiresAt > Date.now()) {
    const [created] = await tx
      .insert(formDraft)
      .values({
        ownerUserId: actor.userId,
        formType: RECONCILIATION_KIND,
        submissionGroupId: identity.conversationId,
        payload,
        expiresAt: new Date(stored.expiresAt),
      })
      .returning();
    row = created ?? null;
  }
  return {
    source: stored.proposal,
    proposal: reviewedProposal(stored.proposal, payload),
    payload,
    row,
    expiresAt: Math.min(stored.expiresAt, row?.expiresAt.getTime() ?? stored.expiresAt),
    resultId: receipt?.documentId ?? null,
  };
}
async function view(
  tx: FinanceTransaction,
  actor: Actor,
  owned: Owned,
): Promise<ReconciliationView> {
  let status: ReconciliationView["status"] = owned.resultId
    ? "CONFIRMED"
    : owned.expiresAt <= Date.now()
      ? "EXPIRED"
      : owned.row?.status === "DISCARDED"
        ? "DISCARDED"
        : "READY";
  if (status === "READY") {
    try {
      const fresh = await prepareReconciliationProposal(actor, owned.source.input, tx);
      if (fresh.expectedContext !== owned.source.expectedContext) status = "STALE";
    } catch (error: unknown) {
      if (error instanceof ReconciliationError && ["NOT_FOUND", "FORBIDDEN"].includes(error.code))
        throw error;
      status = "STALE";
    }
  }
  return {
    proposal: owned.proposal,
    revision: owned.row?.revision ?? 1,
    status,
    resultId: owned.resultId,
  };
}
export async function getAiReconciliationProposal(
  raw: unknown,
): Promise<ActionResponse<ReconciliationView>> {
  const actor = await resolveActor(),
    parsed = reconciliationIdentitySchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!parsed.success) return failure(null);
  try {
    return {
      success: true,
      data: await db.transaction(async (tx) => view(tx, actor, await load(tx, actor, parsed.data))),
    };
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function patchAiReconciliationProposal(
  raw: unknown,
): Promise<ActionResponse<ReconciliationView>> {
  const actor = await resolveActor(),
    parsed = reconciliationPatchSchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Periksa tanggal, deskripsi, nominal dan pilihan pasangan.",
      },
    };
  try {
    const data = await db.transaction(async (tx) => {
      const owned = await load(tx, actor, parsed.data),
        current = await view(tx, actor, owned);
      if (
        !owned.row ||
        current.status !== "READY" ||
        owned.row.revision !== parsed.data.expectedRevision
      )
        throw new ReconciliationError(
          "CONFLICT",
          "Draft atau sumber berubah. Periksa versi terbaru sebelum menerapkan koreksi.",
        );
      const payload = reconciliationPayloadSchema.parse({
        conversationId: parsed.data.conversationId,
        toolCallId: parsed.data.toolCallId,
        rows: parsed.data.rows,
      });
      const proposal = reviewedProposal(owned.source, payload);
      const [saved] = await tx
        .update(formDraft)
        .set({
          payload,
          revision: owned.row.revision + 1,
          updatedAt: new Date(),
          lastSavedAt: new Date(),
        })
        .where(eq(formDraft.id, owned.row.id))
        .returning();
      return { ...current, proposal, revision: saved.revision };
    });
    return { success: true, data };
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function discardAiReconciliationProposal(
  raw: unknown,
): Promise<ActionResponse<ReconciliationView>> {
  const actor = await resolveActor(),
    parsed = reconciliationIdentitySchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!parsed.success) return failure(null);
  try {
    const data = await db.transaction(async (tx) => {
      const owned = await load(tx, actor, parsed.data);
      if (owned.resultId)
        throw new ReconciliationError(
          "CONFLICT",
          "Usulan yang sudah disimpan tidak dapat dibatalkan.",
        );
      if (owned.row)
        await tx
          .update(formDraft)
          .set({ status: "DISCARDED", updatedAt: new Date() })
          .where(eq(formDraft.id, owned.row.id));
      return {
        proposal: owned.proposal,
        revision: owned.row?.revision ?? 1,
        resultId: null,
        status: "DISCARDED" as const,
      };
    });
    return { success: true, data };
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function confirmAiReconciliationProposal(
  raw: unknown,
): Promise<ActionResponse<ReconciliationReceipt>> {
  const actor = await resolveActor(),
    parsed = reconciliationSaveSchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Konfirmasi hanya menerima identitas dan revisi draft server.",
      },
    };
  try {
    assertReconciliationRights(actor);
    await sourceProposal(db, actor, parsed.data);
  } catch (error: unknown) {
    return failure(error);
  }
  const result = await confirmMutation(
    actor,
    parsed.data,
    RECONCILIATION_KIND,
    async (tx) => {
      const owned = await load(tx, actor, parsed.data);
      if (
        !owned.row ||
        owned.row.status !== "ACTIVE" ||
        owned.expiresAt <= Date.now() ||
        owned.row.revision !== parsed.data.expectedRevision
      )
        throw new ReconciliationError(
          "CONFLICT",
          "Draft sudah berubah, dibatalkan atau kedaluwarsa.",
        );
      await lockReconciliationAccount(tx, owned.proposal.bankAccountId);
      const fresh = await prepareReconciliationProposal(actor, owned.source.input, tx);
      if (fresh.expectedContext !== owned.source.expectedContext)
        throw new ReconciliationError(
          "CONFLICT",
          "Rekening atau transaksi berubah. Minta preview terbaru.",
        );
      const proposal = owned.proposal,
        input = proposal.input;
      if (proposal.warning) throw new ReconciliationError("VALIDATION_ERROR", proposal.warning);
      let resultId: string;
      if (input.action === "IMPORT" || input.action === "MATCH") {
        const selected = proposal.rows.filter((r) => r.selected);
        if (!selected.length)
          throw new ReconciliationError("VALIDATION_ERROR", "Pilih minimal satu mutasi siap.");
        if (input.action === "IMPORT") {
          const imported = await importStatementRowsTx(tx, actor.userId, {
            bankAccountId: input.bankAccountId,
            fileName: input.fileName,
            rows: selected.map((r) => ({
              ...r.mutation,
              transactionDate: new Date(r.mutation.transactionDate),
            })),
          });
          if (!imported.importId || imported.importedCount !== selected.length)
            throw new ReconciliationError(
              "CONFLICT",
              "Koreksi memuat mutasi duplikat. Periksa sumber dan pilihan sebelum menyimpan.",
            );
          resultId = imported.importId;
        } else {
          for (const row of [...selected].sort((a, b) =>
            (a.chosenCashId ?? "").localeCompare(b.chosenCashId ?? ""),
          )) {
            if (!row.chosenCashId || !row.statementRowId)
              throw new ReconciliationError(
                "VALIDATION_ERROR",
                "Pilih pasangan catatan kas terlebih dahulu.",
              );
            await reconcilePairTx(tx, actor.userId, {
              cashTransactionId: row.chosenCashId,
              bankStatementRowId: row.statementRowId,
            });
          }
          resultId = selected[0]!.statementRowId!;
        }
      } else {
        const changed = await setReconciliationExceptionTx(tx, actor.userId, {
          cashTransactionId: input.cashTransactionId,
          reason: input.action === "MARK_EXCEPTION" ? input.reason : null,
        });
        resultId = changed.cashTransactionId;
      }
      await tx
        .update(formDraft)
        .set({ status: "CONSUMED", consumedAt: new Date(), updatedAt: new Date() })
        .where(eq(formDraft.id, owned.row.id));
      return { documentId: resultId, result: { resultId } };
    },
    failure,
  );
  if (!result.success) return result;
  revalidateWorkspacePath("/reconciliation");
  revalidateWorkspacePath("/ledger");
  return {
    success: true,
    data: { resultId: result.data.documentId, alreadyConfirmed: result.data.kind === "already" },
  };
}
