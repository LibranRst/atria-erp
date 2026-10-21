import { buildStockCorrectionTools } from "@backend/lib/ai/tools/stock-correction-tools";
import { aiToolContextForRole } from "@backend/lib/testing/ai-tool-context";
import { afterAll, beforeAll, beforeEach, expect, test, spyOn } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { db } from "@backend/db";
import {
  role,
  rolePermission,
  user,
  client,
  project,
  materialCategory,
  materialMaster,
  materialInventory,
  inventoryLocation,
  stockMovement,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  auditLog,
  cashTransaction,
  projectExpenses,
  bankAccount,
  projectBudgets,
  projectBudgetCategory,
  tenant,
  projectRap,
  projectRapItem,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { withTestRequest } from "@backend/lib/testing/request";
import { resolveActor, type Actor } from "@backend/server/actor";
import { prepareProcurementWarehouseProposal } from "@backend/server/usecases/ai/procurement-warehouse-context";
import { getStockCorrectionContext } from "@backend/server/usecases/ai/stock-correction-context";
import * as writer from "@backend/server/usecases/material/stock-correction-writer";
import * as readiness from "@backend/lib/material/operational-readiness";
import { adjustMaterialStock } from "@backend/app/actions/material/inventory-movements";
import {
  getAiProcurementWarehouseProposal,
  confirmAiProcurementWarehouseProposal,
} from "./procurement-warehouse";
import {
  stockCorrectionInputSchema,
  type StockCorrectionInput,
} from "@atria/core/ai/procurement-warehouse";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
const prefix = `CORRECTAI-${randomUUID().slice(0, 8)}`;
const grants: readonly PermissionKey[] = [
  "use:ai_chat",
  "view:material",
  "view:inventory",
  "view:budget",
  "adjust:stock",
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
  other: Person,
  none: Person,
  assigned: Person,
  categoryId: string,
  clientId: string;
function as(p: Person): void {
  api.getSession = async () => ({
    user: p,
    session: { id: randomUUID(), userId: p.id, expiresAt: new Date(Date.now() + 3600000) },
  });
}
function ok<T>(r: ActionResponse<T>): T {
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}
async function actor(): Promise<Actor> {
  const a = await withTestRequest(resolveActor)();
  if (!a) throw new Error("No actor");
  return a;
}
async function person(scope: "GLOBAL" | "NONE" | "ASSIGNED"): Promise<Person> {
  const [r] = await db
    .insert(role)
    .values({ name: `${prefix}-${randomUUID().slice(0, 6)}`, dataScope: scope })
    .returning();
  await db
    .insert(rolePermission)
    .values(grants.map((permissionKey) => ({ roleId: r.id, permissionKey })));
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
  return {
    id: u.id,
    roleId: r.id,
    name: u.name,
    email: u.email,
    isActive: true,
    mustChangePassword: false,
  };
}
async function fixture(size = 2): Promise<{
  projectId: string;
  locationId: string;
  items: { materialId: string; inventoryId: string }[];
}> {
  const [p] = await db
    .insert(project)
    .values({
      name: `${prefix} proyek`,
      clientId,
      projectManagerId: assigned.id,
      status: "ACTIVE",
      totalContractValue: "1000000",
    })
    .returning();
  const [l] = await db
    .insert(inventoryLocation)
    .values({ name: `${prefix} gudang ${randomUUID()}` })
    .returning();
  const items: { materialId: string; inventoryId: string }[] = [];
  for (let i = 0; i < size; i++) {
    const [m] = await db
      .insert(materialMaster)
      .values({ categoryId, name: `${prefix} Panel ${i} ${randomUUID()}`, unit: "lembar" })
      .returning();
    const [v] = await db
      .insert(materialInventory)
      .values({
        materialId: m.id,
        locationId: l.id,
        currentStock: "20.00",
        reservedStock: "5.00",
        averageCost: "10.00",
        lastPurchasePrice: "12.00",
      })
      .returning();
    items.push({ materialId: m.id, inventoryId: v.id });
  }
  return { projectId: p.id, locationId: l.id, items };
}
function input(f: Awaited<ReturnType<typeof fixture>>): StockCorrectionInput {
  return stockCorrectionInputSchema.parse({
    action: "STOCK_CORRECT",
    inventoryLocationId: f.locationId,
    reason: "Koreksi salah pencatatan sintetis",
    items: f.items.map((i) => ({ materialId: i.materialId, direction: "DECREASE", quantity: 2.5 })),
  });
}
async function proof(
  i: StockCorrectionInput,
  age = 0,
): Promise<{ conversationId: string; toolCallId: string }> {
  const a = await actor(),
    p = await prepareProcurementWarehouseProposal(a, i),
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
        type: "tool-proposeStockCorrection",
        state: "output-available",
        toolCallId,
        output: { proposal: p },
      },
    ],
  });
  return { conversationId: c.id, toolCallId };
}
const read = withTestRequest(getAiProcurementWarehouseProposal),
  save = withTestRequest(confirmAiProcurementWarehouseProposal);
async function inv(id: string): Promise<typeof materialInventory.$inferSelect> {
  const r = await db.query.materialInventory.findFirst({ where: eq(materialInventory.id, id) });
  if (!r) throw Error("inventory");
  return r;
}
async function protectedSources(): Promise<string> {
  const rows = await Promise.all([
    db.select().from(cashTransaction),
    db.select().from(projectExpenses),
    db.select().from(bankAccount),
    db.select().from(projectBudgets),
    db.select().from(projectBudgetCategory),
  ]);
  return JSON.stringify(rows);
}
describeIntegration("Owned direct stock correction", () => {
  beforeAll(async () => {
    owner = await person("GLOBAL");
    other = await person("GLOBAL");
    none = await person("NONE");
    assigned = await person("ASSIGNED");
    const [c] = await db
      .insert(client)
      .values({ name: prefix, email: `${prefix}@fixture.invalid`, phone: "000000" })
      .returning();
    clientId = c.id;
    const [m] = await db.insert(materialCategory).values({ name: prefix }).returning();
    categoryId = m.id;
  });
  beforeEach(() => as(owner));
  afterAll(() => {
    api.getSession = original;
  });
  test("preview is read-only and exact before/after with protected reservations", async () => {
    const f = await fixture(1),
      before = await inv(f.items[0].inventoryId),
      p = await prepareProcurementWarehouseProposal(await actor(), input(f));
    expect(p.rows[0].comparisons).toContainEqual({
      label: "Stok fisik (lembar)",
      before: 20,
      after: 17.5,
      money: false,
    });
    expect(p.rows[0].comparisons).toContainEqual({
      label: "Stok tersedia (lembar)",
      before: 15,
      after: 12.5,
      money: false,
    });
    expect(await inv(before.id)).toEqual(before);
  });
  test("batch commits once with one movement/audit per row and one receipt; no financial mutation", async () => {
    const f = await fixture(6),
      identity = await proof(input(f)),
      financial = await protectedSources();
    expect(ok(await read(identity)).status).toBe("READY");
    const r = ok(await save(identity));
    expect(r.alreadyConfirmed).toBe(false);
    for (const i of f.items) {
      const row = await inv(i.inventoryId);
      expect(row.currentStock).toBe("17.50");
      expect(row.reservedStock).toBe("5.00");
      expect(row.averageCost).toBe("10.00");
      expect(row.lastPurchasePrice).toBe("12.00");
      const movements = await db.query.stockMovement.findMany({
        where: eq(stockMovement.materialId, i.materialId),
      });
      expect(movements).toHaveLength(1);
      expect(movements[0].movementDirection).toBe("OUT");
      expect(movements[0].note).toBe(input(f).reason);
      expect(
        await db.query.auditLog.findMany({
          where: and(
            eq(auditLog.targetId, i.inventoryId),
            eq(auditLog.action, "ADJUST_MATERIAL_STOCK"),
          ),
        }),
      ).toHaveLength(1);
    }
    expect(ok(await save(identity)).alreadyConfirmed).toBe(true);
    expect(ok(await read(identity)).status).toBe("CONFIRMED");
    expect(await protectedSources()).toBe(financial);
    expect(
      await db.query.aiProposalConfirmation.findMany({
        where: eq(aiProposalConfirmation.toolCallId, identity.toolCallId),
      }),
    ).toHaveLength(1);
  });
  test("increase and explicit movement cost preserve average valuation", async () => {
    const f = await fixture(1),
      i = input(f);
    i.items[0].direction = "INCREASE";
    i.items[0].quantity = 0.25;
    i.items[0].unitCost = 40.25;
    ok(await save(await proof(i)));
    const r = await inv(f.items[0].inventoryId);
    expect(r.currentStock).toBe("20.25");
    expect(r.averageCost).toBe("10.00");
    const m = await db.query.stockMovement.findFirst({
      where: eq(stockMovement.materialId, f.items[0].materialId),
    });
    expect(m?.unitCost).toBe("40.25");
    expect(m?.movementDirection).toBe("IN");
  });
  test("concurrent approval and later replay never double-post", async () => {
    const f = await fixture(1),
      id = await proof(input(f));
    const results = await Promise.all([save(id), save(id)]);
    expect(results.every((r) => r.success)).toBe(true);
    expect((await inv(f.items[0].inventoryId)).currentStock).toBe("17.50");
    expect(
      await db.query.stockMovement.findMany({
        where: eq(stockMovement.materialId, f.items[0].materialId),
      }),
    ).toHaveLength(1);
  });
  test("reservation floor, zero and precision violations block the full batch", async () => {
    const f = await fixture(),
      i = input(f);
    i.items[1].quantity = 15.01;
    await expect(prepareProcurementWarehouseProposal(await actor(), i)).rejects.toThrow(
      "direservasi",
    );
    for (const q of [0, 0.001]) {
      i.items[1].quantity = q;
      await expect(prepareProcurementWarehouseProposal(await actor(), i)).rejects.toThrow();
    }
    for (const item of f.items) expect((await inv(item.inventoryId)).currentStock).toBe("20.00");
  });
  test("blocked correction reports actual current stock after a prior human save", async () => {
    const f = await fixture(1),
      i = input(f);
    ok(await withTestRequest(confirmAiProcurementWarehouseProposal)(await proof(i)));
    const tools = buildStockCorrectionTools({ ...aiToolContextForRole("OWNER"), userId: owner.id });
    const execute = tools.proposeStockCorrection.execute;
    if (!execute) throw new Error("Missing correction execute");
    const result = await withTestRequest(async () =>
      execute(
        { ...i, items: i.items.map((row) => ({ ...row, quantity: 100 })) },
        { toolCallId: "blocked-live-regression", messages: [], context: {} },
      ),
    )();
    expect(result).toMatchObject({
      toolFailed: true,
      code: "VALIDATION_ERROR",
      stockContext: {
        currentStock: "17.50",
        reservedStock: "5.00",
        availableStock: "12.50",
        maximumDecrease: "12.50",
      },
    });
    const row = await db.query.materialInventory.findFirst({
      where: eq(materialInventory.id, f.items[0].inventoryId),
    });
    expect(row?.currentStock).toBe("17.50");
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, owner.roleId),
          eq(rolePermission.permissionKey, "view:inventory"),
        ),
      );
    try {
      const denied = await withTestRequest(async () =>
        execute(
          { ...i, items: i.items.map((item) => ({ ...item, quantity: 100 })) },
          { toolCallId: "denied-live-regression", messages: [], context: {} },
        ),
      )();
      expect(denied).toMatchObject({ toolFailed: true, code: "FORBIDDEN" });
      expect(denied).not.toHaveProperty("stockContext");
    } finally {
      await db
        .insert(rolePermission)
        .values({ roleId: owner.roleId, permissionKey: "view:inventory" })
        .onConflictDoNothing();
    }
  });
  test("changed quantities, reservations, cost or active sources require fresh proof", async () => {
    const f = await fixture(1),
      id = await proof(input(f));
    await db
      .update(materialInventory)
      .set({ reservedStock: "6.00" })
      .where(eq(materialInventory.id, f.items[0].inventoryId));
    expect(ok(await read(id)).status).toBe("STALE");
    expect((await save(id)).success).toBe(false);
    expect((await inv(f.items[0].inventoryId)).currentStock).toBe("20.00");
  });
  test("owned identity only, foreign conversation and expired proof cannot write", async () => {
    const f = await fixture(1),
      id = await proof(input(f));
    expect((await save({ ...id, currentStock: 0 })).success).toBe(false);
    as(other);
    expect((await save(id)).success).toBe(false);
    as(owner);
    const old = await proof(input(f), 31 * 86400000);
    expect(ok(await read(old)).status).toBe("EXPIRED");
    expect((await save(old)).success).toBe(false);
  });
  test("live revoked grants and inactive users block cached actors", async () => {
    const f = await fixture(1),
      id = await proof(input(f));
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, owner.roleId),
          eq(rolePermission.permissionKey, "adjust:stock"),
        ),
      );
    expect((await save(id)).success).toBe(false);
    await db.insert(rolePermission).values({ roleId: owner.roleId, permissionKey: "adjust:stock" });
    await db.update(user).set({ isActive: false }).where(eq(user.id, owner.id));
    expect((await save(id)).success).toBe(false);
    await db.update(user).set({ isActive: true }).where(eq(user.id, owner.id));
  });
  test("NONE warehouse domain and ASSIGNED project scope remain distinct", async () => {
    const f = await fixture(1);
    as(none);
    ok(await save(await proof(input(f))));
    const i = input(f);
    i.projectId = f.projectId;
    await expect(prepareProcurementWarehouseProposal(await actor(), i)).rejects.toThrow("gudang");
    as(assigned);
    await expect(prepareProcurementWarehouseProposal(await actor(), input(f))).rejects.toThrow(
      "ditugaskan",
    );
    ok(await save(await proof(i)));
    await db.update(project).set({ projectManagerId: other.id }).where(eq(project.id, f.projectId));
    await expect(prepareProcurementWarehouseProposal(await actor(), i)).rejects.toThrow("akses");
  });
  test("inactive, missing and foreign-tenant inventory are blocked without initialization", async () => {
    const f = await fixture(1);
    const [t] = await db.insert(tenant).values({ name: prefix, slug: randomUUID() }).returning();
    await db
      .update(materialInventory)
      .set({ tenantId: t.id })
      .where(eq(materialInventory.id, f.items[0].inventoryId));
    await expect(prepareProcurementWarehouseProposal(await actor(), input(f))).rejects.toThrow(
      "belum tersedia",
    );
    await db
      .update(materialInventory)
      .set({ tenantId: INSTANCE_TENANT_ID })
      .where(eq(materialInventory.id, f.items[0].inventoryId));
    await db
      .update(inventoryLocation)
      .set({ isActive: false })
      .where(eq(inventoryLocation.id, f.locationId));
    await expect(prepareProcurementWarehouseProposal(await actor(), input(f))).rejects.toThrow(
      "Lokasi",
    );
  });
  test("readiness is rechecked at confirmation", async () => {
    const f = await fixture(1),
      id = await proof(input(f)),
      s = spyOn(readiness, "assertOperationalStockReadiness").mockRejectedValue(
        new Error("SETUP_REQUIRED"),
      );
    try {
      expect((await save(id)).success).toBe(false);
      expect((await inv(f.items[0].inventoryId)).currentStock).toBe("20.00");
    } finally {
      s.mockRestore();
    }
  });
  test("post-write failure rolls all stock/movement/audit/receipt back and can retry", async () => {
    const f = await fixture(2),
      id = await proof(input(f)),
      originalWriter = writer.writeStockCorrectionTx,
      s = spyOn(writer, "writeStockCorrectionTx").mockImplementation(async (tx, a, i, ai) => {
        await originalWriter(tx, a, i, ai);
        throw new Error("synthetic failure");
      });
    try {
      expect((await save(id)).success).toBe(false);
    } finally {
      s.mockRestore();
    }
    for (const item of f.items) {
      expect((await inv(item.inventoryId)).currentStock).toBe("20.00");
      expect(
        await db.query.stockMovement.findMany({
          where: eq(stockMovement.materialId, item.materialId),
        }),
      ).toHaveLength(0);
    }
    expect(
      await db.query.aiProposalConfirmation.findMany({
        where: eq(aiProposalConfirmation.toolCallId, id.toolCallId),
      }),
    ).toHaveLength(0);
    ok(await save(id));
  });
  test("manual aliases share audited writer and preserve advanced references contract", async () => {
    const f = await fixture(1),
      i = f.items[0];
    ok(
      await withTestRequest(adjustMaterialStock)({
        materialId: i.materialId,
        inventoryLocationId: f.locationId,
        quantity: 1.5,
        direction: "INCREASE",
        note: "Koreksi manual sintetis",
      }),
    );
    expect((await inv(i.inventoryId)).currentStock).toBe("21.50");
    const m = await db.query.stockMovement.findFirst({
      where: eq(stockMovement.materialId, i.materialId),
    });
    expect(m?.movementDirection).toBe("IN");
    expect(m?.createdById).toBe(owner.id);
    const bad = input(f);
    bad.items[0].projectCostId = randomUUID();
    await expect(prepareProcurementWarehouseProposal(await actor(), bad)).rejects.toThrow();
  });
  test("one-character search and20-row context pages never initialize inventory", async () => {
    const f = await fixture(21),
      a = await actor(),
      r = await getStockCorrectionContext(a, {
        resource: "inventory",
        inventoryLocationId: f.locationId,
        query: "P",
        offset: 0,
      });
    expect(r).toMatchObject({ hasMore: true, nextOffset: 20 });
    const next = await getStockCorrectionContext(a, {
      resource: "inventory",
      inventoryLocationId: f.locationId,
      query: "P",
      offset: 20,
    });
    expect(next).toMatchObject({ hasMore: false, nextOffset: null });
    const [h] = await db
      .select({ n: count() })
      .from(stockMovement)
      .where(eq(stockMovement.inventoryLocationId, f.locationId));
    expect(h.n).toBe(0);
  });
  test("resolved RAP references are visible and source edits invalidate approval", async () => {
    const f = await fixture(1);
    const [rap] = await db.insert(projectRap).values({ projectId: f.projectId }).returning();
    const [line] = await db
      .insert(projectRapItem)
      .values({
        projectRapId: rap.id,
        materialId: f.items[0].materialId,
        name: "Panel terkait untuk ruang QA",
        area: "Ruang QA",
        unit: "lembar",
        requiredQuantity: "10.00",
        totalQuantity: "10.00",
      })
      .returning();
    const i = input(f);
    i.projectId = f.projectId;
    i.items[0].projectRapItemId = line.id;
    const identity = await proof(i),
      view = ok(await read(identity));
    expect(view.proposal.rows[0].details).toContainEqual({
      label: "RAP terkait",
      value: "Panel terkait untuk ruang QA · Ruang QA",
      money: false,
    });
    await db
      .update(projectRapItem)
      .set({ name: "Sumber diperbarui" })
      .where(eq(projectRapItem.id, line.id));
    expect(ok(await read(identity)).status).toBe("STALE");
    expect((await save(identity)).success).toBe(false);
  });
});
