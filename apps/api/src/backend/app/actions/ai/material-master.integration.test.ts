import { beforeAll, afterAll, expect, test, mock, spyOn } from "bun:test";
import type { Actor } from "@backend/server/actor";
import { randomUUID } from "node:crypto";
import { and, eq, like, count, inArray } from "drizzle-orm";
import { Pool } from "pg";
import { db } from "@backend/db";
import { auth } from "@backend/lib/auth";
import {
  aiConversation,
  aiMessage,
  formDraft,
  materialImportAnalysisJob,
  materialMaster,
  materialInventory,
  auditLog,
  cashTransaction,
  stockMovement,
  rolePermission,
  materialCategory,
  inventoryLocation,
  vendor,
} from "@backend/db/schema";
import { withTestRequest } from "@backend/lib/testing/request";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import {
  materialFieldsSchema,
  type MaterialDraftView,
  type MaterialFields,
  type MaterialSource,
} from "@atria/core/ai/material-import";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  loadMaterialReferences,
  createMaterialMasterTx,
} from "@backend/server/usecases/material/master-writer";
import {
  startAiMaterialAnalysis,
  saveAiMaterialRows,
  getAiMaterialDraft,
  patchAiMaterialDraft,
  selectAiMaterialRows,
  confirmAiMaterialReference,
} from "./material-master";
const owner = {
  id: "11111111-1111-1111-1111-111111111111",
  roleId: "00000000-0000-0000-0000-000000000001",
  name: "Fixture Owner",
  email: "owner@fixture.invalid",
  isActive: true,
  mustChangePassword: false,
};
const purchasing = {
  ...owner,
  id: "33333333-3333-3333-3333-333333333333",
  roleId: "00000000-0000-0000-0000-000000000004",
};
const sessionApi = auth.api as unknown as { getSession: unknown };
const original = sessionApi.getSession;
const prefix = `AI-TEST-${randomUUID().slice(0, 8)}`;
const conversations: string[] = [];
const drafts: string[] = [];
function actAs(person = owner): void {
  sessionApi.getSession = async () => ({
    user: person,
    session: { id: randomUUID(), userId: person.id, expiresAt: new Date(Date.now() + 3600000) },
  });
}
function success<T>(result: ActionResponse<T>): T {
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}
let base: MaterialFields;
async function proposal(
  fields: readonly MaterialFields[],
  person = owner,
): Promise<MaterialDraftView> {
  actAs(person);
  const [conversation] = await db.insert(aiConversation).values({ userId: person.id }).returning();
  conversations.push(conversation.id);
  const toolCallId = randomUUID();
  await db.insert(aiMessage).values({
    conversationId: conversation.id,
    role: "assistant",
    parts: [
      {
        type: "tool-proposeMaterialMaster",
        toolCallId,
        state: "output-available",
        output: {
          proposal: { kind: "MATERIAL_MASTER_IMPORT", rows: fields, attachmentUrls: [] },
        },
      },
    ],
  });
  const draft = success(
    await withTestRequest(startAiMaterialAnalysis)({ conversationId: conversation.id, toolCallId }),
  );
  drafts.push(draft.id);
  return draft;
}
describeIntegration("Material AI transactional workflow", () => {
  beforeAll(async () => {
    const refs = await loadMaterialReferences();
    base = materialFieldsSchema.parse({
      name: `${prefix}-base`,
      categoryName: refs.categories[0].name,
      unit: "lembar",
      locationName: refs.locations.find((row) => row.isActive)?.name,
    });
  });
  afterAll(async () => {
    sessionApi.getSession = original;
    for (const id of conversations)
      await db.delete(aiConversation).where(eq(aiConversation.id, id));
    for (const id of drafts) await db.delete(formDraft).where(eq(formDraft.id, id));
    const materials = await db.query.materialMaster.findMany({
      where: like(materialMaster.name, `${prefix}%`),
      columns: { id: true },
    });
    const ids = materials.map((row) => row.id);
    if (ids.length)
      await db.transaction(async (tx) => {
        await tx.delete(materialInventory).where(inArray(materialInventory.materialId, ids));
        await tx.delete(auditLog).where(inArray(auditLog.targetId, ids));
        await tx.delete(materialMaster).where(inArray(materialMaster.id, ids));
      });
    await db.delete(materialInventory).where(
      inArray(
        materialInventory.locationId,
        (
          await db.query.inventoryLocation.findMany({
            where: like(inventoryLocation.name, `${prefix}%`),
            columns: { id: true },
          })
        ).map((row) => row.id),
      ),
    );
    await db.delete(materialCategory).where(like(materialCategory.name, `${prefix}%`));
    await db.delete(inventoryLocation).where(like(inventoryLocation.name, `${prefix}%`));
    await db.delete(vendor).where(like(vendor.name, `${prefix}%`));
  });
  test("approval, partial save, replay, reopen and zero stock/cash", async () => {
    let draft = await proposal([
      { ...base, name: `${prefix}-one` },
      { ...base, name: `${prefix}-two` },
      { ...base, name: `${prefix}-missing`, categoryName: "" },
    ]);
    expect(
      await db.query.materialMaster.findFirst({ where: eq(materialMaster.name, `${prefix}-one`) }),
    ).toBeUndefined();
    const [cashBefore] = await db.select({ value: count() }).from(cashTransaction);
    const [stockBefore] = await db.select({ value: count() }).from(stockMovement);
    const operationId = randomUUID();
    const revision = draft.revision;
    const first = draft.payload.rows[0].id;
    draft = success(
      await withTestRequest(saveAiMaterialRows)({
        draftId: draft.id,
        expectedRevision: revision,
        operationId,
        rowIds: [first],
      }),
    );
    const id = draft.payload.rows[0].materialId;
    expect(id).toBeTruthy();
    expect(draft.payload.rows[1].materialId).toBeNull();
    const replay = success(
      await withTestRequest(saveAiMaterialRows)({
        draftId: draft.id,
        expectedRevision: revision,
        operationId,
        rowIds: [first],
      }),
    );
    expect(replay.payload.rows[0].materialId).toBe(id);
    expect(replay.payload.receipts).toHaveLength(1);
    draft = success(await withTestRequest(getAiMaterialDraft)({ draftId: draft.id }));
    draft = success(
      await withTestRequest(saveAiMaterialRows)({
        draftId: draft.id,
        expectedRevision: draft.revision,
        operationId: randomUUID(),
        rowIds: [draft.payload.rows[1].id],
      }),
    );
    expect(draft.payload.receipts).toHaveLength(2);
    expect(draft.payload.rows[2].issues.length).toBeGreaterThan(0);
    if (!id) throw new Error("Missing material ID");
    const inventory = await db.query.materialInventory.findFirst({
      where: eq(materialInventory.materialId, id),
    });
    expect(Number(inventory?.currentStock)).toBe(0);
    expect(Number(inventory?.reservedStock)).toBe(0);
    expect(await db.query.auditLog.findFirst({ where: eq(auditLog.targetId, id) })).toBeDefined();
    expect((await db.select({ value: count() }).from(cashTransaction))[0].value).toBe(
      cashBefore.value,
    );
    expect((await db.select({ value: count() }).from(stockMovement))[0].value).toBe(
      stockBefore.value,
    );
  });
  test("500 selected rows commit as one batch with per-material audit", async () => {
    const draft = await proposal(
      Array.from({ length: 500 }, (_, index) => ({ ...base, name: `${prefix}-bulk-${index}` })),
    );
    const saved = success(
      await withTestRequest(saveAiMaterialRows)({
        draftId: draft.id,
        expectedRevision: draft.revision,
        operationId: randomUUID(),
        rowIds: draft.payload.rows.map((row) => row.id),
      }),
    );
    expect(saved.payload.rows.filter((row) => row.materialId)).toHaveLength(500);
    expect(saved.payload.receipts).toHaveLength(1);
    expect(saved.payload.receipts[0].rows).toHaveLength(500);
    const materialId = saved.payload.rows[499].materialId;
    if (!materialId) throw new Error("Missing bulk result");
    expect(
      await db.query.auditLog.findFirst({ where: eq(auditLog.targetId, materialId) }),
    ).toBeDefined();
  }, 30000);

  test("bulk selection preserves source review and common corrections are idempotent", async () => {
    let draft = await proposal([
      { ...base, name: `${prefix}-bulk-correction`, categoryName: "", locationName: "" },
    ]);
    draft.payload.rows[0].needsSourceReview = true;
    await db.update(formDraft).set({ payload: draft.payload }).where(eq(formDraft.id, draft.id));
    draft = success(
      await withTestRequest(selectAiMaterialRows)({
        draftId: draft.id,
        expectedRevision: draft.revision,
        selectedRowIds: [],
      }),
    );
    expect(draft.payload.rows[0].selected).toBe(false);
    expect(draft.payload.rows[0].needsSourceReview).toBe(true);
    const toolCallId = randomUUID();
    await db.insert(aiMessage).values({
      conversationId: draft.payload.conversationId,
      role: "assistant",
      parts: [
        {
          type: "tool-proposeMaterialMaster",
          toolCallId,
          state: "output-available",
          output: {
            proposal: {
              kind: "MATERIAL_MASTER_IMPORT",
              correctionDraftId: draft.id,
              bulkCorrections: [
                {
                  fields: { categoryName: base.categoryName, locationName: base.locationName },
                  selected: true,
                },
              ],
            },
          },
        },
      ],
    });
    const corrected = success(
      await withTestRequest(startAiMaterialAnalysis)({
        conversationId: draft.payload.conversationId,
        toolCallId,
      }),
    );
    expect(corrected.payload.rows[0].fields.locationName).toBe(base.locationName);
    expect(corrected.payload.rows[0].needsSourceReview).toBe(true);
    const replay = success(
      await withTestRequest(startAiMaterialAnalysis)({
        conversationId: draft.payload.conversationId,
        toolCallId,
      }),
    );
    expect(replay.revision).toBe(corrected.revision);
  });
  test("an attachment-backed proposal always queues the full source, not a truncated preview", async () => {
    actAs(owner);
    const [conversation] = await db.insert(aiConversation).values({ userId: owner.id }).returning();
    conversations.push(conversation.id);
    const url = `http://atria-api.test/api/media/${randomUUID()}`;
    await db.insert(aiMessage).values({
      conversationId: conversation.id,
      role: "user",
      parts: [
        { type: "text", text: "Tambahkan semua material ke Gudang utama" },
        {
          type: "file",
          url,
          filename: "catalog.xlsx",
          mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    });
    const toolCallId = randomUUID();
    await db.insert(aiMessage).values({
      conversationId: conversation.id,
      role: "assistant",
      parts: [
        {
          type: "tool-proposeMaterialMaster",
          toolCallId,
          state: "output-available",
          output: {
            proposal: {
              kind: "MATERIAL_MASTER_IMPORT",
              rows: [{ ...base, name: `${prefix}-preview-only` }],
            },
          },
        },
      ],
    });
    const draft = success(
      await withTestRequest(startAiMaterialAnalysis)({
        conversationId: conversation.id,
        toolCallId,
      }),
    );
    drafts.push(draft.id);
    expect(draft.payload.analysisStatus).toBe("QUEUED");
    expect(draft.payload.rows).toHaveLength(0);
    expect(draft.payload.sourceInstruction).toContain("Gudang utama");
    const job = await db.query.materialImportAnalysisJob.findFirst({
      where: eq(materialImportAnalysisJob.draftId, draft.id),
    });
    expect(job?.attachmentUrls).toEqual([url]);
    await db
      .update(materialImportAnalysisJob)
      .set({ status: "DONE" })
      .where(eq(materialImportAnalysisJob.draftId, draft.id));
  });
  test("Purchasing approves references together, replays receipt and preserves deliberate selection", async () => {
    let draft = await proposal(
      [
        {
          ...base,
          name: `${prefix}-references`,
          categoryName: `${prefix}-category-source`,
          locationName: `${prefix}-location-source`,
          withoutVendor: true,
        },
      ],
      purchasing,
    );
    draft = success(
      await withTestRequest(selectAiMaterialRows)({
        draftId: draft.id,
        expectedRevision: draft.revision,
        selectedRowIds: [],
      }),
    );
    const revision = draft.revision;
    const operationId = randomUUID();
    const input = {
      draftId: draft.id,
      expectedRevision: revision,
      operationId,
      references: [
        {
          sourceName: `${prefix}-category-source`,
          reference: { kind: "category", name: `${prefix}-category-approved`, phone: "" },
        },
        {
          sourceName: `${prefix}-location-source`,
          reference: { kind: "location", name: `${prefix}-location-approved`, phone: "" },
        },
      ],
    };
    const cashBefore = (await db.select({ value: count() }).from(cashTransaction))[0].value;
    const stockBefore = (await db.select({ value: count() }).from(stockMovement))[0].value;
    draft = success(await withTestRequest(confirmAiMaterialReference)(input));
    expect(draft.payload.rows[0].issues).toHaveLength(0);
    expect(draft.payload.rows[0].selected).toBe(false);
    expect(draft.payload.rows[0].materialId).toBeNull();
    const receipt = draft.payload.referenceBatchReceipts?.[operationId];
    expect(receipt).toHaveLength(2);
    const replay = success(await withTestRequest(confirmAiMaterialReference)(input));
    expect(replay.revision).toBe(draft.revision);
    expect(replay.payload.referenceBatchReceipts?.[operationId]).toEqual(receipt);
    const location = await db.query.inventoryLocation.findFirst({
      where: eq(inventoryLocation.name, `${prefix}-location-approved`),
    });
    if (!location) throw new Error("Missing approved location");
    const inventory = await db.query.materialInventory.findMany({
      where: eq(materialInventory.locationId, location.id),
    });
    expect(inventory.length).toBeGreaterThan(0);
    expect(
      inventory.every((row) => Number(row.currentStock) === 0 && Number(row.reservedStock) === 0),
    ).toBe(true);
    expect((await db.select({ value: count() }).from(cashTransaction))[0].value).toBe(cashBefore);
    expect((await db.select({ value: count() }).from(stockMovement))[0].value).toBe(stockBefore);
  });
  test("a failed reference rolls back the entire group and leaves no receipt", async () => {
    const draft = await proposal([
      {
        ...base,
        name: `${prefix}-reference-rollback`,
        categoryName: `${prefix}-category-rollback`,
        vendorName: `${prefix}-vendor-rollback`,
        withoutVendor: false,
      },
    ]);
    const operationId = randomUUID();
    const result = await withTestRequest(confirmAiMaterialReference)({
      draftId: draft.id,
      expectedRevision: draft.revision,
      operationId,
      references: [
        {
          sourceName: `${prefix}-category-rollback`,
          reference: { kind: "category", name: `${prefix}-category-rollback`, phone: "" },
        },
        {
          sourceName: `${prefix}-vendor-rollback`,
          reference: { kind: "vendor", name: `${prefix}-vendor-rollback`, phone: "" },
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(
      await db.query.materialCategory.findFirst({
        where: eq(materialCategory.name, `${prefix}-category-rollback`),
      }),
    ).toBeUndefined();
    const current = success(await withTestRequest(getAiMaterialDraft)({ draftId: draft.id }));
    expect(current.revision).toBe(draft.revision);
    expect(current.payload.referenceBatchReceipts?.[operationId]).toBeUndefined();
  });
  test("group renames resolve original source names without cascading into other rows", async () => {
    const a = `${prefix}-reference-original-a`,
      b = `${prefix}-reference-original-b`,
      c = `${prefix}-reference-final-c`;
    const draft = await proposal([
      { ...base, name: `${prefix}-rename-a`, categoryName: a, withoutVendor: true },
      { ...base, name: `${prefix}-rename-b`, categoryName: b, withoutVendor: true },
    ]);
    const updated = success(
      await withTestRequest(confirmAiMaterialReference)({
        draftId: draft.id,
        expectedRevision: draft.revision,
        operationId: randomUUID(),
        references: [
          { sourceName: a, reference: { kind: "category", name: b, phone: "" } },
          { sourceName: b, reference: { kind: "category", name: c, phone: "" } },
        ],
      }),
    );
    expect(updated.payload.rows.map((row) => row.fields.categoryName)).toEqual([b, c]);
    expect(updated.payload.rows.every((row) => row.issues.length === 0)).toBe(true);
  });
  test("Purchasing cannot approve a group containing a vendor", async () => {
    const draft = await proposal(
      [
        {
          ...base,
          name: `${prefix}-reference-permission`,
          categoryName: `${prefix}-category-forbidden`,
          vendorName: `${prefix}-vendor-forbidden`,
          withoutVendor: false,
        },
      ],
      purchasing,
    );
    const result = await withTestRequest(confirmAiMaterialReference)({
      draftId: draft.id,
      expectedRevision: draft.revision,
      operationId: randomUUID(),
      references: [
        {
          sourceName: `${prefix}-category-forbidden`,
          reference: { kind: "category", name: `${prefix}-category-forbidden`, phone: "" },
        },
        {
          sourceName: `${prefix}-vendor-forbidden`,
          reference: { kind: "vendor", name: `${prefix}-vendor-forbidden`, phone: "081234567890" },
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(
      await db.query.materialCategory.findFirst({
        where: eq(materialCategory.name, `${prefix}-category-forbidden`),
      }),
    ).toBeUndefined();
  });
  test("ownership, stale edit and Purchasing vendor permission", async () => {
    const draft = await proposal(
      [{ ...base, name: `${prefix}-permissions`, vendorName: "Missing Vendor" }],
      purchasing,
    );
    expect(
      (
        await withTestRequest(confirmAiMaterialReference)({
          draftId: draft.id,
          expectedRevision: draft.revision,
          operationId: randomUUID(),
          reference: { kind: "vendor", name: "Missing Vendor", phone: "0812345678" },
        })
      ).success,
    ).toBe(false);
    expect(
      (
        await withTestRequest(patchAiMaterialDraft)({
          draftId: draft.id,
          expectedRevision: draft.revision + 1,
          rows: [],
        })
      ).success,
    ).toBe(false);
    actAs(owner);
    expect((await withTestRequest(getAiMaterialDraft)({ draftId: draft.id })).success).toBe(false);
    actAs(purchasing);
    const patched = success(
      await withTestRequest(patchAiMaterialDraft)({
        draftId: draft.id,
        expectedRevision: draft.revision,
        rows: [
          {
            id: draft.payload.rows[0].id,
            fields: { ...draft.payload.rows[0].fields, withoutVendor: true },
            selected: true,
          },
        ],
      }),
    );
    expect(patched.payload.rows[0].issues).toEqual([]);
  });
  test("catalog lock prevents concurrent creation", async () => {
    const refs = await loadMaterialReferences();
    const location = refs.locations.find((row) => row.isActive);
    if (!location) throw new Error("Fixture location missing");
    const input = {
      name: `${prefix}-race`,
      categoryId: refs.categories[0].id,
      unit: "unit",
      inventoryDefaults: [
        { inventoryLocationId: location.id, minimumStock: 0, lastPurchasePrice: 0 },
      ],
    };
    const outcomes = await Promise.allSettled([
      db.transaction((tx) => createMaterialMasterTx(tx, owner.id, input)),
      db.transaction((tx) => createMaterialMasterTx(tx, owner.id, input)),
    ]);
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
  test("mid-commit audit failure rolls back domain data and receipt", async () => {
    const pool = new Pool({ connectionString: process.env.ATRIA_TEST_DATABASE_URL });
    const trigger = `material_ai_failure_${randomUUID().replaceAll("-", "")}`;
    let draft = await proposal([
      { ...base, name: `${prefix}-rollback-one` },
      { ...base, name: `${prefix}-rollback-two` },
    ]);
    try {
      await pool.query(
        `CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.new_state LIKE '%${prefix}-rollback-two%' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$`,
      );
      await pool.query(
        `CREATE TRIGGER ${trigger} BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION ${trigger}()`,
      );
      expect(
        (
          await withTestRequest(saveAiMaterialRows)({
            draftId: draft.id,
            expectedRevision: draft.revision,
            operationId: randomUUID(),
            rowIds: draft.payload.rows.map((row) => row.id),
          })
        ).success,
      ).toBe(false);
      expect(
        await db.query.materialMaster.findFirst({
          where: eq(materialMaster.name, `${prefix}-rollback-one`),
        }),
      ).toBeUndefined();
      draft = success(await withTestRequest(getAiMaterialDraft)({ draftId: draft.id }));
      expect(draft.payload.receipts).toHaveLength(0);
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON audit_log`);
      await pool.query(`DROP FUNCTION IF EXISTS ${trigger}()`);
      await pool.end();
    }
  });
  test("permission revocation blocks existing proposals", async () => {
    const draft = await proposal([{ ...base, name: `${prefix}-revoked` }], purchasing);
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, purchasing.roleId),
          eq(rolePermission.permissionKey, "manage:material_settings"),
        ),
      );
    try {
      expect(
        (
          await withTestRequest(saveAiMaterialRows)({
            draftId: draft.id,
            expectedRevision: draft.revision,
            operationId: randomUUID(),
            rowIds: [draft.payload.rows[0].id],
          })
        ).success,
      ).toBe(false);
    } finally {
      await db
        .insert(rolePermission)
        .values({ roleId: purchasing.roleId, permissionKey: "manage:material_settings" })
        .onConflictDoNothing();
    }
  });
  test("structured reads checkpoint immediately and 500 sources across two files are not counted twice", async () => {
    const source = await import("@backend/server/services/material-analysis-source");
    const worker = await import("@backend/server/services/material-analysis-worker");
    const draft = await proposal([{ ...base, name: `${prefix}-structured-worker` }]);
    const extraction = spyOn(source, "extractMaterialSources").mockImplementation(
      async (
        _actor: Actor,
        url: string,
      ): Promise<{ sources: MaterialSource[]; totalPages: number }> => ({
        totalPages: 1,
        sources: Array.from({ length: 250 }, (_, index) => ({
          attachmentUrl: url,
          fileName: "catalog.xlsx",
          sheet: "Material",
          row: index + 2,
          raw: `Kolom: ${JSON.stringify(["Nama", "Kategori", "Satuan", "Lokasi", "Tanpa Vendor"])}\nData: ${JSON.stringify([`${prefix}-${url}-${index}`, base.categoryName, "lembar", base.locationName, "Ya"])}`,
        })),
      }),
    );
    try {
      await db
        .update(formDraft)
        .set({ payload: { ...draft.payload, rows: [], analysisStatus: "QUEUED" } })
        .where(eq(formDraft.id, draft.id));
      await db
        .update(materialImportAnalysisJob)
        .set({
          status: "QUEUED",
          attachmentUrls: ["first", "second"],
          extracted: 0,
          cursor: 0,
          sources: [],
        })
        .where(eq(materialImportAnalysisJob.draftId, draft.id));
      await worker.processMaterialAnalysisStep();
      let current = success(await withTestRequest(getAiMaterialDraft)({ draftId: draft.id }));
      expect(current.payload.progress).toBe(20);
      expect(current.payload.rows).toHaveLength(20);
      await worker.processMaterialAnalysisStep();
      const checkpoint = await db.query.materialImportAnalysisJob.findFirst({
        where: eq(materialImportAnalysisJob.draftId, draft.id),
      });
      expect(checkpoint?.sources).toHaveLength(500);
      expect(checkpoint?.cursor).toBe(40);
      for (let step = 0; step < 23; step++) await worker.processMaterialAnalysisStep();
      current = success(await withTestRequest(getAiMaterialDraft)({ draftId: draft.id }));
      expect(current.payload.analysisStatus).toBe("READY");
      expect(current.payload.rows).toHaveLength(500);
      expect(new Set(current.payload.rows.map((row) => row.id)).size).toBe(500);
      expect(current.payload.rows.every((row) => !row.materialId)).toBe(true);
    } finally {
      extraction.mockRestore();
    }
  });
  test("analysis recovers an expired lease and retries from the same checkpoint", async () => {
    const source = await import("@backend/server/services/material-analysis-source");
    let fail = true;
    mock.module("@backend/server/services/material-analysis-source", () => ({
      ...source,
      mapMaterialSources: async (sources: readonly MaterialSource[]) => {
        if (fail) {
          fail = false;
          throw new Error("synthetic transient provider failure");
        }
        return sources.map((item, index) => ({
          index,
          fields: materialFieldsSchema.parse(JSON.parse(item.raw)),
          uncertain: false,
        }));
      },
    }));
    const worker = await import("@backend/server/services/material-analysis-worker");
    const draft = await proposal([{ ...base, name: `${prefix}-worker` }]);
    await db
      .update(formDraft)
      .set({ payload: { ...draft.payload, rows: [], analysisStatus: "QUEUED" } })
      .where(eq(formDraft.id, draft.id));
    await db
      .update(materialImportAnalysisJob)
      .set({
        status: "PROCESSING",
        leaseToken: randomUUID(),
        leaseExpiresAt: new Date(0),
        sources: Array.from({ length: 25 }, (_, index) => ({
          row: index + 1,
          raw: JSON.stringify({ ...base, name: `${prefix}-worker-${index}` }),
        })),
      })
      .where(eq(materialImportAnalysisJob.draftId, draft.id));
    expect(await worker.processMaterialAnalysisStep()).toBe(true);
    const failed = await db.query.materialImportAnalysisJob.findFirst({
      where: eq(materialImportAnalysisJob.draftId, draft.id),
    });
    expect(failed?.cursor).toBe(0);
    expect(failed?.attempts).toBe(1);
    await db
      .update(materialImportAnalysisJob)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(materialImportAnalysisJob.draftId, draft.id));
    await worker.processMaterialAnalysisStep();
    let resumed = success(await withTestRequest(getAiMaterialDraft)({ draftId: draft.id }));
    // Unstructured model work uses five-row checkpoints within the 20-row ceiling.
    expect(resumed.payload.rows).toHaveLength(5);
    for (let step = 0; step < 4; step++) await worker.processMaterialAnalysisStep();
    resumed = success(await withTestRequest(getAiMaterialDraft)({ draftId: draft.id }));
    expect(resumed.payload.rows).toHaveLength(25);
    expect(resumed.payload.analysisStatus).toBe("READY");
    expect(
      await db.query.materialMaster.findFirst({
        where: eq(materialMaster.name, `${prefix}-worker-0`),
      }),
    ).toBeUndefined();
  });
  test("an expired worker cannot overwrite a recovered checkpoint", async () => {
    const source = await import("@backend/server/services/material-analysis-source");
    let first = true;
    let release = (): void => undefined;
    let started = (): void => undefined;
    const firstStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    mock.module("@backend/server/services/material-analysis-source", () => ({
      ...source,
      mapMaterialSources: async (sources: readonly MaterialSource[]) => {
        if (first) {
          first = false;
          started();
          await barrier;
        }
        return sources.map((item, index) => ({
          index,
          fields: materialFieldsSchema.parse(JSON.parse(item.raw)),
          uncertain: false,
        }));
      },
    }));
    const worker = await import("@backend/server/services/material-analysis-worker");
    const draft = await proposal([{ ...base, name: `${prefix}-fence` }]);
    await db
      .update(formDraft)
      .set({ payload: { ...draft.payload, rows: [], analysisStatus: "QUEUED" } })
      .where(eq(formDraft.id, draft.id));
    await db
      .update(materialImportAnalysisJob)
      .set({
        status: "QUEUED",
        sources: [{ row: 1, raw: JSON.stringify({ ...base, name: `${prefix}-fenced-source` }) }],
      })
      .where(eq(materialImportAnalysisJob.draftId, draft.id));
    const oldWorker = worker.processMaterialAnalysisStep();
    await firstStarted;
    await db
      .update(materialImportAnalysisJob)
      .set({ leaseExpiresAt: new Date(0) })
      .where(eq(materialImportAnalysisJob.draftId, draft.id));
    await worker.processMaterialAnalysisStep();
    release();
    await oldWorker;
    const saved = success(await withTestRequest(getAiMaterialDraft)({ draftId: draft.id }));
    expect(saved.payload.rows).toHaveLength(1);
    expect(saved.payload.analysisStatus).toBe("READY");
  });
});
