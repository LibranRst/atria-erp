import { readRapReviewCorrections } from "@backend/server/usecases/ai/rap-review-context";
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@backend/db";
import {
  aiConversation,
  aiMessage,
  formDraft,
  aiProposalConfirmation,
  auditLog,
  cashTransaction,
  expenseCategory,
  materialInventory,
  materialMaster,
  itemPriceLibrary,
  project,
  projectBudgets,
  projectBudgetCategory,
  projectRap,
  projectRapItem,
  role,
  rolePermission,
  stockMovement,
  user,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { withTestRequest } from "@backend/lib/testing/request";
import { aiToolContextForRole } from "@backend/lib/testing/ai-tool-context";
import { buildRapDraftTools } from "@backend/lib/ai/tools/rap-draft-tools";
import {
  createMaterialMasterTx,
  loadMaterialReferences,
} from "@backend/server/usecases/material/master-writer";
import {
  addProjectRapItem,
  createProjectRap,
  lockProjectRap,
} from "@backend/app/actions/project/project-rap-actions";
import { copyPricingTemplateToRap } from "@backend/app/actions/project/workflow-governance";
import {
  rapDraftInputSchema,
  rapDraftProposalSchema,
  type RapDraftProposal,
} from "@atria/core/ai/rap-draft";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { PermissionKey } from "@atria/core/auth/permissions";
import {
  getAiRapDraftProposal,
  confirmAiRapDraftProposal,
  patchAiRapDraftProposal,
} from "./rap-draft";

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
const originalSession = sessionApi.getSession;
const prefix = `AI-RAP-${randomUUID().slice(0, 8)}`;
const projects: string[] = [],
  materials: string[] = [],
  libraries: string[] = [],
  conversations: string[] = [];
let categoryId: string,
  locationId: string,
  clientId: string,
  expenseId: string,
  customRoleId: string,
  customUserId: string;
const grants: readonly PermissionKey[] = [
  "use:ai_chat",
  "create:rap",
  "update:rap",
  "view:budget",
  "view:material",
  "lock:rap",
];
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
type Fixture = { projectId: string; budgetId: string; materialId: string; categoryId: string };
async function fixture(manager = customUserId): Promise<Fixture> {
  const [record] = await db
    .insert(project)
    .values({
      name: `${prefix}-${projects.length}`,
      clientId,
      projectManagerId: manager,
      status: "DRAFT",
      totalContractValue: "1000000.00",
    })
    .returning();
  projects.push(record.id);
  const [budget] = await db
    .insert(projectBudgets)
    .values({ projectId: record.id, contractValue: "1000000.00", internalBudget: "900000.00" })
    .returning();
  const [category] = await db
    .insert(projectBudgetCategory)
    .values({
      projectBudgetId: budget.id,
      expenseCategoryId: expenseId,
      allocatedAmount: "315000.00",
      actualAmount: "10000.00",
      pendingAmount: "5000.00",
      remainingAmount: "300000.00",
    })
    .returning();
  const material = await db.transaction((tx) =>
    createMaterialMasterTx(tx, owner.id, {
      categoryId,
      name: `${prefix}-M-${materials.length}`,
      unit: "lembar",
      inventoryDefaults: [
        { inventoryLocationId: locationId, minimumStock: 0, lastPurchasePrice: 50000 },
      ],
    }),
  );
  materials.push(material.id);
  return {
    projectId: record.id,
    budgetId: budget.id,
    materialId: material.id,
    categoryId: category.id,
  };
}
async function prepare(
  record: Fixture,
  person = owner,
  quantity = 2,
): Promise<{
  conversationId: string;
  toolCallId: string;
  messageId: string;
  proposal: RapDraftProposal;
}> {
  const context = aiToolContextForRole("OWNER", { userId: person.id });
  const execute = buildRapDraftTools(context).proposeRapMaterialDraft.execute;
  if (!execute) throw new Error("Missing RAP proposal tool");
  const toolCallId = randomUUID();
  const output = await execute(
    rapDraftInputSchema.parse({
      projectId: record.projectId,
      rows: [
        {
          materialId: record.materialId,
          requiredQuantity: quantity,
          bufferQuantity: 0.25,
          area: "Ruang utama",
        },
      ],
    }),
    { toolCallId, messages: [], context: undefined },
  );
  const parsed = z.object({ proposal: rapDraftProposalSchema }).parse(output);
  const [conversation] = await db.insert(aiConversation).values({ userId: person.id }).returning();
  conversations.push(conversation.id);
  const [message] = await db
    .insert(aiMessage)
    .values({
      conversationId: conversation.id,
      role: "assistant",
      parts: [
        {
          type: "tool-proposeRapMaterialDraft",
          toolCallId,
          state: "output-available",
          output: parsed,
        },
      ],
    })
    .returning();
  return {
    conversationId: conversation.id,
    toolCallId,
    messageId: message.id,
    proposal: parsed.proposal,
  };
}
function identity(proposed: Awaited<ReturnType<typeof prepare>>): {
  conversationId: string;
  toolCallId: string;
} {
  return { conversationId: proposed.conversationId, toolCallId: proposed.toolCallId };
}
async function counters(): Promise<{ cash: number; movements: number }> {
  const [[cash], [movements]] = await Promise.all([
    db.select({ value: count() }).from(cashTransaction),
    db.select({ value: count() }).from(stockMovement),
  ]);
  return { cash: cash.value, movements: movements.value };
}
const read = withTestRequest(getAiRapDraftProposal),
  save = withTestRequest(confirmAiRapDraftProposal);
const manualCreate = withTestRequest(createProjectRap),
  manualAdd = withTestRequest(addProjectRapItem),
  manualLock = withTestRequest(lockProjectRap);
describeIntegration("owned RAP Material draft proposals", () => {
  beforeAll(async (): Promise<void> => {
    const refs = await loadMaterialReferences();
    categoryId = refs.categories[0].id;
    locationId = refs.locations.find((row) => row.isActive)?.id ?? "";
    clientId = (await db.query.client.findFirst())?.id ?? "";
    expenseId =
      (await db.query.expenseCategory.findFirst({ where: eq(expenseCategory.code, "MATERIAL") }))
        ?.id ?? "";
    const [customRole] = await db
      .insert(role)
      .values({ name: prefix, dataScope: "ASSIGNED" })
      .returning();
    customRoleId = customRole.id;
    await db
      .insert(rolePermission)
      .values(grants.map((permissionKey) => ({ roleId: customRoleId, permissionKey })));
    const [person] = await db
      .insert(user)
      .values({ name: prefix, email: `${prefix}@fixture.invalid`, roleId: customRoleId })
      .returning();
    customUserId = person.id;
  });
  beforeEach((): void => actAs(owner));
  afterAll(async (): Promise<void> => {
    sessionApi.getSession = originalSession;
    if (conversations.length)
      await db.delete(aiConversation).where(inArray(aiConversation.id, conversations));
    if (projects.length) await db.delete(project).where(inArray(project.id, projects));
    if (libraries.length)
      await db.delete(itemPriceLibrary).where(inArray(itemPriceLibrary.id, libraries));
    if (materials.length) {
      await db.delete(materialInventory).where(inArray(materialInventory.materialId, materials));
      await db.delete(materialMaster).where(inArray(materialMaster.id, materials));
    }
    if (customUserId) await db.delete(auditLog).where(eq(auditLog.userId, customUserId));
    if (customUserId) await db.delete(user).where(eq(user.id, customUserId));
    if (customRoleId) {
      await db.delete(rolePermission).where(eq(rolePermission.roleId, customRoleId));
      await db.delete(role).where(eq(role.id, customRoleId));
    }
  });
  test("read-only proposal, atomic new RAP, double-click/replay, audit and no stock/cash/budget usage", async (): Promise<void> => {
    const record = await fixture();
    const before = await counters();
    const inventory = await db.query.materialInventory.findMany({
      where: eq(materialInventory.materialId, record.materialId),
    });
    const budget = await db.query.projectBudgetCategory.findFirst({
      where: eq(projectBudgetCategory.id, record.categoryId),
    });
    const proposed = await prepare(record);
    expect(
      await db.query.projectRap.findFirst({ where: eq(projectRap.projectId, record.projectId) }),
    ).toBeUndefined();
    expect(proposed.proposal.rows[0].unit).toBe("lembar");
    expect(proposed.proposal.rows[0].priceSource).toBe("REFERENCE");
    expect(proposed.proposal.budget).toMatchObject({
      actual: 10000,
      pending: 5000,
      remaining: 300000,
      existingPlan: 0,
      addition: 112500,
      afterPlan: 112500,
    });
    expect(ok(await read(identity(proposed))).status).toBe("READY");
    const outcomes = await Promise.all([save(identity(proposed)), save(identity(proposed))]);
    expect(outcomes.every((result) => result.success)).toBe(true);
    const receipts = outcomes.map(ok);
    expect(receipts.filter((row) => !row.alreadyConfirmed)).toHaveLength(1);
    expect(receipts[0].itemIds).toEqual(receipts[1].itemIds);
    const rap = await db.query.projectRap.findFirst({
      where: eq(projectRap.projectId, record.projectId),
      with: { items: true },
    });
    expect(rap?.status).toBe("DRAFT");
    expect(rap?.items).toHaveLength(1);
    expect(rap?.items[0].totalQuantity).toBe("2.25");
    expect(Number(rap?.items[0].estimatedTotalCost)).toBe(112500);
    expect(rap?.items[0].id).toBe(proposed.proposal.rows[0].rowId);
    expect(ok(await read(identity(proposed))).status).toBe("CONFIRMED");
    expect(ok(await save(identity(proposed))).itemIds).toEqual(receipts[0].itemIds);
    expect(
      await db.query.materialInventory.findMany({
        where: eq(materialInventory.materialId, record.materialId),
      }),
    ).toEqual(inventory);
    expect(
      await db.query.projectBudgetCategory.findFirst({
        where: eq(projectBudgetCategory.id, record.categoryId),
      }),
    ).toEqual(budget);
    expect(await counters()).toEqual(before);
    expect(
      await db.query.aiProposalConfirmation.findMany({
        where: eq(aiProposalConfirmation.toolCallId, proposed.toolCallId),
      }),
    ).toHaveLength(1);
    expect(
      await db.query.auditLog.findMany({
        where: and(
          eq(auditLog.targetId, rap?.items[0].id ?? ""),
          eq(auditLog.action, "CREATE_RAP_ITEM_DRAFT"),
        ),
      }),
    ).toHaveLength(1);
  });
  test("append preserves existing items and reports existing plan without double-counting actual", async (): Promise<void> => {
    const record = await fixture();
    const first = await prepare(record);
    const receipt = ok(await save(identity(first)));
    const second = await prepare(record, owner, 1);
    expect(second.proposal.projectRapId).toBe(receipt.projectRapId);
    expect(second.proposal.budget).toMatchObject({
      existingPlan: 112500,
      addition: 62500,
      afterPlan: 175000,
      actual: 10000,
    });
    expect(ok(await save(identity(second))).projectRapId).toBe(receipt.projectRapId);
    expect(
      await db.query.projectRapItem.findMany({
        where: eq(projectRapItem.projectRapId, receipt.projectRapId),
      }),
    ).toHaveLength(2);
  });
  test("custom assigned role, ownership, NONE, reassignment and revoked permission at save", async (): Promise<void> => {
    const person = { ...owner, id: customUserId, roleId: customRoleId };
    const record = await fixture();
    const proposed = await prepare(record, person);
    actAs(owner);
    expect((await save(identity(proposed))).success).toBe(false);
    actAs(person);
    expect(ok(await read(identity(proposed))).status).toBe("READY");
    await db
      .update(project)
      .set({ projectManagerId: owner.id })
      .where(eq(project.id, record.projectId));
    expect((await save(identity(proposed))).success).toBe(false);
    await db
      .update(project)
      .set({ projectManagerId: customUserId })
      .where(eq(project.id, record.projectId));
    const fresh = await prepare(record, person);
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, customRoleId),
          eq(rolePermission.permissionKey, "update:rap"),
        ),
      );
    expect((await save(identity(fresh))).success).toBe(false);
    await db.insert(rolePermission).values({ roleId: customRoleId, permissionKey: "update:rap" });
    await db.update(role).set({ dataScope: "NONE" }).where(eq(role.id, customRoleId));
    expect((await save(identity(fresh))).success).toBe(false);
    await db.update(role).set({ dataScope: "ASSIGNED" }).where(eq(role.id, customRoleId));
    const final = await prepare(record, person);
    expect((await save(identity(final))).success).toBe(true);
    actAs(purchasing);
    expect((await save(identity(final))).success).toBe(false);
  });
  test("missing new-header grant, closed project, inactive material and missing price refuse", async (): Promise<void> => {
    const person = { ...owner, id: customUserId, roleId: customRoleId };
    const record = await fixture();
    const proposed = await prepare(record, person);
    actAs(person);
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, customRoleId),
          eq(rolePermission.permissionKey, "create:rap"),
        ),
      );
    expect((await save(identity(proposed))).success).toBe(false);
    await db.insert(rolePermission).values({ roleId: customRoleId, permissionKey: "create:rap" });
    actAs(owner);
    await db.update(project).set({ status: "COMPLETED" }).where(eq(project.id, record.projectId));
    expect((await save(identity(proposed))).success).toBe(false);
    await db.update(project).set({ status: "DRAFT" }).where(eq(project.id, record.projectId));
    await db
      .update(materialMaster)
      .set({ isActive: false })
      .where(eq(materialMaster.id, record.materialId));
    expect((await save(identity(proposed))).success).toBe(false);
    await db
      .update(materialMaster)
      .set({ isActive: true })
      .where(eq(materialMaster.id, record.materialId));
    await db
      .update(materialInventory)
      .set({ lastPurchasePrice: "0.00" })
      .where(eq(materialInventory.materialId, record.materialId));
    await expect(prepare(record)).rejects.toThrow();
  });
  test("expiry, forged values and stale budget/material/stock/manual RAP reject without receipt", async (): Promise<void> => {
    const record = await fixture();
    let proposed = await prepare(record);
    expect((await save({ ...identity(proposed), rows: proposed.proposal.rows })).success).toBe(
      false,
    );
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, proposed.messageId));
    expect(ok(await read(identity(proposed))).status).toBe("EXPIRED");
    expect((await save(identity(proposed))).success).toBe(false);
    proposed = await prepare(record);
    await db
      .update(projectBudgetCategory)
      .set({ allocatedAmount: "320000.00" })
      .where(eq(projectBudgetCategory.id, record.categoryId));
    expect(ok(await read(identity(proposed))).status).toBe("STALE");
    expect((await save(identity(proposed))).success).toBe(false);
    proposed = await prepare(record);
    await db
      .update(materialMaster)
      .set({ unit: "panel" })
      .where(eq(materialMaster.id, record.materialId));
    expect((await save(identity(proposed))).success).toBe(false);
    proposed = await prepare(record);
    await db
      .update(materialInventory)
      .set({ reservedStock: "1.00" })
      .where(eq(materialInventory.materialId, record.materialId));
    expect((await save(identity(proposed))).success).toBe(false);
    proposed = await prepare(record);
    const rap = ok(await manualCreate({ projectId: record.projectId }));
    expect((await save(identity(proposed))).success).toBe(false);
    expect(
      await db.query.aiProposalConfirmation.findMany({
        where: eq(aiProposalConfirmation.toolCallId, proposed.toolCallId),
      }),
    ).toHaveLength(0);
    const pending = await prepare(record);
    ok(
      await manualAdd({
        projectRapId: rap.id,
        materialId: record.materialId,
        name: "Manual material",
        unit: "panel",
        area: "Area manual",
        requiredQuantity: 1,
        bufferQuantity: 0,
        estimatedUnitCost: 50000,
        source: "PURCHASE",
      }),
    );
    expect((await save(identity(pending))).success).toBe(false);
    const toLock = await prepare(record);
    await db
      .update(projectRap)
      .set({
        setupStage: "REVIEW",
        tukangScopeSkipped: true,
        subconScopeSkipped: true,
      })
      .where(eq(projectRap.id, rap.id));
    ok(await manualLock(rap.id));
    expect((await save(identity(toLock))).success).toBe(false);
  });
  test("concurrent manual create and AI confirmation serialize one RAP header", async (): Promise<void> => {
    const record = await fixture();
    const proposed = await prepare(record);
    const results = await Promise.all([
      save(identity(proposed)),
      manualCreate({ projectId: record.projectId }),
    ]);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(
      await db.query.projectRap.findMany({ where: eq(projectRap.projectId, record.projectId) }),
    ).toHaveLength(1);
  });
  test("late row failure rolls back header, items, audits and confirmation together", async (): Promise<void> => {
    const record = await fixture();
    const proposed = await prepare(record);
    const bad = {
      ...proposed.proposal,
      rows: [proposed.proposal.rows[0], { ...proposed.proposal.rows[0], area: "Area kedua" }],
    };
    await db
      .update(aiMessage)
      .set({
        parts: [
          {
            type: "tool-proposeRapMaterialDraft",
            toolCallId: proposed.toolCallId,
            state: "output-available",
            output: { proposal: bad },
          },
        ],
      })
      .where(eq(aiMessage.id, proposed.messageId));
    expect((await save(identity(proposed))).success).toBe(false);
    expect(
      await db.query.projectRap.findFirst({ where: eq(projectRap.projectId, record.projectId) }),
    ).toBeUndefined();
    expect(
      await db.query.projectRapItem.findFirst({
        where: eq(projectRapItem.id, proposed.proposal.rows[0].rowId),
      }),
    ).toBeUndefined();
    expect(
      await db.query.auditLog.findMany({
        where: eq(auditLog.targetId, proposed.proposal.rows[0].rowId),
      }),
    ).toHaveLength(0);
    expect(
      await db.query.aiProposalConfirmation.findMany({
        where: eq(aiProposalConfirmation.toolCallId, proposed.toolCallId),
      }),
    ).toHaveLength(0);
  });
  test("manual append racing AI never loses manual rows or overwrites a changed RAP", async (): Promise<void> => {
    const record = await fixture();
    const rap = ok(await manualCreate({ projectId: record.projectId }));
    const proposed = await prepare(record);
    const [ai, manual] = await Promise.all([
      save(identity(proposed)),
      manualAdd({
        projectRapId: rap.id,
        materialId: record.materialId,
        name: "Manual race row",
        unit: "lembar",
        area: "Area manual",
        requiredQuantity: 1,
        bufferQuantity: 0,
        estimatedUnitCost: 50000,
        source: "PURCHASE",
      }),
    ]);
    expect(manual.success).toBe(true);
    const rows = await db.query.projectRapItem.findMany({
      where: eq(projectRapItem.projectRapId, rap.id),
    });
    expect(rows.some((row) => row.name === "Manual race row")).toBe(true);
    expect(rows).toHaveLength(ai.success ? 2 : 1);
  });
  test("finalization racing AI appends either before lock or refuses after lock", async (): Promise<void> => {
    const record = await fixture();
    const first = await prepare(record);
    const receipt = ok(await save(identity(first)));
    await db
      .update(projectRap)
      .set({ setupStage: "REVIEW", tukangScopeSkipped: true, subconScopeSkipped: true })
      .where(eq(projectRap.id, receipt.projectRapId));
    const proposed = await prepare(record);
    const [ai, locked] = await Promise.all([
      save(identity(proposed)),
      manualLock(receipt.projectRapId),
    ]);
    expect(locked.success).toBe(true);
    const rap = await db.query.projectRap.findFirst({
      where: eq(projectRap.id, receipt.projectRapId),
      with: { items: true },
    });
    expect(rap?.status).toBe("LOCKED");
    expect(rap?.items).toHaveLength(ai.success ? 2 : 1);
  });
  test("template copying shares the RAP lock and exact cost calculation", async (): Promise<void> => {
    const record = await fixture();
    const rap = ok(await manualCreate({ projectId: record.projectId }));
    const [template] = await db
      .insert(itemPriceLibrary)
      .values({
        name: `${prefix}-template`,
        expenseCategoryId: expenseId,
        itemType: "MATERIAL_ITEM",
        materialId: record.materialId,
        unit: "lembar",
        defaultInternalCost: "0.05",
        defaultClientPrice: "1.00",
      })
      .returning();
    libraries.push(template.id);
    const proposed = await prepare(record);
    const [ai, manual] = await Promise.all([
      save(identity(proposed)),
      withTestRequest(copyPricingTemplateToRap)({
        projectRapId: rap.id,
        itemPriceLibraryId: template.id,
        area: "Area template",
        requiredQuantity: 0.7,
        bufferQuantity: 0,
        source: "PURCHASE",
      }),
    ]);
    expect(manual.success).toBe(true);
    const item = ok(manual);
    expect(Number(item.estimatedTotalCost)).toBe(0.04);
    expect(item.sourceLibraryItemId).toBe(template.id);
    expect(
      await db.query.projectRapItem.findMany({ where: eq(projectRapItem.projectRapId, rap.id) }),
    ).toHaveLength(ai.success ? 2 : 1);
  });
  test("applied corrections persist separately, validate reviewed revision and preserve the confirmed snapshot", async (): Promise<void> => {
    const record = await fixture();
    const proposed = await prepare(record);
    const original = await db.query.aiMessage.findFirst({
      where: eq(aiMessage.id, proposed.messageId),
    });
    const before = await counters();
    const initial = ok(await read(identity(proposed)));
    const fields = {
      area: "Area dikoreksi",
      requiredQuantity: 3,
      bufferQuantity: 0.5,
      estimatedUnitCost: 75000,
    };
    const corrected = ok(
      await withTestRequest(patchAiRapDraftProposal)({
        ...identity(proposed),
        expectedRevision: initial.revision,
        rows: [{ rowId: proposed.proposal.rows[0].rowId, fields }],
      }),
    );
    expect(corrected.revision).toBe(2);
    const contextDrafts = await readRapReviewCorrections(
      aiToolContextForRole("OWNER", { userId: owner.id }),
      record.projectId,
    );
    expect(contextDrafts[0].rows[0].requiredQuantity).toBe(3);
    expect(
      await readRapReviewCorrections(
        aiToolContextForRole("OWNER", { userId: owner.id, dataScope: "NONE" }),
        record.projectId,
      ),
    ).toEqual([]);
    expect(corrected.proposal.rows[0]).toMatchObject({
      ...fields,
      estimatedTotalCost: 262500,
      priceSource: "USER",
    });
    expect(ok(await read(identity(proposed))).proposal).toEqual(corrected.proposal);
    expect(
      await db.query.aiMessage.findFirst({ where: eq(aiMessage.id, proposed.messageId) }),
    ).toEqual(original);
    expect(
      await db.query.projectRap.findFirst({ where: eq(projectRap.projectId, record.projectId) }),
    ).toBeUndefined();
    expect(await counters()).toEqual(before);
    expect((await save(identity(proposed))).success).toBe(false);
    expect((await save({ ...identity(proposed), expectedRevision: 1 })).success).toBe(false);
    const receipt = ok(await save({ ...identity(proposed), expectedRevision: corrected.revision }));
    const items = await db.query.projectRapItem.findMany({
      where: eq(projectRapItem.projectRapId, receipt.projectRapId),
    });
    expect(items[0]).toMatchObject({
      area: fields.area,
      requiredQuantity: "3.00",
      bufferQuantity: "0.50",
      estimatedUnitCost: "75000.00",
    });
    expect(Number(items[0].estimatedTotalCost)).toBe(262500);
    const consumed = await db.query.formDraft.findFirst({
      where: eq(formDraft.id, corrected.draftId ?? ""),
    });
    expect(consumed?.status).toBe("CONSUMED");
    expect(ok(await read(identity(proposed))).proposal).toEqual(corrected.proposal);
    expect(ok(await save({ ...identity(proposed), expectedRevision: 1 })).alreadyConfirmed).toBe(
      true,
    );
    expect(
      (
        await withTestRequest(patchAiRapDraftProposal)({
          ...identity(proposed),
          expectedRevision: 2,
          rows: [{ rowId: proposed.proposal.rows[0].rowId, fields }],
        })
      ).success,
    ).toBe(false);
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, proposed.messageId));
    expect(ok(await read(identity(proposed))).status).toBe("CONFIRMED");
  });
  test("concurrent draft corrections reject stale revisions and forged/foreign row fields", async (): Promise<void> => {
    const record = await fixture();
    const proposed = await prepare(record);
    const current = ok(await read(identity(proposed)));
    const fields = {
      area: "Area koreksi",
      requiredQuantity: 4,
      bufferQuantity: 0,
      estimatedUnitCost: 50000,
    };
    const input = {
      ...identity(proposed),
      expectedRevision: current.revision,
      rows: [{ rowId: proposed.proposal.rows[0].rowId, fields }],
    };
    const patch = withTestRequest(patchAiRapDraftProposal);
    const results = await Promise.all([
      patch(input),
      patch({ ...input, rows: [{ ...input.rows[0], fields: { ...fields, requiredQuantity: 5 } }] }),
    ]);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    const latest = ok(await read(identity(proposed)));
    expect(latest.revision).toBe(2);
    expect(
      (
        await patch({
          ...input,
          expectedRevision: 2,
          rows: [{ ...input.rows[0], fields: { ...fields, unit: "kg" } }],
        })
      ).success,
    ).toBe(false);
    expect(
      (
        await patch({
          ...input,
          expectedRevision: 2,
          rows: [{ ...input.rows[0], rowId: randomUUID() }],
        })
      ).success,
    ).toBe(false);
    expect(
      (await patch({ ...input, expectedRevision: 2, rows: [input.rows[0], input.rows[0]] }))
        .success,
    ).toBe(false);
    expect(
      (await patch({ ...input, expectedRevision: 2, proposal: proposed.proposal })).success,
    ).toBe(false);
    expect(ok(await read(identity(proposed))).revision).toBe(2);
  });
  test("edit/save race serializes against the reviewed revision", async (): Promise<void> => {
    const record = await fixture();
    const proposed = await prepare(record);
    const current = ok(await read(identity(proposed)));
    const [applied, saved] = await Promise.all([
      withTestRequest(patchAiRapDraftProposal)({
        ...identity(proposed),
        expectedRevision: current.revision,
        rows: [
          {
            rowId: proposed.proposal.rows[0].rowId,
            fields: {
              area: "Area race",
              requiredQuantity: 8,
              bufferQuantity: 0,
              estimatedUnitCost: 50000,
            },
          },
        ],
      }),
      save({ ...identity(proposed), expectedRevision: current.revision }),
    ]);
    expect([applied, saved].filter((result) => result.success)).toHaveLength(1);
    const latest = ok(await read(identity(proposed)));
    expect(latest.status).toBe(saved.success ? "CONFIRMED" : "READY");
    expect(latest.proposal.rows[0].requiredQuantity).toBe(saved.success ? 2 : 8);
  });
  test("correction respects revoked permissions, source expiry and live business context", async (): Promise<void> => {
    const person = { ...owner, id: customUserId, roleId: customRoleId };
    const record = await fixture();
    const proposed = await prepare(record, person);
    actAs(person);
    const current = ok(await read(identity(proposed)));
    const input = {
      ...identity(proposed),
      expectedRevision: current.revision,
      rows: [
        {
          rowId: proposed.proposal.rows[0].rowId,
          fields: {
            area: "Area edit",
            requiredQuantity: 3,
            bufferQuantity: 0,
            estimatedUnitCost: 50000,
          },
        },
      ],
    };
    const patch = withTestRequest(patchAiRapDraftProposal);
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, customRoleId),
          eq(rolePermission.permissionKey, "update:rap"),
        ),
      );
    expect((await patch(input)).success).toBe(false);
    await db.insert(rolePermission).values({ roleId: customRoleId, permissionKey: "update:rap" });
    await db
      .update(projectBudgetCategory)
      .set({ allocatedAmount: "320000.00" })
      .where(eq(projectBudgetCategory.id, record.categoryId));
    expect((await patch(input)).success).toBe(false);
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, proposed.messageId));
    expect((await patch(input)).success).toBe(false);
    expect(ok(await read(identity(proposed))).revision).toBe(current.revision);
  });
});
