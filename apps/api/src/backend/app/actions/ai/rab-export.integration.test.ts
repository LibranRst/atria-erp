import { beforeAll, beforeEach, afterAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq, count } from "drizzle-orm";
import { db } from "@backend/db";
import {
  tenant,
  role,
  rolePermission,
  user,
  client,
  project,
  rabEstimate,
  rabEstimateItem,
  rabEstimateBundle,
  aiConversation,
  aiMessage,
  auditLog,
  aiProposalConfirmation,
  cashTransaction,
  stockMovement,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { resolveActor, type Actor } from "@backend/server/actor";
import { withTestRequest } from "@backend/lib/testing/request";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { prepareRabExport, readRabExport } from "@backend/server/usecases/ai/rab-export-context";
import { getAiRabExportPreview } from "./rab-export";
import { buildRabExportTools } from "@backend/lib/ai/tools/rab-export-tools";
const api = auth.api as unknown as { getSession: unknown },
  original = api.getSession;
let actor: Actor, pId: string, rId: string, roleId: string, lineId: string;
async function proof(): Promise<{ conversationId: string; toolCallId: string; messageId: string }> {
  const proposal = await prepareRabExport(actor, {
    projectId: pId,
    rabEstimateId: rId,
    format: "PDF",
  });
  const [c] = await db
    .insert(aiConversation)
    .values({ userId: actor.userId, title: "QA export" })
    .returning();
  const toolCallId = randomUUID();
  const [m] = await db
    .insert(aiMessage)
    .values({
      conversationId: c.id,
      role: "assistant",
      parts: [
        {
          type: "tool-prepareRabExport",
          state: "output-available",
          toolCallId,
          output: { proposal },
        },
      ],
    })
    .returning();
  return { conversationId: c.id, toolCallId, messageId: m.id };
}
const read = withTestRequest(getAiRabExportPreview);
async function invariant(): Promise<readonly number[]> {
  return Promise.all(
    [auditLog, aiProposalConfirmation, cashTransaction, stockMovement].map(
      async (t) => (await db.select({ n: count() }).from(t))[0].n,
    ),
  );
}
describeIntegration("RAB export owned read-only workflow", () => {
  beforeAll(async () => {
    await db
      .insert(tenant)
      .values({ id: INSTANCE_TENANT_ID, name: "QA", slug: "qa-export" })
      .onConflictDoNothing();
  });
  beforeEach(async () => {
    const [r] = await db
      .insert(role)
      .values({ name: `EXPORT_${randomUUID().slice(0, 12)}`, dataScope: "GLOBAL" })
      .returning();
    roleId = r.id;
    await db.insert(rolePermission).values(
      (["use:ai_chat", "view:project", "view:rab"] as const).map((permissionKey) => ({
        roleId,
        permissionKey,
      })),
    );
    const [u] = await db
      .insert(user)
      .values({ name: "QA exporter", email: `${randomUUID()}@fixture.invalid`, roleId })
      .returning();
    api.getSession = async () => ({ user: u, session: { id: "test", userId: u.id } });
    const a = await withTestRequest(resolveActor)();
    if (!a) throw new Error("actor");
    actor = a;
    const [c] = await db
      .insert(client)
      .values({ name: "Klien QA", email: `${randomUUID()}@fixture.invalid`, phone: "000" })
      .returning();
    const [p] = await db
      .insert(project)
      .values({
        name: "Proyek ekspor QA",
        clientId: c.id,
        location: "QA",
        projectManagerId: u.id,
        totalContractValue: "100",
        status: "DRAFT",
      })
      .returning();
    pId = p.id;
    const [rab] = await db
      .insert(rabEstimate)
      .values({
        projectId: pId,
        title: "RAB QA",
        revision: 1,
        status: "DRAFT",
        clientNotes: "Ketentuan klien nyata",
      })
      .returning();
    rId = rab.id;
    const [line] = await db
      .insert(rabEstimateItem)
      .values({
        rabEstimateId: rId,
        clientLabel: "Panel klien",
        description: "Spesifikasi klien",
        quantity: "2",
        unit: "lembar",
        unitPrice: "125.25",
        lineTotal: "250.50",
        sourceType: "MANUAL",
      })
      .returning();
    lineId = line.id;
  });
  afterAll(() => {
    api.getSession = original;
  });
  test("explicit revision, exact sen and only client-safe data; preparation/read never writes", async () => {
    const before = await invariant();
    const id = await proof();
    const afterProof = await invariant();
    expect(afterProof).toEqual(before);
    const result = await read({ conversationId: id.conversationId, toolCallId: id.toolCallId });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error.message);
    expect(result.data.proposal.total).toBe("250.50");
    expect(result.data.status).toBe("READY");
    const serialized = JSON.stringify(result.data.document);
    for (const key of [
      "sourceType",
      "sourceProjectRapId",
      "sourceLibraryItemId",
      "sourceUpdatedAt",
      "internalCost",
      "margin",
    ])
      expect(serialized).not.toContain(key);
    expect(await invariant()).toEqual(before);
  });
  test("hidden bundle and children cannot escape; visible bundle has no component prices/double count", async () => {
    const [b] = await db
      .insert(rabEstimateBundle)
      .values({
        rabEstimateId: rId,
        clientLabel: "Paket klien",
        quantity: "1",
        unit: "paket",
        unitPrice: "500.25",
        lineTotal: "500.25",
      })
      .returning();
    await db.update(rabEstimateItem).set({ bundleId: b.id }).where(eq(rabEstimateItem.id, lineId));
    const good = await readRabExport(
      actor,
      { projectId: pId, rabEstimateId: rId, format: "EXCEL" },
      new Date().toISOString(),
    );
    expect(good.proposal.total).toBe("500.25");
    expect(good.document.estimate.items[0].unitPrice).toBe("0.00");
    await db
      .update(rabEstimateBundle)
      .set({ isHidden: true })
      .where(eq(rabEstimateBundle.id, b.id));
    await expect(
      prepareRabExport(actor, { projectId: pId, rabEstimateId: rId, format: "PDF" }),
    ).rejects.toThrow("Belum ada baris");
  });
  test("stale source/header/contact/visibility blocks release until a fresh descriptor", async () => {
    const id = await proof();
    await db
      .update(rabEstimateItem)
      .set({ unitPrice: "130", lineTotal: "260" })
      .where(eq(rabEstimateItem.id, lineId));
    const r = await read({ conversationId: id.conversationId, toolCallId: id.toolCallId });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.status).toBe("STALE");
      expect(r.data.document).toBeNull();
    }
    const newer = await proof();
    const fresh = await read({
      conversationId: newer.conversationId,
      toolCallId: newer.toolCallId,
    });
    expect(fresh.success && fresh.data.status).toBe("READY");
  });
  test("ownership, strict identity, grant revocation and inactive actor refuse", async () => {
    const id = await proof();
    expect(
      (
        await read({
          conversationId: id.conversationId,
          toolCallId: id.toolCallId,
          userId: actor.userId,
        })
      ).success,
    ).toBe(false);
    expect((await read({ conversationId: randomUUID(), toolCallId: id.toolCallId })).success).toBe(
      false,
    );
    await db
      .delete(rolePermission)
      .where(and(eq(rolePermission.roleId, roleId), eq(rolePermission.permissionKey, "view:rab")));
    expect(
      (await read({ conversationId: id.conversationId, toolCallId: id.toolCallId })).success,
    ).toBe(false);
    await expect(
      readRabExport(
        actor,
        { projectId: pId, rabEstimateId: rId, format: "PDF" },
        new Date().toISOString(),
      ),
    ).rejects.toThrow("Izin ekspor");
    await db.insert(rolePermission).values({ roleId, permissionKey: "view:rab" });
    await db.update(user).set({ isActive: false }).where(eq(user.id, actor.userId));
    await expect(
      readRabExport(
        actor,
        { projectId: pId, rabEstimateId: rId, format: "PDF" },
        new Date().toISOString(),
      ),
    ).rejects.toThrow("Akun atau akses");
  });
  test("ASSIGNED only own project; NONE and another tenant are inaccessible", async () => {
    await db.update(role).set({ dataScope: "ASSIGNED" }).where(eq(role.id, roleId));
    expect(
      (await prepareRabExport(actor, { projectId: pId, rabEstimateId: rId, format: "PDF" }))
        .revision,
    ).toBe(1);
    await db.update(project).set({ projectManagerId: null }).where(eq(project.id, pId));
    await expect(
      prepareRabExport(actor, { projectId: pId, rabEstimateId: rId, format: "PDF" }),
    ).rejects.toThrow("di luar akses");
    await db.update(role).set({ dataScope: "NONE" }).where(eq(role.id, roleId));
    await expect(
      prepareRabExport(actor, { projectId: pId, rabEstimateId: rId, format: "PDF" }),
    ).rejects.toThrow("Izin ekspor");
    await db.update(role).set({ dataScope: "GLOBAL" }).where(eq(role.id, roleId));
    const [foreign] = await db
      .insert(tenant)
      .values({ name: "Foreign QA", slug: `export-${randomUUID()}` })
      .returning();
    await db.update(project).set({ tenantId: foreign.id }).where(eq(project.id, pId));
    await expect(
      prepareRabExport(actor, { projectId: pId, rabEstimateId: rId, format: "PDF" }),
    ).rejects.toThrow("di luar akses");
  });
  test("approved visible totals must match the selected approved revision", async () => {
    await db
      .update(rabEstimate)
      .set({ status: "APPROVED", approvedValue: "251.50" })
      .where(eq(rabEstimate.id, rId));
    await expect(
      prepareRabExport(actor, { projectId: pId, rabEstimateId: rId, format: "EXCEL" }),
    ).rejects.toThrow("tidak konsisten");
    await db.update(rabEstimate).set({ approvedValue: "250.50" }).where(eq(rabEstimate.id, rId));
    expect(
      (await prepareRabExport(actor, { projectId: pId, rabEstimateId: rId, format: "PNG" })).status,
    ).toBe("APPROVED");
  });
  test("expired and VOID/empty revisions never return downloadable content", async () => {
    const id = await proof();
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, id.messageId));
    const r = await read({ conversationId: id.conversationId, toolCallId: id.toolCallId });
    expect(r.success && r.data.status).toBe("EXPIRED");
    if (r.success) expect(r.data.document).toBeNull();
    await db.update(rabEstimate).set({ status: "VOID" }).where(eq(rabEstimate.id, rId));
    await expect(
      prepareRabExport(actor, { projectId: pId, rabEstimateId: rId, format: "PNG" }),
    ).rejects.toThrow("dibatalkan");
  });
  test("one-character lookup requests choice and actual revision IDs are paginated", async () => {
    const tools = buildRabExportTools(actor),
      call = { toolCallId: "lookup", messages: [], context: {} };
    const r = await withTestRequest(async () =>
      tools.getRabExportContext.execute?.({ projectQuery: "P", offset: 0 }, call),
    )();
    expect(r).toMatchObject({ needsDisambiguation: true });
    const revisions = await withTestRequest(async () =>
      tools.getRabExportContext.execute?.({ projectId: pId, offset: 0 }, call),
    )();
    expect(revisions).toMatchObject({
      needsRevisionChoice: false,
      revisions: [{ id: rId, revision: 1, status: "DRAFT", exportable: true }],
    });
  });
});
