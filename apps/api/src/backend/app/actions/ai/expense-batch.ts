import { and, eq, inArray, asc } from "drizzle-orm";
import { db } from "@backend/db";
import {
  formDraft,
  INSTANCE_TENANT_ID,
  projectBudgetCategory,
  materialMaster,
  inventoryLocation,
  materialInventory,
} from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import {
  lockFinanceProject,
  type FinanceTransaction,
} from "@backend/server/usecases/finance/mutation-access";
import { readOwnedStoredProposal } from "@backend/server/usecases/ai/stored-proposal";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import {
  readExpenseContext,
  reviewExpensePayload,
  assertExpenseProjectAccess,
  ownedExpenseForm,
  assertExpenseBatchRights,
  EXPENSE_BATCH_FORM_TYPE,
  type ExpenseReader,
} from "@backend/server/usecases/ai/expense-batch-context";
import { FinanceInputError } from "@backend/server/usecases/ai/finance-input-context";
import { submitExpenseBatchTx } from "@backend/server/usecases/finance/submit-expense-batch";
import { assertExpenseAttachment } from "@backend/server/usecases/finance/expense-attachment";
import {
  EXPENSE_BATCH_KIND,
  expenseBatchIdentitySchema,
  expenseBatchProposalSchema,
  expenseBatchStateSchema,
  expenseBatchPatchSchema,
  expenseBatchSubmitSchema,
  type ExpenseBatchState,
  type ExpenseBatchProposal,
  type ExpenseBatchView,
} from "@atria/core/ai/expense-batch";
import { toExpenseSubmission } from "@atria/core/validations/expense-draft";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import type { z } from "zod";
type Identity = z.infer<typeof expenseBatchIdentitySchema>;
function failure(error: unknown): ActionResponse<never> {
  if (error instanceof FinanceInputError)
    return { success: false, error: { code: error.code, message: error.message } };
  const reason = error instanceof Error ? error.message : "";
  return {
    success: false,
    error: {
      code: reason.startsWith("FORBIDDEN:") ? "FORBIDDEN" : "TRANSACTION_FAILED",
      message:
        reason === "EXPENSE_BATCH_LIMIT"
          ? "Maksimal 50 baris per draft. Pecah pengeluaran menjadi beberapa draft."
          : "Pengeluaran belum tersimpan. Draft tetap aman; periksa sumber, izin dan isian sebelum mengulang.",
    },
  };
}
async function stored(
  actor: Actor,
  identity: Identity,
  reader: ExpenseReader = db,
): Promise<{ proposal: ExpenseBatchProposal; expiresAt: number }> {
  assertExpenseBatchRights(actor);
  return readOwnedStoredProposal(
    reader,
    actor,
    identity,
    "proposeExpenseBatch",
    expenseBatchProposalSchema,
  );
}
async function reviewRecord(
  actor: Actor,
  identity: Identity,
  reader: ExpenseReader = db,
): Promise<{
  proposal: ExpenseBatchProposal;
  draft: typeof formDraft.$inferSelect;
  state: ExpenseBatchState;
}> {
  const p = await stored(actor, identity, reader);
  const draft = await ownedExpenseForm(actor, p.proposal.reviewId, EXPENSE_BATCH_FORM_TYPE, reader);
  const state = expenseBatchStateSchema.parse(draft.payload);
  await assertExpenseProjectAccess(actor, state.payload.projectId, reader);
  return { proposal: p.proposal, draft, state };
}
async function source(
  actor: Actor,
  state: ExpenseBatchState,
  reader: ExpenseReader,
): Promise<void> {
  if (!state.sourceDraftId) return;
  const d = await ownedExpenseForm(actor, state.sourceDraftId, "EXPENSE_CREATE", reader);
  if (d.status !== "ACTIVE" || d.expiresAt <= new Date() || d.revision !== state.sourceRevision)
    throw new FinanceInputError(
      "CONFLICT",
      "Draft sumber berubah atau sudah diajukan. Baca draft terbaru.",
    );
}
async function view(
  actor: Actor,
  record: Awaited<ReturnType<typeof reviewRecord>>,
  reader: ExpenseReader = db,
): Promise<ExpenseBatchView> {
  const c = await readExpenseContext(actor, record.state.payload.projectId, reader),
    r = reviewExpensePayload(actor, record.state.payload, record.state.selectedKeys, c);
  let status: ExpenseBatchView["status"] =
    record.draft.status === "DISCARDED"
      ? "DISCARDED"
      : record.state.submitted.length === record.state.payload.lines.length
        ? "COMPLETE"
        : record.draft.expiresAt <= new Date()
          ? "EXPIRED"
          : r.hash !== record.state.contextHash
            ? "STALE"
            : "ACTIVE";
  const blockers = [...r.blockers];
  if (status !== "COMPLETE" && status !== "DISCARDED")
    try {
      await source(actor, record.state, reader);
    } catch {
      status = "STALE";
      blockers.push("Draft sumber berubah. Periksa kembali sebelum mengajukan.");
    }
  return {
    reviewId: record.draft.id,
    revision: record.draft.revision,
    status,
    projectName: c.project.name,
    state: record.state,
    rows: r.rows,
    categories: r.categories,
    materials: c.materials.map((m) => ({ id: m.id, name: m.name, unit: m.unit })),
    locations: c.locations.map((l) => ({ id: l.id, name: l.name })),
    packages: c.packages.map((p) => ({
      id: p.id,
      name: p.name,
      categoryId: p.projectBudgetCategoryId,
    })),
    rapItems: c.rapItems.map((r) => ({ id: r.id, name: r.name, materialId: r.materialId })),
    canStock:
      actor.permissions.includes("create:stock_movement") &&
      actor.permissions.includes("view:material"),
    blockers,
    totalSelected: r.totalSelected,
  };
}
export async function startAiExpenseBatchReview(
  raw: unknown,
): Promise<ActionResponse<ExpenseBatchView>> {
  const actor = await resolveActor(),
    identity = expenseBatchIdentitySchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!identity.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas usulan tidak valid." },
    };
  try {
    await db.transaction(async (tx) => {
      const s = await stored(actor, identity.data, tx),
        p = s.proposal;
      if (s.expiresAt <= Date.now()) throw new FinanceInputError("CONFLICT", "Usulan kedaluwarsa.");
      await tx.select().from(formDraft).where(eq(formDraft.id, p.reviewId)).for("update");
      const existing = await tx.query.formDraft.findFirst({ where: eq(formDraft.id, p.reviewId) }),
        marker = `${identity.data.conversationId}:${identity.data.toolCallId}`;
      if (existing) {
        if (
          existing.ownerUserId !== actor.userId ||
          existing.tenantId !== INSTANCE_TENANT_ID ||
          existing.formType !== EXPENSE_BATCH_FORM_TYPE
        )
          throw new FinanceInputError("FORBIDDEN", "Draft bukan milik Anda.");
        const current = expenseBatchStateSchema.parse(existing.payload);
        if (current.appliedTools.includes(marker)) return;
        if (
          p.request.reviewDraftId !== existing.id ||
          p.expectedReviewRevision !== existing.revision ||
          existing.status !== "ACTIVE"
        )
          throw new FinanceInputError("CONFLICT", "Versi koreksi berubah. Baca review terbaru.");
        const pending = current.payload.lines.filter(
          (l) => !current.submitted.some((x) => x.key === l.key),
        );
        if (
          p.payload.lines.length !== pending.length ||
          p.payload.lines.some((l) => !pending.some((x) => x.key === l.key))
        )
          throw new FinanceInputError(
            "VALIDATION_ERROR",
            "Koreksi harus mempertahankan ID semua baris yang belum diajukan.",
          );
        const payload = {
          ...p.payload,
          lines: current.payload.lines.map((l) =>
            current.submitted.some((x) => x.key === l.key)
              ? l
              : p.payload.lines.find((x) => x.key === l.key)!,
          ),
        };
        const context = await readExpenseContext(actor, p.payload.projectId, tx),
          r = reviewExpensePayload(actor, p.payload, current.selectedKeys, context);
        if (r.hash !== p.expectedContext)
          throw new FinanceInputError("CONFLICT", "Sumber koreksi berubah. Minta preview terbaru.");
        await source(actor, current, tx);
        const next = {
          ...current,
          payload,
          contextHash: reviewExpensePayload(actor, payload, current.selectedKeys, context).hash,
          appliedTools: [...current.appliedTools, marker],
        };
        await tx
          .update(formDraft)
          .set({
            payload: next,
            revision: existing.revision + 1,
            lastSavedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(formDraft.id, existing.id));
        return;
      }
      const context = await readExpenseContext(actor, p.payload.projectId, tx),
        r = reviewExpensePayload(actor, p.payload, [], context);
      const state: ExpenseBatchState = {
        payload: p.payload,
        selectedKeys: r.rows.filter((x) => x.issues.length === 0).map((x) => x.key),
        submitted: [],
        contextHash: p.expectedContext,
        sourceDraftId: p.sourceDraftId,
        sourceRevision: p.sourceRevision,
        appliedTools: [marker],
        receipts: [],
      };
      await source(actor, state, tx);
      await tx
        .insert(formDraft)
        .values({
          id: p.reviewId,
          ownerUserId: actor.userId,
          formType: EXPENSE_BATCH_FORM_TYPE,
          projectId: p.payload.projectId,
          payload: state,
          expiresAt: new Date(s.expiresAt),
          status: "ACTIVE",
        })
        .onConflictDoNothing();
    });
    return { success: true, data: await view(actor, await reviewRecord(actor, identity.data)) };
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function getAiExpenseBatchReview(
  raw: unknown,
): Promise<ActionResponse<ExpenseBatchView>> {
  const actor = await resolveActor(),
    identity = expenseBatchIdentitySchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!identity.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas draft tidak valid." },
    };
  try {
    return { success: true, data: await view(actor, await reviewRecord(actor, identity.data)) };
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function patchAiExpenseBatchReview(
  raw: unknown,
): Promise<ActionResponse<ExpenseBatchView>> {
  const actor = await resolveActor(),
    input = expenseBatchPatchSchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!input.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Periksa isian dan pilihan baris." },
    };
  try {
    await db.transaction(async (tx) => {
      const p = await stored(actor, input.data, tx);
      await tx.select().from(formDraft).where(eq(formDraft.id, p.proposal.reviewId)).for("update");
      const r = await reviewRecord(actor, input.data, tx);
      if (
        r.draft.status !== "ACTIVE" ||
        r.draft.expiresAt <= new Date() ||
        r.draft.revision !== input.data.expectedRevision
      )
        throw new FinanceInputError(
          "CONFLICT",
          "Draft berubah atau kedaluwarsa. Muat versi terbaru.",
        );
      await source(actor, r.state, tx);
      const payload = input.data.payload;
      if (
        payload.projectId !== r.state.payload.projectId ||
        payload.lines.length !== r.state.payload.lines.length ||
        new Set(payload.lines.map((l) => l.key)).size !== payload.lines.length ||
        payload.lines.some((l) => !r.state.payload.lines.some((x) => x.key === l.key)) ||
        r.state.submitted.some(
          (s) =>
            JSON.stringify(payload.lines.find((l) => l.key === s.key)) !==
            JSON.stringify(r.state.payload.lines.find((l) => l.key === s.key)),
        )
      )
        throw new FinanceInputError(
          "VALIDATION_ERROR",
          "Identitas/proyek dan baris yang telah diajukan tidak dapat diubah.",
        );
      if (
        new Set(input.data.selectedKeys).size !== input.data.selectedKeys.length ||
        input.data.selectedKeys.some(
          (k) =>
            !payload.lines.some((l) => l.key === k) || r.state.submitted.some((s) => s.key === k),
        )
      )
        throw new FinanceInputError("VALIDATION_ERROR", "Pilih hanya baris draft yang tersedia.");
      if (payload.receipt)
        await assertExpenseAttachment(
          actor,
          payload.projectId,
          payload.receipt.url,
          payload.receipt.fileId,
          tx,
        );
      const c = await readExpenseContext(actor, payload.projectId, tx),
        checked = reviewExpensePayload(actor, payload, input.data.selectedKeys, c);
      const next = {
        ...r.state,
        payload,
        selectedKeys: input.data.selectedKeys,
        contextHash: checked.hash,
      };
      await tx
        .update(formDraft)
        .set({
          payload: next,
          revision: r.draft.revision + 1,
          lastSavedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(formDraft.id, r.draft.id));
    });
    return { success: true, data: await view(actor, await reviewRecord(actor, input.data)) };
  } catch (error: unknown) {
    return failure(error);
  }
}
async function lockReviewSources(
  tx: FinanceTransaction,
  actor: Actor,
  state: ExpenseBatchState,
): Promise<void> {
  await lockFinanceProject(tx, actor, state.payload.projectId);
  const categories = [
    ...new Set(state.payload.lines.map((l) => l.projectBudgetCategoryId).filter(Boolean)),
  ].sort();
  if (categories.length)
    await tx
      .select()
      .from(projectBudgetCategory)
      .where(inArray(projectBudgetCategory.id, categories))
      .orderBy(asc(projectBudgetCategory.id))
      .for("update");
  const materials = [
    ...new Set(state.payload.lines.map((l) => l.materialId).filter(Boolean)),
  ].sort();
  if (materials.length)
    await tx
      .select()
      .from(materialMaster)
      .where(inArray(materialMaster.id, materials))
      .orderBy(asc(materialMaster.id))
      .for("update");
  const locations = [
    ...new Set(state.payload.lines.map((l) => l.inventoryLocationId).filter(Boolean)),
  ].sort();
  if (locations.length)
    await tx
      .select()
      .from(inventoryLocation)
      .where(inArray(inventoryLocation.id, locations))
      .orderBy(asc(inventoryLocation.id))
      .for("update");
  if (materials.length && locations.length)
    await tx
      .select()
      .from(materialInventory)
      .where(
        and(
          inArray(materialInventory.materialId, materials),
          inArray(materialInventory.locationId, locations),
        ),
      )
      .orderBy(asc(materialInventory.id))
      .for("update");
}
export async function submitAiExpenseBatchReview(
  raw: unknown,
): Promise<
  ActionResponse<{ groupId: string; costIds: readonly string[]; alreadyConfirmed: boolean }>
> {
  const actor = await resolveActor(),
    input = expenseBatchSubmitSchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!input.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Konfirmasi hanya menerima identitas, revision dan token tindakan.",
      },
    };
  try {
    const initial = await reviewRecord(actor, input.data),
      prior = initial.state.receipts.find((r) => r.token === input.data.token);
    if (prior)
      return {
        success: true,
        data: { groupId: prior.groupId, costIds: prior.costIds, alreadyConfirmed: true },
      };
    const result = await confirmMutation(
      actor,
      {
        conversationId: input.data.conversationId,
        toolCallId: `${input.data.toolCallId}:${input.data.token}`,
      },
      EXPENSE_BATCH_KIND,
      async (tx) => {
        await tx.select().from(formDraft).where(eq(formDraft.id, initial.draft.id)).for("update");
        const r = await reviewRecord(actor, input.data, tx);
        if (
          r.draft.status !== "ACTIVE" ||
          r.draft.revision !== input.data.expectedRevision ||
          r.draft.expiresAt <= new Date()
        )
          throw new FinanceInputError("CONFLICT", "Versi draft berubah atau kedaluwarsa.");
        if (r.state.sourceDraftId)
          await tx
            .select()
            .from(formDraft)
            .where(eq(formDraft.id, r.state.sourceDraftId))
            .for("update");
        await source(actor, r.state, tx);
        await lockReviewSources(tx, actor, r.state);
        const c = await readExpenseContext(actor, r.state.payload.projectId, tx),
          checked = reviewExpensePayload(actor, r.state.payload, r.state.selectedKeys, c);
        if (checked.hash !== r.state.contextHash)
          throw new FinanceInputError(
            "CONFLICT",
            "Budget/referensi/stok berubah. Periksa sumber terbaru lalu terapkan review.",
          );
        const keys = r.state.selectedKeys;
        if (
          !keys.length ||
          checked.blockers.length ||
          checked.rows.some((row) => keys.includes(row.key) && row.issues.length)
        )
          throw new FinanceInputError(
            "VALIDATION_ERROR",
            "Pilih baris yang siap dan selesaikan masalah validasi.",
          );
        const selected = r.state.payload.lines.filter((l) => keys.includes(l.key)),
          costs = await submitExpenseBatchTx(
            tx,
            actor,
            toExpenseSubmission({ ...r.state.payload, lines: selected }),
          ),
          groupId = costs[0].receiptGroupId!;
        const submitted = [
          ...r.state.submitted,
          ...costs.map((cost, index) => ({
            key: selected[index].key,
            costId: cost.id,
            description: cost.description,
            amount: Number(cost.amount),
            receiptGroupId: groupId,
          })),
        ];
        const remaining = r.state.payload.lines.filter(
          (l) => !submitted.some((s) => s.key === l.key),
        );
        let sourceRevision = r.state.sourceRevision;
        if (r.state.sourceDraftId) {
          sourceRevision = (sourceRevision ?? 0) + 1;
          await tx
            .update(formDraft)
            .set({
              projectId: r.state.payload.projectId,
              payload: remaining.length
                ? { ...r.state.payload, lines: remaining }
                : r.state.payload,
              status: remaining.length ? "ACTIVE" : "CONSUMED",
              revision: sourceRevision,
              submissionGroupId: remaining.length ? null : groupId,
              consumedAt: remaining.length ? null : new Date(),
              updatedAt: new Date(),
            })
            .where(eq(formDraft.id, r.state.sourceDraftId));
        }
        const receipt = {
            token: input.data.token,
            groupId,
            costIds: costs.map((c) => c.id),
            keys,
            total: costs.reduce((s, c) => s + Number(c.amount), 0),
          },
          fresh = await readExpenseContext(actor, r.state.payload.projectId, tx),
          hash = reviewExpensePayload(actor, r.state.payload, [], fresh).hash;
        await tx
          .update(formDraft)
          .set({
            payload: {
              ...r.state,
              submitted,
              selectedKeys: [],
              sourceRevision,
              contextHash: hash,
              receipts: [...r.state.receipts, receipt],
            },
            revision: r.draft.revision + 1,
            status: remaining.length ? "ACTIVE" : "CONSUMED",
            lastSavedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(formDraft.id, r.draft.id));
        return { documentId: groupId, result: { costIds: receipt.costIds } };
      },
      failure,
    );
    if (!result.success) return result;
    revalidateWorkspacePath("/expenses");
    revalidateWorkspacePath("/materials");
    revalidateWorkspacePath("/ledger");
    revalidateWorkspacePath("/approvals");
    revalidateWorkspacePath(`/projects/${initial.state.payload.projectId}`);
    const fresh = await reviewRecord(actor, input.data),
      receipt = fresh.state.receipts.find((r) => r.token === input.data.token);
    return {
      success: true,
      data: {
        groupId: result.data.documentId,
        costIds: receipt?.costIds ?? [],
        alreadyConfirmed: result.data.kind === "already",
      },
    };
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function discardAiExpenseBatchReview(
  raw: unknown,
): Promise<ActionResponse<{ discarded: true }>> {
  const actor = await resolveActor(),
    identity = expenseBatchIdentitySchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!identity.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas draft tidak valid." },
    };
  try {
    const r = await reviewRecord(actor, identity.data);
    await db
      .update(formDraft)
      .set({ status: "DISCARDED", updatedAt: new Date() })
      .where(and(eq(formDraft.id, r.draft.id), eq(formDraft.status, "ACTIVE")));
    return { success: true, data: { discarded: true } };
  } catch (error: unknown) {
    return failure(error);
  }
}
