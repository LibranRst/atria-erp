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
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
  projectExpenses,
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
import {
  inspectBudgetSummaryTx,
  writeBudgetSummaryTx,
} from "@backend/server/usecases/project/budget-summary-writer";
import { getAiBudgetSyncProposal, confirmAiBudgetSyncProposal } from "./budget-sync";
import { recalculateProjectBudgetCategories } from "@backend/app/actions/project/excel-budget";
import { budgetSummaryChanges } from "@atria/core/ai/budget-sync";
const api = auth.api as unknown as { getSession: unknown },
  original = api.getSession;
let actor: Actor, pId: string, bId: string, cId: string, eId: string;
const read = withTestRequest(getAiBudgetSyncProposal),
  confirm = withTestRequest(confirmAiBudgetSyncProposal);
async function proof(): Promise<{ conversationId: string; toolCallId: string; messageId: string }> {
  const proposal = await db.transaction((tx) => inspectBudgetSummaryTx(tx, actor, pId));
  const [c] = await db
    .insert(aiConversation)
    .values({ userId: actor.userId, title: "QA budget sync" })
    .returning();
  const toolCallId = randomUUID();
  const [m] = await db
    .insert(aiMessage)
    .values({
      conversationId: c.id,
      role: "assistant",
      parts: [
        {
          type: "tool-inspectProjectBudgetSummary",
          state: "output-available",
          toolCallId,
          output: { proposal },
        },
      ],
    })
    .returning();
  return { conversationId: c.id, toolCallId, messageId: m.id };
}
async function invariants(): Promise<string> {
  return JSON.stringify(
    await Promise.all([
      db.select().from(project).where(eq(project.id, pId)),
      db.select().from(projectBudgets).where(eq(projectBudgets.id, bId)),
      db.select().from(projectExpenses).where(eq(projectExpenses.id, eId)),
      db.select({ n: count() }).from(cashTransaction),
      db.select({ n: count() }).from(stockMovement),
    ]),
  );
}
describeIntegration("AI reviewed budget summary repair", () => {
  beforeAll(async () => {
    await db
      .insert(tenant)
      .values({ id: INSTANCE_TENANT_ID, name: "QA", slug: "qa-budget-sync" })
      .onConflictDoNothing();
  });
  beforeEach(async () => {
    const [r] = await db
      .insert(role)
      .values({ name: `SYNC_${randomUUID().slice(0, 12)}`, dataScope: "GLOBAL" })
      .returning();
    await db
      .insert(rolePermission)
      .values(
        (["use:ai_chat", "view:project", "view:budget", "update:budget"] as const).map(
          (permissionKey) => ({ roleId: r.id, permissionKey }),
        ),
      );
    const [u] = await db
      .insert(user)
      .values({ name: "QA sync", email: `${randomUUID()}@fixture.invalid`, roleId: r.id })
      .returning();
    api.getSession = async () => ({ user: u, session: { id: "test", userId: u.id } });
    const a = await withTestRequest(resolveActor)();
    if (!a) throw new Error("actor");
    actor = a;
    const [cl] = await db
      .insert(client)
      .values({ name: "QA sync", email: `${randomUUID()}@fixture.invalid`, phone: "000" })
      .returning();
    const [p] = await db
      .insert(project)
      .values({
        name: "QA sync",
        clientId: cl.id,
        projectManagerId: u.id,
        totalContractValue: "1000.00",
        status: "ACTIVE",
      })
      .returning();
    pId = p.id;
    const [b] = await db
      .insert(projectBudgets)
      .values({ projectId: p.id, contractValue: "1000.00", internalBudget: "900.00" })
      .returning();
    bId = b.id;
    await db
      .insert(expenseCategory)
      .values({ code: "MATERIAL", name: "Material" })
      .onConflictDoNothing();
    const ec = await db.query.expenseCategory.findFirst({
      where: and(
        eq(expenseCategory.code, "MATERIAL"),
        eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
      ),
    });
    if (!ec) throw new Error("category");
    const [c] = await db
      .insert(projectBudgetCategory)
      .values({
        projectBudgetId: b.id,
        expenseCategoryId: ec.id,
        allocatedAmount: "315.00",
        remainingAmount: "315.00",
        actualAmount: "1.00",
      })
      .returning();
    cId = c.id;
    const [e] = await db
      .insert(projectExpenses)
      .values({
        projectId: p.id,
        projectBudgetId: b.id,
        projectBudgetCategoryId: c.id,
        expenseCategoryId: ec.id,
        requestedById: u.id,
        description: "QA approved",
        amount: "125.25",
        status: "APPROVED",
      })
      .returning();
    eId = e.id;
  });
  afterAll(() => {
    api.getSession = original;
  });
  test("inspection is read-only and confirms only exact reviewed derived values with audit/receipt", async () => {
    const before = await invariants(),
      id = await proof();
    const audits = (await db.select({ n: count() }).from(auditLog))[0].n;
    const view = await read({ conversationId: id.conversationId, toolCallId: id.toolCallId });
    expect(view.success).toBe(true);
    if (!view.success) throw new Error("read");
    expect(view.data.status).toBe("READY");
    expect(view.data.proposal.categories[0].after.actualAmount).toBe("125.25");
    expect(await invariants()).toBe(before);
    expect((await db.select({ n: count() }).from(auditLog))[0].n).toBe(audits);
    const result = await confirm({ conversationId: id.conversationId, toolCallId: id.toolCallId });
    expect(result.success).toBe(true);
    const row = await db.query.projectBudgetCategory.findFirst({
      where: eq(projectBudgetCategory.id, cId),
    });
    expect(row?.actualAmount).toBe("125.25");
    expect(row?.remainingAmount).toBe("189.75");
    expect(row?.allocatedAmount).toBe("315.00");
    expect(await invariants()).toBe(before);
    expect((await db.select({ n: count() }).from(auditLog))[0].n).toBe(audits + 1);
    const verified = await read({ conversationId: id.conversationId, toolCallId: id.toolCallId });
    expect(verified.success && verified.data.status).toBe("CONFIRMED");
    expect(verified.success && verified.data.verified).toBe(true);
  });
  test("no-op inspection has no actionable repair, audit or receipt", async () => {
    await db.transaction(async (tx) => {
      const p = await inspectBudgetSummaryTx(tx, actor, pId);
      await writeBudgetSummaryTx(tx, actor, p);
    });
    const id = await proof(),
      view = await read({ conversationId: id.conversationId, toolCallId: id.toolCallId });
    expect(
      view.success && view.data.proposal.categories.every((c) => !budgetSummaryChanges(c).length),
    ).toBe(true);
    expect(
      (await confirm({ conversationId: id.conversationId, toolCallId: id.toolCallId })).success,
    ).toBe(false);
    expect(
      await db.query.aiProposalConfirmation.findFirst({
        where: eq(aiProposalConfirmation.toolCallId, id.toolCallId),
      }),
    ).toBeUndefined();
  });
  test("changed expense status, same amount, invalidates preview and does not write", async () => {
    const id = await proof();
    await db
      .update(projectExpenses)
      .set({ status: "SUBMITTED" })
      .where(eq(projectExpenses.id, eId));
    const view = await read({ conversationId: id.conversationId, toolCallId: id.toolCallId });
    expect(view.success && view.data.status).toBe("STALE");
    expect(
      (await confirm({ conversationId: id.conversationId, toolCallId: id.toolCallId })).success,
    ).toBe(false);
    expect(
      (await db.query.projectBudgetCategory.findFirst({ where: eq(projectBudgetCategory.id, cId) }))
        ?.actualAmount,
    ).toBe("1.00");
  });
  test("concurrent repeat approvals produce one repair and receipt", async () => {
    const id = await proof(),
      identity = { conversationId: id.conversationId, toolCallId: id.toolCallId };
    const rs = await Promise.all([confirm(identity), confirm(identity)]);
    expect(rs.every((r) => r.success)).toBe(true);
    expect(rs.filter((r) => r.success && r.data.alreadyConfirmed)).toHaveLength(1);
    expect(
      (
        await db
          .select({ n: count() })
          .from(aiProposalConfirmation)
          .where(eq(aiProposalConfirmation.toolCallId, id.toolCallId))
      )[0].n,
    ).toBe(1);
  });
  test("expired, foreign conversation and client supplied totals are blocked", async () => {
    const id = await proof();
    expect(
      (
        await confirm({
          conversationId: id.conversationId,
          toolCallId: id.toolCallId,
          actualAmount: "0",
        })
      ).success,
    ).toBe(false);
    expect((await read({ conversationId: randomUUID(), toolCallId: id.toolCallId })).success).toBe(
      false,
    );
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, id.messageId));
    const view = await read({ conversationId: id.conversationId, toolCallId: id.toolCallId });
    expect(view.success && view.data.status).toBe("EXPIRED");
    expect(
      (await confirm({ conversationId: id.conversationId, toolCallId: id.toolCallId })).success,
    ).toBe(false);
  });
  test("read-only reader sees diagnosis, cannot sync; permission loss hides source", async () => {
    const id = await proof();
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, actor.roleId),
          eq(rolePermission.permissionKey, "update:budget"),
        ),
      );
    expect(
      (await read({ conversationId: id.conversationId, toolCallId: id.toolCallId })).success,
    ).toBe(true);
    expect(
      (await confirm({ conversationId: id.conversationId, toolCallId: id.toolCallId })).success,
    ).toBe(false);
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, actor.roleId),
          eq(rolePermission.permissionKey, "view:budget"),
        ),
      );
    expect(
      (await read({ conversationId: id.conversationId, toolCallId: id.toolCallId })).success,
    ).toBe(false);
  });
  test("ASSIGNED/NONE scope and tenant mismatch cannot inspect", async () => {
    await expect(
      db.transaction((tx) => inspectBudgetSummaryTx(tx, { ...actor, dataScope: "NONE" }, pId)),
    ).rejects.toThrow();
    await db.update(project).set({ projectManagerId: null }).where(eq(project.id, pId));
    await expect(
      db.transaction((tx) => inspectBudgetSummaryTx(tx, { ...actor, dataScope: "ASSIGNED" }, pId)),
    ).rejects.toThrow();
    const [t] = await db
      .insert(tenant)
      .values({ name: "Other QA", slug: randomUUID() })
      .returning();
    await db.update(project).set({ tenantId: t.id }).where(eq(project.id, pId));
    await expect(db.transaction((tx) => inspectBudgetSummaryTx(tx, actor, pId))).rejects.toThrow();
  });
  test("rollback restores derived rows and no audit survives", async () => {
    await expect(
      db.transaction(async (tx) => {
        await writeBudgetSummaryTx(tx, actor, await inspectBudgetSummaryTx(tx, actor, pId));
        throw new Error("fault");
      }),
    ).rejects.toThrow("fault");
    expect(
      (await db.query.projectBudgetCategory.findFirst({ where: eq(projectBudgetCategory.id, cId) }))
        ?.actualAmount,
    ).toBe("1.00");
    expect(
      (await db.select({ n: count() }).from(auditLog).where(eq(auditLog.targetId, bId)))[0].n,
    ).toBe(0);
  });
  test("verification exposes new discrepancies after a successful repair without replaying it", async () => {
    const id = await proof(),
      identity = { conversationId: id.conversationId, toolCallId: id.toolCallId };
    expect((await confirm(identity)).success).toBe(true);
    await db
      .update(projectBudgetCategory)
      .set({ actualAmount: "0.00" })
      .where(eq(projectBudgetCategory.id, cId));
    const view = await read(identity);
    expect(view.success && view.data.status).toBe("CONFIRMED");
    expect(view.success && view.data.verified).toBe(false);
    const replay = await confirm(identity);
    expect(replay.success && replay.data.alreadyConfirmed).toBe(true);
    expect(
      (await db.query.projectBudgetCategory.findFirst({ where: eq(projectBudgetCategory.id, cId) }))
        ?.actualAmount,
    ).toBe("0.00");
  });
  test("missing budget and mismatched source references stay blocking errors", async () => {
    const [cl] = await db
      .insert(client)
      .values({ name: "QA empty", email: `${randomUUID()}@fixture.invalid`, phone: "000" })
      .returning();
    const [p] = await db
      .insert(project)
      .values({ name: "QA empty", clientId: cl.id, totalContractValue: "0", status: "DRAFT" })
      .returning();
    await expect(db.transaction((tx) => inspectBudgetSummaryTx(tx, actor, p.id))).rejects.toThrow(
      "Budget proyek belum dibuat",
    );
    await db.update(projectExpenses).set({ projectId: p.id }).where(eq(projectExpenses.id, eId));
    await expect(db.transaction((tx) => inspectBudgetSummaryTx(tx, actor, pId))).rejects.toThrow(
      "Referensi pengeluaran tidak sesuai",
    );
  });
  test("manual recalculation shares verified audited writer", async () => {
    expect((await withTestRequest(recalculateProjectBudgetCategories)(bId)).success).toBe(true);
    expect(
      (await db.query.projectBudgetCategory.findFirst({ where: eq(projectBudgetCategory.id, cId) }))
        ?.actualAmount,
    ).toBe("125.25");
    expect(
      (await db.select({ n: count() }).from(auditLog).where(eq(auditLog.targetId, bId)))[0].n,
    ).toBe(1);
  });
});
