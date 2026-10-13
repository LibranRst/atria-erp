import { beforeAll, beforeEach, afterAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@backend/db";
import {
  aiConversation,
  aiMessage,
  auditLog,
  project,
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
  projectRap,
  itemPriceLibrary,
  materialMaster,
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
import { buildRapLifecycleTools } from "@backend/lib/ai/tools/rap-lifecycle-tools";
import {
  lifecycleInputSchema,
  lifecycleProposalSchema,
  type LifecycleInput,
  type LifecycleProposal,
} from "@atria/core/ai/rap-lifecycle";
import type { ActionResponse } from "@atria/core/types/action-response";
import { getAiRapLifecycleProposal, confirmAiRapLifecycleProposal } from "./rap-lifecycle";
import {
  createRapRevision,
  createCategoryPlanRevision,
} from "@backend/app/actions/project/revision-change-order";
import { markProjectCategoryPlanItemDraft } from "@backend/app/actions/project/rap-setup";
import { createRapRevisionTx } from "@backend/server/usecases/project/rap-revision-writer";
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
async function prepare(
  f: Fixture,
  input:
    | Omit<Extract<LifecycleInput, { action: "REVISION" }>, "projectId">
    | Omit<Extract<LifecycleInput, { action: "PACKAGE_CHANGES" }>, "projectId">
    | Omit<Extract<LifecycleInput, { action: "ADD_MATERIAL" }>, "projectId">,
  person = owner,
): Promise<{
  conversationId: string;
  toolCallId: string;
  messageId: string;
  proposal: LifecycleProposal;
}> {
  const execute = buildRapLifecycleTools(aiToolContextForRole("OWNER", { userId: person.id }))
    .proposeRapLifecycleActions.execute;
  if (!execute) throw new Error("Missing setup tool");
  const toolCallId = randomUUID(),
    output = await execute(lifecycleInputSchema.parse({ projectId: f.projectId, ...input }), {
      toolCallId,
      messages: [],
      context: undefined,
    }),
    parsed = z.object({ proposal: lifecycleProposalSchema }).parse(output);
  const [c] = await db.insert(aiConversation).values({ userId: person.id }).returning();
  conversations.push(c.id);
  const [m] = await db
    .insert(aiMessage)
    .values({
      conversationId: c.id,
      role: "assistant",
      parts: [
        {
          type: "tool-proposeRapLifecycleActions",
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
const read = withTestRequest(getAiRapLifecycleProposal),
  save = withTestRequest(confirmAiRapLifecycleProposal),
  manualRevision = withTestRequest(createRapRevision),
  manualPackageRevision = withTestRequest(createCategoryPlanRevision),
  manualReopen = withTestRequest(markProjectCategoryPlanItemDraft);
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
describeIntegration("AI RAP lifecycle", () => {
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

  async function locked(): Promise<Fixture> {
    const f = await fixture();
    await db
      .update(projectRap)
      .set({ status: "LOCKED", setupStage: "COMPLETE", tukangScopeSkipped: false })
      .where(eq(projectRap.id, f.rapId));
    await db
      .update(projectCategoryPlanItem)
      .set({ status: "ACTIVE" })
      .where(inArray(projectCategoryPlanItem.id, f.packageIds));
    return f;
  }
  test("revision copies Material and selected Siap package once, keeps baseline and balances intact", async () => {
    const f = await locked(),
      before = await finances(f),
      p = await prepare(f, {
        action: "REVISION",
        reason: "Perubahan scope dapur",
        reviseMaterial: true,
        packageIds: [f.packageIds[0]],
      });
    const baseline = await db.query.projectRap.findFirst({ where: eq(projectRap.id, f.rapId) });
    expect(ok(await read(identity(p))).status).toBe("READY");
    const results = await Promise.all([save(identity(p)), save(identity(p))]);
    expect(results.every((r) => r.success)).toBe(true);
    expect(results.map(ok).filter((r) => !r.alreadyConfirmed)).toHaveLength(1);
    const receipt = ok(results[0]);
    expect(receipt.revisionIds).toHaveLength(2);
    expect(ok(await save(identity(p))).revisionIds).toEqual(receipt.revisionIds);
    expect(await db.query.projectRap.findFirst({ where: eq(projectRap.id, f.rapId) })).toEqual(
      baseline,
    );
    expect(
      await db.query.projectRap.findFirst({ where: eq(projectRap.id, receipt.projectRapId) }),
    ).toMatchObject({ status: "DRAFT", revision: 2, supersedesProjectRapId: f.rapId });
    expect(
      await db.query.projectRapItem.findMany({
        where: eq(projectRapItem.projectRapId, receipt.projectRapId),
      }),
    ).toHaveLength(1);
    expect(
      await db.query.projectCategoryPlanItem.findFirst({
        where: eq(projectCategoryPlanItem.id, receipt.revisionIds[1]),
      }),
    ).toMatchObject({ status: "DRAFT", supersedesProjectCategoryPlanItemId: f.packageIds[0] });
    expect(ok(await read(identity(p))).status).toBe("CONFIRMED");
    expect(await finances(f)).toEqual(before);
  });
  test("package-only revision prepares editable RAP; manual revision shares duplicate/race guards", async () => {
    const f = await locked(),
      p = await prepare(f, {
        action: "REVISION",
        reason: "Revisi scope tukang",
        reviseMaterial: false,
        packageIds: [f.packageIds[0]],
      });
    expect(p.proposal.rows[0].detail).toContain("Baseline Material dipertahankan");
    const outcomes = await Promise.all([
      save(identity(p)),
      manualRevision({ projectRapId: f.rapId, reason: "Koreksi baseline manual" }),
    ]);
    expect(outcomes.filter((r) => r.success)).toHaveLength(1);
    expect(
      await db.query.projectRap.findMany({
        where: and(eq(projectRap.projectId, f.projectId), eq(projectRap.status, "DRAFT")),
      }),
    ).toHaveLength(1);
    const another = await locked();
    expect(
      (
        await manualPackageRevision({
          projectCategoryPlanItemId: another.packageIds[0],
          reason: "Revisi paket manual",
        })
      ).success,
    ).toBe(true);
    expect(
      (
        await manualPackageRevision({
          projectCategoryPlanItemId: another.packageIds[0],
          reason: "Revisi paket manual",
        })
      ).success,
    ).toBe(false);
  });
  test("Edit Lagi and delete Draft batch commits audits and exact projected plan, without cash/stock", async () => {
    const f = await fixture(),
      before = await finances(f);
    await db
      .update(projectCategoryPlanItem)
      .set({ status: "ACTIVE" })
      .where(eq(projectCategoryPlanItem.id, f.packageIds[0]));
    const p = await prepare(f, {
      action: "PACKAGE_CHANGES",
      rows: [
        { action: "REOPEN", itemId: f.packageIds[0] },
        { action: "DELETE", itemId: f.packageIds[1] },
      ],
    });
    expect(p.proposal.budget.planTotal).toBe(150000);
    const receipt = ok(await save(identity(p)));
    expect(receipt.reopenedIds).toEqual([f.packageIds[0]]);
    expect(receipt.deletedIds).toEqual([f.packageIds[1]]);
    expect(
      await db.query.projectCategoryPlanItem.findFirst({
        where: eq(projectCategoryPlanItem.id, f.packageIds[0]),
      }),
    ).toMatchObject({ status: "DRAFT" });
    expect(
      await db.query.projectCategoryPlanItem.findFirst({
        where: eq(projectCategoryPlanItem.id, f.packageIds[1]),
      }),
    ).toBeUndefined();
    expect(ok(await save(identity(p))).alreadyConfirmed).toBe(true);
    expect(await finances(f)).toEqual(before);
  });
  test("stale manual edits, ownership, expiry, unknown targets and client patch cannot commit", async () => {
    const f = await fixture();
    await db
      .update(projectCategoryPlanItem)
      .set({ status: "ACTIVE" })
      .where(eq(projectCategoryPlanItem.id, f.packageIds[0]));
    const p = await prepare(f, {
      action: "PACKAGE_CHANGES",
      rows: [{ action: "REOPEN", itemId: f.packageIds[0] }],
    });
    expect((await save({ ...identity(p), rows: [] })).success).toBe(false);
    expect((await save({ ...identity(p), conversationId: randomUUID() })).success).toBe(false);
    await manualReopen({ projectCategoryPlanItemId: f.packageIds[0] });
    expect(ok(await read(identity(p))).status).toBe("STALE");
    expect((await save(identity(p))).success).toBe(false);
    const fresh = await prepare(f, {
      action: "PACKAGE_CHANGES",
      rows: [{ action: "DELETE", itemId: f.packageIds[0] }],
    });
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, fresh.messageId));
    expect(ok(await read(identity(fresh))).status).toBe("EXPIRED");
    expect((await save(identity(fresh))).success).toBe(false);
    await expect(
      prepare(f, { action: "PACKAGE_CHANGES", rows: [{ action: "DELETE", itemId: randomUUID() }] }),
    ).rejects.toThrow();
  });
  test("custom assigned role and revocation before save, closed projects and foreign scope reject", async () => {
    const f = await locked(),
      p = await prepare(f, {
        action: "REVISION",
        reason: "Perubahan scope dapur",
        reviseMaterial: true,
        packageIds: [],
      });
    const person = { ...owner, id: customUserId, roleId: customRoleId };
    actAs(person);
    expect((await read(identity(p))).success).toBe(false);
    const own = await prepare(
      f,
      { action: "REVISION", reason: "Perubahan scope dapur", reviseMaterial: true, packageIds: [] },
      person,
    );
    expect(ok(await read(identity(own))).status).toBe("READY");
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, customRoleId),
          eq(rolePermission.permissionKey, "update:rap"),
        ),
      );
    expect((await save(identity(own))).success).toBe(false);
    await db.insert(rolePermission).values({ roleId: customRoleId, permissionKey: "update:rap" });
    await db.update(project).set({ projectManagerId: owner.id }).where(eq(project.id, f.projectId));
    expect((await save(identity(own))).success).toBe(false);
    actAs(owner);
    await db.update(project).set({ status: "COMPLETED" }).where(eq(project.id, f.projectId));
    expect((await save(identity(p))).success).toBe(false);
  });
  test("manual and library Material subset uses Settings snapshots, reasoned overrides and stale reference guards", async () => {
    const f = await fixture(false),
      material = await db.query.materialMaster.findFirst({
        where: eq(materialMaster.isActive, true),
      });
    if (!material) throw new Error("seed material missing");
    const expense = await db.query.expenseCategory.findFirst({
      where: eq(expenseCategory.code, "MATERIAL"),
    });
    if (!expense) throw new Error("seed category missing");
    const [template] = await db
      .insert(itemPriceLibrary)
      .values({
        code: `${prefix}-${randomUUID()}`,
        name: "Template uji Material",
        itemType: "MATERIAL_ITEM",
        materialId: material.id,
        expenseCategoryId: expense.id,
        unit: material.unit,
        defaultInternalCost: "1234.56",
        defaultClientPrice: "2000.00",
        pricingMode: "FIXED_CLIENT_PRICE",
        targetGrossPercentage: "0.0000",
        priceSourceType: "HISTORICAL",
        sourceNote: "Fixture disposable",
        effectiveFrom: new Date(),
      })
      .returning();
    try {
      const before = await finances(f),
        p = await prepare(f, {
          action: "ADD_MATERIAL",
          rows: [
            {
              sourceKind: "LIBRARY",
              itemPriceLibraryId: template.id,
              area: "Area uji",
              requiredQuantity: 2,
              bufferQuantity: 0.5,
              source: "PURCHASE",
            },
            {
              sourceKind: "MANUAL",
              materialId: null,
              name: "Item manual uji",
              area: "Area uji",
              requiredQuantity: 1,
              bufferQuantity: 0,
              unit: "ls",
              estimatedUnitCost: 50000,
              source: "VENDOR",
            },
          ],
        });
      expect(p.proposal.materialRows[0].values).toMatchObject({
        name: template.name,
        estimatedUnitCost: 1234.56,
        unit: material.unit,
      });
      expect(p.proposal.rows[0].estimate).toBe(3086.4);
      expect(
        await db.query.projectRapItem.findMany({ where: eq(projectRapItem.projectRapId, f.rapId) }),
      ).toHaveLength(1);
      const receipt = ok(await save(identity(p)));
      expect(receipt.addedIds).toHaveLength(2);
      expect(ok(await save(identity(p))).addedIds).toEqual(receipt.addedIds);
      expect(
        await db.query.projectRapItem.findFirst({
          where: eq(projectRapItem.id, receipt.addedIds[0]),
        }),
      ).toMatchObject({
        sourceLibraryItemId: template.id,
        estimatedTotalCost: "3086.40",
        suggestedClientUnitPrice: "2000.00",
      });
      expect(await finances(f)).toEqual(before);
      await expect(
        prepare(f, {
          action: "ADD_MATERIAL",
          rows: [
            {
              sourceKind: "LIBRARY",
              itemPriceLibraryId: template.id,
              area: "Area uji",
              requiredQuantity: 1,
              bufferQuantity: 0,
              source: "PURCHASE",
              overrideUnitCost: 1000,
            },
          ],
        }),
      ).rejects.toThrow();
      const stale = await prepare(f, {
        action: "ADD_MATERIAL",
        rows: [
          {
            sourceKind: "LIBRARY",
            itemPriceLibraryId: template.id,
            area: "Area uji",
            requiredQuantity: 1,
            bufferQuantity: 0,
            source: "PURCHASE",
            overrideUnitCost: 1000,
            overrideReason: "Harga penawaran terbaru",
          },
        ],
      });
      await db
        .update(itemPriceLibrary)
        .set({ defaultInternalCost: "2000.00" })
        .where(eq(itemPriceLibrary.id, template.id));
      expect(ok(await read(identity(stale))).status).toBe("STALE");
      expect((await save(identity(stale))).success).toBe(false);
    } finally {
      await db
        .update(projectRapItem)
        .set({ sourceLibraryItemId: null })
        .where(eq(projectRapItem.sourceLibraryItemId, template.id));
      await db.delete(itemPriceLibrary).where(eq(itemPriceLibrary.id, template.id));
    }
  });
  test("transaction failure after copy rolls back revision, item copies and audits", async () => {
    const f = await locked(),
      before = await db.query.auditLog.findMany({
        where: eq(auditLog.action, "CREATE_RAP_REVISION"),
      });
    await expect(
      db.transaction(async (tx) => {
        const actor = await withTestRequest(resolveActor)();
        if (!actor) throw new Error("missing actor");
        await createRapRevisionTx(tx, actor, f.rapId, "Perubahan scope dapur");
        throw new Error("Injected failure after revision copy");
      }),
    ).rejects.toThrow("Injected failure");
    expect(
      await db.query.projectRap.findMany({ where: eq(projectRap.projectId, f.projectId) }),
    ).toHaveLength(1);
    expect(
      await db.query.auditLog.findMany({ where: eq(auditLog.action, "CREATE_RAP_REVISION") }),
    ).toEqual(before);
  });
});
