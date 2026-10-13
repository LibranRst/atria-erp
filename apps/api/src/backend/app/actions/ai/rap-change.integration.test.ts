import { buildRapChangeTools } from "@backend/lib/ai/tools/rap-change-tools";
import {
  rapChangeInputSchema,
  rapChangeProposalSchema,
  type RapChangeInput,
  type RapChangeProposal,
} from "@atria/core/ai/rap-change";
import { getAiRapChangeProposal, confirmAiRapChangeProposal } from "./rap-change";
import {
  updateProjectRapItem,
  deleteProjectRapItem,
} from "@backend/app/actions/project/project-rap-actions";
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@backend/db";
import {
  aiConversation,
  aiMessage,
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
import { addProjectRapItem } from "@backend/app/actions/project/project-rap-actions";
import {
  rapDraftInputSchema,
  rapDraftProposalSchema,
  type RapDraftProposal,
} from "@atria/core/ai/rap-draft";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { PermissionKey } from "@atria/core/auth/permissions";
import { getAiRapDraftProposal, confirmAiRapDraftProposal } from "./rap-draft";

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
function identity(proposed: { readonly conversationId: string; readonly toolCallId: string }): {
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
const manualAdd = withTestRequest(addProjectRapItem);

const readChange = withTestRequest(getAiRapChangeProposal),
  saveChange = withTestRequest(confirmAiRapChangeProposal);
async function storedFixture(
  manager = customUserId,
): Promise<Fixture & { rapId: string; itemIds: string[] }> {
  const record = await fixture(manager);
  const proposed = await prepare(record);
  const saved = ok(await save(identity(proposed)));
  expect(ok(await read(identity(proposed))).status).toBe("CONFIRMED");
  const added = ok(
    await manualAdd({
      projectRapId: saved.projectRapId,
      materialId: record.materialId,
      name: "Panel kedua",
      unit: "lembar",
      area: "Ruang kedua",
      requiredQuantity: 1,
      bufferQuantity: 0,
      estimatedUnitCost: 50000,
      source: "PURCHASE",
    }),
  );
  return { ...record, rapId: saved.projectRapId, itemIds: [saved.itemIds[0], added.id] };
}
async function prepareChange(
  record: Fixture,
  rows: RapChangeInput["rows"],
  person = owner,
): Promise<{
  conversationId: string;
  toolCallId: string;
  messageId: string;
  proposal: RapChangeProposal;
}> {
  const execute = buildRapChangeTools(aiToolContextForRole("OWNER", { userId: person.id }))
    .proposeRapMaterialChanges.execute;
  if (!execute) throw new Error("Missing change tool");
  const toolCallId = randomUUID();
  const output = await execute(rapChangeInputSchema.parse({ projectId: record.projectId, rows }), {
    toolCallId,
    messages: [],
    context: undefined,
  });
  const parsed = z.object({ proposal: rapChangeProposalSchema }).parse(output);
  const [conversation] = await db.insert(aiConversation).values({ userId: person.id }).returning();
  conversations.push(conversation.id);
  const [message] = await db
    .insert(aiMessage)
    .values({
      conversationId: conversation.id,
      role: "assistant",
      parts: [
        {
          type: "tool-proposeRapMaterialChanges",
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
describeIntegration("saved RAP item change proposals", () => {
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

  test("mixed atomic edit/delete, audited, double-click/replay and unchanged budget/cash/stock", async () => {
    const record = await storedFixture();
    const before = await counters();
    const inventory = await db.query.materialInventory.findMany({
      where: eq(materialInventory.materialId, record.materialId),
    });
    const budget = await db.query.projectBudgetCategory.findFirst({
      where: eq(projectBudgetCategory.id, record.categoryId),
    });
    const change = await prepareChange(record, [
      { action: "UPDATE", itemId: record.itemIds[0], changes: { requiredQuantity: 4 } },
      { action: "DELETE", itemId: record.itemIds[1] },
    ]);
    expect(change.proposal.budget).toMatchObject({
      beforePlan: 162500,
      afterPlan: 212500,
      delta: 50000,
      actual: 10000,
      pending: 5000,
      remaining: 300000,
    });
    expect(ok(await readChange(identity(change))).status).toBe("READY");
    expect(
      await db.query.projectRapItem.findMany({
        where: eq(projectRapItem.projectRapId, record.rapId),
      }),
    ).toHaveLength(2);
    const outcomes = await Promise.all([
      saveChange(identity(change)),
      saveChange(identity(change)),
    ]);
    expect(outcomes.every((row) => row.success)).toBe(true);
    expect(outcomes.map(ok).filter((row) => !row.alreadyConfirmed)).toHaveLength(1);
    const items = await db.query.projectRapItem.findMany({
      where: eq(projectRapItem.projectRapId, record.rapId),
    });
    expect(items).toHaveLength(1);
    expect(items[0].requiredQuantity).toBe("4.00");
    expect(Number(items[0].estimatedTotalCost)).toBe(212500);
    expect(ok(await saveChange(identity(change))).alreadyConfirmed).toBe(true);
    expect(ok(await readChange(identity(change))).status).toBe("CONFIRMED");
    expect(await counters()).toEqual(before);
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
    expect(
      await db.query.aiProposalConfirmation.findMany({
        where: eq(aiProposalConfirmation.toolCallId, change.toolCallId),
      }),
    ).toHaveLength(1);
    const logs = await db.query.auditLog.findMany({
      where: inArray(auditLog.targetId, record.itemIds),
    });
    expect(logs.filter((row) => row.action === "UPDATE_RAP_ITEM_DRAFT")).toHaveLength(1);
    expect(logs.filter((row) => row.action === "DELETE_RAP_ITEM_DRAFT")).toHaveLength(1);
  });
  test("manual edits/deletion/additions and locked RAP invalidate preview", async () => {
    const record = await storedFixture();
    const change = await prepareChange(record, [{ action: "DELETE", itemId: record.itemIds[1] }]);
    const row = await db.query.projectRapItem.findFirst({
      where: eq(projectRapItem.id, record.itemIds[0]),
    });
    if (!row) throw new Error("missing");
    expect(
      ok(
        await withTestRequest(updateProjectRapItem)({
          projectRapItemId: row.id,
          materialId: row.materialId,
          name: row.name,
          unit: row.unit,
          area: row.area,
          requiredQuantity: 3,
          bufferQuantity: 0,
          estimatedUnitCost: 50000,
          source: "PURCHASE",
        }),
      ),
    ).toBeDefined();
    expect(ok(await readChange(identity(change))).status).toBe("STALE");
    expect((await saveChange(identity(change))).success).toBe(false);
    const fresh = await prepareChange(record, [{ action: "DELETE", itemId: record.itemIds[1] }]);
    await withTestRequest(deleteProjectRapItem)(record.itemIds[1]);
    expect((await saveChange(identity(fresh))).success).toBe(false);
    const locked = await prepareChange(record, [{ action: "DELETE", itemId: record.itemIds[0] }]);
    await db.update(projectRap).set({ status: "LOCKED" }).where(eq(projectRap.id, record.rapId));
    expect((await saveChange(identity(locked))).success).toBe(false);
  });
  test("dynamic assigned role, owner isolation, reassignment, NONE and revoked grant", async () => {
    const record = await storedFixture();
    const person = { ...owner, id: customUserId, roleId: customRoleId };
    const change = await prepareChange(
      record,
      [{ action: "UPDATE", itemId: record.itemIds[0], changes: { bufferQuantity: 1 } }],
      person,
    );
    expect((await saveChange(identity(change))).success).toBe(false);
    actAs(person);
    expect(ok(await readChange(identity(change))).status).toBe("READY");
    await db
      .update(project)
      .set({ projectManagerId: owner.id })
      .where(eq(project.id, record.projectId));
    expect((await saveChange(identity(change))).success).toBe(false);
    await db
      .update(project)
      .set({ projectManagerId: customUserId })
      .where(eq(project.id, record.projectId));
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, customRoleId),
          eq(rolePermission.permissionKey, "update:rap"),
        ),
      );
    expect((await saveChange(identity(change))).success).toBe(false);
    await db.insert(rolePermission).values({ roleId: customRoleId, permissionKey: "update:rap" });
    await db.update(role).set({ dataScope: "NONE" }).where(eq(role.id, customRoleId));
    expect((await saveChange(identity(change))).success).toBe(false);
    await db.update(role).set({ dataScope: "ASSIGNED" }).where(eq(role.id, customRoleId));
    expect((await saveChange(identity(change))).success).toBe(true);
  });
  test("identity only, expiry, user-message proof refused and cross-project targets refused", async () => {
    const record = await storedFixture();
    const change = await prepareChange(record, [{ action: "DELETE", itemId: record.itemIds[0] }]);
    expect((await saveChange({ ...identity(change), rows: change.proposal.rows })).success).toBe(
      false,
    );
    await db.update(aiMessage).set({ role: "user" }).where(eq(aiMessage.id, change.messageId));
    expect((await saveChange(identity(change))).success).toBe(false);
    await db
      .update(aiMessage)
      .set({ role: "assistant", createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, change.messageId));
    expect(ok(await readChange(identity(change))).status).toBe("EXPIRED");
    expect((await saveChange(identity(change))).success).toBe(false);
    const another = await storedFixture();
    expect(
      prepareChange(record, [{ action: "DELETE", itemId: another.itemIds[0] }]),
    ).rejects.toThrow();
  });
  test("entire subset rolls back if a later writer fails; inactive catalog can still be deleted", async () => {
    const record = await storedFixture();
    record.itemIds.sort().reverse();
    const change = await prepareChange(record, [
      { action: "UPDATE", itemId: record.itemIds[0], changes: { requiredQuantity: 4 } },
      { action: "DELETE", itemId: record.itemIds[1] },
    ]);
    // A source field outside the AI's editable contract is invalid legacy data.
    await db
      .update(projectRapItem)
      .set({ source: "INVALID" })
      .where(eq(projectRapItem.id, record.itemIds[0]));
    const afterBad = await prepareChange(record, [
      { action: "UPDATE", itemId: record.itemIds[0], changes: { requiredQuantity: 4 } },
      { action: "DELETE", itemId: record.itemIds[1] },
    ]);
    expect((await saveChange(identity(afterBad))).success).toBe(false);
    expect(
      await db.query.projectRapItem.findMany({
        where: eq(projectRapItem.projectRapId, record.rapId),
      }),
    ).toHaveLength(2);
    expect(
      await db.query.aiProposalConfirmation.findFirst({
        where: eq(aiProposalConfirmation.toolCallId, afterBad.toolCallId),
      }),
    ).toBeUndefined();
    expect((await saveChange(identity(change))).success).toBe(false);
    await db
      .update(materialMaster)
      .set({ isActive: false })
      .where(eq(materialMaster.id, record.materialId));
    const deletion = await prepareChange(record, [{ action: "DELETE", itemId: record.itemIds[1] }]);
    expect((await saveChange(identity(deletion))).success).toBe(true);
  });
  test("explicit identity resolution preserves details and rejects implicit unit conversions", async () => {
    const record = await storedFixture();
    const replacement = await db.transaction((tx) =>
      createMaterialMasterTx(tx, owner.id, {
        categoryId,
        name: `${prefix}-Replacement`,
        unit: "m2",
        inventoryDefaults: [
          { inventoryLocationId: locationId, minimumStock: 0, lastPurchasePrice: 0 },
        ],
      }),
    );
    materials.push(replacement.id);
    await expect(
      prepareChange(record, [
        { action: "UPDATE", itemId: record.itemIds[0], changes: { materialId: replacement.id } },
      ]),
    ).rejects.toThrow();
    const p = await prepareChange(record, [
      {
        action: "UPDATE",
        itemId: record.itemIds[0],
        changes: {
          materialId: replacement.id,
          requiredQuantity: 2,
          bufferQuantity: 0.1,
          estimatedUnitCost: 100000,
          description: "Panel area baru",
          internalNote: "Catatan internal uji",
          source: "VENDOR",
        },
      },
    ]);
    expect(p.proposal.rows[0].after).toMatchObject({
      materialId: replacement.id,
      name: replacement.name,
      unit: "m2",
      estimatedTotalCost: 210000,
    });
    expect((await saveChange(identity(p))).success).toBe(true);
    expect(
      await db.query.projectRapItem.findFirst({ where: eq(projectRapItem.id, record.itemIds[0]) }),
    ).toMatchObject({
      materialId: replacement.id,
      name: replacement.name,
      unit: "m2",
      description: "Panel area baru",
      internalNote: "Catatan internal uji",
      source: "VENDOR",
    });
    const rename = await prepareChange(record, [
      { action: "UPDATE", itemId: record.itemIds[0], changes: { name: "Nama presentasi proyek" } },
    ]);
    expect(rename.proposal.rows[0].after).toMatchObject({
      description: "Panel area baru",
      internalNote: "Catatan internal uji",
      source: "VENDOR",
    });
    expect((await saveChange(identity(rename))).success).toBe(true);
    await expect(
      prepareChange(record, [
        { action: "UPDATE", itemId: record.itemIds[0], changes: { unit: "lembar" } },
      ]),
    ).rejects.toThrow();
  });
  test("Purchasing follows configured project scope; lookup returns saved identifiers", async () => {
    const record = await storedFixture();
    const change = await prepareChange(
      record,
      [{ action: "UPDATE", itemId: record.itemIds[0], changes: { area: "Area pembelian" } }],
      purchasing,
    );
    actAs(purchasing);
    expect((await saveChange(identity(change))).success).toBe(false);
    await db.update(role).set({ dataScope: "ASSIGNED" }).where(eq(role.id, purchasing.roleId));
    try {
      await db
        .update(project)
        .set({ projectManagerId: purchasing.id })
        .where(eq(project.id, record.projectId));
      const fresh = await prepareChange(
        record,
        [{ action: "UPDATE", itemId: record.itemIds[0], changes: { area: "Area pembelian" } }],
        purchasing,
      );
      expect((await saveChange(identity(fresh))).success).toBe(true);
    } finally {
      await db.update(role).set({ dataScope: "NONE" }).where(eq(role.id, purchasing.roleId));
    }
    const lookup = buildRapChangeTools(aiToolContextForRole("OWNER", { userId: owner.id }))
      .getEditableRapItems.execute;
    if (!lookup) throw new Error("lookup missing");
    const result = await lookup(
      { projectId: record.projectId, offset: 0 },
      { toolCallId: "lookup", messages: [], context: undefined },
    );
    expect(z.object({ items: z.array(z.unknown()) }).parse(result).items).toHaveLength(2);
  });
  test("race with manual append preserves manual row and stale preview cannot overwrite", async () => {
    const record = await storedFixture();
    const change = await prepareChange(record, [{ action: "DELETE", itemId: record.itemIds[1] }]);
    const [changed, added] = await Promise.all([
      saveChange(identity(change)),
      manualAdd({
        projectRapId: record.rapId,
        materialId: record.materialId,
        name: "Manual race",
        unit: "lembar",
        area: "Area manual",
        requiredQuantity: 1,
        bufferQuantity: 0,
        estimatedUnitCost: 50000,
        source: "PURCHASE",
      }),
    ]);
    const appended = ok(added);
    expect(
      await db.query.projectRapItem.findFirst({ where: eq(projectRapItem.id, appended.id) }),
    ).toBeDefined();
    const items = await db.query.projectRapItem.findMany({
      where: eq(projectRapItem.projectRapId, record.rapId),
    });
    expect(items).toHaveLength(changed.success ? 2 : 3);
    expect(
      await db.query.aiProposalConfirmation.findMany({
        where: eq(aiProposalConfirmation.toolCallId, change.toolCallId),
      }),
    ).toHaveLength(changed.success ? 1 : 0);
  });
});
