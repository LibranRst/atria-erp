import { afterAll, beforeAll, beforeEach, expect, test, spyOn } from "bun:test";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { and, eq, count, inArray } from "drizzle-orm";
import { db } from "@backend/db";
import {
  role,
  rolePermission,
  user,
  tenantMember,
  client,
  project,
  appConfig,
  budgetAllocationSetting,
  budgetAllocationSettingCategory,
  expenseCategory,
  projectBudgets,
  projectBudgetCategory,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  auditLog,
  onboardingEvent,
  cashTransaction,
  stockMovement,
  materialInventory,
  inventoryOpeningBatch,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { assertOwnedAuditDatabase } from "@backend/lib/testing/owned-audit-database";
import { withTestRequest } from "@backend/lib/testing/request";
import { resolveActor, type Actor } from "@backend/server/actor";
import {
  prepareQuickStart,
  getQuickStartContext,
} from "@backend/server/usecases/ai/quick-start-context";
import * as writer from "@backend/server/usecases/onboarding/quick-start-writer";
import {
  advanceQuickStartUseCase,
  createFirstProjectQuickStartUseCase,
} from "@backend/server/usecases/onboarding/quick-start-mutations";
import { confirmAiQuickStartProposal, getAiQuickStartProposal } from "./quick-start";
import {
  createDefaultOwnerQuickStartState,
  OWNER_ONBOARDING_V2_CONFIG_KEY,
  type OwnerQuickStartState,
} from "@atria/core/onboarding/organization-setup";
import type { QuickStartInput } from "@atria/core/ai/quick-start";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
const prefix = `QUICKAI-${randomUUID().slice(0, 8)}`;
const grants: readonly PermissionKey[] = [
  "use:ai_chat",
  "manage:onboarding",
  "create:project",
  "view:settings",
  "view:project",
  "create:opening_inventory",
];
type Person = {
  id: string;
  roleId: string;
  name: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
};
let owner: Person, other: Person, pm: Person, opening: Person, clientId: string, settingId: string;
const api = auth.api as unknown as { getSession: unknown },
  original = api.getSession;
function as(p: Person): void {
  api.getSession = async () => ({
    user: p,
    session: { id: randomUUID(), userId: p.id, expiresAt: new Date(Date.now() + 3600000) },
  });
}
function ok<T>(r: ActionResponse<T>): T {
  if (!r.success) throw Error(r.error.message);
  return r.data;
}
async function actor(): Promise<Actor> {
  const a = await withTestRequest(resolveActor)();
  if (!a) throw Error("actor");
  return a;
}
async function person(
  scope: "GLOBAL" | "ASSIGNED" | "NONE",
  keys: readonly PermissionKey[] = grants,
): Promise<Person> {
  const [r] = await db
    .insert(role)
    .values({ name: `${prefix}-${randomUUID().slice(0, 6)}`, dataScope: scope })
    .returning();
  await db
    .insert(rolePermission)
    .values(keys.map((permissionKey) => ({ roleId: r.id, permissionKey })));
  const [u] = await db
    .insert(user)
    .values({
      roleId: r.id,
      name: r.name,
      email: `${randomUUID()}@fixture.invalid`,
      isActive: true,
      mustChangePassword: false,
    })
    .returning();
  await db
    .insert(tenantMember)
    .values({ tenantId: INSTANCE_TENANT_ID, userId: u.id, roleId: r.id, isActive: true });
  return {
    id: u.id,
    roleId: r.id,
    name: u.name,
    email: u.email,
    isActive: true,
    mustChangePassword: false,
  };
}
async function state(patch: Partial<OwnerQuickStartState> = {}): Promise<void> {
  const value = JSON.stringify({
    ...createDefaultOwnerQuickStartState("2026-10-13T00:00:00.000Z"),
    ...patch,
  });
  await db
    .insert(appConfig)
    .values({ key: OWNER_ONBOARDING_V2_CONFIG_KEY, value, updatedById: owner.id })
    .onConflictDoUpdate({
      target: [appConfig.tenantId, appConfig.key],
      set: { value, updatedAt: new Date(), updatedById: owner.id },
    });
}
async function proof(
  input: QuickStartInput,
  age = 0,
): Promise<{ conversationId: string; toolCallId: string }> {
  const a = await actor(),
    proposal = await prepareQuickStart(a, input),
    toolCallId = randomUUID();
  const [c] = await db
    .insert(aiConversation)
    .values({ userId: a.userId, title: prefix })
    .returning();
  await db.insert(aiMessage).values({
    conversationId: c.id,
    role: "assistant",
    createdAt: new Date(Date.now() - age),
    parts: [
      {
        type: "tool-proposeQuickStart",
        toolCallId,
        state: "output-available",
        input,
        output: { proposal },
      },
    ],
  });
  return { conversationId: c.id, toolCallId };
}
async function size(): Promise<{
  projects: number;
  receipts: number;
  audits: number;
  cash: number;
  movements: number;
}> {
  const [p, r, a, c, m] = await Promise.all([
    db.select({ n: count() }).from(project),
    db.select({ n: count() }).from(aiProposalConfirmation),
    db.select({ n: count() }).from(auditLog),
    db.select({ n: count() }).from(cashTransaction),
    db.select({ n: count() }).from(stockMovement),
  ]);
  return { projects: p[0].n, receipts: r[0].n, audits: a[0].n, cash: c[0].n, movements: m[0].n };
}
function projectInput(): QuickStartInput {
  return {
    action: "CREATE_PROJECT",
    project: {
      name: `${prefix} proyek`,
      clientId,
      projectManagerId: pm.id,
      totalContractValue: 1000000.25,
      approvedRabValue: 950000.5,
    },
  };
}
const confirm = withTestRequest(confirmAiQuickStartProposal),
  read = withTestRequest(getAiQuickStartProposal);
describeIntegration("Owned Quick Start through chat", () => {
  beforeAll(async () => {
    assertOwnedAuditDatabase("atria_audit_quick_start");
    owner = await person("GLOBAL");
    other = await person("GLOBAL");
    pm = await person("ASSIGNED");
    opening = await person("NONE", ["use:ai_chat", "create:opening_inventory"]);
    const [c] = await db
      .insert(client)
      .values({
        name: prefix,
        companyName: "",
        email: `${prefix}@fixture.invalid`,
        phone: "-",
        address: "-",
      })
      .returning();
    clientId = c.id;
    await db.update(budgetAllocationSetting).set({ isActive: false });
    const [s] = await db
      .insert(budgetAllocationSetting)
      .values({ name: prefix, budgetCapRatio: "0.88", isActive: true })
      .returning();
    settingId = s.id;
    const ratios: Record<string, number> = {
      MATERIAL: 0.4,
      TUKANG: 0.25,
      OPERASIONAL: 0.1,
      LAIN_LAIN: 0.05,
      SUBCON: 0.2,
    };
    for (const [code, ratio] of Object.entries(ratios)) {
      let cat = await db.query.expenseCategory.findFirst({
        where: and(
          eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
          eq(expenseCategory.code, code),
        ),
      });
      if (!cat) {
        [cat] = await db
          .insert(expenseCategory)
          .values({ code, name: code, defaultRatio: String(ratio), isActive: true })
          .returning();
      }
      await db
        .update(expenseCategory)
        .set({ isActive: true })
        .where(eq(expenseCategory.id, cat.id));
      await db.insert(budgetAllocationSettingCategory).values({
        budgetAllocationSettingId: settingId,
        expenseCategoryId: cat.id,
        ratioPercentage: String(ratio),
        sortOrder: Object.keys(ratios).indexOf(code),
        isEnabled: true,
      });
    }
  });
  beforeEach(async () => {
    as(owner);
    await state();
  });
  afterAll(() => {
    api.getSession = original;
  });
  test("source and immutable preview are read-only and preserve physical/cash data", async () => {
    const before = await size();
    await getQuickStartContext(await actor(), { resource: "setup", offset: 0 });
    const id = await proof({ action: "ADVANCE", stepId: "welcome" });
    expect(ok(await read(id)).status).toBe("READY");
    expect(await size()).toEqual(before);
  });
  test("acknowledge, pause, resume without skipping and financial review move exactly one step", async () => {
    ok(await confirm(await proof({ action: "ADVANCE", stepId: "welcome" })));
    ok(await confirm(await proof({ action: "PAUSE", stepId: "financial_defaults" })));
    ok(await confirm(await proof({ action: "RESUME", stepId: "financial_defaults" })));
    const current = await db.query.appConfig.findFirst({
      where: eq(appConfig.key, OWNER_ONBOARDING_V2_CONFIG_KEY),
    });
    expect(JSON.parse(current!.value).currentStep).toBe("financial_defaults");
    ok(await confirm(await proof({ action: "ADVANCE", stepId: "financial_defaults" })));
    expect(
      JSON.parse(
        (await db.query.appConfig.findFirst({
          where: eq(appConfig.key, OWNER_ONBOARDING_V2_CONFIG_KEY),
        }))!.value,
      ).currentStep,
    ).toBe("first_project");
  });
  test("first project uses reviewed Settings, persists canonical budget and completes setup once under concurrency/replay", async () => {
    await state({ currentStep: "first_project", reviewedSteps: ["welcome", "financial_defaults"] });
    const before = await size(),
      id = await proof(projectInput());
    const [a, b] = await Promise.all([confirm(id), confirm(id)]);
    const saved = ok(a);
    ok(b);
    expect(ok(await confirm(id)).alreadyConfirmed).toBe(true);
    const budget = await db.query.projectBudgets.findFirst({
      where: eq(projectBudgets.projectId, saved.resultId),
    });
    expect(budget?.internalBudget).toBe("880000.22");
    expect(budget?.approvedRabValue).toBe("950000.50");
    expect(budget?.budgetCapRatio).toBe("0.880000");
    const cats = await db.query.projectBudgetCategory.findMany({
      where: eq(projectBudgetCategory.projectBudgetId, budget!.id),
    });
    expect(cats).toHaveLength(5);
    expect(cats.every((c) => c.actualAmount === "0.00" && c.paidAmount === "0.00")).toBe(true);
    const after = await size();
    expect(after.projects).toBe(before.projects + 1);
    expect(after.receipts).toBe(before.receipts + 1);
    expect(after.cash).toBe(before.cash);
    expect(after.movements).toBe(before.movements);
    expect(ok(await read(id)).destination).toBe(`/projects/${saved.resultId}`);
    expect(
      JSON.parse(
        (await db.query.appConfig.findFirst({
          where: eq(appConfig.key, OWNER_ONBOARDING_V2_CONFIG_KEY),
        }))!.value,
      ).firstProjectId,
    ).toBe(saved.resultId);
  });
  test("physical stock decision and retry record audit/events only; retry is idempotent", async () => {
    const before = await size();
    const decision = await proof({ action: "STOCK_DECISION", decision: "HAS_LEGACY_STOCK" });
    ok(await confirm(decision));
    const retry = await proof({ action: "RETRY", stepId: "welcome" });
    ok(await confirm(retry));
    expect(ok(await confirm(retry)).alreadyConfirmed).toBe(true);
    expect(
      (
        await db.query.onboardingEvent.findMany({
          where: and(
            eq(onboardingEvent.actorUserId, owner.id),
            eq(onboardingEvent.eventType, "QUICK_START_RETRY"),
          ),
        })
      ).length,
    ).toBe(1);
    const after = await size();
    expect(after.projects).toBe(before.projects);
    expect(after.cash).toBe(before.cash);
    expect(after.movements).toBe(before.movements);
    expect(after.audits).toBeGreaterThan(before.audits);
  });
  test("no-op pause needs no save and completed setup cannot reset or create again", async () => {
    await state({ status: "PAUSED" });
    const id = await proof({ action: "PAUSE", stepId: "welcome" }),
      before = await size();
    expect(ok(await read(id)).status).toBe("NO_CHANGE");
    expect((await confirm(id)).success).toBe(false);
    expect(await size()).toEqual(before);
    await state({ status: "COMPLETED", currentStep: "success" });
    const completed = z
      .object({
        status: z.literal("Selesai"),
        canManageProgress: z.literal(false),
        stepId: z.never().optional(),
      })
      .parse(await getQuickStartContext(await actor(), { resource: "setup", offset: 0 }));
    expect(completed.stepId).toBeUndefined();
    expect(completed.canManageProgress).toBe(false);
    await expect(prepareQuickStart(await actor(), projectInput())).rejects.toThrow();
  });
  test("Settings and stage drift invalidate proof without any writes", async () => {
    const id = await proof({ action: "ADVANCE", stepId: "welcome" }),
      before = await size();
    await state({ currentStep: "financial_defaults" });
    expect(ok(await read(id)).status).toBe("STALE");
    expect((await confirm(id)).success).toBe(false);
    expect(await size()).toEqual(before);
    await state({ currentStep: "first_project" });
    const p = await proof(projectInput());
    await db
      .update(budgetAllocationSetting)
      .set({ budgetCapRatio: "0.87" })
      .where(eq(budgetAllocationSetting.id, settingId));
    expect(ok(await read(p)).status).toBe("STALE");
    expect((await confirm(p)).success).toBe(false);
    await db
      .update(budgetAllocationSetting)
      .set({ budgetCapRatio: "0.88" })
      .where(eq(budgetAllocationSetting.id, settingId));
  });
  test("stored proof ownership, strict identity, expiry and revoked live grants are authoritative", async () => {
    const id = await proof({ action: "ADVANCE", stepId: "welcome" });
    as(other);
    expect((await confirm(id)).success).toBe(false);
    as(owner);
    expect((await confirm({ ...id, action: "ADVANCE" })).success).toBe(false);
    const expired = await proof({ action: "ADVANCE", stepId: "welcome" }, 31 * 86400000);
    expect(ok(await read(expired)).status).toBe("EXPIRED");
    expect((await confirm(expired)).success).toBe(false);
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, owner.roleId),
          eq(rolePermission.permissionKey, "manage:onboarding"),
        ),
      );
    expect((await confirm(id)).success).toBe(false);
    await db
      .insert(rolePermission)
      .values({ roleId: owner.roleId, permissionKey: "manage:onboarding" });
  });
  test("opening-only NONE can decide readiness but cannot progress or create a project", async () => {
    as(opening);
    const id = await proof({ action: "STOCK_DECISION", decision: "SKIPPED" });
    ok(await confirm(id));
    await expect(
      prepareQuickStart(await actor(), { action: "ADVANCE", stepId: "welcome" }),
    ).rejects.toThrow();
  });
  test("contradictory no-legacy-stock declaration and inactive PM block instead of bypassing", async () => {
    const existing = await db.query.materialInventory.findFirst();
    expect(existing).toBeDefined();
    await db
      .update(materialInventory)
      .set({ currentStock: "3", reservedStock: "0" })
      .where(eq(materialInventory.id, existing!.id));
    await expect(
      prepareQuickStart(await actor(), { action: "STOCK_DECISION", decision: "NO_LEGACY_STOCK" }),
    ).rejects.toThrow("Stok atau pengajuan");
    await state({ currentStep: "first_project" });
    await db.update(user).set({ isActive: false }).where(eq(user.id, pm.id));
    await expect(prepareQuickStart(await actor(), projectInput())).rejects.toThrow(
      "Project Manager",
    );
    await db.update(user).set({ isActive: true }).where(eq(user.id, pm.id));
  });
  test("invalid/default missing category cannot be acknowledged or create a project", async () => {
    await state({ currentStep: "financial_defaults" });
    await db
      .update(budgetAllocationSetting)
      .set({ budgetCapRatio: "1.2" })
      .where(eq(budgetAllocationSetting.id, settingId));
    await expect(
      prepareQuickStart(await actor(), { action: "ADVANCE", stepId: "financial_defaults" }),
    ).rejects.toThrow("Default budget");
    await db
      .update(budgetAllocationSetting)
      .set({ budgetCapRatio: "0.88" })
      .where(eq(budgetAllocationSetting.id, settingId));
  });
  test("post-write failure rolls back project, budget, completion, audit and receipt; retry succeeds", async () => {
    await state({ currentStep: "first_project" });
    const id = await proof(projectInput()),
      before = await size(),
      real = writer.createFirstProjectQuickStartTx;
    const fault = spyOn(writer, "createFirstProjectQuickStartTx").mockImplementation(
      async (...args) => {
        await real(...args);
        throw Error("injected post-write");
      },
    );
    try {
      expect((await confirm(id)).success).toBe(false);
      expect(await size()).toEqual(before);
      expect(ok(await read(id)).status).toBe("READY");
    } finally {
      fault.mockRestore();
    }
    ok(await confirm(id));
  });
  test("manual actions share writer and create no duplicate after completion", async () => {
    ok(await advanceQuickStartUseCase(await actor(), { stepId: "welcome" }));
    ok(await advanceQuickStartUseCase(await actor(), { stepId: "financial_defaults" }));
    const i = projectInput();
    if (i.action !== "CREATE_PROJECT") throw Error("project");
    const before = await size(),
      first = ok(await createFirstProjectQuickStartUseCase(await actor(), i.project)),
      again = ok(await createFirstProjectQuickStartUseCase(await actor(), i.project));
    expect(again.projectId).toBe(first.projectId);
    expect(again.alreadyCompleted).toBe(true);
    expect((await size()).projects).toBe(before.projects + 1);
  });
  test("source choices support one-character search, stable20-page and actual references", async () => {
    for (let i = 0; i < 22; i++)
      await db.insert(client).values({
        name: `${prefix} choix ${String(i).padStart(2, "0")}`,
        companyName: "",
        email: `${randomUUID()}@fixture.invalid`,
        phone: "-",
        address: "-",
      });
    const result = await getQuickStartContext(await actor(), {
      resource: "clients",
      query: prefix.slice(0, 1),
      offset: 0,
    });
    expect(typeof result).toBe("object");
    const schema = z.object({
      items: z.array(z.object({ id: z.string(), name: z.string() })),
      hasMore: z.boolean(),
      nextOffset: z.number().nullable(),
    });
    const page = schema.parse(result);
    expect(page.items).toHaveLength(20);
    expect(page.hasMore).toBe(true);
    expect(page.nextOffset).toBe(20);
  });
  test("actual user and company membership revocation hide owned historical data", async () => {
    const id = await proof({ action: "ADVANCE", stepId: "welcome" });
    await db
      .update(tenantMember)
      .set({ isActive: false })
      .where(and(eq(tenantMember.userId, owner.id), eq(tenantMember.tenantId, INSTANCE_TENANT_ID)));
    expect((await read(id)).success).toBe(false);
    expect((await confirm(id)).success).toBe(false);
    await db
      .update(tenantMember)
      .set({ isActive: true })
      .where(and(eq(tenantMember.userId, owner.id), eq(tenantMember.tenantId, INSTANCE_TENANT_ID)));
    await db.update(user).set({ isActive: false }).where(eq(user.id, owner.id));
    expect((await confirm(id)).success).toBe(false);
    await db.update(user).set({ isActive: true }).where(eq(user.id, owner.id));
  });
  test("changed reference identity invalidates project proof; unknown client is rejected", async () => {
    await state({ currentStep: "first_project" });
    const id = await proof(projectInput());
    await db
      .update(user)
      .set({ name: pm.name + " updated" })
      .where(eq(user.id, pm.id));
    expect(ok(await read(id)).status).toBe("STALE");
    expect((await confirm(id)).success).toBe(false);
    await db.update(user).set({ name: pm.name }).where(eq(user.id, pm.id));
    const input = projectInput();
    if (input.action !== "CREATE_PROJECT") throw Error("project");
    await expect(
      prepareQuickStart(await actor(), {
        ...input,
        project: { ...input.project, clientId: randomUUID() },
      }),
    ).rejects.toThrow("Klien");
  });
  test("no-legacy-stock requires an empty physical baseline and writes readiness only", async () => {
    const inventories = await db.select().from(materialInventory),
      pending = await db.query.inventoryOpeningBatch.findMany({
        where: inArray(inventoryOpeningBatch.status, ["DRAFT", "PENDING_APPROVAL"]),
      });
    try {
      await db.update(materialInventory).set({ currentStock: "0", reservedStock: "0" });
      for (const b of pending)
        await db
          .update(inventoryOpeningBatch)
          .set({ status: "REJECTED" })
          .where(eq(inventoryOpeningBatch.id, b.id));
      if (inventories[0]) {
        for (const values of [
          { currentStock: "-1", reservedStock: "0" },
          { currentStock: "0", reservedStock: "-1" },
        ]) {
          await db
            .update(materialInventory)
            .set(values)
            .where(eq(materialInventory.id, inventories[0].id));
          await expect(
            prepareQuickStart(await actor(), {
              action: "STOCK_DECISION",
              decision: "NO_LEGACY_STOCK",
            }),
          ).rejects.toThrow("Stok atau pengajuan");
        }
        await db
          .update(materialInventory)
          .set({ currentStock: "0", reservedStock: "0" })
          .where(eq(materialInventory.id, inventories[0].id));
      }
      const before = await size(),
        id = await proof({ action: "STOCK_DECISION", decision: "NO_LEGACY_STOCK" });
      ok(await confirm(id));
      const after = await size();
      expect(after.movements).toBe(before.movements);
      expect(after.cash).toBe(before.cash);
      expect(after.receipts).toBe(before.receipts + 1);
      const cfg = await db.query.appConfig.findFirst({
        where: eq(appConfig.key, OWNER_ONBOARDING_V2_CONFIG_KEY),
      });
      expect(JSON.parse(cfg!.value).initialStockDecision).toBe("NO_LEGACY_STOCK");
    } finally {
      for (const i of inventories)
        await db
          .update(materialInventory)
          .set({ currentStock: i.currentStock, reservedStock: i.reservedStock })
          .where(eq(materialInventory.id, i.id));
      for (const b of pending)
        await db
          .update(inventoryOpeningBatch)
          .set({ status: b.status })
          .where(eq(inventoryOpeningBatch.id, b.id));
    }
  });
});
