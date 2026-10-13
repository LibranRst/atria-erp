import { randomUUID } from "node:crypto";
import { and, eq, lte, or } from "drizzle-orm";
import { db } from "@backend/db";
import {
  formDraft,
  materialImportAnalysisJob,
  user,
  aiRun,
  aiConversation,
  role,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { isKnownPermissionKey } from "@atria/core/auth/role-impact";
import { loadMaterialReferences } from "@backend/server/usecases/material/master-writer";
import {
  materialDraftPayloadSchema,
  MATERIAL_IMPORT_FORM,
  type MaterialCandidate,
  type MaterialSource,
  type MaterialFields,
} from "@atria/core/ai/material-import";
import {
  extractMaterialSources,
  mapMaterialSources,
  MaterialAnalysisInputError,
} from "./material-analysis-source";
import {
  materialSourceChunk,
  mappedStructuredMaterialSource,
  normalizedTextMaterialSources,
  hasMaterialFieldInstructions,
} from "./material-source-mapping";
import { DocumentContentError } from "@backend/lib/ai/document-model";
let running = false;
function candidate(
  fields: MaterialFields,
  source: MaterialSource,
  uncertain: boolean,
): MaterialCandidate {
  return {
    id: randomUUID(),
    fields,
    source,
    needsSourceReview: uncertain || source.raw.includes("[?]"),
    issues: [],
    similarNames: [],
    selected: true,
    materialId: null,
  };
}
export async function materialAnalysisActor(userId: string): Promise<Actor> {
  const owner = await db.query.user.findFirst({ where: eq(user.id, userId) });
  const record = owner?.isActive
    ? await db.query.role.findFirst({
        where: eq(role.id, owner.roleId),
        with: { permissions: true },
      })
    : null;
  const access = record
    ? {
        roleName: record.name,
        dataScope: record.dataScope,
        permissions: record.permissions
          .map((item) => item.permissionKey)
          .filter(isKnownPermissionKey),
      }
    : null;
  if (
    !owner ||
    !access ||
    !access.permissions.includes("use:ai_chat") ||
    !access.permissions.includes("manage:material_settings")
  )
    throw new MaterialAnalysisInputError("Akses analisis material sudah dicabut.");
  return {
    userId: owner.id,
    roleId: owner.roleId,
    roleName: access.roleName,
    permissions: access.permissions,
    dataScope:
      access.dataScope === "GLOBAL" || access.dataScope === "ASSIGNED" ? access.dataScope : "NONE",
    name: owner.name,
    email: owner.email,
    image: owner.image,
    isActive: true,
    mustChangePassword: owner.mustChangePassword,
    sessionId: "",
    developerActorUserId: null,
  };
}
export async function processMaterialAnalysisStep(): Promise<boolean> {
  const leaseToken = randomUUID();
  const job = await db.transaction(async (tx) => {
    const [candidate] = await tx
      .select()
      .from(materialImportAnalysisJob)
      .where(
        or(
          and(
            eq(materialImportAnalysisJob.status, "QUEUED"),
            lte(materialImportAnalysisJob.nextAttemptAt, new Date()),
          ),
          and(
            eq(materialImportAnalysisJob.status, "PROCESSING"),
            lte(materialImportAnalysisJob.leaseExpiresAt, new Date()),
          ),
        ),
      )
      .for("update", { skipLocked: true })
      .limit(1);
    if (!candidate) return null;
    const [claimed] = await tx
      .update(materialImportAnalysisJob)
      .set({
        status: "PROCESSING",
        leaseToken,
        leaseExpiresAt: new Date(Date.now() + 120000),
        updatedAt: new Date(),
      })
      .where(eq(materialImportAnalysisJob.id, candidate.id))
      .returning();
    return claimed;
  });
  if (!job) return false;
  const signal = AbortSignal.timeout(45000);
  try {
    const actor = await materialAnalysisActor(job.ownerUserId);
    const conversation = await db.query.aiConversation.findFirst({
      where: and(
        eq(aiConversation.id, job.conversationId),
        eq(aiConversation.userId, actor.userId),
      ),
    });
    const draft = await db.query.formDraft.findFirst({
      where: and(
        eq(formDraft.id, job.draftId),
        eq(formDraft.ownerUserId, actor.userId),
        eq(formDraft.formType, MATERIAL_IMPORT_FORM),
        eq(formDraft.status, "ACTIVE"),
      ),
    });
    if (!conversation || !draft || draft.expiresAt <= new Date())
      throw new MaterialAnalysisInputError("Draft atau percakapan sudah tidak tersedia.");
    const payload = materialDraftPayloadSchema.parse(draft.payload);
    if (payload.analysisStatus === "CANCELLED") return false;
    let sources = job.cursor === 0 ? normalizedTextMaterialSources(job.sources) : job.sources;
    let extracted = job.extracted;
    let cursor = job.cursor;
    let pageCursor = job.pageCursor;
    const candidates: MaterialCandidate[] = [];
    if (extracted < job.attachmentUrls.length) {
      const extractedSource = await extractMaterialSources(
        actor,
        job.attachmentUrls[extracted],
        signal,
        pageCursor,
      );
      const previousCount = sources.length;
      sources = [
        ...sources,
        ...extractedSource.sources.map((source, index) =>
          source.imageRegion && !/\.pdf$/i.test(source.fileName ?? "")
            ? { ...source, row: previousCount + index + 1 }
            : source,
        ),
      ];
      if (sources.length + payload.rows.filter((row) => !row.source.attachmentUrl).length > 500)
        throw new MaterialAnalysisInputError(
          "Maksimal 500 material per batch. Pisahkan sumber; tidak ada material yang dipotong.",
        );
      pageCursor++;
      if (pageCursor >= extractedSource.totalPages) {
        extracted++;
        pageCursor = 0;
      }
      // Structured OCR/spreadsheets need no second generation. Commit their
      // first bounded chunk now so each completed read is visible/recoverable.
      const context = { userRequest: payload.sourceInstruction ?? "" };
      if (!hasMaterialFieldInstructions(context)) {
        const chunk = materialSourceChunk(sources.slice(cursor), context);
        const decoded = chunk.map((source) => ({
          source,
          value: mappedStructuredMaterialSource(source, context),
        }));
        if (decoded.length && decoded.every((item) => item.value !== null)) {
          for (const item of decoded)
            if (item.value)
              candidates.push(candidate(item.value.fields, item.source, item.value.uncertain));
          cursor += chunk.length;
        }
      }
    } else if (cursor < sources.length) {
      const refs = await loadMaterialReferences();
      const context = {
        userRequest: payload.sourceInstruction ?? "",
        categories: refs.categories.map((row) => row.name),
        locations: refs.locations.filter((row) => row.isActive).map((row) => row.name),
        vendors: refs.vendors.filter((row) => row.isActive).map((row) => row.name),
      };
      let chunk: MaterialSource[];
      try {
        chunk = materialSourceChunk(sources.slice(cursor), context);
      } catch (error: unknown) {
        if (error instanceof RangeError) throw new MaterialAnalysisInputError(error.message);
        throw error;
      }
      const mapped = await mapMaterialSources(
        chunk,
        context,
        AbortSignal.any([signal, AbortSignal.timeout(40000)]),
      );
      for (const row of mapped)
        candidates.push(candidate(row.fields, chunk[row.index], row.uncertain));
      cursor += chunk.length;
    }
    await materialAnalysisActor(job.ownerUserId);
    await db.transaction(async (tx) => {
      const [lease] = await tx
        .select()
        .from(materialImportAnalysisJob)
        .where(
          and(
            eq(materialImportAnalysisJob.id, job.id),
            eq(materialImportAnalysisJob.leaseToken, leaseToken),
            eq(materialImportAnalysisJob.status, "PROCESSING"),
          ),
        )
        .for("update");
      if (!lease || !lease.leaseExpiresAt || lease.leaseExpiresAt <= new Date()) return;
      const [current] = await tx
        .select()
        .from(formDraft)
        .where(eq(formDraft.id, job.draftId))
        .for("update");
      if (!current) return;
      const latest = materialDraftPayloadSchema.parse(current.payload);
      if (latest.analysisStatus === "CANCELLED") return;
      latest.rows.push(...candidates);
      latest.progress = cursor;
      const done = extracted === job.attachmentUrls.length && cursor === sources.length;
      latest.analysisStatus = done ? "READY" : "PROCESSING";
      latest.error = null;
      if (done && !latest.rows.length)
        throw new MaterialAnalysisInputError("Tidak ada material yang terbaca dari sumber.");
      await tx
        .update(formDraft)
        .set({ payload: latest, revision: current.revision + 1, updatedAt: new Date() })
        .where(eq(formDraft.id, current.id));
      await tx
        .update(materialImportAnalysisJob)
        .set({
          sources,
          extracted,
          cursor,
          pageCursor,
          attempts: 0,
          status: done ? "DONE" : "QUEUED",
          nextAttemptAt: new Date(),
          leaseToken: null,
          leaseExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(materialImportAnalysisJob.id, job.id));
    });
  } catch (error: unknown) {
    const attempts = job.attempts + 1;
    const failed = error instanceof MaterialAnalysisInputError || attempts >= 3;
    const message =
      error instanceof MaterialAnalysisInputError
        ? error.message
        : error instanceof DocumentContentError && error.code === "TIMEOUT"
          ? failed
            ? `${job.extracted < job.attachmentUrls.length ? "Pembacaan gambar/dokumen" : "Pemetaan material"} melewati batas waktu. Progres aman; gunakan Lanjutkan analisis untuk mencoba lagi.`
            : `${job.extracted < job.attachmentUrls.length ? "Pembacaan gambar/dokumen" : "Pemetaan material"} melewati batas waktu. Progres terakhir aman; analisis dicoba ulang otomatis.`
          : "Analisis belum selesai. Coba ulang dari progres terakhir.";
    await db.transaction(async (tx) => {
      const [lease] = await tx
        .select()
        .from(materialImportAnalysisJob)
        .where(
          and(
            eq(materialImportAnalysisJob.id, job.id),
            eq(materialImportAnalysisJob.leaseToken, leaseToken),
          ),
        )
        .for("update");
      if (!lease) return;
      await tx
        .update(materialImportAnalysisJob)
        .set({
          status: failed ? "FAILED" : "QUEUED",
          attempts,
          error: message,
          nextAttemptAt: new Date(Date.now() + (attempts === 1 ? 30000 : 120000)),
          leaseToken: null,
          leaseExpiresAt: null,
        })
        .where(eq(materialImportAnalysisJob.id, job.id));
      const [draft] = await tx
        .select()
        .from(formDraft)
        .where(eq(formDraft.id, job.draftId))
        .for("update");
      if (draft) {
        const payload = materialDraftPayloadSchema.parse(draft.payload);
        payload.analysisStatus = failed ? "FAILED" : "PROCESSING";
        payload.error = message;
        await tx
          .update(formDraft)
          .set({ payload, revision: draft.revision + 1 })
          .where(eq(formDraft.id, draft.id));
      }
      await tx.insert(aiRun).values({
        runType: "MATERIAL_MASTER_IMPORT",
        runById: job.ownerUserId,
        status: failed ? "FAILED" : "RETRY",
        errorMessage: message,
      });
    });
  }
  return true;
}
export async function drainMaterialAnalysis(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (let step = 0; step < 30; step++) {
      if (!(await processMaterialAnalysisStep())) break;
    }
  } finally {
    running = false;
  }
}
