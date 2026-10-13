import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@backend/db";
import {
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  auditLog,
  cashTransaction,
  client,
  expenseCategory,
  formDraft,
  INSTANCE_TENANT_ID,
  materialInventory,
  project,
  projectBudgetCategory,
  projectBudgets,
  projectCategoryPlanItem,
  projectRap,
  projectRapItem,
  rabEstimate,
  rabEstimateItem,
  role,
  rolePermission,
  stockMovement,
  tenant,
  user,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { buildRabDraftTools } from "@backend/lib/ai/tools/rab-draft-tools";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { withTestRequest } from "@backend/lib/testing/request";
import { resolveActor } from "@backend/server/actor";
import { buildRabProposal, readRabContext } from "@backend/server/usecases/ai/rab-context";
import { generateRabFromSelectedSourcesTx } from "@backend/server/usecases/project/rab-generation-writer";
import {
  generateRabFromSelectedSources,
  generateRabFromRap,
} from "@backend/app/actions/project/rap-rab-generation";
import {
  confirmAiRabDraftProposal,
  getAiRabDraftProposal,
  patchAiRabDraftProposal,
} from "./rab-draft";
import {
  rabDraftInputSchema,
  type RabDraftPayload,
  type RabDraftProposal,
  type RabDraftView,
} from "@atria/core/ai/rab-draft";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { PermissionKey } from "@atria/core/auth/permissions";
const prefix = `RAB-${randomUUID().slice(0, 8)}`;
const permissions: readonly PermissionKey[] = ["use:ai_chat", "view:rap", "view:rab", "create:rab"];
type Person = {
  id: string;
  roleId: string;
  name: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
};
let owner: Person, assigned: Person, clientId: string, categoryId: string;
const projectIds: string[] = [],
  conversationIds: string[] = [];
const api = auth.api as unknown as { getSession: unknown },
  original = api.getSession;
function as(person: Person | null): void {
  api.getSession = async () =>
    person
      ? {
          user: person,
          session: {
            id: randomUUID(),
            userId: person.id,
            expiresAt: new Date(Date.now() + 3600000),
          },
        }
      : null;
}
function ok<T>(response: ActionResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}
const read = withTestRequest(getAiRabDraftProposal),
  patch = withTestRequest(patchAiRabDraftProposal),
  save = withTestRequest(confirmAiRabDraftProposal),
  manual = withTestRequest(generateRabFromSelectedSources),
  manualRap = withTestRequest(generateRabFromRap);
type Fixture = {
  projectId: string;
  rapId: string;
  materialId: string;
  packageId: string;
  budgetId: string;
};
async function fixture(): Promise<Fixture> {
  const [p] = await db
    .insert(project)
    .values({
      name: `${prefix}-${projectIds.length}`,
      clientId,
      projectManagerId: assigned.id,
      status: "ACTIVE",
      totalContractValue: "1000000.00",
    })
    .returning();
  projectIds.push(p.id);
  const [budget] = await db
    .insert(projectBudgets)
    .values({
      projectId: p.id,
      contractValue: "1000000.00",
      internalBudget: "800000.00",
      targetGrossPercentage: "20.00",
    })
    .returning();
  const [cat] = await db
    .insert(projectBudgetCategory)
    .values({
      projectBudgetId: budget.id,
      expenseCategoryId: categoryId,
      allocatedAmount: "200000.00",
      actualAmount: "10000.00",
      remainingAmount: "190000.00",
    })
    .returning();
  const [rap] = await db
    .insert(projectRap)
    .values({ projectId: p.id, status: "LOCKED", setupStage: "COMPLETE" })
    .returning();
  const [material] = await db
    .insert(projectRapItem)
    .values({
      projectRapId: rap.id,
      name: "Panel produksi",
      area: "Dapur",
      description: "PRIVATE_SCOPE",
      internalNote: "PRIVATE_VENDOR_MARGIN",
      unit: "lembar",
      requiredQuantity: "2.00",
      bufferQuantity: "0.50",
      totalQuantity: "2.50",
      estimatedUnitCost: "10000.00",
      estimatedTotalCost: "25000.00",
      suggestedClientUnitPrice: "12500.00",
      source: "PURCHASE",
    })
    .returning();
  const [pkg] = await db
    .insert(projectCategoryPlanItem)
    .values({
      projectId: p.id,
      projectBudgetId: budget.id,
      projectBudgetCategoryId: cat.id,
      expenseCategoryId: categoryId,
      name: "Pemasangan panel",
      scopeDescription: "PRIVATE_LABOR_SCOPE",
      internalNote: "PRIVATE_NOTE",
      area: "Dapur",
      quantity: "2.00",
      unit: "m2",
      estimatedUnitCost: "5000.00",
      estimatedTotalCost: "10000.00",
      status: "ACTIVE",
    })
    .returning();
  return {
    projectId: p.id,
    rapId: rap.id,
    materialId: material.id,
    packageId: pkg.id,
    budgetId: budget.id,
  };
}
async function prepare(
  f: Fixture,
  person = owner,
): Promise<{
  conversationId: string;
  toolCallId: string;
  messageId: string;
  proposal: RabDraftProposal;
}> {
  as(person);
  const actor = await withTestRequest(resolveActor)();
  if (!actor) throw new Error("No actor");
  const proposal = await buildRabProposal(
    actor,
    rabDraftInputSchema.parse({
      projectId: f.projectId,
      rows: [
        { sourceId: f.materialId, sourceKind: "MATERIAL" },
        { sourceId: f.packageId, sourceKind: "TUKANG" },
      ],
    }),
  );
  const [c] = await db.insert(aiConversation).values({ userId: person.id }).returning();
  conversationIds.push(c.id);
  const toolCallId = randomUUID();
  const [m] = await db
    .insert(aiMessage)
    .values({
      conversationId: c.id,
      role: "assistant",
      parts: [
        {
          type: "tool-proposeRabDraft",
          toolCallId,
          state: "output-available",
          output: { proposal },
        },
      ],
    })
    .returning();
  return { conversationId: c.id, toolCallId, messageId: m.id, proposal };
}
function identity(p: { conversationId: string; toolCallId: string }): {
  conversationId: string;
  toolCallId: string;
} {
  return { conversationId: p.conversationId, toolCallId: p.toolCallId };
}
function payload(
  p: { conversationId: string; toolCallId: string },
  v: RabDraftView,
): RabDraftPayload {
  return {
    ...identity(p),
    title: v.proposal.title,
    clientNotes: v.proposal.clientNotes,
    rows: v.proposal.rows.map((r) => ({
      rowId: r.rowId,
      selected: r.selected,
      clientLabel: r.clientLabel,
      description: r.description,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
    })),
  };
}
async function invariant(f: Fixture): Promise<unknown> {
  const [[cash], [stock], inventory, budgets, p] = await Promise.all([
    db.select({ n: count() }).from(cashTransaction),
    db.select({ n: count() }).from(stockMovement),
    db.select().from(materialInventory).orderBy(materialInventory.id),
    db.query.projectBudgets.findFirst({
      where: eq(projectBudgets.id, f.budgetId),
      with: { categories: true },
    }),
    db.query.project.findFirst({ where: eq(project.id, f.projectId) }),
  ]);
  return { cash: cash.n, stock: stock.n, inventory, budgets, p };
}
describeIntegration("AI client-safe RAB drafts", () => {
  beforeAll(async () => {
    await db
      .insert(tenant)
      .values({ id: INSTANCE_TENANT_ID, name: "Disposable RAB", slug: "disposable-rab" })
      .onConflictDoNothing();
    async function person(scope: "GLOBAL" | "ASSIGNED"): Promise<Person> {
      const [r] = await db
        .insert(role)
        .values({ name: `${prefix}-${scope}`, dataScope: scope })
        .returning();
      await db
        .insert(rolePermission)
        .values(permissions.map((permissionKey) => ({ roleId: r.id, permissionKey })));
      const [u] = await db
        .insert(user)
        .values({
          name: `${prefix}-${scope}`,
          email: `${prefix}-${scope}@fixture.invalid`,
          roleId: r.id,
        })
        .returning();
      return {
        id: u.id,
        roleId: r.id,
        name: u.name,
        email: u.email,
        isActive: true,
        mustChangePassword: false,
      };
    }
    owner = await person("GLOBAL");
    assigned = await person("ASSIGNED");
    const [c] = await db
      .insert(client)
      .values({ name: prefix, email: `${prefix}@fixture.invalid`, phone: "0800000000" })
      .returning();
    clientId = c.id;
    const existing = await db.query.expenseCategory.findFirst({
      where: eq(expenseCategory.code, "TUKANG"),
    });
    categoryId =
      existing?.id ??
      (await db.insert(expenseCategory).values({ code: "TUKANG", name: "Tukang" }).returning())[0]
        .id;
  });
  beforeEach(() => as(owner));
  afterAll(async () => {
    api.getSession = original;
    if (conversationIds.length)
      await db.delete(aiConversation).where(inArray(aiConversation.id, conversationIds));
    if (projectIds.length) await db.delete(project).where(inArray(project.id, projectIds));
    await db.delete(auditLog).where(inArray(auditLog.userId, [owner.id, assigned.id]));
    await db.delete(client).where(eq(client.id, clientId));
    await db.delete(user).where(inArray(user.id, [owner.id, assigned.id]));
    await db
      .delete(rolePermission)
      .where(inArray(rolePermission.roleId, [owner.roleId, assigned.roleId]));
    await db.delete(role).where(inArray(role.id, [owner.roleId, assigned.roleId]));
  });
  test("server corrections save only selected client rows, audit and receipt, with zero operational impact", async () => {
    const f = await fixture(),
      before = await invariant(f),
      p = await prepare(f),
      v = ok(await read(identity(p)));
    expect(v.status).toBe("READY");
    expect(JSON.stringify(v.proposal)).not.toContain("PRIVATE_");
    expect(JSON.stringify(v.proposal)).not.toContain("estimatedUnitCost");
    const corrected = payload(p, v);
    corrected.rows[1].selected = false;
    corrected.rows[0].clientLabel = "Panel finishing klien";
    corrected.rows[0].description = "Finishing sesuai persetujuan klien";
    corrected.rows[0].unitPrice = 15000.25;
    const updated = ok(await patch({ ...corrected, expectedRevision: v.revision }));
    expect(updated.revision).toBe(2);
    expect((await save({ ...identity(p), expectedRevision: 1 })).success).toBe(false);
    const saved = ok(await save({ ...identity(p), expectedRevision: updated.revision }));
    const items = await db.query.rabEstimateItem.findMany({
      where: eq(rabEstimateItem.rabEstimateId, saved.rabEstimateId),
    });
    expect(items).toHaveLength(1);
    expect(items[0].clientLabel).toBe("Panel finishing klien");
    expect(items[0].unitPrice).toBe("15000.25");
    expect(items[0].lineTotal).toBe("37500.63");
    expect(items[0].sourceProjectRapItemId).toBe(f.materialId);
    expect(JSON.stringify(items)).not.toContain("PRIVATE_");
    expect(await invariant(f)).toEqual(before);
    expect((await read(identity(p))).success).toBe(true);
    expect(
      await db.query.aiProposalConfirmation.findFirst({
        where: eq(aiProposalConfirmation.toolCallId, p.toolCallId),
      }),
    ).toBeDefined();
    expect(
      (await db.query.formDraft.findFirst({ where: eq(formDraft.id, v.draftId ?? "") }))?.status,
    ).toBe("CONSUMED");
    expect(
      await db.query.auditLog.findFirst({ where: eq(auditLog.targetId, saved.rabEstimateId) }),
    ).toBeDefined();
  });
  test("model reads applied corrections only from owned review metadata", async () => {
    const f = await fixture(),
      p = await prepare(f, assigned),
      v = ok(await read(identity(p)));
    const changed = payload(p, v);
    changed.rows[0].unitPrice = 19000;
    changed.rows[1].selected = false;
    ok(await patch({ ...changed, expectedRevision: v.revision }));
    const actor = await withTestRequest(resolveActor)();
    if (!actor) throw new Error("No actor");
    const execute = buildRabDraftTools(actor).getRabDraftContext.execute;
    if (!execute) throw new Error("No tool");
    const output = await execute(
      { projectId: f.projectId, reviewToolCallId: p.toolCallId, offset: 0 },
      { toolCallId: randomUUID(), messages: [], context: undefined },
    );
    expect(JSON.stringify(output)).toContain('"unitPrice":19000');
    expect(JSON.stringify(output)).toContain('"selected":false');
    expect(JSON.stringify(output)).not.toContain("PRIVATE_");
    as(owner);
    const other = await withTestRequest(resolveActor)();
    if (!other) throw new Error("No actor");
    const foreign = buildRabDraftTools(other).getRabDraftContext.execute;
    if (!foreign) throw new Error("No tool");
    const result = await foreign(
      { projectId: f.projectId, reviewToolCallId: p.toolCallId, offset: 0 },
      { toolCallId: randomUUID(), messages: [], context: undefined },
    );
    expect(JSON.stringify(result)).toContain('"reviewCorrections":[]');
  });
  test("double click and retry commit one RAB and one receipt", async () => {
    const f = await fixture(),
      p = await prepare(f),
      v = ok(await read(identity(p))),
      input = { ...identity(p), expectedRevision: v.revision };
    const results = await Promise.all([save(input), save(input)]);
    expect(results.every((r) => r.success)).toBe(true);
    expect(ok(results[0]).rabEstimateId).toBe(ok(results[1]).rabEstimateId);
    expect(ok(await save(input)).alreadyConfirmed).toBe(true);
    expect(
      await db.query.rabEstimate.findMany({ where: eq(rabEstimate.projectId, f.projectId) }),
    ).toHaveLength(1);
  });
  test("manual selected-source and AI generation serialize under one project lock", async () => {
    const f = await fixture(),
      p = await prepare(f),
      v = ok(await read(identity(p)));
    const results = await Promise.all([
      save({ ...identity(p), expectedRevision: v.revision }),
      manual({
        projectId: f.projectId,
        projectRapItemIds: [f.materialId],
        projectCategoryPlanItemIds: [],
        manualLines: [],
      }),
    ]);
    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(
      await db.query.rabEstimate.findMany({ where: eq(rabEstimate.projectId, f.projectId) }),
    ).toHaveLength(1);
  });
  test("manual RAP generation and AI generation serialize too", async () => {
    const f = await fixture(),
      p = await prepare(f),
      v = ok(await read(identity(p)));
    const results = await Promise.all([
      save({ ...identity(p), expectedRevision: v.revision }),
      manualRap({ projectRapId: f.rapId }),
    ]);
    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(
      await db.query.rabEstimate.findMany({ where: eq(rabEstimate.projectId, f.projectId) }),
    ).toHaveLength(1);
  });
  test("custom assigned roles follow live grants and assignment; foreign conversation and permission revocation fail", async () => {
    const f = await fixture(),
      p = await prepare(f, assigned),
      v = ok(await read(identity(p)));
    expect(v.status).toBe("READY");
    as(owner);
    expect((await read(identity(p))).success).toBe(false);
    as(assigned);
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, assigned.roleId),
          eq(rolePermission.permissionKey, "create:rab"),
        ),
      );
    expect((await save({ ...identity(p), expectedRevision: v.revision })).success).toBe(false);
    await db
      .insert(rolePermission)
      .values({ roleId: assigned.roleId, permissionKey: "create:rab" });
    await db.update(project).set({ projectManagerId: owner.id }).where(eq(project.id, f.projectId));
    expect((await read(identity(p))).success).toBe(false);
    expect(
      await db.query.rabEstimate.findMany({ where: eq(rabEstimate.projectId, f.projectId) }),
    ).toHaveLength(0);
  });
  test("expired proofs and changed source values block saving", async () => {
    const f = await fixture(),
      p = await prepare(f),
      v = ok(await read(identity(p)));
    await db
      .update(projectRapItem)
      .set({ suggestedClientUnitPrice: "17000.00" })
      .where(eq(projectRapItem.id, f.materialId));
    expect(ok(await read(identity(p))).status).toBe("STALE");
    expect((await save({ ...identity(p), expectedRevision: v.revision })).success).toBe(false);
    const f2 = await fixture(),
      p2 = await prepare(f2);
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, p2.messageId));
    expect(ok(await read(identity(p2))).status).toBe("EXPIRED");
    expect((await save({ ...identity(p2), expectedRevision: 1 })).success).toBe(false);
  });
  test("concurrent review corrections accept one revision and preserve its complete selection", async () => {
    const f = await fixture(),
      p = await prepare(f),
      v = ok(await read(identity(p))),
      a = payload(p, v),
      b = payload(p, v);
    a.rows[0].selected = false;
    b.rows[1].selected = false;
    const results = await Promise.all([
      patch({ ...a, expectedRevision: 1 }),
      patch({ ...b, expectedRevision: 1 }),
    ]);
    expect(results.filter((r) => r.success)).toHaveLength(1);
    const updated = ok(await read(identity(p)));
    expect(updated.revision).toBe(2);
    expect(updated.proposal.rows.filter((r) => r.selected)).toHaveLength(1);
  });
  test("source discovery excludes superseded or unready sources and never exposes private fields", async () => {
    const f = await fixture();
    const actor = await withTestRequest(resolveActor)();
    if (!actor) throw new Error("No actor");
    const c = await readRabContext(actor, f.projectId);
    expect(c.rows.find((r) => r.sourceId === f.packageId)?.unitPrice).toBe(6250);
    expect(JSON.stringify(c)).not.toContain("PRIVATE_");
    await db
      .update(projectCategoryPlanItem)
      .set({ status: "DRAFT" })
      .where(eq(projectCategoryPlanItem.id, f.packageId));
    await db.insert(projectRap).values({
      projectId: f.projectId,
      status: "DRAFT",
      revision: 2,
      supersedesProjectRapId: f.rapId,
    });
    expect((await readRabContext(actor, f.projectId)).rows).toHaveLength(0);
  });
  test("new AI draft keeps approved baseline intact and copies exactly selected sources", async () => {
    const f = await fixture();
    const [baseline] = await db
      .insert(rabEstimate)
      .values({ projectId: f.projectId, status: "APPROVED", revision: 1, title: "Baseline klien" })
      .returning();
    await db.insert(rabEstimateItem).values({
      rabEstimateId: baseline.id,
      sourceType: "MANUAL",
      clientLabel: "Biaya lama",
      quantity: "1.00",
      unit: "paket",
      unitPrice: "3000.00",
      lineTotal: "3000.00",
    });
    const p = await prepare(f),
      v = ok(await read(identity(p))),
      saved = ok(await save({ ...identity(p), expectedRevision: v.revision }));
    const created = await db.query.rabEstimate.findFirst({
      where: eq(rabEstimate.id, saved.rabEstimateId),
    });
    expect(created?.revision).toBe(2);
    expect(created?.supersedesRabEstimateId).toBe(baseline.id);
    expect(
      (await db.query.rabEstimate.findFirst({ where: eq(rabEstimate.id, baseline.id) }))?.status,
    ).toBe("APPROVED");
    expect(
      await db.query.rabEstimateItem.findMany({
        where: eq(rabEstimateItem.rabEstimateId, saved.rabEstimateId),
      }),
    ).toHaveLength(2);
  });
  test("shared writer rolls back complete RAB subset and audit on a later transaction failure", async () => {
    const f = await fixture(),
      before = await invariant(f),
      actor = await withTestRequest(resolveActor)();
    if (!actor) throw new Error("No actor");
    await expect(
      db.transaction(async (tx) => {
        await generateRabFromSelectedSourcesTx(tx, actor, {
          projectId: f.projectId,
          projectRapItemIds: [f.materialId],
          projectCategoryPlanItemIds: [f.packageId],
          manualLines: [],
        });
        throw new Error("Simulated later failure");
      }),
    ).rejects.toThrow("Simulated later failure");
    expect(
      await db.query.rabEstimate.findMany({ where: eq(rabEstimate.projectId, f.projectId) }),
    ).toHaveLength(0);
    expect(await invariant(f)).toEqual(before);
  });
});
