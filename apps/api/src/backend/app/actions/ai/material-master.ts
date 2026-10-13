import {
  createMaterialCategoryTx,
  createInventoryLocationTx,
  createVendorTx,
} from "@backend/server/usecases/material/reference-writer";
import { randomUUID } from "node:crypto";
import { and, eq, gt, lte, desc } from "drizzle-orm";
import { db } from "@backend/db";
import {
  aiConversation,
  aiMessage,
  formDraft,
  materialImportAnalysisJob,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import {
  createMaterialMastersTx,
  materialIdentityIndex,
  loadMaterialReferences,
  lockMaterialCatalog,
  resolveMaterialFields,
} from "@backend/server/usecases/material/master-writer";
import { after } from "@runtime/next-server";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import {
  materialDraftPayloadSchema,
  materialProposalSchema,
  materialStartSchema,
  materialSelectionSchema,
  applyMaterialBulkCorrections,
  materialDraftIdentitySchema,
  materialPatchSchema,
  materialSaveSchema,
  materialConfirmReferenceSchema,
  normalizeMaterialIdentity,
  MATERIAL_IMPORT_FORM,
  type MaterialCandidate,
  type MaterialDraftPayload,
  type MaterialDraftView,
  type MaterialReference,
} from "@atria/core/ai/material-import";
import { vendorAdministrationSchema } from "@atria/core/validations/administration";
import { createInventoryLocationSchema } from "@atria/core/validations/warehouse";
import { createMaterialCategorySettingSchema } from "@atria/core/validations/settings";
import type { ActionResponse } from "@atria/core/types/action-response";
import { z } from "zod";

export class MaterialDraftError extends Error {}
function refuse(message: string): never {
  throw new MaterialDraftError(message);
}
async function run<T>(work: (actor: Actor) => Promise<T>): Promise<ActionResponse<T>> {
  try {
    const actor = await resolveActor();
    if (!actor || !actorCan(actor, "use:ai_chat") || !actorCan(actor, "manage:material_settings"))
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Akses AI dan pengaturan material diperlukan." },
      };
    return { success: true, data: await work(actor) };
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message:
          error instanceof MaterialDraftError
            ? error.message
            : error instanceof z.ZodError
              ? "Data usulan belum valid. Periksa semua field wajib."
              : "Material belum tersimpan. Muat ulang dan periksa kembali draft.",
      },
    };
  }
}
function expiry(): Date {
  return new Date(Date.now() + 30 * 86400_000);
}
async function ownedDraft(
  tx: FinanceTransaction,
  actor: Actor,
  id: string,
): Promise<{ row: typeof formDraft.$inferSelect; payload: MaterialDraftPayload }> {
  const [row] = await tx
    .select()
    .from(formDraft)
    .where(
      and(
        eq(formDraft.id, id),
        eq(formDraft.tenantId, INSTANCE_TENANT_ID),
        eq(formDraft.ownerUserId, actor.userId),
        eq(formDraft.formType, MATERIAL_IMPORT_FORM),
        eq(formDraft.status, "ACTIVE"),
        gt(formDraft.expiresAt, new Date()),
      ),
    )
    .for("update");
  if (!row) refuse("Draft tidak tersedia atau kedaluwarsa.");
  const payload = materialDraftPayloadSchema.parse(row.payload);
  const conversation = await tx.query.aiConversation.findFirst({
    where: and(
      eq(aiConversation.id, payload.conversationId),
      eq(aiConversation.userId, actor.userId),
    ),
  });
  if (!conversation) refuse("Percakapan tidak tersedia.");
  return { row, payload };
}
export async function validateMaterialCandidates(
  rows: readonly MaterialCandidate[],
  tx: Pick<typeof db, "query"> = db,
): Promise<MaterialCandidate[]> {
  const refs = await loadMaterialReferences(tx);
  const names = new Set<string>();
  const codes = new Set<string>();
  return rows.map((row) => {
    if (row.materialId) return row;
    const issues = resolveMaterialFields(row.fields, refs).issues;
    if (row.needsSourceReview)
      issues.push("Periksa sumber yang ambigu, lalu konfirmasi koreksi baris.");
    const name = normalizeMaterialIdentity(row.fields.name);
    const code = normalizeMaterialIdentity(row.fields.code);
    if (row.selected && (names.has(name) || (code && codes.has(code))))
      issues.push("Duplikat di batch. Pilih satu atau koreksi identitas.");
    if (row.selected) {
      names.add(name);
      if (code) codes.add(code);
    }
    const nameKey = name.replace(/[^a-z0-9]/g, "");
    const similarNames = materialIdentityIndex(refs)
      .folded.filter((item) => {
        const existingKey = item.key;
        return (
          existingKey !== nameKey &&
          Math.min(nameKey.length, existingKey.length) >= 5 &&
          (nameKey.includes(existingKey) || existingKey.includes(nameKey))
        );
      })
      .slice(0, 3)
      .map((item) => item.name);
    return { ...row, issues, similarNames };
  });
}
async function view(
  tx: FinanceTransaction,
  actor: Actor,
  row: typeof formDraft.$inferSelect,
  payload: MaterialDraftPayload,
): Promise<MaterialDraftView> {
  const refs = await loadMaterialReferences(tx);
  return {
    options: {
      categories: refs.categories.map((item) => item.name),
      locations: refs.locations.filter((item) => item.isActive).map((item) => item.name),
      vendors: refs.vendors.filter((item) => item.isActive).map((item) => item.name),
    },
    id: row.id,
    revision: row.revision,
    payload: { ...payload, rows: await validateMaterialCandidates(payload.rows, tx) },
    canCreateVendor: actorCan(actor, "manage:vendors"),
  };
}
function checkRevision(actual: number, expected: number): void {
  if (actual !== expected) refuse("Draft berubah. Muat ulang sebelum melanjutkan.");
}
async function persist(
  tx: FinanceTransaction,
  row: typeof formDraft.$inferSelect,
  payload: MaterialDraftPayload,
  actor: Actor,
): Promise<MaterialDraftView> {
  const [saved] = await tx
    .update(formDraft)
    .set({
      payload,
      revision: row.revision + 1,
      expiresAt: expiry(),
      lastSavedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(formDraft.id, row.id))
    .returning();
  if (!saved) refuse("Draft tidak tersedia.");
  return view(tx, actor, saved, payload);
}
export async function startAiMaterialAnalysis(
  input: unknown,
): Promise<ActionResponse<MaterialDraftView>> {
  return run(async (actor) => {
    const identity = materialStartSchema.parse(input);
    const result = await db.transaction(async (tx) => {
      const [conversation] = await tx
        .select()
        .from(aiConversation)
        .where(
          and(
            eq(aiConversation.id, identity.conversationId),
            eq(aiConversation.userId, actor.userId),
          ),
        )
        .for("update");
      if (!conversation) refuse("Percakapan tidak ditemukan.");
      const existing = await tx.query.materialImportAnalysisJob.findFirst({
        where: and(
          eq(materialImportAnalysisJob.conversationId, identity.conversationId),
          eq(materialImportAnalysisJob.toolCallId, identity.toolCallId),
        ),
      });
      if (existing) {
        const draft = await ownedDraft(tx, actor, existing.draftId);
        return view(tx, actor, draft.row, draft.payload);
      }
      const messages = await tx.query.aiMessage.findMany({
        where: and(
          eq(aiMessage.conversationId, identity.conversationId),
          eq(aiMessage.role, "assistant"),
        ),
      });
      let proposal: z.infer<typeof materialProposalSchema> | null = null;
      let proposalMessageId: string | null = null;
      for (const message of messages) {
        const parts = z
          .array(
            z
              .object({ toolCallId: z.string().optional(), output: z.unknown().optional() })
              .passthrough(),
          )
          .safeParse(message.parts);
        if (!parts.success) continue;
        for (const part of parts.data) {
          if (part.toolCallId !== identity.toolCallId) continue;
          const parsed = z.object({ proposal: materialProposalSchema }).safeParse(part.output);
          if (parsed.success) {
            proposal = parsed.data.proposal;
            proposalMessageId = message.id;
          }
        }
      }
      if (!proposal) refuse("Usulan belum tersimpan. Tunggu jawaban selesai lalu coba lagi.");
      const boundary = tx
        .select({ at: aiMessage.createdAt })
        .from(aiMessage)
        .where(eq(aiMessage.id, proposalMessageId ?? "00000000-0000-4000-8000-000000000000"));
      const sourceMessage = await tx.query.aiMessage.findFirst({
        where: and(
          eq(aiMessage.conversationId, identity.conversationId),
          eq(aiMessage.role, "user"),
          lte(aiMessage.createdAt, boundary),
        ),
        orderBy: [desc(aiMessage.createdAt)],
      });
      const sourceParts = z
        .array(
          z
            .object({ type: z.string(), url: z.string().optional(), text: z.string().optional() })
            .passthrough(),
        )
        .safeParse(sourceMessage?.parts);
      const sourceInstruction = sourceParts.success
        ? sourceParts.data
            .filter((part) => part.type === "text")
            .map((part) => part.text ?? "")
            .join("\n")
            .slice(0, 2000)
        : "";
      if (!proposal.correctionDraftId && !proposal.attachmentUrls.length && sourceParts.success) {
        const sourceUrls = sourceParts.data
          .filter((part) => part.type === "file" && part.url)
          .map((part) => part.url)
          .filter((url): url is string => Boolean(url));
        if (sourceUrls.length) {
          proposal.attachmentUrls = sourceUrls;
          proposal.rows = [];
        }
      }
      if (proposal.correctionDraftId) {
        const draft = await ownedDraft(tx, actor, proposal.correctionDraftId);
        if (
          draft.payload.conversationId !== identity.conversationId ||
          draft.payload.analysisStatus !== "READY"
        )
          refuse("Draft belum siap untuk dikoreksi.");
        if (draft.payload.appliedCorrections.includes(identity.toolCallId))
          return view(tx, actor, draft.row, draft.payload);
        for (const correction of proposal.corrections) {
          const row = draft.payload.rows.find((item) => item.id === correction.rowId);
          if (!row || row.materialId) refuse("Baris koreksi tidak tersedia atau sudah tersimpan.");
          row.fields = correction.fields;
          row.needsSourceReview = false;
        }
        draft.payload.rows = applyMaterialBulkCorrections(
          draft.payload.rows,
          proposal.bulkCorrections,
        );
        draft.payload.appliedCorrections.push(identity.toolCallId);
        return persist(tx, draft.row, draft.payload, actor);
      }
      if (!proposal.attachmentUrls.length && !proposal.rows.length)
        refuse("Tambahkan material atau lampiran terlebih dahulu.");
      const payload: MaterialDraftPayload = {
        conversationId: identity.conversationId,
        sourceInstruction,
        toolCallId: identity.toolCallId,
        rows: proposal.rows.map((fields, index) => ({
          id: randomUUID(),
          fields,
          source: { row: index + 1, raw: JSON.stringify(fields) },
          selected: true,
          needsSourceReview: false,
          materialId: null,
          issues: [],
          similarNames: [],
        })),
        receipts: [],
        appliedCorrections: [],
        referenceReceipts: {},
        analysisStatus: proposal.attachmentUrls.length ? "QUEUED" : "READY",
        progress: 0,
        error: null,
      };
      const [draft] = await tx
        .insert(formDraft)
        .values({
          ownerUserId: actor.userId,
          formType: MATERIAL_IMPORT_FORM,
          payload,
          expiresAt: expiry(),
        })
        .returning();
      if (!draft) refuse("Draft belum tersimpan.");
      await tx.insert(materialImportAnalysisJob).values({
        draftId: draft.id,
        conversationId: conversation.id,
        ownerUserId: actor.userId,
        toolCallId: identity.toolCallId,
        attachmentUrls: proposal.attachmentUrls,
        status: proposal.attachmentUrls.length ? "QUEUED" : "DONE",
      });
      for (const message of messages) {
        const parts = z.array(z.record(z.string(), z.unknown())).safeParse(message.parts);
        if (!parts.success) continue;
        for (const part of parts.data)
          if (part.toolCallId === identity.toolCallId) {
            const output = z.record(z.string(), z.unknown()).safeParse(part.output);
            if (output.success) part.output = { ...output.data, draftId: draft.id };
          }
        await tx.update(aiMessage).set({ parts: parts.data }).where(eq(aiMessage.id, message.id));
      }
      return view(tx, actor, draft, payload);
    });
    after(async () => {
      const { drainMaterialAnalysis } =
        await import("@backend/server/services/material-analysis-worker");
      await drainMaterialAnalysis();
    });
    return result;
  });
}
export async function getAiMaterialDraft(
  input: unknown,
): Promise<ActionResponse<MaterialDraftView>> {
  return run(async (actor) =>
    db.transaction(async (tx) => {
      const { draftId } = materialDraftIdentitySchema.parse(input);
      const draft = await ownedDraft(tx, actor, draftId);
      return view(tx, actor, draft.row, draft.payload);
    }),
  );
}
export async function patchAiMaterialDraft(
  input: unknown,
): Promise<ActionResponse<MaterialDraftView>> {
  return run(async (actor) =>
    db.transaction(async (tx) => {
      const patch = materialPatchSchema.parse(input);
      const draft = await ownedDraft(tx, actor, patch.draftId);
      checkRevision(draft.row.revision, patch.expectedRevision);
      if (draft.payload.analysisStatus !== "READY")
        refuse("Tunggu analisis selesai sebelum mengedit.");
      for (const edit of patch.rows) {
        const row = draft.payload.rows.find((item) => item.id === edit.id);
        if (!row || row.materialId) refuse("Baris tidak tersedia atau sudah tersimpan.");
        row.fields = edit.fields;
        row.selected = edit.selected;
        row.needsSourceReview = false;
      }
      return persist(tx, draft.row, draft.payload, actor);
    }),
  );
}
export async function selectAiMaterialRows(
  input: unknown,
): Promise<ActionResponse<MaterialDraftView>> {
  return run(async (actor) =>
    db.transaction(async (tx) => {
      const selection = materialSelectionSchema.parse(input);
      const draft = await ownedDraft(tx, actor, selection.draftId);
      checkRevision(draft.row.revision, selection.expectedRevision);
      if (draft.payload.analysisStatus !== "READY")
        refuse("Tunggu analisis selesai sebelum memilih.");
      const ids = new Set(selection.selectedRowIds);
      if (
        [...ids].some((id) => !draft.payload.rows.some((row) => row.id === id && !row.materialId))
      )
        refuse("Baris pilihan tidak tersedia atau sudah tersimpan.");
      draft.payload.rows = draft.payload.rows.map((row) =>
        row.materialId ? row : { ...row, selected: ids.has(row.id) },
      );
      return persist(tx, draft.row, draft.payload, actor);
    }),
  );
}
export async function saveAiMaterialRows(
  input: unknown,
): Promise<ActionResponse<MaterialDraftView>> {
  const result = await run(async (actor) =>
    db.transaction(async (tx) => {
      const save = materialSaveSchema.parse(input);
      const draft = await ownedDraft(tx, actor, save.draftId);
      if (draft.payload.receipts.some((receipt) => receipt.operationId === save.operationId))
        return view(tx, actor, draft.row, draft.payload);
      checkRevision(draft.row.revision, save.expectedRevision);
      if (draft.payload.analysisStatus !== "READY")
        refuse("Tunggu analisis selesai sebelum menyimpan.");
      if (new Set(save.rowIds).size !== save.rowIds.length) refuse("Pilihan baris duplikat.");
      await lockMaterialCatalog(tx);
      draft.payload.rows = await validateMaterialCandidates(draft.payload.rows, tx);
      const selected = save.rowIds.map((id) => draft.payload.rows.find((row) => row.id === id));
      if (selected.some((row) => !row || row.materialId || !row.selected || row.issues.length))
        refuse("Baris pilihan belum valid. Muat ulang dan periksa kembali.");
      const receipt: MaterialDraftPayload["receipts"][number] = {
        operationId: save.operationId,
        rows: [],
      };
      const references = await loadMaterialReferences(tx);
      const inputs = selected.map((row) => {
        if (!row) refuse("Baris tidak tersedia.");
        const resolved = resolveMaterialFields(row.fields, references);
        if (!resolved.input) refuse(resolved.issues.join(" "));
        return { input: resolved.input, source: row.source };
      });
      const created = await createMaterialMastersTx(tx, actor.userId, inputs);
      for (const [index, row] of selected.entries()) {
        if (!row) refuse("Baris tidak tersedia.");
        row.materialId = created[index].id;
        row.selected = false;
        row.issues = [];
        receipt.rows.push({ rowId: row.id, materialId: created[index].id });
      }
      draft.payload.receipts.push(receipt);
      return persist(tx, draft.row, draft.payload, actor);
    }),
  );
  if (result.success) {
    revalidateWorkspacePath("/settings");
    revalidateWorkspacePath("/materials");
    revalidateWorkspacePath("/onboarding");
  }
  return result;
}
export async function createMaterialReferenceTx(
  tx: FinanceTransaction,
  actorUserId: string,
  ref: MaterialReference,
): Promise<string> {
  await lockMaterialCatalog(tx);
  const refs = await loadMaterialReferences(tx);
  const existing = (
    ref.kind === "category"
      ? refs.categories
      : ref.kind === "location"
        ? refs.locations.filter((row) => row.isActive)
        : refs.vendors.filter((row) => row.isActive)
  ).filter((row) => normalizeMaterialIdentity(row.name) === normalizeMaterialIdentity(ref.name));
  if (existing.length === 1) return existing[0].id;
  if (existing.length > 1) refuse("Nama referensi ambigu. Pilih referensi yang sudah ada.");
  let id: string;
  if (ref.kind === "category")
    id = (
      await createMaterialCategoryTx(
        tx,
        actorUserId,
        createMaterialCategorySettingSchema.parse({ name: ref.name }),
      )
    ).id;
  else if (ref.kind === "location")
    id = (
      await createInventoryLocationTx(
        tx,
        actorUserId,
        createInventoryLocationSchema.parse({ name: ref.name }),
      )
    ).id;
  else {
    const value = vendorAdministrationSchema.parse({
      name: ref.name,
      phone: ref.phone,
      isActive: true,
    });
    id = (
      await createVendorTx(tx, actorUserId, {
        name: value.name,
        phone: value.phone,
        isActive: true,
      })
    ).id;
  }

  return id;
}
export async function confirmAiMaterialReference(
  input: unknown,
): Promise<ActionResponse<MaterialDraftView>> {
  const result = await run(async (actor) =>
    db.transaction(async (tx) => {
      const confirmation = materialConfirmReferenceSchema.parse(input);
      const draft = await ownedDraft(tx, actor, confirmation.draftId);
      const references =
        "references" in confirmation
          ? confirmation.references
          : [
              {
                reference: confirmation.reference,
                sourceName: confirmation.sourceName ?? confirmation.reference.name,
              },
            ];
      if (
        references.some(({ reference }) => reference.kind === "vendor") &&
        !actorCan(actor, "manage:vendors")
      )
        refuse("Izin kelola vendor diperlukan.");
      if (
        draft.payload.referenceReceipts[confirmation.operationId] ||
        draft.payload.referenceBatchReceipts?.[confirmation.operationId]
      )
        return view(tx, actor, draft.row, draft.payload);
      checkRevision(draft.row.revision, confirmation.expectedRevision);
      if (draft.payload.analysisStatus !== "READY")
        refuse("Tunggu analisis selesai sebelum membuat referensi.");
      const ids: string[] = [];
      const changes: {
        field: "categoryName" | "locationName" | "vendorName";
        sourceName: string;
        name: string;
      }[] = [];
      const sources = new Set<string>();
      for (const { reference: ref, sourceName } of references) {
        const field =
          ref.kind === "category"
            ? "categoryName"
            : ref.kind === "location"
              ? "locationName"
              : "vendorName";
        const sourceKey = `${ref.kind}:${normalizeMaterialIdentity(sourceName)}`;
        if (sources.has(sourceKey))
          refuse("Satu referensi sumber hanya dapat dikonfirmasi sekali dalam kelompok.");
        sources.add(sourceKey);
        if (
          !draft.payload.rows.some(
            (row) =>
              !row.materialId &&
              normalizeMaterialIdentity(row.fields[field]) ===
                normalizeMaterialIdentity(sourceName),
          )
        )
          refuse("Referensi harus terkait dengan draft material ini.");
        ids.push(await createMaterialReferenceTx(tx, actor.userId, ref));
        changes.push({ field, sourceName, name: ref.name });
      }
      for (const row of draft.payload.rows) {
        if (row.materialId) continue;
        const original = { ...row.fields };
        for (const change of changes) {
          if (
            normalizeMaterialIdentity(original[change.field]) ===
            normalizeMaterialIdentity(change.sourceName)
          )
            row.fields[change.field] = change.name;
        }
      }
      if ("references" in confirmation) {
        draft.payload.referenceBatchReceipts ??= {};
        draft.payload.referenceBatchReceipts[confirmation.operationId] = ids;
      } else draft.payload.referenceReceipts[confirmation.operationId] = ids[0];
      return persist(tx, draft.row, draft.payload, actor);
    }),
  );
  if (result.success) {
    revalidateWorkspacePath("/settings");
    revalidateWorkspacePath("/materials");
  }
  return result;
}
export async function retryAiMaterialAnalysis(
  input: unknown,
): Promise<ActionResponse<MaterialDraftView>> {
  const result = await run(async (actor) =>
    db.transaction(async (tx) => {
      const { draftId } = materialDraftIdentitySchema.parse(input);
      const draft = await ownedDraft(tx, actor, draftId);
      if (draft.payload.analysisStatus !== "FAILED")
        refuse("Analisis ini tidak perlu dicoba ulang.");
      await tx
        .update(materialImportAnalysisJob)
        .set({
          status: "QUEUED",
          attempts: 0,
          error: null,
          nextAttemptAt: new Date(),
          leaseToken: null,
          leaseExpiresAt: null,
        })
        .where(eq(materialImportAnalysisJob.draftId, draftId));
      draft.payload.analysisStatus = "QUEUED";
      draft.payload.error = null;
      return persist(tx, draft.row, draft.payload, actor);
    }),
  );
  if (result.success)
    after(async () => {
      const { drainMaterialAnalysis } =
        await import("@backend/server/services/material-analysis-worker");
      await drainMaterialAnalysis();
    });
  return result;
}
export async function discardAiMaterialDraft(
  input: unknown,
): Promise<ActionResponse<MaterialDraftView>> {
  return run(async (actor) =>
    db.transaction(async (tx) => {
      const { draftId } = materialDraftIdentitySchema.parse(input);
      const draft = await ownedDraft(tx, actor, draftId);
      await tx
        .update(materialImportAnalysisJob)
        .set({ status: "CANCELLED", leaseToken: null, leaseExpiresAt: null })
        .where(eq(materialImportAnalysisJob.draftId, draftId));
      draft.payload.analysisStatus = "CANCELLED";
      return persist(tx, draft.row, draft.payload, actor);
    }),
  );
}
