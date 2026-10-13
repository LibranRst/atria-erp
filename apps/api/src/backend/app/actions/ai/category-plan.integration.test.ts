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
  projectCategoryPlanItem,
  projectRap,
  expenseCategory,
  itemPriceLibrary,
  vendor,
  role,
  rolePermission,
  user,
  cashTransaction,
  stockMovement,
  materialInventory,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { withTestRequest } from "@backend/lib/testing/request";
import { aiToolContextForRole } from "@backend/lib/testing/ai-tool-context";
import { buildCategoryPlanTools } from "@backend/lib/ai/tools/category-plan-tools";
import {
  packageInputSchema,
  packageProposalSchema,
  type PackageInput,
  type PackageProposal,
} from "@atria/core/ai/category-plan";
import type { ActionResponse } from "@atria/core/types/action-response";
import { getAiCategoryPlanProposal, confirmAiCategoryPlanProposal } from "./category-plan";
import {
  createProjectCategoryPlanItem,
  updateProjectCategoryPlanItem,
  markProjectCategoryPlanItemActive,
} from "@backend/app/actions/project/category-plan";

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
const sessionApi = auth.api as unknown as { getSession: unknown },
  originalSession = sessionApi.getSession;
const prefix = `AI-PKG-${randomUUID().slice(0, 8)}`;
const projects: string[] = [],
  conversations: string[] = [],
  libraries: string[] = [],
  vendors: string[] = [];
let clientId: string,
  tukangId: string,
  subconId: string,
  customRoleId: string,
  customUserId: string;
function actAs(person: typeof owner | null): void {
  sessionApi.getSession = async () =>
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
const read = withTestRequest(getAiCategoryPlanProposal),
  save = withTestRequest(confirmAiCategoryPlanProposal),
  manualCreate = withTestRequest(createProjectCategoryPlanItem),
  manualUpdate = withTestRequest(updateProjectCategoryPlanItem),
  manualReady = withTestRequest(markProjectCategoryPlanItemActive);
type Fixture = {
  projectId: string;
  budgetId: string;
  tukangCategoryId: string;
  subconCategoryId: string;
};
async function fixture(): Promise<Fixture> {
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
      [tukangId, subconId].map((expenseCategoryId) => ({
        projectBudgetId: b.id,
        expenseCategoryId,
        allocatedAmount: "100000.00",
        actualAmount: "10000.00",
        pendingAmount: "5000.00",
        remainingAmount: "85000.00",
      })),
    )
    .returning();
  return {
    projectId: p.id,
    budgetId: b.id,
    tukangCategoryId: cats[0].id,
    subconCategoryId: cats[1].id,
  };
}
function manual(
  category: "TUKANG" | "SUBCON",
  name = "Pasang panel",
): PackageInput["rows"][number] {
  return {
    action: "CREATE",
    category,
    draft: {
      source: "MANUAL",
      name,
      scopeDescription: "Lingkup terukur",
      area: "Utama",
      quantity: 1.25,
      unit: "m2",
      estimatedUnitCost: 50000,
      vendorId: null,
      internalNote: null,
    },
  };
}
async function prepare(
  record: Fixture,
  rows: PackageInput["rows"],
  person = owner,
): Promise<{
  conversationId: string;
  toolCallId: string;
  messageId: string;
  proposal: PackageProposal;
}> {
  const execute = buildCategoryPlanTools(aiToolContextForRole("OWNER", { userId: person.id }))
    .proposeCategoryPlanPackages.execute;
  if (!execute) throw new Error("Missing proposal tool");
  const toolCallId = randomUUID();
  const output = await execute(packageInputSchema.parse({ projectId: record.projectId, rows }), {
    toolCallId,
    messages: [],
    context: undefined,
  });
  const parsed = z.object({ proposal: packageProposalSchema }).parse(output);
  const [c] = await db.insert(aiConversation).values({ userId: person.id }).returning();
  conversations.push(c.id);
  const [m] = await db
    .insert(aiMessage)
    .values({
      conversationId: c.id,
      role: "assistant",
      parts: [
        {
          type: "tool-proposeCategoryPlanPackages",
          toolCallId,
          state: "output-available",
          output: parsed,
        },
      ],
    })
    .returning();
  return { conversationId: c.id, toolCallId, messageId: m.id, proposal: parsed.proposal };
}
function identity(p: { conversationId: string; toolCallId: string }): {
  conversationId: string;
  toolCallId: string;
} {
  return { conversationId: p.conversationId, toolCallId: p.toolCallId };
}
async function counters(): Promise<{ cash: number; stock: number; inventory: unknown[] }> {
  const [[cash], [stock], inventory] = await Promise.all([
    db.select({ value: count() }).from(cashTransaction),
    db.select({ value: count() }).from(stockMovement),
    db.select().from(materialInventory).orderBy(materialInventory.id),
  ]);
  return { cash: cash.value, stock: stock.value, inventory };
}
async function initial(record: Fixture): Promise<string> {
  return ok(
    await manualCreate({
      projectId: record.projectId,
      projectBudgetCategoryId: record.tukangCategoryId,
      name: "Paket existing",
      scopeDescription: "Scope lama",
      area: " Area lama ",
      quantity: 1,
      unit: "ls",
      estimatedUnitCost: 50000,
      internalNote: "Jangan hilang",
    }),
  ).id;
}

describeIntegration("AI Tukang/Subcon packages", () => {
  beforeAll(async () => {
    clientId = (await db.query.client.findFirst())?.id ?? "";
    tukangId =
      (await db.query.expenseCategory.findFirst({ where: eq(expenseCategory.code, "TUKANG") }))
        ?.id ?? "";
    subconId =
      (await db.query.expenseCategory.findFirst({ where: eq(expenseCategory.code, "SUBCON") }))
        ?.id ?? "";
    const [r] = await db.insert(role).values({ name: prefix, dataScope: "ASSIGNED" }).returning();
    customRoleId = r.id;
    await db.insert(rolePermission).values(
      ["use:ai_chat", "update:budget", "view:budget"].map((permissionKey) => ({
        roleId: r.id,
        permissionKey,
      })),
    );
    const [p] = await db
      .insert(user)
      .values({ name: prefix, email: `${prefix}@fixture.invalid`, roleId: r.id })
      .returning();
    customUserId = p.id;
  });
  beforeEach(() => actAs(owner));
  afterAll(async () => {
    sessionApi.getSession = originalSession;
    if (conversations.length)
      await db.delete(aiConversation).where(inArray(aiConversation.id, conversations));
    if (projects.length) await db.delete(project).where(inArray(project.id, projects));
    if (libraries.length)
      await db.delete(itemPriceLibrary).where(inArray(itemPriceLibrary.id, libraries));
    if (vendors.length) await db.delete(vendor).where(inArray(vendor.id, vendors));
    await db.delete(auditLog).where(eq(auditLog.userId, customUserId));
    await db.delete(user).where(eq(user.id, customUserId));
    await db.delete(rolePermission).where(eq(rolePermission.roleId, customRoleId));
    await db.delete(role).where(eq(role.id, customRoleId));
  });
  test("mixed create/update is atomic, exact, audited, replayable and leaves actual/stock/cash unchanged", async () => {
    const f = await fixture(),
      id = await initial(f),
      before = await counters(),
      budget = await db.query.projectBudgetCategory.findMany({
        where: eq(projectBudgetCategory.projectBudgetId, f.budgetId),
      });
    const p = await prepare(f, [
      { action: "UPDATE", itemId: id, changes: { quantity: 1.25 } },
      manual("SUBCON"),
    ]);
    expect(p.proposal.rows[0].after.area).toBe(" Area lama ");
    expect(p.proposal.rows[0].after.internalNote).toBe("Jangan hilang");
    expect(p.proposal.budgets.find((b) => b.category === "TUKANG")).toMatchObject({
      beforePlan: 50000,
      afterPlan: 62500,
      delta: 12500,
    });
    expect(ok(await read(identity(p))).status).toBe("READY");
    const results = await Promise.all([save(identity(p)), save(identity(p))]);
    expect(results.every((r) => r.success)).toBe(true);
    expect(results.map(ok).filter((r) => !r.alreadyConfirmed)).toHaveLength(1);
    const receipt = ok(results[0]);
    expect(receipt.items[1].itemId).toBe(p.proposal.rows[1].rowId);
    expect(
      (
        await db.query.projectCategoryPlanItem.findFirst({
          where: eq(projectCategoryPlanItem.id, receipt.items[1].itemId),
        })
      )?.status,
    ).toBe("DRAFT");
    expect(ok(await save(identity(p))).items).toEqual(receipt.items);
    expect(ok(await read(identity(p))).status).toBe("CONFIRMED");
    expect(await counters()).toEqual(before);
    expect(
      await db.query.projectBudgetCategory.findMany({
        where: eq(projectBudgetCategory.projectBudgetId, f.budgetId),
      }),
    ).toEqual(budget);
    expect(
      await db.query.aiProposalConfirmation.findMany({
        where: eq(aiProposalConfirmation.toolCallId, p.toolCallId),
      }),
    ).toHaveLength(1);
    expect(
      await db.query.auditLog.findMany({
        where: inArray(
          auditLog.targetId,
          receipt.items.map((i) => i.itemId),
        ),
      }),
    ).toHaveLength(3);
  });
  test("library snapshot and reasoned override preserve Settings identities and client price", async () => {
    const f = await fixture();
    const [v] = await db.insert(vendor).values({ name: prefix, phone: "0800000000" }).returning();
    vendors.push(v.id);
    const [t] = await db
      .insert(itemPriceLibrary)
      .values({
        name: "Paket vendor",
        description: "Lingkup template",
        unit: "paket",
        expenseCategoryId: subconId,
        itemType: "SUBCON_PACKAGE",
        defaultInternalCost: "50000.00",
        defaultClientPrice: "80000.00",
        defaultVendorId: v.id,
      })
      .returning();
    libraries.push(t.id);
    const p = await prepare(f, [
      {
        action: "CREATE",
        category: "SUBCON",
        draft: {
          source: "LIBRARY",
          libraryId: t.id,
          area: "Fasad",
          quantity: 2,
          overrideUnitCost: 60000,
          overrideReason: "Penawaran yang disepakati",
        },
      },
    ]);
    expect(p.proposal.rows[0].after).toMatchObject({
      name: t.name,
      vendorId: v.id,
      unit: "paket",
      estimatedTotalCost: 120000,
    });
    const receipt = ok(await save(identity(p)));
    const row = await db.query.projectCategoryPlanItem.findFirst({
      where: eq(projectCategoryPlanItem.id, receipt.items[0].itemId),
    });
    expect(row).toMatchObject({
      sourceLibraryItemId: t.id,
      suggestedClientUnitPrice: "80000.00",
      estimatedTotalCost: "120000.00",
    });
    const stale = await prepare(f, [
      {
        action: "CREATE",
        category: "SUBCON",
        draft: { source: "LIBRARY", libraryId: t.id, area: "Area kedua", quantity: 1 },
      },
    ]);
    await db.update(itemPriceLibrary).set({ isActive: false }).where(eq(itemPriceLibrary.id, t.id));
    expect(ok(await read(identity(stale))).status).toBe("STALE");
    expect((await save(identity(stale))).success).toBe(false);
  });
  test("dynamic grants, assigned project, NONE scope, ownership and Purchasing are enforced", async () => {
    const f = await fixture(),
      person = { ...owner, id: customUserId, roleId: customRoleId },
      p = await prepare(f, [manual("TUKANG")], person);
    actAs(person);
    expect(ok(await read(identity(p))).status).toBe("READY");
    actAs(owner);
    expect((await read(identity(p))).success).toBe(false);
    actAs(person);
    await db.update(project).set({ projectManagerId: owner.id }).where(eq(project.id, f.projectId));
    expect((await save(identity(p))).success).toBe(false);
    await db
      .update(project)
      .set({ projectManagerId: customUserId })
      .where(eq(project.id, f.projectId));
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, customRoleId),
          eq(rolePermission.permissionKey, "update:budget"),
        ),
      );
    expect((await save(identity(p))).success).toBe(false);
    await db
      .insert(rolePermission)
      .values({ roleId: customRoleId, permissionKey: "update:budget" });
    await db.update(role).set({ dataScope: "NONE" }).where(eq(role.id, customRoleId));
    expect((await read(identity(p))).success).toBe(false);
    await db.update(role).set({ dataScope: "ASSIGNED" }).where(eq(role.id, customRoleId));
    actAs(purchasing);
    expect((await read(identity(p))).success).toBe(false);
  });
  test("identity-only proof, expiry, non-assistant source, stale manual edits and Ready/locked targets", async () => {
    const f = await fixture(),
      id = await initial(f),
      p = await prepare(f, [
        { action: "UPDATE", itemId: id, changes: { estimatedUnitCost: 60000 } },
      ]);
    expect((await save({ ...identity(p), rows: p.proposal.rows })).success).toBe(false);
    await db.update(aiMessage).set({ role: "user" }).where(eq(aiMessage.id, p.messageId));
    expect((await save(identity(p))).success).toBe(false);
    await db
      .update(aiMessage)
      .set({ role: "assistant", createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, p.messageId));
    expect(ok(await read(identity(p))).status).toBe("EXPIRED");
    expect((await save(identity(p))).success).toBe(false);
    const stale = await prepare(f, [
      { action: "UPDATE", itemId: id, changes: { estimatedUnitCost: 60000 } },
    ]);
    ok(
      await manualUpdate({
        projectId: f.projectId,
        projectCategoryPlanItemId: id,
        projectBudgetCategoryId: f.tukangCategoryId,
        name: "Paket existing",
        scopeDescription: "Scope manual",
        area: "Area manual",
        quantity: 1,
        unit: "ls",
        estimatedUnitCost: 70000,
      }),
    );
    expect(ok(await read(identity(stale))).status).toBe("STALE");
    expect((await save(identity(stale))).success).toBe(false);
    const next = await prepare(f, [
      { action: "UPDATE", itemId: id, changes: { estimatedUnitCost: 60000 } },
    ]);
    ok(await manualReady(id));
    expect(ok(await read(identity(next))).status).toBe("STALE");
    expect((await save(identity(next))).success).toBe(false);
    const [rap] = await db
      .insert(projectRap)
      .values({ projectId: f.projectId, status: "LOCKED" })
      .returning();
    expect((await save(identity(next))).success).toBe(false);
    expect(
      await manualCreate({
        projectId: f.projectId,
        projectBudgetCategoryId: f.tukangCategoryId,
        name: "Blocked",
        area: "Umum",
        quantity: 1,
        unit: "ls",
        estimatedUnitCost: 10,
      }),
    ).toMatchObject({ success: false });
    await db.delete(projectRap).where(eq(projectRap.id, rap.id));
  });
  test("rolls back earlier row and audits when a later database insert fails", async () => {
    const f = await fixture(),
      p = await prepare(f, [manual("TUKANG", "Baris pertama"), manual("SUBCON", "Baris kedua")]);
    const collision = p.proposal.rows[1].rowId;
    await db.insert(projectCategoryPlanItem).values({
      id: collision,
      projectId: f.projectId,
      projectBudgetId: f.budgetId,
      projectBudgetCategoryId: f.subconCategoryId,
      expenseCategoryId: subconId,
      name: "Collision",
      area: "Lain",
      unit: "ls",
      quantity: "1.00",
      estimatedUnitCost: "1.00",
      estimatedTotalCost: "1.00",
    });
    // Same-context check intentionally records the collision in the proof; writer still must roll back the first row when PK conflict reaches row two.
    const execute = buildCategoryPlanTools(aiToolContextForRole("OWNER", { userId: owner.id }))
      .proposeCategoryPlanPackages.execute;
    if (!execute) throw new Error("Missing tool");
    const output = await execute(
      packageInputSchema.parse({
        projectId: f.projectId,
        rows: [manual("TUKANG", "Baris pertama"), manual("SUBCON", "Baris kedua")],
      }),
      { toolCallId: p.toolCallId, messages: [], context: undefined },
    );
    const rebuilt = z.object({ proposal: packageProposalSchema }).parse(output).proposal;
    const originalIds = p.proposal.rows.map((r) => r.rowId);
    rebuilt.rows.forEach((r, i) => {
      r.rowId = originalIds[i];
    });
    await db
      .update(aiMessage)
      .set({
        parts: [
          {
            type: "tool-proposeCategoryPlanPackages",
            toolCallId: p.toolCallId,
            state: "output-available",
            output: { proposal: rebuilt },
          },
        ],
      })
      .where(eq(aiMessage.id, p.messageId));
    expect(ok(await read(identity(p))).status).toBe("READY");
    expect((await save(identity(p))).success).toBe(false);
    expect(
      await db.query.projectCategoryPlanItem.findFirst({
        where: eq(projectCategoryPlanItem.id, originalIds[0]),
      }),
    ).toBeUndefined();
    expect(
      await db.query.auditLog.findMany({ where: eq(auditLog.targetId, originalIds[0]) }),
    ).toHaveLength(0);
    expect(
      await db.query.aiProposalConfirmation.findMany({
        where: eq(aiProposalConfirmation.toolCallId, p.toolCallId),
      }),
    ).toHaveLength(0);
  });
  test("manual create race never loses a package or confirms a stale total", async () => {
    const f = await fixture(),
      p = await prepare(f, [manual("TUKANG", "Usulan AI")]);
    const [a, m] = await Promise.all([
      save(identity(p)),
      manualCreate({
        projectId: f.projectId,
        projectBudgetCategoryId: f.tukangCategoryId,
        name: "Input manual",
        area: "Utama",
        quantity: 1,
        unit: "ls",
        estimatedUnitCost: 100,
      }),
    ]);
    expect(m.success).toBe(true);
    const rows = await db.query.projectCategoryPlanItem.findMany({
      where: eq(projectCategoryPlanItem.projectId, f.projectId),
    });
    expect(rows.some((r) => r.name === "Input manual")).toBe(true);
    expect(rows).toHaveLength(a.success ? 2 : 1);
  });
  test("skipped scope, closed project, invalid vendor and mismatched template are rejected", async () => {
    const f = await fixture();
    await expect(
      prepare(f, [
        {
          action: "CREATE",
          category: "TUKANG",
          draft: {
            source: "MANUAL",
            name: "Paket vendor",
            area: "Utama",
            quantity: 1,
            unit: "ls",
            estimatedUnitCost: 10,
            vendorId: randomUUID(),
            scopeDescription: null,
            internalNote: null,
          },
        },
      ]),
    ).rejects.toThrow();
    const [template] = await db
      .insert(itemPriceLibrary)
      .values({
        expenseCategoryId: tukangId,
        itemType: "WORK_PACKAGE",
        name: "Template Tukang",
        unit: "ls",
        defaultInternalCost: "10.00",
      })
      .returning();
    libraries.push(template.id);
    await expect(
      prepare(f, [
        {
          action: "CREATE",
          category: "SUBCON",
          draft: { source: "LIBRARY", libraryId: template.id, area: "Utama", quantity: 1 },
        },
      ]),
    ).rejects.toThrow();
    const [rap] = await db
      .insert(projectRap)
      .values({ projectId: f.projectId, status: "DRAFT", tukangScopeSkipped: true })
      .returning();
    await expect(prepare(f, [manual("TUKANG")])).rejects.toThrow();
    expect(
      (
        await manualCreate({
          projectId: f.projectId,
          projectBudgetCategoryId: f.tukangCategoryId,
          name: "Ditolak",
          area: "Umum",
          quantity: 1,
          unit: "ls",
          estimatedUnitCost: 10,
        })
      ).success,
    ).toBe(false);
    await db.delete(projectRap).where(eq(projectRap.id, rap.id));
    const proposed = await prepare(f, [manual("TUKANG")]);
    await db.update(project).set({ status: "CLOSED" }).where(eq(project.id, f.projectId));
    expect(ok(await read(identity(proposed))).status).toBe("STALE");
    expect((await save(identity(proposed))).success).toBe(false);
  });
  test("exactly50 rows save while51 and duplicate/no-op/cross-project update are rejected", async () => {
    const f = await fixture();
    const rows = Array.from({ length: 50 }, (_, i) =>
      manual(i % 2 ? "TUKANG" : "SUBCON", `Paket ${i}`),
    );
    const p = await prepare(f, rows);
    expect(ok(await save(identity(p))).items).toHaveLength(50);
    expect(
      packageInputSchema.safeParse({
        projectId: f.projectId,
        rows: [...rows, manual("TUKANG", "Extra")],
      }).success,
    ).toBe(false);
    const other = await fixture(),
      id = await initial(other);
    await expect(
      prepare(f, [{ action: "UPDATE", itemId: id, changes: { quantity: 2 } }]),
    ).rejects.toThrow();
    const current = await initial(f);
    await expect(
      prepare(f, [{ action: "UPDATE", itemId: current, changes: { quantity: 1 } }]),
    ).rejects.toThrow();
  });
});
