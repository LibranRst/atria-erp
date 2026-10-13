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
  projectRap,
  projectRapItem,
  materialCategory,
  materialMaster,
  materialInventory,
  inventoryLocation,
  inventoryOpeningBatch,
  stockMovement,
  warehouseIntake,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  auditLog,
  cashTransaction,
  projectExpenses,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { withTestRequest } from "@backend/lib/testing/request";
import { resolveActor, type Actor } from "@backend/server/actor";
import { prepareProcurementWarehouseProposal } from "@backend/server/usecases/ai/procurement-warehouse-context";
import * as intakeWriter from "@backend/server/usecases/material/warehouse-intake-writer";
import { recordStockIn } from "@backend/app/actions/material/inventory-movements";
import { decideInventoryOpening } from "@backend/app/actions/material/opening-inventory-mutations";
import { confirmAiGoodsReceiptProposal } from "./confirm-material-proposal";
import {
  getAiProcurementWarehouseProposal,
  confirmAiProcurementWarehouseProposal,
} from "./procurement-warehouse";
import { buildWarehouseIntakeTools } from "@backend/lib/ai/tools/warehouse-intake-tools";
import {
  warehouseIntakeInputSchema,
  type WarehouseIntakeInput,
} from "@atria/core/ai/procurement-warehouse";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
const prefix = `INTAKEAI-${randomUUID().slice(0, 8)}`;
const grants: readonly PermissionKey[] = [
  "use:ai_chat",
  "view:material",
  "view:inventory",
  "view:budget",
  "create:stock_movement",
  "create:opening_inventory",
  "approve:opening_inventory",
  "reverse:opening_inventory",
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
let maker: Person,
  checker: Person,
  warehouse: Person,
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
async function person(
  scope: "GLOBAL" | "NONE" | "ASSIGNED",
  permissions: readonly PermissionKey[] = grants,
): Promise<Person> {
  const [r] = await db
    .insert(role)
    .values({ name: `${prefix}-${randomUUID().slice(0, 6)}`, dataScope: scope })
    .returning();
  await db
    .insert(rolePermission)
    .values(permissions.map((permissionKey) => ({ roleId: r.id, permissionKey })));
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
async function fixture(
  current = "0.00",
  size = 2,
): Promise<{
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
  const items = [];
  for (let n = 0; n < size; n++) {
    const [m] = await db
      .insert(materialMaster)
      .values({ categoryId, name: `${prefix} Panel ${n} ${randomUUID()}`, unit: "lembar" })
      .returning();
    const [i] = await db
      .insert(materialInventory)
      .values({ materialId: m.id, locationId: l.id, currentStock: current, averageCost: "10.00" })
      .returning();
    items.push({ materialId: m.id, inventoryId: i.id });
  }
  return { projectId: p.id, locationId: l.id, items };
}
function stockInput(f: Awaited<ReturnType<typeof fixture>>): WarehouseIntakeInput {
  return warehouseIntakeInputSchema.parse({
    action: "WAREHOUSE_STOCK_IN",
    inventoryLocationId: f.locationId,
    referenceNumber: `${prefix}-${randomUUID()}`,
    receivedAt: "2026-10-11",
    note: "Surat jalan vendor data sintetis",
    items: f.items.map((i) => ({ materialId: i.materialId, quantity: 2.5, unitCost: 20 })),
  });
}
function openingInput(f: Awaited<ReturnType<typeof fixture>>): WarehouseIntakeInput {
  return warehouseIntakeInputSchema.parse({
    action: "OPENING_REQUEST",
    batchNumber: `${prefix}-${randomUUID()}`,
    referenceNumber: `OPNAME-${randomUUID()}`,
    cutoverDate: "2026-10-11",
    note: "Hasil penghitungan stok awal sintetis",
    items: f.items.map((i) => ({ materialInventoryId: i.inventoryId, quantity: 5, unitCost: 25 })),
  });
}
async function proof(
  input: WarehouseIntakeInput,
): Promise<{ conversationId: string; toolCallId: string }> {
  const a = await actor(),
    proposal = await prepareProcurementWarehouseProposal(a, input),
    toolCallId = randomUUID();
  const [c] = await db
    .insert(aiConversation)
    .values({ userId: a.userId, title: prefix })
    .returning();
  await db.insert(aiMessage).values({
    conversationId: c.id,
    role: "assistant",
    parts: [
      {
        type: "tool-proposeWarehouseIntake",
        state: "output-available",
        toolCallId,
        output: { proposal },
      },
    ],
  });
  return { conversationId: c.id, toolCallId };
}
const read = withTestRequest(getAiProcurementWarehouseProposal),
  save = withTestRequest(confirmAiProcurementWarehouseProposal);
async function stock(id: string): Promise<number> {
  return Number(
    (await db.query.materialInventory.findFirst({ where: eq(materialInventory.id, id) }))
      ?.currentStock,
  );
}
async function financeCounts(): Promise<{ cash: number; expenses: number }> {
  const [c] = await db.select({ n: count() }).from(cashTransaction);
  const [e] = await db.select({ n: count() }).from(projectExpenses);
  return { cash: c.n, expenses: e.n };
}
describeIntegration("AI warehouse intake and opening lifecycle", () => {
  beforeAll(async () => {
    maker = await person("GLOBAL");
    checker = await person("GLOBAL");
    warehouse = await person("NONE");
    assigned = await person("ASSIGNED");
    const [c] = await db
      .insert(client)
      .values({ name: prefix, email: `${prefix}@fixture.invalid`, phone: "000000" })
      .returning();
    clientId = c.id;
    const [mc] = await db.insert(materialCategory).values({ name: prefix }).returning();
    categoryId = mc.id;
  });
  beforeEach(() => as(maker));
  afterAll(() => {
    api.getSession = original;
  });
  test("a receiving location with no inventory is disclosed in preview and created only at confirmation", async () => {
    const f = await fixture("0.00", 1);
    await db.delete(materialInventory).where(eq(materialInventory.id, f.items[0].inventoryId));
    const before = await financeCounts(),
      identity = await proof(stockInput(f));
    expect(ok(await read(identity)).proposal.summary).toContainEqual({
      label: "Inventory baru saat konfirmasi",
      value: 1,
      money: false,
    });
    expect(
      await db.query.materialInventory.findFirst({
        where: and(
          eq(materialInventory.materialId, f.items[0].materialId),
          eq(materialInventory.locationId, f.locationId),
        ),
      }),
    ).toBeUndefined();
    ok(await save(identity));
    const row = await db.query.materialInventory.findFirst({
      where: and(
        eq(materialInventory.materialId, f.items[0].materialId),
        eq(materialInventory.locationId, f.locationId),
      ),
    });
    expect(row?.currentStock).toBe("2.50");
    expect(row?.averageCost).toBe("20.00");
    expect(await financeCounts()).toEqual(before);
  });
  test("multi-material company intake records exact weighted costs, source/audit and repeat receipt without cash/expenses", async () => {
    const f = await fixture("10.00"),
      input = stockInput(f),
      identity = await proof(input),
      before = await financeCounts();
    expect(ok(await read(identity)).status).toBe("READY");
    const [one, two] = await Promise.all([save(identity), save(identity)]);
    expect(one.success && two.success).toBe(true);
    for (const i of f.items) {
      expect(await stock(i.inventoryId)).toBe(12.5);
      expect(
        (
          await db.query.materialInventory.findFirst({
            where: eq(materialInventory.id, i.inventoryId),
          })
        )?.averageCost,
      ).toBe("12.00");
    }
    const id = ok(one).resultId;
    expect(
      await db.query.warehouseIntake.findFirst({ where: eq(warehouseIntake.id, id) }),
    ).toBeDefined();
    expect(
      await db.query.stockMovement.findMany({ where: eq(stockMovement.referenceId, id) }),
    ).toHaveLength(2);
    expect(
      await db.query.auditLog.findMany({
        where: and(eq(auditLog.targetId, id), eq(auditLog.action, "POST_WAREHOUSE_INTAKE")),
      }),
    ).toHaveLength(1);
    expect(ok(await save(identity)).alreadyConfirmed).toBe(true);
    expect(await financeCounts()).toEqual(before);
  });
  test("one material can receive against distinct RAP areas with a single exact final stock/valuation", async () => {
    const f = await fixture("10.00", 1);
    const [rap] = await db
      .insert(projectRap)
      .values({ projectId: f.projectId, status: "LOCKED", setupStage: "COMPLETE" })
      .returning();
    const items = await db
      .insert(projectRapItem)
      .values(
        ["Dapur", "Kamar"].map((area) => ({
          projectRapId: rap.id,
          materialId: f.items[0].materialId,
          name: `Panel ${area}`,
          area,
          unit: "lembar",
          requiredQuantity: "10.00",
          totalQuantity: "10.00",
          bufferQuantity: "0.00",
          estimatedUnitCost: "20.00",
          estimatedTotalCost: "200.00",
        })),
      )
      .returning();
    const input = warehouseIntakeInputSchema.parse({
      action: "PROJECT_RECEIPT",
      projectId: f.projectId,
      inventoryLocationId: f.locationId,
      receiptNumber: `${prefix}-${randomUUID()}`,
      receivedAt: "2026-10-11",
      note: "Pengiriman dibagi dua area RAP",
      items: items.map((item, i) => ({
        materialId: f.items[0].materialId,
        projectRapItemId: item.id,
        quantity: i ? 1.5 : 2.5,
        unitCost: i ? 30 : 20,
      })),
    });
    const identity = await proof(input),
      view = ok(await read(identity));
    expect(new Set(view.proposal.rows.map((r) => r.id)).size).toBe(2);
    expect(view.proposal.rows.every((r) => r.comparisons[0].after === 14)).toBe(true);
    const cost = view.proposal.rows[0].comparisons[1].after;
    ok(await save(identity));
    expect(await stock(f.items[0].inventoryId)).toBe(14);
    expect(
      Number(
        (
          await db.query.materialInventory.findFirst({
            where: eq(materialInventory.id, f.items[0].inventoryId),
          })
        )?.averageCost,
      ),
    ).toBe(cost);
  });
  test("receipt receives a complete project batch, permits warehouse NONE and denies unassigned project", async () => {
    const f = await fixture(),
      input = warehouseIntakeInputSchema.parse({
        action: "PROJECT_RECEIPT",
        projectId: f.projectId,
        inventoryLocationId: f.locationId,
        receiptNumber: `${prefix}-${randomUUID()}`,
        receivedAt: "2026-10-11",
        note: "Penerimaan material proyek sintetis",
        items: f.items.map((i) => ({ materialId: i.materialId, quantity: 3, unitCost: 20 })),
      });
    as(warehouse);
    const identity = await proof(input);
    expect(ok(await save(identity)).resultId).toBeTruthy();
    for (const i of f.items) expect(await stock(i.inventoryId)).toBe(3);
    as(assigned);
    if (input.action !== "PROJECT_RECEIPT") throw new Error("Receipt fixture action mismatch.");
    await db.update(project).set({ projectManagerId: maker.id }).where(eq(project.id, f.projectId));
    await expect(proof({ ...input, receiptNumber: `${prefix}-${randomUUID()}` })).rejects.toThrow(
      "di luar akses",
    );
  });
  test("opening request changes no stock, independent approval posts all lines, then guarded reversal removes them", async () => {
    const f = await fixture(),
      before = await financeCounts(),
      request = await proof(openingInput(f));
    const batchId = ok(await save(request)).resultId;
    for (const i of f.items) expect(await stock(i.inventoryId)).toBe(0);
    await expect(
      proof({ action: "OPENING_APPROVE", batchId, reason: "Hasil opname diperiksa ulang" }),
    ).rejects.toThrow("pemeriksa lain");
    as(checker);
    const approval = await proof({
      action: "OPENING_APPROVE",
      batchId,
      reason: "Hasil opname diperiksa ulang",
    });
    ok(await save(approval));
    for (const i of f.items) expect(await stock(i.inventoryId)).toBe(5);
    const reversal = await proof({
      action: "OPENING_REVERSE",
      batchId,
      reason: "Pengajuan salah lokasi gudang",
    });
    ok(await save(reversal));
    for (const i of f.items) expect(await stock(i.inventoryId)).toBe(0);
    expect(
      (
        await db.query.inventoryOpeningBatch.findFirst({
          where: eq(inventoryOpeningBatch.id, batchId),
        })
      )?.status,
    ).toBe("REVERSED");
    expect(await financeCounts()).toEqual(before);
  });
  test("rejecting an opening retains zero stock and stores the human reason", async () => {
    const f = await fixture(),
      batchId = ok(await save(await proof(openingInput(f)))).resultId;
    as(checker);
    ok(
      await save(
        await proof({ action: "OPENING_REJECT", batchId, reason: "Dokumen sumber belum lengkap" }),
      ),
    );
    expect(
      (
        await db.query.inventoryOpeningBatch.findFirst({
          where: eq(inventoryOpeningBatch.id, batchId),
        })
      )?.rejectedReason,
    ).toBe("Dokumen sumber belum lengkap");
    for (const i of f.items) expect(await stock(i.inventoryId)).toBe(0);
  });
  test("opening cannot overwrite active stock, prior movements or pending openings", async () => {
    const active = await fixture("1.00");
    await expect(proof(openingInput(active))).rejects.toThrow("inventory kosong");
    const f = await fixture();
    ok(await save(await proof(openingInput(f))));
    await expect(proof(openingInput(f))).rejects.toThrow("menunggu persetujuan");
    const other = await fixture();
    await db.insert(stockMovement).values({
      materialId: other.items[0].materialId,
      inventoryLocationId: other.locationId,
      movementType: "STOCK_IN",
      movementDirection: "IN",
      quantity: "0.00",
      unitCost: "0.00",
      createdById: maker.id,
    });
    await expect(proof(openingInput(other))).rejects.toThrow("inventory kosong");
  });
  test("reversal is blocked after a subsequent stock-in and a stale approval cannot overwrite manual changes", async () => {
    const f = await fixture(),
      batchId = ok(await save(await proof(openingInput(f)))).resultId;
    as(checker);
    const approval = await proof({
      action: "OPENING_APPROVE",
      batchId,
      reason: "Hasil opname diverifikasi",
    });
    await db
      .update(materialInventory)
      .set({ currentStock: "1.00" })
      .where(eq(materialInventory.id, f.items[0].inventoryId));
    expect((await save(approval)).success).toBe(false);
    expect(await stock(f.items[1].inventoryId)).toBe(0);
    await db
      .update(materialInventory)
      .set({ currentStock: "0.00" })
      .where(eq(materialInventory.id, f.items[0].inventoryId));
    ok(
      await withTestRequest(decideInventoryOpening)({
        batchId,
        decision: "APPROVE",
        reason: "Pemeriksaan manual selesai",
        emergencyOverride: false,
      }),
    );
    ok(
      await withTestRequest(recordStockIn)({
        materialId: f.items[0].materialId,
        inventoryLocationId: f.locationId,
        quantity: 1,
        unitCost: 20,
        note: "Stok masuk sesudah saldo awal",
      }),
    );
    await expect(
      proof({ action: "OPENING_REVERSE", batchId, reason: "Mencoba membalik saldo awal" }),
    ).rejects.toThrow("tidak dapat dibalik");
  });
  test("ownership, current permission revocation, stale source and nonactive references block saving", async () => {
    const f = await fixture(),
      identity = await proof(stockInput(f));
    as(checker);
    expect((await save(identity)).success).toBe(false);
    as(maker);
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, maker.roleId),
          eq(rolePermission.permissionKey, "create:stock_movement"),
        ),
      );
    expect((await save(identity)).success).toBe(false);
    await db
      .insert(rolePermission)
      .values({ roleId: maker.roleId, permissionKey: "create:stock_movement" });
    await db
      .update(materialInventory)
      .set({ currentStock: "1.00" })
      .where(eq(materialInventory.id, f.items[0].inventoryId));
    expect(ok(await read(identity)).status).toBe("STALE");
    expect((await save(identity)).success).toBe(false);
    await db
      .update(materialMaster)
      .set({ isActive: false })
      .where(eq(materialMaster.id, f.items[1].materialId));
    await expect(proof(stockInput(f))).rejects.toThrow("nonaktif");
  });
  test("a failed final step rolls back the entire subset and retry succeeds once", async () => {
    const f = await fixture(),
      identity = await proof(stockInput(f)),
      originalWrite = intakeWriter.createWarehouseIntakeTx;
    const fail = spyOn(intakeWriter, "createWarehouseIntakeTx").mockImplementation(
      async (...args: Parameters<typeof originalWrite>) => {
        await originalWrite(...args);
        throw new Error("Injected final failure");
      },
    );
    try {
      expect((await save(identity)).success).toBe(false);
    } finally {
      fail.mockRestore();
    }
    for (const i of f.items) expect(await stock(i.inventoryId)).toBe(0);
    expect(
      await db.query.aiProposalConfirmation.findFirst({
        where: eq(aiProposalConfirmation.toolCallId, identity.toolCallId),
      }),
    ).toBeUndefined();
    expect((await save(identity)).success).toBe(true);
  });
  test("manual/AI race on a reference commits once and client-payload legacy previews cannot mutate", async () => {
    const f = await fixture(),
      input = stockInput(f),
      one = await proof(input),
      two = await proof(input);
    const results = await Promise.all([save(one), save(two)]);
    expect(results.filter((r) => r.success)).toHaveLength(1);
    for (const i of f.items) expect(await stock(i.inventoryId)).toBe(2.5);
    expect(
      (
        await withTestRequest(confirmAiGoodsReceiptProposal)({
          ...one,
          projectId: f.projectId,
          quantity: 999,
        })
      ).success,
    ).toBe(false);
    expect((await save({ ...one, quantity: 999 })).success).toBe(false);
    expect((await withTestRequest(confirmAiGoodsReceiptProposal)(one)).success).toBe(false);
  });
  test("source lookup paginates and one-character queries work while missing selections wait", async () => {
    as(warehouse);
    const tools = buildWarehouseIntakeTools({
      userId: warehouse.id,
      roleName: "custom",
      roleId: warehouse.roleId,
      permissions: grants,
      dataScope: "NONE",
    });
    const execute = tools.getWarehouseIntakeContext.execute;
    if (!execute) throw new Error("Missing execute");
    const options = { toolCallId: randomUUID(), messages: [], context: undefined };
    const waiting = await withTestRequest(async () =>
      execute({ resource: "inventory", offset: 0 }, options),
    )();
    expect(waiting).toMatchObject({ status: "waiting_for_location" });
    const result = await withTestRequest(async () =>
      execute({ resource: "projects", query: "I", offset: 0 }, options),
    )();
    expect(result).toMatchObject({ hasMore: expect.any(Boolean) });
  });
});
