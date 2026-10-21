import { ensureSettingsTestFixture } from "@backend/lib/testing/settings-fixture";
import { beforeAll, beforeEach, afterAll, test, expect, spyOn } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, count } from "drizzle-orm";
import { z } from "zod";
import { db } from "@backend/db";
import {
  role,
  rolePermission,
  user,
  tenant,
  appConfig,
  expenseCategory,
  budgetAllocationSetting,
  budgetAllocationSettingCategory,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  auditLog,
  projectCost,
  projectBudgets,
  cashTransaction,
  stockMovement,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { resolveActor, type Actor } from "@backend/server/actor";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { withTestRequest } from "@backend/lib/testing/request";
import { prepareFinanceInput } from "@backend/server/usecases/ai/finance-input-context";
import * as writers from "@backend/server/usecases/settings/operational-settings-writer";
import { updateApprovalThresholds } from "@backend/app/actions/settings/approval-thresholds";
import {
  updateExpenseCategoryDetails,
  updateExpenseCategorySetting,
} from "@backend/app/actions/settings/system-budget-expense";
import { buildOperationalSettingsTools } from "@backend/lib/ai/tools/operational-settings-tools";
import { APPROVAL_THRESHOLD_CONFIG_KEYS } from "@atria/core/finance/approval-thresholds";
import { CORE_EXPENSE_CODES } from "@atria/core/ai/operational-settings";
import {
  financeInputSchema,
  type FinanceInputProposal,
  type FinanceInput,
} from "@atria/core/ai/finance-input";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { PermissionKey } from "@atria/core/auth/permissions";
import { getAiFinanceInputProposal, confirmAiFinanceInputProposal } from "./finance-input";
const prefix = `OPS-${randomUUID().slice(0, 8)}`;
const reason = "Kebijakan operasional yang ditinjau melalui data uji";
const api = auth.api as unknown as { getSession: unknown };
const original = api.getSession;
type Person = {
  id: string;
  roleId: string;
  name: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
};
let owner: Person,
  limited: Person,
  outsider: Person,
  categoryId: string,
  customId: string,
  foreignId: string,
  settingId: string;
let canonical: (typeof expenseCategory.$inferSelect)[];
const grants: PermissionKey[] = [
  "use:ai_chat",
  "view:settings",
  "manage:approval_settings",
  "manage:expense_categories",
  "manage:budget_settings",
];
function ok<T>(r: ActionResponse<T>): T {
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}
function as(person: Person): void {
  api.getSession = async () => ({
    user: person,
    session: { id: randomUUID(), userId: person.id, expiresAt: new Date(Date.now() + 3600000) },
  });
}
async function actor(): Promise<Actor> {
  const a = await withTestRequest(resolveActor)();
  if (!a) throw new Error("No actor");
  return a;
}
async function person(permissions: readonly PermissionKey[]): Promise<Person> {
  const [r] = await db
    .insert(role)
    .values({ name: `${prefix}-${randomUUID()}`, dataScope: "NONE" })
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
const thresholds = (value = 6_000_000): FinanceInput =>
  financeInputSchema.parse({
    action: "APPROVAL_THRESHOLDS",
    patch: { fieldCostAmount: value },
    reason,
  });
const category = (patch: unknown): FinanceInput =>
  financeInputSchema.parse({
    action: "EXPENSE_CATEGORY_SETTINGS",
    expenseCategoryId: categoryId,
    patch,
    reason,
  });
async function proof(input: FinanceInput): Promise<{
  proposal: FinanceInputProposal;
  identity: { conversationId: string; toolCallId: string };
  messageId: string;
}> {
  const a = await actor();
  const proposal = await prepareFinanceInput(a, input);
  const [c] = await db
    .insert(aiConversation)
    .values({ userId: a.userId, title: prefix })
    .returning();
  const toolCallId = randomUUID();
  const [m] = await db
    .insert(aiMessage)
    .values({
      conversationId: c.id,
      role: "assistant",
      parts: [
        {
          type:
            input.action === "APPROVAL_THRESHOLDS"
              ? "tool-proposeApprovalThresholds"
              : "tool-proposeExpenseCategorySettings",
          state: "output-available",
          toolCallId,
          output: { proposal },
        },
      ],
    })
    .returning();
  return { proposal, identity: { conversationId: c.id, toolCallId }, messageId: m.id };
}
const save = withTestRequest(confirmAiFinanceInputProposal),
  read = withTestRequest(getAiFinanceInputProposal);
async function config(): Promise<number[]> {
  const c = await writers.readOperationalThresholds(await actor());
  return [c.values.fieldCostCents, c.values.vendorPaymentCents];
}
async function invariants(): Promise<string> {
  return JSON.stringify({
    costs: await db.query.projectCost.findMany({ orderBy: [asc(projectCost.id)] }),
    budgets: await db.query.projectBudgets.findMany({ orderBy: [asc(projectBudgets.id)] }),
    cash: (await db.select({ n: count() }).from(cashTransaction))[0].n,
    stock: (await db.select({ n: count() }).from(stockMovement))[0].n,
  });
}
describeIntegration("AI operational Settings", () => {
  beforeAll(async () => {
    await ensureSettingsTestFixture();
    owner = await person(grants);
    limited = await person(["use:ai_chat", "view:settings", "manage:expense_categories"]);
    outsider = await person(["use:ai_chat", "view:settings"]);
    canonical = await db.query.expenseCategory.findMany({
      where: and(
        eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
        inArray(expenseCategory.code, [...CORE_EXPENSE_CODES]),
      ),
      orderBy: [asc(expenseCategory.sortOrder)],
    });
    expect(canonical).toHaveLength(5);
    categoryId = canonical.find((c) => c.code === "OPERASIONAL")!.id;
    const [custom] = await db
      .insert(expenseCategory)
      .values({ code: prefix, name: "Kategori QA tambahan", defaultRatio: "0.000000" })
      .returning();
    customId = custom.id;
    const [foreign] = await db
      .insert(tenant)
      .values({ name: prefix, slug: prefix.toLowerCase() })
      .returning();
    foreignId = foreign.id;
    await db.insert(appConfig).values({
      tenantId: foreignId,
      key: APPROVAL_THRESHOLD_CONFIG_KEYS.fieldCost,
      value: "999",
      description: prefix,
    });
  });
  beforeEach(async () => {
    as(owner);
    for (const row of canonical)
      await db
        .update(expenseCategory)
        .set({
          name: row.name,
          description: row.description,
          defaultRatio: "0.100000",
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(expenseCategory.id, row.id));
    await db
      .update(expenseCategory)
      .set({
        name: "Kategori QA tambahan",
        description: null,
        defaultRatio: "0.000000",
        isActive: true,
      })
      .where(eq(expenseCategory.id, customId));
    for (const key of Object.values(APPROVAL_THRESHOLD_CONFIG_KEYS))
      await db
        .insert(appConfig)
        .values({ key, value: "500000000" })
        .onConflictDoUpdate({
          target: [appConfig.tenantId, appConfig.key],
          set: { value: "500000000", updatedAt: new Date() },
        });
    await db
      .update(budgetAllocationSetting)
      .set({ isActive: false })
      .where(eq(budgetAllocationSetting.tenantId, INSTANCE_TENANT_ID));
    const [setting] = await db
      .insert(budgetAllocationSetting)
      .values({
        name: prefix,
        budgetCapRatio: "0.900000",
        isActive: true,
        notes: "Default sintetis",
      })
      .returning();
    settingId = setting.id;
    await db.insert(budgetAllocationSettingCategory).values(
      canonical.map((c, i) => ({
        budgetAllocationSettingId: setting.id,
        expenseCategoryId: c.id,
        ratioPercentage: "0.100000",
        isEnabled: true,
        sortOrder: i,
      })),
    );
  });
  afterAll(() => {
    api.getSession = original;
  });
  test("partial zero threshold preserves other policy and all operational rows, with one audit/receipt and replay", async () => {
    const before = await invariants();
    const p = await proof(thresholds(0));
    expect(ok(await read(p.identity)).status).toBe("READY");
    const results = await Promise.all([save(p.identity), save(p.identity)]);
    expect(results.every((r) => r.success)).toBe(true);
    expect(results.filter((r) => r.success && r.data.alreadyConfirmed)).toHaveLength(1);
    expect(await config()).toEqual([0, 500000000]);
    expect(await invariants()).toBe(before);
    expect(ok(await read(p.identity)).status).toBe("CONFIRMED");
    const audits = await db.query.auditLog.findMany({
      where: and(eq(auditLog.userId, owner.id), eq(auditLog.action, "UPDATE_APPROVAL_THRESHOLDS")),
    });
    expect(audits.at(-1)?.newState).toContain(reason);
    expect(
      await db.query.aiProposalConfirmation.findMany({
        where: eq(aiProposalConfirmation.toolCallId, p.identity.toolCallId),
      }),
    ).toHaveLength(1);
    expect(
      (
        await db.query.appConfig.findFirst({
          where: and(
            eq(appConfig.tenantId, foreignId),
            eq(appConfig.key, APPROVAL_THRESHOLD_CONFIG_KEYS.fieldCost),
          ),
        })
      )?.value,
    ).toBe("999");
  });
  test("fallback rows are scoped and fractional rupiah stores exact cents", async () => {
    await db
      .delete(appConfig)
      .where(
        and(
          eq(appConfig.tenantId, INSTANCE_TENANT_ID),
          inArray(appConfig.key, Object.values(APPROVAL_THRESHOLD_CONFIG_KEYS)),
        ),
      );
    expect(await config()).toEqual([500000000, 500000000]);
    const p = await proof(thresholds(100.5));
    expect((await save(p.identity)).success).toBe(true);
    expect(await config()).toEqual([10050, 500000000]);
  });
  test("owned proof, exact tool/action, Settings grants and revocation block writes independently of scope", async () => {
    const p = await proof(thresholds());
    as(outsider);
    expect((await save(p.identity)).success).toBe(false);
    as(owner);
    expect((await save({ ...p.identity, patch: { fieldCostAmount: 0 } })).success).toBe(false);
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, owner.roleId),
          eq(rolePermission.permissionKey, "manage:approval_settings"),
        ),
      );
    expect((await read(p.identity)).success).toBe(false);
    expect((await save(p.identity)).success).toBe(false);
    await db
      .insert(rolePermission)
      .values({ roleId: owner.roleId, permissionKey: "manage:approval_settings" });
    await db
      .update(aiMessage)
      .set({
        parts: [
          {
            type: "tool-proposeBudgetSettings",
            state: "output-available",
            toolCallId: p.identity.toolCallId,
            output: { proposal: p.proposal },
          },
        ],
      })
      .where(eq(aiMessage.id, p.messageId));
    expect((await save(p.identity)).success).toBe(false);
    expect(await config()).toEqual([500000000, 500000000]);
  });
  test("manual threshold updates stale the old proof and expired proof cannot save", async () => {
    const p = await proof(thresholds());
    ok(
      await withTestRequest(updateApprovalThresholds)({
        fieldCostCents: 400000000,
        vendorPaymentCents: 500000000,
      }),
    );
    expect(ok(await read(p.identity)).status).toBe("STALE");
    expect((await save(p.identity)).success).toBe(false);
    const expired = await proof(thresholds());
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, expired.messageId));
    expect(ok(await read(expired.identity)).status).toBe("EXPIRED");
    expect((await save(expired.identity)).success).toBe(false);
  });
  test("metadata patch preserves omissions, supports explicit clearing and manual action uses same writer", async () => {
    await db
      .update(expenseCategory)
      .set({ description: "Catatan awal" })
      .where(eq(expenseCategory.id, categoryId));
    const p = await proof(category({ description: null }));
    expect((await save(p.identity)).success).toBe(true);
    const row = await db.query.expenseCategory.findFirst({
      where: eq(expenseCategory.id, categoryId),
    });
    expect(row?.description).toBeNull();
    expect(row?.name).toBe(p.proposal.entityName);
    expect(row?.defaultRatio).toBe("0.100000");
    ok(
      await withTestRequest(updateExpenseCategoryDetails)({
        expenseCategoryId: categoryId,
        name: "Operasional QA",
        description: "Detail manual",
      }),
    );
    expect(
      (await db.query.expenseCategory.findFirst({ where: eq(expenseCategory.id, categoryId) }))
        ?.name,
    ).toBe("Operasional QA");
  });
  test("ratio sync preserves other defaults and existing budgets, requires both grants", async () => {
    const before = await invariants();
    const p = await proof(category({ name: "Operasional QA", defaultRatio: 0.2 }));
    as(limited);
    expect((await save(p.identity)).success).toBe(false);
    await expect(
      prepareFinanceInput(await actor(), category({ defaultRatio: 0.2 })),
    ).rejects.toThrow();
    as(owner);
    expect((await save(p.identity)).success).toBe(true);
    expect(
      (await db.query.expenseCategory.findFirst({ where: eq(expenseCategory.id, categoryId) }))
        ?.defaultRatio,
    ).toBe("0.200000");
    const rows = await db.query.budgetAllocationSettingCategory.findMany({
      where: eq(budgetAllocationSettingCategory.budgetAllocationSettingId, settingId),
    });
    expect(rows.find((r) => r.expenseCategoryId === categoryId)?.ratioPercentage).toBe("0.200000");
    expect(
      rows
        .filter((r) => r.expenseCategoryId !== categoryId)
        .every((r) => r.ratioPercentage === "0.100000"),
    ).toBe(true);
    expect(await invariants()).toBe(before);
  });
  test("canonical deactivation, aggregate overflow, no-op and foreign-category access are explicit blockers", async () => {
    await expect(prepareFinanceInput(await actor(), category({ isActive: false }))).rejects.toThrow(
      "Lima kategori",
    );
    await expect(
      prepareFinanceInput(await actor(), category({ defaultRatio: 0.7 })),
    ).rejects.toThrow("100%");
    await expect(prepareFinanceInput(await actor(), thresholds(5000000))).rejects.toThrow(
      "tidak ada perubahan",
    );
    await expect(
      prepareFinanceInput(await actor(), category({ defaultRatio: 0.1 })),
    ).rejects.toThrow("tidak ada perubahan");
    const [foreign] = await db
      .insert(expenseCategory)
      .values({ tenantId: foreignId, code: randomUUID(), name: "Kategori tenant lain" })
      .returning();
    await expect(
      prepareFinanceInput(
        await actor(),
        financeInputSchema.parse({
          action: "EXPENSE_CATEGORY_SETTINGS",
          expenseCategoryId: foreign.id,
          patch: { name: "Tidak boleh" },
          reason,
        }),
      ),
    ).rejects.toThrow("perusahaan Anda");
    expect(
      (
        await withTestRequest(updateExpenseCategorySetting)({
          expenseCategoryId: categoryId,
          name: "Operasional",
          defaultRatio: 0.1,
          isActive: false,
        })
      ).success,
    ).toBe(false);
  });
  test("non-core availability is reversible without deleting recorded rows", async () => {
    const p = await proof(
      financeInputSchema.parse({
        action: "EXPENSE_CATEGORY_SETTINGS",
        expenseCategoryId: customId,
        patch: { isActive: false },
        reason,
      }),
    );
    expect((await save(p.identity)).success).toBe(true);
    expect(
      (await db.query.expenseCategory.findFirst({ where: eq(expenseCategory.id, customId) }))
        ?.isActive,
    ).toBe(false);
    const restored = await proof(
      financeInputSchema.parse({
        action: "EXPENSE_CATEGORY_SETTINGS",
        expenseCategoryId: customId,
        patch: { isActive: true },
        reason,
      }),
    );
    expect((await save(restored.identity)).success).toBe(true);
  });
  test("category manual changes stale metadata proof and allocation source changes stale ratio proof", async () => {
    const p = await proof(category({ name: "Operasional AI" }));
    ok(
      await withTestRequest(updateExpenseCategoryDetails)({
        expenseCategoryId: categoryId,
        name: "Operasional manual",
      }),
    );
    expect((await save(p.identity)).success).toBe(false);
    const ratio = await proof(category({ defaultRatio: 0.2 }));
    await db
      .update(budgetAllocationSettingCategory)
      .set({ ratioPercentage: "0.150000" })
      .where(eq(budgetAllocationSettingCategory.budgetAllocationSettingId, settingId));
    expect(ok(await read(ratio.identity)).status).toBe("STALE");
    expect((await save(ratio.identity)).success).toBe(false);
  });
  test("audit/receipt failure rolls back policy atomically", async () => {
    const p = await proof(thresholds());
    const originalWriter = writers.writeApprovalThresholdsTx;
    const fault = spyOn(writers, "writeApprovalThresholdsTx").mockImplementation(
      async (...args) => {
        await originalWriter(...args);
        throw new Error("Injected rollback");
      },
    );
    try {
      expect((await save(p.identity)).success).toBe(false);
    } finally {
      fault.mockRestore();
    }
    expect(await config()).toEqual([500000000, 500000000]);
    expect(
      await db.query.aiProposalConfirmation.findFirst({
        where: eq(aiProposalConfirmation.toolCallId, p.identity.toolCallId),
      }),
    ).toBeUndefined();
    expect((await save(p.identity)).success).toBe(true);
  });
  test("manual and AI partial policy changes serialize without losing the other threshold", async () => {
    const before = await invariants();
    const p = await proof(
      financeInputSchema.parse({
        action: "APPROVAL_THRESHOLDS",
        patch: { fieldCostAmount: 6000000, vendorPaymentAmount: 7000000 },
        reason,
      }),
    );
    const a = await actor();
    const [ai, manual] = await Promise.all([
      save(p.identity),
      db.transaction((tx) =>
        writers.writeApprovalThresholdsTx(
          tx,
          a,
          { fieldCostAmount: 4000000 },
          "Perubahan manual setelah peninjauan kebijakan",
        ),
      ),
    ]);
    expect(manual.updated).toBe(true);
    expect(await config()).toEqual([400000000, ai.success ? 700000000 : 500000000]);
    expect(await invariants()).toBe(before);
  });
  test("invalid config fails visibly; complete manual overwrite repairs it with original evidence", async () => {
    await db
      .update(appConfig)
      .set({ value: "broken" })
      .where(
        and(
          eq(appConfig.tenantId, INSTANCE_TENANT_ID),
          eq(appConfig.key, APPROVAL_THRESHOLD_CONFIG_KEYS.fieldCost),
        ),
      );
    await expect(prepareFinanceInput(await actor(), thresholds())).rejects.toThrow(
      "Konfigurasi ambang",
    );
    expect(
      (
        await withTestRequest(updateApprovalThresholds)({
          fieldCostCents: 500000000,
          vendorPaymentCents: 500000000,
        })
      ).success,
    ).toBe(true);
    expect(await config()).toEqual([500000000, 500000000]);
  });
  test("one-character discovery requires choice and live read-only tools do not mutate", async () => {
    const before = await config();
    const a = await actor();
    const tools = buildOperationalSettingsTools(a);
    const choice = await withTestRequest(
      async () =>
        await tools.getExpenseCategorySettingsContext.execute?.(
          { categoryQuery: "O", offset: 0 },
          { toolCallId: "lookup", messages: [], context: {} },
        ),
    )();
    expect(
      z.object({ needsDisambiguation: z.literal(true) }).parse(choice).needsDisambiguation,
    ).toBe(true);
    const value = await withTestRequest(
      async () =>
        await tools.getOperationalSettingsContext.execute?.(
          {},
          { toolCallId: "threshold", messages: [], context: {} },
        ),
    )();
    expect(z.object({ fieldCostAmount: z.number() }).parse(value).fieldCostAmount).toBe(5000000);
    const preview = await withTestRequest(
      async () =>
        await tools.proposeApprovalThresholds.execute?.(thresholds(), {
          toolCallId: "preview",
          messages: [],
          context: {},
        }),
    )();
    expect(
      z.object({ proposal: z.object({ kind: z.literal("FINANCE_INPUT") }) }).parse(preview).proposal
        .kind,
    ).toBe("FINANCE_INPUT");
    as(outsider);
    const readonlyTools = buildOperationalSettingsTools(await actor());
    const actual = await withTestRequest(
      async () =>
        await readonlyTools.getOperationalSettingsContext.execute?.(
          {},
          { toolCallId: "read-only", messages: [], context: {} },
        ),
    )();
    expect(z.object({ fieldCostAmount: z.number() }).parse(actual).fieldCostAmount).toBe(5000000);
    const denied = await withTestRequest(
      async () =>
        await readonlyTools.proposeApprovalThresholds.execute?.(thresholds(), {
          toolCallId: "no-write",
          messages: [],
          context: {},
        }),
    )();
    expect(z.object({ error: z.string() }).parse(denied).error).toContain("Izin tindakan");
    as(owner);
    expect(await config()).toEqual(before);
  });
});
