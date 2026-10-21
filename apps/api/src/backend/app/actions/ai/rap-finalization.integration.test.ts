import { beforeAll, beforeEach, afterAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@backend/db";
import {
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  auditLog,
  project,
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
  projectRap,
  projectRapItem,
  projectCategoryPlanItem,
  notification,
  cashTransaction,
  stockMovement,
  materialInventory,
  role,
  rolePermission,
  user,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { resolveActor } from "@backend/server/actor";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { withTestRequest } from "@backend/lib/testing/request";
import { aiToolContextForRole } from "@backend/lib/testing/ai-tool-context";
import { buildRapFinalizationTools } from "@backend/lib/ai/tools/rap-finalization-tools";
import {
  setupInputSchema,
  setupProposalSchema,
  type SetupStep,
  type SetupProposal,
} from "@atria/core/ai/rap-finalization";
import type { ActionResponse } from "@atria/core/types/action-response";
import { getAiRapSetupProposal, confirmAiRapSetupProposal } from "./rap-finalization";
import {
  setProjectRapScopeSkipped,
  advanceProjectRapSetup,
  finalizeProjectInternalPlan,
} from "@backend/app/actions/project/rap-setup";
import { applyRapSetupStepTx } from "@backend/server/usecases/project/rap-setup-writer";
const owner = {
  id: "11111111-1111-1111-1111-111111111111",
  roleId: "00000000-0000-0000-0000-000000000001",
  name: "Fixture Owner",
  email: "owner@fixture.invalid",
  isActive: true,
  mustChangePassword: false,
};
const api = auth.api as unknown as { getSession: unknown },
  original = api.getSession,
  prefix = `AI-FIN-${randomUUID().slice(0, 8)}`;
const projects: string[] = [],
  conversations: string[] = [];
let clientId: string, customRoleId: string, customUserId: string, categoryIds: string[];
function actAs(person: typeof owner | null): void {
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
type Fixture = { projectId: string; rapId: string; packageIds: string[]; budgetId: string };
async function fixture(packages = true): Promise<Fixture> {
  const [p] = await db
    .insert(project)
    .values({
      name: `${prefix}-${projects.length}`,
      clientId,
      projectManagerId: customUserId,
      status: "DRAFT",
      totalContractValue: "1000000.00",
    })
    .returning();
  projects.push(p.id);
  const [b] = await db
    .insert(projectBudgets)
    .values({ projectId: p.id, contractValue: "1000000.00", internalBudget: "900000.00" })
    .returning();
  const cats = await db
    .insert(projectBudgetCategory)
    .values(
      categoryIds.map((expenseCategoryId) => ({
        projectBudgetId: b.id,
        expenseCategoryId,
        allocatedAmount: "100000.00",
        actualAmount: "10000.00",
        pendingAmount: "5000.00",
        remainingAmount: "85000.00",
      })),
    )
    .returning();
  const [r] = await db
    .insert(projectRap)
    .values({ projectId: p.id, status: "DRAFT", setupStage: "MATERIAL" })
    .returning();
  await db.insert(projectRapItem).values({
    projectRapId: r.id,
    name: "Panel uji",
    area: "Utama",
    unit: "lembar",
    requiredQuantity: "1.00",
    bufferQuantity: "0.00",
    totalQuantity: "1.00",
    estimatedUnitCost: "100000.00",
    estimatedTotalCost: "100000.00",
    source: "PURCHASE",
  });
  const rows = packages
    ? await db
        .insert(projectCategoryPlanItem)
        .values(
          [0, 1].map((index) => ({
            projectId: p.id,
            projectBudgetId: b.id,
            projectBudgetCategoryId: cats[index].id,
            expenseCategoryId: categoryIds[index],
            name: `Paket ${index}`,
            scopeDescription: "Scope ditinjau",
            area: "Utama",
            unit: "ls",
            quantity: "1.00",
            estimatedUnitCost: "50000.00",
            estimatedTotalCost: "50000.00",
            status: "DRAFT",
          })),
        )
        .returning()
    : [];
  return { projectId: p.id, rapId: r.id, packageIds: rows.map((row) => row.id), budgetId: b.id };
}
function full(f: Fixture): SetupStep[] {
  return [
    { action: "READY_PACKAGES", itemIds: f.packageIds },
    { action: "ADVANCE", targetStage: "TUKANG" },
    { action: "ADVANCE", targetStage: "SUBCON" },
    { action: "ADVANCE", targetStage: "REVIEW" },
    { action: "FINALIZE" },
  ];
}
async function prepare(
  f: Fixture,
  steps: SetupStep[],
  person = owner,
): Promise<{
  conversationId: string;
  toolCallId: string;
  messageId: string;
  proposal: SetupProposal;
}> {
  const execute = buildRapFinalizationTools(aiToolContextForRole("OWNER", { userId: person.id }))
    .proposeRapSetupActions.execute;
  if (!execute) throw new Error("Missing setup tool");
  const toolCallId = randomUUID(),
    output = await execute(setupInputSchema.parse({ projectId: f.projectId, steps }), {
      toolCallId,
      messages: [],
      context: undefined,
    }),
    parsed = z.object({ proposal: setupProposalSchema }).parse(output);
  const [c] = await db.insert(aiConversation).values({ userId: person.id }).returning();
  conversations.push(c.id);
  const [m] = await db
    .insert(aiMessage)
    .values({
      conversationId: c.id,
      role: "assistant",
      parts: [
        {
          type: "tool-proposeRapSetupActions",
          toolCallId,
          state: "output-available",
          output: parsed,
        },
      ],
    })
    .returning();
  return { conversationId: c.id, toolCallId, messageId: m.id, proposal: parsed.proposal };
}
function identity(value: { conversationId: string; toolCallId: string }): {
  conversationId: string;
  toolCallId: string;
} {
  return { conversationId: value.conversationId, toolCallId: value.toolCallId };
}
const read = withTestRequest(getAiRapSetupProposal),
  save = withTestRequest(confirmAiRapSetupProposal),
  manualScope = withTestRequest(setProjectRapScopeSkipped),
  manualAdvance = withTestRequest(advanceProjectRapSetup),
  manualFinalize = withTestRequest(finalizeProjectInternalPlan);
async function finances(
  f: Fixture,
): Promise<{ cash: number; stock: number; inventory: unknown[]; budget: unknown[] }> {
  const [[cash], [stock], inventory, budget] = await Promise.all([
    db.select({ value: count() }).from(cashTransaction),
    db.select({ value: count() }).from(stockMovement),
    db.select().from(materialInventory).orderBy(materialInventory.id),
    db
      .select()
      .from(projectBudgetCategory)
      .where(eq(projectBudgetCategory.projectBudgetId, f.budgetId))
      .orderBy(projectBudgetCategory.id),
  ]);
  return { cash: cash.value, stock: stock.value, inventory, budget };
}
describeIntegration("AI RAP readiness/finalization", () => {
  beforeAll(async () => {
    clientId = (await db.query.client.findFirst())?.id ?? "";
    categoryIds = await Promise.all(
      ["TUKANG", "SUBCON", "MATERIAL"].map(
        async (code) =>
          (await db.query.expenseCategory.findFirst({ where: eq(expenseCategory.code, code) }))
            ?.id ?? "",
      ),
    );
    const [r] = await db.insert(role).values({ name: prefix, dataScope: "ASSIGNED" }).returning();
    customRoleId = r.id;
    await db
      .insert(rolePermission)
      .values(
        ["use:ai_chat", "view:rap", "view:budget", "update:rap", "update:budget", "lock:rap"].map(
          (permissionKey) => ({ roleId: r.id, permissionKey }),
        ),
      );
    const [u] = await db
      .insert(user)
      .values({ name: prefix, email: `${prefix}@fixture.invalid`, roleId: r.id })
      .returning();
    customUserId = u.id;
  });
  beforeEach(() => actAs(owner));
  afterAll(async () => {
    api.getSession = original;
    if (conversations.length)
      await db.delete(aiConversation).where(inArray(aiConversation.id, conversations));
    if (projects.length) {
      await db.delete(notification).where(inArray(notification.projectId, projects));
      await db.delete(project).where(inArray(project.id, projects));
    }
    await db.delete(auditLog).where(eq(auditLog.userId, customUserId));
    await db.delete(user).where(eq(user.id, customUserId));
    await db.delete(rolePermission).where(eq(rolePermission.roleId, customRoleId));
    await db.delete(role).where(eq(role.id, customRoleId));
  });
  test("whole explicit workflow commits once with audits/notification and no finance or stock side effects", async () => {
    const f = await fixture(),
      before = await finances(f),
      p = await prepare(f, full(f));
    expect(p.proposal.after).toMatchObject({ stage: "COMPLETE", status: "LOCKED" });
    expect(p.proposal.budget).toMatchObject({
      projectValue: 1000000,
      internalCap: 900000,
      planTotal: 200000,
      actual: 30000,
      pending: 15000,
      marginAmount: 970000,
    });
    expect(ok(await read(identity(p))).status).toBe("READY");
    const outcomes = await Promise.all([save(identity(p)), save(identity(p))]);
    expect(outcomes.every((r) => r.success)).toBe(true);
    expect(outcomes.map(ok).filter((r) => !r.alreadyConfirmed)).toHaveLength(1);
    expect(ok(await save(identity(p))).alreadyConfirmed).toBe(true);
    expect(ok(await read(identity(p))).status).toBe("CONFIRMED");
    expect(
      await db.query.projectRap.findFirst({ where: eq(projectRap.id, f.rapId) }),
    ).toMatchObject({ status: "LOCKED", setupStage: "COMPLETE", lockedById: owner.id });
    expect(
      (
        await db.query.projectCategoryPlanItem.findMany({
          where: eq(projectCategoryPlanItem.projectId, f.projectId),
        })
      ).every((row) => row.status === "ACTIVE"),
    ).toBe(true);
    expect(await finances(f)).toEqual(before);
    expect(
      await db.query.aiProposalConfirmation.findMany({
        where: eq(aiProposalConfirmation.toolCallId, p.toolCallId),
      }),
    ).toHaveLength(1);
    expect(
      await db.query.auditLog.findMany({
        where: and(
          eq(auditLog.targetId, f.rapId),
          eq(auditLog.action, "FINALIZE_PROJECT_INTERNAL_PLAN"),
        ),
      }),
    ).toHaveLength(1);
    const notified = await db.query.notification.findMany({
      where: eq(notification.referenceId, f.rapId),
    });
    expect(notified.length).toBeGreaterThan(0);
    await save(identity(p));
    expect(
      await db.query.notification.findMany({ where: eq(notification.referenceId, f.rapId) }),
    ).toEqual(notified);
  });
  test("unused scopes require explicit decisions and existing packages cannot be silently skipped", async () => {
    const f = await fixture(false);
    await expect(prepare(f, [{ action: "FINALIZE" }])).rejects.toThrow();
    const p = await prepare(f, [
      { action: "SET_SCOPE", category: "TUKANG", skipped: true },
      { action: "SET_SCOPE", category: "SUBCON", skipped: true },
      { action: "ADVANCE", targetStage: "TUKANG" },
      { action: "ADVANCE", targetStage: "SUBCON" },
      { action: "ADVANCE", targetStage: "REVIEW" },
      { action: "FINALIZE" },
    ]);
    expect(ok(await save(identity(p))).status).toBe("LOCKED");
    const live = await fixture();
    await expect(
      prepare(live, [{ action: "SET_SCOPE", category: "TUKANG", skipped: true }]),
    ).rejects.toThrow();
    await expect(
      prepare(live, [
        { action: "ADVANCE", targetStage: "TUKANG" },
        { action: "ADVANCE", targetStage: "SUBCON" },
      ]),
    ).rejects.toThrow();
  });
  test("custom assignment, ownership, each action right, revocation and NONE scope are enforced", async () => {
    const f = await fixture(),
      person = { ...owner, id: customUserId, roleId: customRoleId },
      p = await prepare(f, full(f), person);
    actAs(person);
    expect(ok(await read(identity(p))).status).toBe("READY");
    actAs(owner);
    expect((await read(identity(p))).success).toBe(false);
    actAs(person);
    await db
      .delete(rolePermission)
      .where(
        and(eq(rolePermission.roleId, customRoleId), eq(rolePermission.permissionKey, "lock:rap")),
      );
    expect((await save(identity(p))).success).toBe(false);
    await db.insert(rolePermission).values({ roleId: customRoleId, permissionKey: "lock:rap" });
    await db.update(project).set({ projectManagerId: owner.id }).where(eq(project.id, f.projectId));
    expect((await save(identity(p))).success).toBe(false);
    await db
      .update(project)
      .set({ projectManagerId: customUserId })
      .where(eq(project.id, f.projectId));
    await db.update(role).set({ dataScope: "NONE" }).where(eq(role.id, customRoleId));
    expect((await read(identity(p))).success).toBe(false);
    await db.update(role).set({ dataScope: "ASSIGNED" }).where(eq(role.id, customRoleId));
    expect(ok(await save(identity(p))).status).toBe("LOCKED");
  });
  test("lock-only custom role can finalize an already reviewed RAP without unrelated write grants", async () => {
    const f = await fixture();
    const prepared = await prepare(f, full(f).slice(0, -1));
    ok(await save(identity(prepared)));
    const person = { ...owner, id: customUserId, roleId: customRoleId };
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, customRoleId),
          inArray(rolePermission.permissionKey, ["update:rap", "update:budget"]),
        ),
      );
    try {
      const final = await prepare(f, [{ action: "FINALIZE" }], person);
      actAs(person);
      expect(ok(await read(identity(final))).status).toBe("READY");
      expect(ok(await save(identity(final))).status).toBe("LOCKED");
    } finally {
      await db.insert(rolePermission).values(
        ["update:rap", "update:budget"].map((permissionKey) => ({
          roleId: customRoleId,
          permissionKey,
        })),
      );
      actAs(owner);
    }
  });
  test("identity-only proof/expiry and stale manual stage changes prevent hidden writes", async () => {
    const f = await fixture(),
      p = await prepare(f, full(f));
    expect((await save({ ...identity(p), steps: p.proposal.request.steps })).success).toBe(false);
    await db.update(aiMessage).set({ role: "user" }).where(eq(aiMessage.id, p.messageId));
    expect((await save(identity(p))).success).toBe(false);
    await db
      .update(aiMessage)
      .set({ role: "assistant", createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, p.messageId));
    expect(ok(await read(identity(p))).status).toBe("EXPIRED");
    expect((await save(identity(p))).success).toBe(false);
    const fresh = await prepare(f, full(f));
    ok(await manualAdvance({ projectRapId: f.rapId, targetStage: "TUKANG" }));
    expect(ok(await read(identity(fresh))).status).toBe("STALE");
    expect((await save(identity(fresh))).success).toBe(false);
    expect(
      (
        await db.query.projectCategoryPlanItem.findMany({
          where: eq(projectCategoryPlanItem.projectId, f.projectId),
        })
      ).every((p) => p.status === "DRAFT"),
    ).toBe(true);
  });
  test("all writes and notification rollback when transaction fails after finalization", async () => {
    const f = await fixture(),
      before = await finances(f);
    const actor = await withTestRequest(resolveActor)();
    if (!actor) throw new Error("Actor missing");
    await expect(
      db.transaction(async (tx) => {
        for (const step of full(f)) await applyRapSetupStepTx(tx, actor, f.rapId, step);
        throw new Error("Rollback after finalization");
      }),
    ).rejects.toThrow("Rollback after finalization");
    expect(
      await db.query.projectRap.findFirst({ where: eq(projectRap.id, f.rapId) }),
    ).toMatchObject({ status: "DRAFT", setupStage: "MATERIAL", lockedById: null });
    expect(
      (
        await db.query.projectCategoryPlanItem.findMany({
          where: eq(projectCategoryPlanItem.projectId, f.projectId),
        })
      ).every((p) => p.status === "DRAFT"),
    ).toBe(true);
    expect(
      await db.query.auditLog.findMany({
        where: inArray(auditLog.targetId, [f.rapId, ...f.packageIds]),
      }),
    ).toHaveLength(0);
    expect(
      await db.query.notification.findMany({ where: eq(notification.referenceId, f.rapId) }),
    ).toHaveLength(0);
    expect(await finances(f)).toEqual(before);
  });
  test("manual and AI finalization race serializes without duplicate audits or notifications", async () => {
    const f = await fixture();
    const ready = await prepare(f, full(f).slice(0, -1));
    ok(await save(identity(ready)));
    const p = await prepare(f, [{ action: "FINALIZE" }]);
    const [ai, manual] = await Promise.all([
      save(identity(p)),
      manualFinalize({ projectRapId: f.rapId }),
    ]);
    expect(ai.success || manual.success).toBe(true);
    expect(
      await db.query.auditLog.findMany({
        where: and(
          eq(auditLog.targetId, f.rapId),
          eq(auditLog.action, "FINALIZE_PROJECT_INTERNAL_PLAN"),
        ),
      }),
    ).toHaveLength(1);
    expect(
      await db.query.projectRap.findFirst({ where: eq(projectRap.id, f.rapId) }),
    ).toMatchObject({ status: "LOCKED" });
  });
  test("scope restore, missing material and cross-project package targets obey shared rules", async () => {
    const f = await fixture(false);
    ok(await manualScope({ projectRapId: f.rapId, categoryCode: "TUKANG", skipped: true }));
    const p = await prepare(f, [{ action: "SET_SCOPE", category: "TUKANG", skipped: false }]);
    ok(await save(identity(p)));
    expect(
      await db.query.projectRap.findFirst({ where: eq(projectRap.id, f.rapId) }),
    ).toMatchObject({ tukangScopeSkipped: false });
    await db.delete(projectRapItem).where(eq(projectRapItem.projectRapId, f.rapId));
    await expect(prepare(f, [{ action: "ADVANCE", targetStage: "TUKANG" }])).rejects.toThrow();
    const other = await fixture();
    await expect(
      prepare(f, [{ action: "READY_PACKAGES", itemIds: other.packageIds }]),
    ).rejects.toThrow();
  });
});
