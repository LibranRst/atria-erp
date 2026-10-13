import { ensureSettingsTestFixture } from "@backend/lib/testing/settings-fixture";
import { z } from "zod";
import { beforeAll, beforeEach, afterAll, test, expect, spyOn } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq, count } from "drizzle-orm";
import { db } from "@backend/db";
import {
  role,
  rolePermission,
  user,
  client,
  project,
  clientInvoice,
  budgetAllocationSetting,
  budgetAllocationSettingCategory,
  auditLog,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  cashTransaction,
  stockMovement,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { resolveActor, type Actor } from "@backend/server/actor";
import { withTestRequest } from "@backend/lib/testing/request";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { prepareFinanceInput } from "@backend/server/usecases/ai/finance-input-context";
import * as writers from "@backend/server/usecases/finance/client-invoice-writer";
import { createClientInvoice } from "@backend/app/actions/finance/create-client-invoice";
import { updateBudgetAllocationDefaults } from "@backend/app/actions/settings/system-budget-expense";
import { buildFinanceInputTools } from "@backend/lib/ai/tools/finance-input-tools";
import { financeInputSchema, type FinanceInput } from "@atria/core/ai/finance-input";
import { getAiFinanceInputProposal, confirmAiFinanceInputProposal } from "./finance-input";
import type { PermissionKey, RoleDataScope } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
const prefix = `FININPUT-${randomUUID().slice(0, 8)}`;
const grants: PermissionKey[] = [
  "use:ai_chat",
  "view:project",
  "view:client_invoice",
  "create:client_invoice",
  "view:settings",
  "manage:budget_settings",
];
type Person = {
  id: string;
  roleId: string;
  name: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
};
const api = auth.api as unknown as { getSession: unknown },
  original = api.getSession;
let owner: Person,
  pm: Person,
  other: Person,
  none: Person,
  purchasing: Person,
  clientId: string,
  projectId: string,
  settingId: string,
  categories: (typeof budgetAllocationSettingCategory.$inferSelect)[];
function as(person: Person): void {
  api.getSession = async () => ({
    user: person,
    session: { id: randomUUID(), userId: person.id, expiresAt: new Date(Date.now() + 3600000) },
  });
}
function ok<T>(result: ActionResponse<T>): T {
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}
async function actor(): Promise<Actor> {
  const result = await withTestRequest(resolveActor)();
  if (!result) throw new Error("No Actor");
  return result;
}
async function person(
  scope: RoleDataScope,
  permissions: readonly PermissionKey[],
): Promise<Person> {
  const [r] = await db
    .insert(role)
    .values({ name: `${prefix}-${randomUUID().slice(0, 6)}`, dataScope: scope })
    .returning();
  await db
    .insert(rolePermission)
    .values(permissions.map((permissionKey) => ({ roleId: r.id, permissionKey })));
  const [p] = await db
    .insert(user)
    .values({
      name: r.name,
      email: `${randomUUID()}@fixture.invalid`,
      roleId: r.id,
      isActive: true,
      mustChangePassword: false,
    })
    .returning();
  return {
    id: p.id,
    roleId: r.id,
    name: p.name,
    email: p.email,
    isActive: true,
    mustChangePassword: false,
  };
}
async function proof(raw: unknown) {
  const proposal = await prepareFinanceInput(await actor(), financeInputSchema.parse(raw));
  const [conversation] = await db
    .insert(aiConversation)
    .values({ userId: (await actor()).userId, title: prefix })
    .returning();
  const toolCallId = randomUUID();
  const [message] = await db
    .insert(aiMessage)
    .values({
      conversationId: conversation.id,
      role: "assistant",
      parts: [
        {
          type:
            proposal.input.action === "BUDGET_DEFAULTS"
              ? "tool-proposeBudgetSettings"
              : proposal.input.action === "CREATE_SCHEDULE"
                ? "tool-proposeClientInvoiceSchedule"
                : "tool-proposeClientInvoice",
          state: "output-available",
          toolCallId,
          output: { proposal },
        },
      ],
    })
    .returning();
  return {
    proposal,
    messageId: message.id,
    identity: { conversationId: conversation.id, toolCallId },
  };
}
const save = withTestRequest(confirmAiFinanceInputProposal),
  read = withTestRequest(getAiFinanceInputProposal);
function invoice(number = `${prefix}-${randomUUID()}`): FinanceInput {
  return {
    action: "CREATE_INVOICE",
    projectId,
    invoiceNumber: number,
    amount: 300,
    stage: "DP",
    dueDate: "2026-10-30",
  };
}
function schedule(): FinanceInput {
  return {
    action: "CREATE_SCHEDULE",
    projectId,
    firstDueDate: "2026-10-31",
    installments: [
      { label: "DP", percentage: 0.3 },
      { label: "Progres", percentage: 0.4 },
      { label: "Pelunasan", percentage: 0.3 },
    ],
  };
}
function defaults(cap = 0.8): FinanceInput {
  return {
    action: "BUDGET_DEFAULTS",
    payload: {
      budgetAllocationSettingId: settingId,
      name: prefix,
      budgetCapRatio: cap,
      notes: "Default uji",
      categories: categories.map((row) => ({
        budgetAllocationSettingCategoryId: row.id,
        ratioPercentage: Number(row.ratioPercentage),
        isEnabled: true,
      })),
    },
  };
}
async function totals(): Promise<readonly number[]> {
  return Promise.all(
    [cashTransaction, stockMovement].map(async (table) =>
      Number((await db.select({ n: count() }).from(table))[0].n),
    ),
  );
}
describeIntegration("AI invoices and company budget defaults", () => {
  beforeAll(async () => {
    await ensureSettingsTestFixture();
    owner = await person("GLOBAL", grants);
    pm = await person("ASSIGNED", grants);
    other = await person("GLOBAL", grants);
    none = await person("NONE", grants);
    purchasing = await person("GLOBAL", ["use:ai_chat", "view:project", "view:client_invoice"]);
    const [c] = await db
      .insert(client)
      .values({ name: prefix, phone: "08123456789", email: `${randomUUID()}@fixture.invalid` })
      .returning();
    clientId = c.id;
  });
  beforeEach(async () => {
    as(owner);
    const [p] = await db
      .insert(project)
      .values({
        name: prefix,
        clientId,
        projectManagerId: pm.id,
        totalContractValue: "1000.01",
        status: "ACTIVE",
      })
      .returning();
    projectId = p.id;
    const [setting] = await db
      .insert(budgetAllocationSetting)
      .values({ name: prefix, budgetCapRatio: "0.900000", isActive: false })
      .returning();
    settingId = setting.id;
    const definitions = await db.query.expenseCategory.findMany({
      limit: 5,
      orderBy: (t, { asc }) => asc(t.sortOrder),
    });
    categories = await db
      .insert(budgetAllocationSettingCategory)
      .values(
        definitions.map((c, index) => ({
          budgetAllocationSettingId: setting.id,
          expenseCategoryId: c.id,
          ratioPercentage: [0.35, 0.18, 0.1, 0.07, 0.3][index].toFixed(6),
          isEnabled: true,
          sortOrder: index,
        })),
      )
      .returning();
  });
  afterAll(() => {
    api.getSession = original;
  });
  test("single invoice is unpaid, owned, audited and replay-safe without cash/stock changes", async () => {
    const before = await totals(),
      p = await proof(invoice());
    expect(ok(await read(p.identity)).status).toBe("READY");
    const results = await Promise.all([save(p.identity), save(p.identity)]);
    expect(results.every((r) => r.success)).toBe(true);
    expect(results.filter((r) => r.success && r.data.alreadyConfirmed)).toHaveLength(1);
    const created = await db.query.clientInvoice.findMany({
      where: eq(clientInvoice.projectId, projectId),
    });
    expect(created).toHaveLength(1);
    expect(created[0].status).toBe("UNPAID");
    expect(ok(await read(p.identity)).status).toBe("CONFIRMED");
    expect(
      await db.query.auditLog.findFirst({
        where: and(
          eq(auditLog.action, "CREATE_CLIENT_INVOICE"),
          eq(auditLog.targetId, created[0].id),
        ),
      }),
    ).toBeDefined();
    expect(await totals()).toEqual(before);
    as(other);
    expect((await save(p.identity)).success).toBe(false);
  });
  test("live role permissions, assignment and NONE scope are independently enforced", async () => {
    const p = await proof(invoice());
    as(purchasing);
    expect((await save(p.identity)).success).toBe(false);
    as(none);
    await expect(prepareFinanceInput(await actor(), invoice())).rejects.toThrow();
    as(pm);
    const assigned = await proof(invoice());
    expect((await save(assigned.identity)).success).toBe(true);
    await db.update(project).set({ projectManagerId: other.id }).where(eq(project.id, projectId));
    expect((await read(assigned.identity)).success).toBe(false);
    as(owner);
    const revoked = await proof(invoice());
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, owner.roleId),
          eq(rolePermission.permissionKey, "create:client_invoice"),
        ),
      );
    expect((await save(revoked.identity)).success).toBe(false);
    await db
      .insert(rolePermission)
      .values({ roleId: owner.roleId, permissionKey: "create:client_invoice" });
  });
  test("stale contract, expiry and identity tampering cannot write", async () => {
    const p = await proof(invoice());
    await db
      .update(project)
      .set({ totalContractValue: "1100.00" })
      .where(eq(project.id, projectId));
    expect(ok(await read(p.identity)).status).toBe("STALE");
    expect((await save(p.identity)).success).toBe(false);
    expect((await save({ ...p.identity, amount: 1 })).success).toBe(false);
    const expired = await proof(invoice());
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, expired.messageId));
    expect(ok(await read(expired.identity)).status).toBe("EXPIRED");
    expect((await save(expired.identity)).success).toBe(false);
  });
  test("schedule totals are exact and AI/manual concurrent schedules serialize", async () => {
    const p = await proof(schedule()),
      before = await totals();
    const a = await actor();
    const results = await Promise.allSettled([
      save(p.identity),
      db.transaction((tx) =>
        writers.generateClientInvoiceScheduleTx(tx, a, {
          projectId,
          firstDueDate: "2026-10-31",
          installments: [{ label: "DP", percentage: 1 }],
        }),
      ),
    ]);
    const created = await db.query.clientInvoice.findMany({
      where: eq(clientInvoice.projectId, projectId),
    });
    expect([1, 3]).toContain(created.length);
    expect(created.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0)).toBe(
      100001,
    );
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    expect(await totals()).toEqual(before);
    await expect(prepareFinanceInput(a, schedule())).rejects.toThrow();
  });
  test("subset failures roll back invoice, audit and receipt together", async () => {
    const p = await proof(invoice());
    const originalWriter = writers.writeFinanceInvoiceInputTx;
    const fail = spyOn(writers, "writeFinanceInvoiceInputTx").mockImplementation(
      async (...args) => {
        await originalWriter(...args);
        throw new Error("Injected rollback");
      },
    );
    try {
      expect((await save(p.identity)).success).toBe(false);
    } finally {
      fail.mockRestore();
    }
    expect(
      await db.query.clientInvoice.findMany({ where: eq(clientInvoice.projectId, projectId) }),
    ).toHaveLength(0);
    expect(
      await db.query.aiProposalConfirmation.findFirst({
        where: eq(aiProposalConfirmation.toolCallId, p.identity.toolCallId),
      }),
    ).toBeUndefined();
    expect((await save(p.identity)).success).toBe(true);
  });
  test("company defaults retain projects and require Settings rights, current snapshot and complete categories", async () => {
    const p = await proof(defaults()),
      before = await db.query.project.findFirst({ where: eq(project.id, projectId) });
    as(pm);
    expect((await prepareFinanceInput(await actor(), defaults())).input.action).toBe(
      "BUDGET_DEFAULTS",
    );
    as(purchasing);
    expect((await save(p.identity)).success).toBe(false);
    as(owner);
    expect((await save(p.identity)).success).toBe(true);
    expect((await save(p.identity)).success).toBe(true);
    expect(
      Number(
        (
          await db.query.budgetAllocationSetting.findFirst({
            where: eq(budgetAllocationSetting.id, settingId),
          })
        )?.budgetCapRatio,
      ),
    ).toBe(0.8);
    expect(await db.query.project.findFirst({ where: eq(project.id, projectId) })).toEqual(before);
    const stale = await proof(defaults(0.7));
    const raw = defaults(0.75);
    if (raw.action !== "BUDGET_DEFAULTS") throw new Error("Fixture");
    expect((await withTestRequest(updateBudgetAllocationDefaults)(raw.payload)).success).toBe(true);
    expect((await save(stale.identity)).success).toBe(false);
    const incomplete = defaults(0.6);
    if (incomplete.action !== "BUDGET_DEFAULTS") throw new Error("Fixture");
    incomplete.payload.categories.pop();
    await expect(prepareFinanceInput(await actor(), incomplete)).rejects.toThrow();
  });
  test("project-name invoice discovery returns verified IDs and scopes ambiguous candidates", async () => {
    const name = `Ω${prefix}-Exact-${randomUUID().slice(0, 6)}`;
    await db.update(project).set({ name }).where(eq(project.id, projectId));
    const a = await actor(),
      tools = buildFinanceInputTools(a);
    const execute = tools.getClientInvoiceContext.execute;
    if (!execute) throw new Error("Missing context tool");
    const oneCharacter = await execute(
      { projectQuery: "Ω", offset: 0 },
      { toolCallId: "single-character", messages: [], context: {} },
    );
    expect(
      z.object({ needsDisambiguation: z.literal(true) }).parse(oneCharacter).needsDisambiguation,
    ).toBe(true);
    const result = await execute(
      { projectQuery: name, offset: 0 },
      { toolCallId: "lookup", messages: [], context: {} },
    );
    expect(z.object({ project: z.object({ id: z.string() }) }).parse(result).project.id).toBe(
      projectId,
    );
    const ambiguous = await execute(
      { projectQuery: prefix, offset: 0 },
      { toolCallId: "lookup-many", messages: [], context: {} },
    );
    expect(
      ambiguous &&
        typeof ambiguous === "object" &&
        "needsDisambiguation" in ambiguous &&
        ambiguous.needsDisambiguation,
    ).toBe(true);
    as(pm);
    const scopedTools = buildFinanceInputTools(await actor());
    const scoped = await scopedTools.getClientInvoiceContext.execute?.(
      { projectQuery: name, offset: 0 },
      { toolCallId: "scoped", messages: [], context: {} },
    );
    expect(z.object({ project: z.object({ id: z.string() }) }).parse(scoped).project.id).toBe(
      projectId,
    );
    await db.update(project).set({ projectManagerId: other.id }).where(eq(project.id, projectId));
    const denied = await scopedTools.getClientInvoiceContext.execute?.(
      { projectQuery: name, offset: 0 },
      { toolCallId: "changed", messages: [], context: {} },
    );
    expect(
      denied &&
        typeof denied === "object" &&
        "needsDisambiguation" in denied &&
        denied.needsDisambiguation,
    ).toBe(true);
  });
  test("manual invoice and AI proposals enforce the same contract ceiling", async () => {
    const raw = invoice();
    if (raw.action !== "CREATE_INVOICE") throw new Error("Fixture");
    expect(
      (
        await withTestRequest(createClientInvoice)({
          ...raw,
          amount: 2000,
          dueDate: new Date(raw.dueDate),
        })
      ).success,
    ).toBe(false);
    await expect(prepareFinanceInput(await actor(), { ...raw, amount: 2000 })).rejects.toThrow();
  });
});
