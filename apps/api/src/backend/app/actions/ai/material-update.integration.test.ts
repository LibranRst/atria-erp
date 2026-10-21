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
  materialInventory,
  materialMaster,
  role,
  rolePermission,
  stockMovement,
  user,
  vendor,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { withTestRequest } from "@backend/lib/testing/request";
import { aiToolContextForRole } from "@backend/lib/testing/ai-tool-context";
import {
  createMaterialMasterTx,
  loadMaterialReferences,
} from "@backend/server/usecases/material/master-writer";
import { readMaterialEditTarget } from "@backend/server/usecases/material/master-edit-reader";
import { updateMaterialMasterTx } from "@backend/server/usecases/material/master-editor";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import { resolveActor } from "@backend/server/actor";
import { updateMaterial, setMaterialActive } from "@backend/app/actions/settings/system-materials";
import { buildMaterialEditTools } from "@backend/lib/ai/tools/material-edit-tools";
import {
  materialUpdateProposalSchema,
  type MaterialUpdateChanges,
  type MaterialUpdateProposal,
} from "@atria/core/ai/material-update";
import type { ActionResponse } from "@atria/core/types/action-response";
import { confirmAiMaterialUpdateProposal, getAiMaterialUpdateProposal } from "./material-update";

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
const prefix = `AI-EDIT-${randomUUID().slice(0, 8)}`;
const materials: string[] = [],
  conversations: string[] = [];
let categoryId: string, locationId: string, customRoleId: string, customUserId: string;
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
async function material(): Promise<typeof materialMaster.$inferSelect> {
  const index = materials.length;
  const row = await db.transaction((tx) =>
    createMaterialMasterTx(tx, owner.id, {
      categoryId,
      name: `${prefix}-${index}`,
      code: `${prefix}-CODE-${index}`,
      unit: "lembar",
      color: "Putih",
      inventoryDefaults: [
        { inventoryLocationId: locationId, minimumStock: 1, lastPurchasePrice: 50000 },
      ],
    }),
  );
  materials.push(row.id);
  return row;
}
async function prepare(
  materialId: string,
  changes: MaterialUpdateChanges,
  person = owner,
): Promise<{
  conversationId: string;
  toolCallId: string;
  proposal: MaterialUpdateProposal;
  messageId: string;
}> {
  const context = aiToolContextForRole("OWNER", { userId: person.id });
  const call = buildMaterialEditTools(context).proposeUpdateMaterial.execute;
  if (!call) throw new Error("Proposal tool missing");
  const toolCallId = randomUUID();
  const output = await call(
    { materialId, changes },
    { toolCallId, messages: [], context: undefined },
  );
  const parsed = z.object({ proposal: materialUpdateProposalSchema }).parse(output);
  const [conversation] = await db.insert(aiConversation).values({ userId: person.id }).returning();
  conversations.push(conversation.id);
  const [message] = await db
    .insert(aiMessage)
    .values({
      conversationId: conversation.id,
      role: "assistant",
      parts: [
        {
          type: "tool-proposeUpdateMaterial",
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
    proposal: parsed.proposal,
    messageId: message.id,
  };
}
function identity(proposal: Awaited<ReturnType<typeof prepare>>): {
  conversationId: string;
  toolCallId: string;
} {
  return { conversationId: proposal.conversationId, toolCallId: proposal.toolCallId };
}
async function counters(): Promise<{ cash: number; movements: number }> {
  const [[cash], [movements]] = await Promise.all([
    db.select({ value: count() }).from(cashTransaction),
    db.select({ value: count() }).from(stockMovement),
  ]);
  return { cash: cash.value, movements: movements.value };
}
async function receipts(toolCallId: string): Promise<number> {
  return (
    await db
      .select({ value: count() })
      .from(aiProposalConfirmation)
      .where(eq(aiProposalConfirmation.toolCallId, toolCallId))
  )[0].value;
}
const read = withTestRequest(getAiMaterialUpdateProposal);
const save = withTestRequest(confirmAiMaterialUpdateProposal);

describeIntegration("owned Material Master edit proposals", () => {
  beforeAll(async (): Promise<void> => {
    const refs = await loadMaterialReferences();
    categoryId = refs.categories[0].id;
    locationId = refs.locations.find((row) => row.isActive)?.id ?? "";
    const [customRole] = await db
      .insert(role)
      .values({ name: prefix, dataScope: "NONE" })
      .returning();
    customRoleId = customRole.id;
    await db.insert(rolePermission).values([
      { roleId: customRoleId, permissionKey: "use:ai_chat" },
      { roleId: customRoleId, permissionKey: "manage:material_settings" },
    ]);
    const [customUser] = await db
      .insert(user)
      .values({ name: prefix, email: `${prefix}@fixture.invalid`, roleId: customRoleId })
      .returning();
    customUserId = customUser.id;
  });
  beforeEach((): void => {
    actAs(owner);
  });
  afterAll(async (): Promise<void> => {
    sessionApi.getSession = originalSession;
    if (conversations.length)
      await db.delete(aiConversation).where(inArray(aiConversation.id, conversations));
    if (materials.length) {
      await db.delete(auditLog).where(inArray(auditLog.targetId, materials));
      await db.delete(materialInventory).where(inArray(materialInventory.materialId, materials));
      await db.delete(materialMaster).where(inArray(materialMaster.id, materials));
    }
    if (customUserId) await db.delete(user).where(eq(user.id, customUserId));
    if (customRoleId) {
      await db.delete(rolePermission).where(eq(rolePermission.roleId, customRoleId));
      await db.delete(role).where(eq(role.id, customRoleId));
    }
  });
  test("read-only proposal, explicit atomic update, replay and unchanged inventory/cash", async (): Promise<void> => {
    const target = await material();
    await db
      .update(materialInventory)
      .set({ currentStock: "7.00", reservedStock: "2.00", averageCost: "42000.00" })
      .where(eq(materialInventory.materialId, target.id));
    const inventoryBefore = await db.query.materialInventory.findMany({
      where: eq(materialInventory.materialId, target.id),
    });
    const counts = await counters();
    const proposed = await prepare(target.id, { color: "Hitam", specification: "Panel 18 mm" });
    expect((await readMaterialEditTarget(target.id)).snapshot.color).toBe("Putih");
    expect(ok(await read(identity(proposed))).status).toBe("READY");
    const outcomes = await Promise.all([save(identity(proposed)), save(identity(proposed))]);
    expect(outcomes.every((outcome) => outcome.success)).toBe(true);
    expect(outcomes.map(ok).filter((receipt) => !receipt.alreadyConfirmed)).toHaveLength(1);
    expect(await receipts(proposed.toolCallId)).toBe(1);
    expect((await readMaterialEditTarget(target.id)).snapshot.color).toBe("Hitam");
    expect(ok(await read(identity(proposed))).status).toBe("CONFIRMED");
    const audits = await db.query.auditLog.findMany({
      where: and(eq(auditLog.targetId, target.id), eq(auditLog.action, "UPDATE_MATERIAL_SETTING")),
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].newState).toContain(proposed.toolCallId);
    expect(
      await db.query.materialInventory.findMany({
        where: eq(materialInventory.materialId, target.id),
      }),
    ).toEqual(inventoryBefore);
    expect(await counters()).toEqual(counts);
  });
  test("Purchasing and custom NONE role may edit the global catalogue", async (): Promise<void> => {
    for (const person of [purchasing, { ...owner, id: customUserId, roleId: customRoleId }]) {
      const target = await material();
      const proposed = await prepare(target.id, { brand: "Merek uji" }, person);
      actAs(person);
      expect(ok(await save(identity(proposed))).materialId).toBe(target.id);
    }
  });
  test("revocation after proposal blocks both preview and save", async (): Promise<void> => {
    const person = { ...owner, id: customUserId, roleId: customRoleId };
    const target = await material(),
      proposed = await prepare(target.id, { color: "Merah" }, person);
    actAs(person);
    expect(ok(await read(identity(proposed))).status).toBe("READY");
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, customRoleId),
          eq(rolePermission.permissionKey, "manage:material_settings"),
        ),
      );
    try {
      expect(await save(identity(proposed))).toMatchObject({
        success: false,
        error: { code: "FORBIDDEN" },
      });
      expect(await read(identity(proposed))).toMatchObject({
        success: false,
        error: { code: "FORBIDDEN" },
      });
      expect(await receipts(proposed.toolCallId)).toBe(0);
    } finally {
      await db
        .insert(rolePermission)
        .values({ roleId: customRoleId, permissionKey: "manage:material_settings" });
    }
  });
  test("no session, foreign ownership, user-authored parts and forged values are denied", async (): Promise<void> => {
    const target = await material(),
      proposed = await prepare(target.id, { color: "Biru" });
    actAs(null);
    expect(await save(identity(proposed))).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
    actAs(purchasing);
    expect(await read(identity(proposed))).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
    });
    expect(await save(identity(proposed))).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
    });
    actAs(owner);
    expect(await save({ ...identity(proposed), after: { color: "Injected" } })).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
    await db.update(aiMessage).set({ role: "user" }).where(eq(aiMessage.id, proposed.messageId));
    expect(await save(identity(proposed))).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
    });
    expect((await readMaterialEditTarget(target.id)).snapshot.color).toBe("Putih");
  });
  test("expired and stale proposals cannot overwrite current material data", async (): Promise<void> => {
    const target = await material(),
      expired = await prepare(target.id, { color: "Biru" });
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, expired.messageId));
    expect(ok(await read(identity(expired))).status).toBe("EXPIRED");
    expect(await save(identity(expired))).toMatchObject({
      success: false,
      error: { code: "CONFLICT" },
    });
    const stale = await prepare(target.id, { color: "Merah" });
    ok(
      await withTestRequest(updateMaterial)({
        materialId: target.id,
        ...stale.proposal.before,
        specification: "Diubah manual",
      }),
    );
    expect(ok(await read(identity(stale))).status).toBe("STALE");
    expect(await save(identity(stale))).toMatchObject({
      success: false,
      error: { code: "CONFLICT" },
    });
    expect((await readMaterialEditTarget(target.id)).snapshot.specification).toBe("Diubah manual");
    expect(await receipts(stale.toolCallId)).toBe(0);
  });
  test("deactivation/reactivation preserves metadata and is discoverable when inactive", async (): Promise<void> => {
    const target = await material(),
      deactivate = await prepare(target.id, { isActive: false });
    const before = (await readMaterialEditTarget(target.id)).snapshot;
    ok(await save(identity(deactivate)));
    expect((await readMaterialEditTarget(target.id)).snapshot).toEqual({
      ...before,
      isActive: false,
    });
    const lookup = buildMaterialEditTools(aiToolContextForRole("OWNER")).getEditableMaterials
      .execute;
    if (!lookup) throw new Error("Lookup missing");
    expect(
      await lookup(
        { materialId: target.id },
        { toolCallId: randomUUID(), messages: [], context: undefined },
      ),
    ).toMatchObject({ materials: [{ id: target.id, isActive: false }] });
    const reactivate = await prepare(target.id, { isActive: true });
    ok(await save(identity(reactivate)));
    expect((await readMaterialEditTarget(target.id)).snapshot.isActive).toBe(true);
  });
  test("case/trim duplicate names and codes include inactive materials", async (): Promise<void> => {
    const existing = await material(),
      target = await material();
    ok(await withTestRequest(setMaterialActive)({ materialId: existing.id, isActive: false }));
    for (const changes of [
      { name: ` ${existing.name.toLowerCase()} ` },
      { code: ` ${existing.code?.toLowerCase()} ` },
    ]) {
      const proposed = await prepare(target.id, changes);
      expect(await save(identity(proposed))).toMatchObject({
        success: false,
        error: { code: "CONFLICT" },
      });
      expect(await receipts(proposed.toolCallId)).toBe(0);
    }
    expect((await readMaterialEditTarget(target.id)).snapshot.name).toBe(target.name);
  });
  test("manual and AI rename races cannot claim the same normalized identity", async (): Promise<void> => {
    const manualTarget = await material(),
      aiTarget = await material();
    const sharedName = `${prefix}-race`;
    const proposed = await prepare(aiTarget.id, { name: sharedName });
    const manualBefore = (await readMaterialEditTarget(manualTarget.id)).snapshot;
    const outcomes = await Promise.all([
      withTestRequest(updateMaterial)({
        materialId: manualTarget.id,
        ...manualBefore,
        name: sharedName.toUpperCase(),
      }),
      save(identity(proposed)),
    ]);
    expect(outcomes.filter((result) => result.success)).toHaveLength(1);
    const rows = await db.query.materialMaster.findMany({
      where: inArray(materialMaster.id, [manualTarget.id, aiTarget.id]),
    });
    expect(rows.filter((row) => row.name.toLowerCase() === sharedName.toLowerCase())).toHaveLength(
      1,
    );
  });
  test("reference rejection and transaction failure roll back material, audit and receipt", async (): Promise<void> => {
    const target = await material(),
      proposed = await prepare(target.id, { color: "Biru" });
    const refs = await loadMaterialReferences();
    const supplier = refs.vendors.find((row) => row.isActive);
    if (!supplier) throw new Error("Vendor fixture missing");
    const vendorProposal = await prepare(target.id, { defaultVendorId: supplier.id });
    await db.update(vendor).set({ isActive: false }).where(eq(vendor.id, supplier.id));
    try {
      expect(await read(identity(vendorProposal))).toMatchObject({
        success: false,
        error: { code: "VALIDATION_ERROR" },
      });
      expect(await save(identity(vendorProposal))).toMatchObject({
        success: false,
        error: { code: "VALIDATION_ERROR" },
      });
    } finally {
      await db.update(vendor).set({ isActive: true }).where(eq(vendor.id, supplier.id));
    }
    const failed = await withTestRequest(async () => {
      const actor = await resolveActor();
      if (!actor) throw new Error("Actor missing");
      return confirmMutation(actor, identity(proposed), "MATERIAL_MASTER_UPDATE", async (tx) => {
        await updateMaterialMasterTx(
          tx,
          actor.userId,
          { materialId: target.id, ...proposed.proposal.after },
          { expectedUpdatedAt: proposed.proposal.expectedUpdatedAt },
        );
        throw new Error("Injected failure before receipt");
      });
    })();
    expect(failed.success).toBe(false);
    expect((await readMaterialEditTarget(target.id)).snapshot.color).toBe("Putih");
    expect(await receipts(proposed.toolCallId)).toBe(0);
    expect(
      await db.query.auditLog.findMany({
        where: and(
          eq(auditLog.targetId, target.id),
          eq(auditLog.action, "UPDATE_MATERIAL_SETTING"),
        ),
      }),
    ).toHaveLength(0);
  });
});
