import * as receiptWriters from "@backend/server/usecases/material/receipt-reversal-writer";
import {
  requestGoodsReceiptReversal,
  approveGoodsReceiptReversal,
} from "@backend/app/actions/material/warehouse-receipt-reversal";
import { beforeAll, beforeEach, afterAll, expect, test, spyOn } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { db } from "@backend/db";
import {
  role,
  rolePermission,
  user,
  client,
  project,
  expenseCategory,
  projectBudgets,
  projectBudgetCategory,
  materialCategory,
  materialMaster,
  inventoryLocation,
  materialInventory,
  projectRap,
  projectRapItem,
  stockMovement,
  goodsReceipt,
  goodsReceiptItem,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  auditLog,
  cashTransaction,
  vendor,
  vendorBill,
  formDraft,
  stockCount,
  stockTransfer,
  attachment,
  bankAccount,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { withTestRequest } from "@backend/lib/testing/request";
import { resolveActor, type Actor } from "@backend/server/actor";
import { prepareProcurementWarehouseProposal } from "@backend/server/usecases/ai/procurement-warehouse-context";
import * as transferWriter from "@backend/server/usecases/material/warehouse-transfer-writer";
import {
  getAiProcurementWarehouseProposal,
  confirmAiProcurementWarehouseProposal,
} from "./procurement-warehouse";
import {
  procurementWarehouseInputSchema,
  type ProcurementWarehouseInput,
  type ProcurementWarehouseProposal,
} from "@atria/core/ai/procurement-warehouse";
import { prepareProjectStockProposal } from "@backend/server/usecases/ai/project-stock-context";
import { confirmAiProjectStockProposal } from "./project-stock";
import { postGoodsReceipt } from "@backend/app/actions/material/goods-receipt";
import { reserveMaterialForProject } from "@backend/app/actions/material/inventory-movements";
import { buildProcurementWarehouseTools } from "@backend/lib/ai/tools/procurement-warehouse-tools";
import {
  saveVendorBillDraft,
  submitVendorBillDraft,
} from "@backend/app/actions/finance/vendor-bill-drafts";
import { createStockTransfer } from "@backend/app/actions/material/warehouse-transfer";
import { scheduleVendorBillPayment } from "@backend/app/actions/finance/schedule-vendor-bill";
import { payVendorBill } from "@backend/app/actions/finance/pay-vendor-bill";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
const prefix = `PROCUREAI-${randomUUID().slice(0, 8)}`;
const grants: readonly PermissionKey[] = [
  "use:ai_chat",
  "view:material",
  "view:inventory",
  "view:budget",
  "reserve:stock",
  "use:stock",
  "create:stock_movement",
  "view:cost",
  "view:vendor_bill",
  "create:vendor_bill",
  "pay:vendor_bill",
  "transfer:stock",
  "create:stock_count",
  "approve:stock_count",
  "request:goods_receipt_reversal",
  "approve:goods_receipt_reversal",
];
type Person = {
  id: string;
  roleId: string;
  name: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
};
type Fixture = {
  projectId: string;
  budgetId: string;
  categoryId: string;
  materialId: string;
  locationId: string;
  inventoryId: string;
  rapItemId: string;
};
let owner: Person,
  assigned: Person,
  warehouse: Person,
  clientId: string,
  expenseId: string,
  materialCategoryId: string;
const api = auth.api as unknown as { getSession: unknown },
  original = api.getSession;
function as(person: Person | null): void {
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
function ok<T>(result: ActionResponse<T>): T {
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}
async function actor(): Promise<Actor> {
  const value = await withTestRequest(resolveActor)();
  if (!value) throw new Error("No actor");
  return value;
}
const read = withTestRequest(getAiProcurementWarehouseProposal),
  save = withTestRequest(confirmAiProcurementWarehouseProposal);
async function person(
  scope: "GLOBAL" | "ASSIGNED" | "NONE",
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
      name: r.name,
      email: `${r.name}@fixture.invalid`,
      roleId: r.id,
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
async function fixture(stock = "100.00"): Promise<Fixture> {
  const [p] = await db
    .insert(project)
    .values({
      name: `${prefix}-${randomUUID().slice(0, 6)}`,
      clientId,
      projectManagerId: assigned.id,
      status: "ACTIVE",
      totalContractValue: "10000.00",
    })
    .returning();
  const [b] = await db
    .insert(projectBudgets)
    .values({
      projectId: p.id,
      contractValue: "10000.00",
      internalBudget: "8000.00",
      budgetCapRatio: "0.8000",
      targetGrossPercentage: "20.00",
    })
    .returning();
  const [c] = await db
    .insert(projectBudgetCategory)
    .values({
      projectBudgetId: b.id,
      expenseCategoryId: expenseId,
      ratioPercentage: "0.5000",
      allocatedAmount: "4000.00",
      actualAmount: "0.00",
      remainingAmount: "4000.00",
    })
    .returning();
  const [m] = await db
    .insert(materialMaster)
    .values({
      name: `${prefix} Panel ${randomUUID().slice(0, 4)}`,
      categoryId: materialCategoryId,
      unit: "lembar",
    })
    .returning();
  const [l] = await db
    .insert(inventoryLocation)
    .values({ name: `${prefix} gudang ${randomUUID().slice(0, 4)}` })
    .returning();
  const [i] = await db
    .insert(materialInventory)
    .values({
      materialId: m.id,
      locationId: l.id,
      currentStock: stock,
      reservedStock: "0.00",
      averageCost: "10.00",
    })
    .returning();
  const [r] = await db
    .insert(projectRap)
    .values({ projectId: p.id, status: "LOCKED", setupStage: "COMPLETE" })
    .returning();
  const [ri] = await db
    .insert(projectRapItem)
    .values({
      projectRapId: r.id,
      materialId: m.id,
      name: "Panel dapur",
      area: "Dapur",
      requiredQuantity: "20.00",
      bufferQuantity: "0.00",
      totalQuantity: "20.00",
      unit: "lembar",
      estimatedUnitCost: "10.00",
      estimatedTotalCost: "200.00",
    })
    .returning();
  await db.insert(stockMovement).values({
    materialId: m.id,
    inventoryLocationId: l.id,
    movementType: "STOCK_IN",
    movementDirection: "IN",
    quantity: stock,
    unitCost: "10.00",
    createdById: owner.id,
    note: "Synthetic opening stock",
  });
  return {
    projectId: p.id,
    budgetId: b.id,
    categoryId: c.id,
    materialId: m.id,
    locationId: l.id,
    inventoryId: i.id,
    rapItemId: ri.id,
  };
}
async function proof(raw: ProcurementWarehouseInput): Promise<{
  identity: { conversationId: string; toolCallId: string };
  proposal: ProcurementWarehouseProposal;
  messageId: string;
}> {
  const a = await actor(),
    proposal = await prepareProcurementWarehouseProposal(a, raw),
    toolCallId = randomUUID();
  const [conversation] = await db
    .insert(aiConversation)
    .values({ userId: a.userId, title: prefix })
    .returning();
  const [message] = await db
    .insert(aiMessage)
    .values({
      conversationId: conversation.id,
      role: "assistant",
      parts: [
        {
          type: raw.action.startsWith("VENDOR_BILL")
            ? "tool-proposeVendorBill"
            : "tool-proposeWarehouseOperation",
          state: "output-available",
          toolCallId,
          output: { proposal },
        },
      ],
    })
    .returning();
  return {
    identity: { conversationId: conversation.id, toolCallId },
    proposal,
    messageId: message.id,
  };
}

async function stock(f: Fixture): Promise<typeof materialInventory.$inferSelect> {
  const row = await db.query.materialInventory.findFirst({
    where: eq(materialInventory.id, f.inventoryId),
  });
  if (!row) throw new Error("Missing inventory");
  return row;
}
async function actual(f: Fixture): Promise<number> {
  const row = await db.query.projectBudgetCategory.findFirst({
    where: eq(projectBudgetCategory.id, f.categoryId),
  });
  return Number(row?.actualAmount ?? 0);
}
async function billInput(f: Fixture): Promise<ProcurementWarehouseInput> {
  const [supplier] = await db
    .insert(vendor)
    .values({ name: `${prefix}-${randomUUID().slice(0, 4)}`, phone: "000000" })
    .returning();
  return procurementWarehouseInputSchema.parse({
    action: "VENDOR_BILL_SAVE",
    payload: {
      projectId: f.projectId,
      projectBudgetCategoryId: f.categoryId,
      vendorId: supplier.id,
      materialId: f.materialId,
      projectRapItemId: f.rapItemId,
      billNumber: `${prefix}-${randomUUID().slice(0, 8)}`,
      amount: 200,
      dueDate: "2026-10-20",
      notes: "Pembelian panel dapur",
      invoice: {
        urls: [],
        lines: [
          { name: "Panel dapur", quantity: 20, unit: "lembar", amount: 200, source: "Percakapan" },
        ],
      },
    },
  });
}
async function transferInput(f: Fixture): Promise<ProcurementWarehouseInput> {
  const [destination] = await db
    .insert(inventoryLocation)
    .values({ name: `${prefix} tujuan ${randomUUID().slice(0, 5)}` })
    .returning();
  await db.insert(materialInventory).values({
    materialId: f.materialId,
    locationId: destination.id,
    currentStock: "10.00",
    averageCost: "20.00",
  });
  return procurementWarehouseInputSchema.parse({
    action: "WAREHOUSE_TRANSFER",
    transferNumber: `${prefix}-${randomUUID().slice(0, 8)}`,
    fromLocationId: f.locationId,
    toLocationId: destination.id,
    transferredAt: "2026-10-10",
    note: "Kebutuhan lokasi proyek kedua",
    items: [{ materialId: f.materialId, quantity: 10 }],
  });
}
async function counts(table: typeof cashTransaction): Promise<number> {
  return Number((await db.select({ n: count() }).from(table))[0].n);
}

describeIntegration("AI procurement and warehouse", () => {
  beforeAll(async () => {
    const [cl] = await db
      .insert(client)
      .values({ name: prefix, email: `${prefix}@fixture.invalid`, phone: "000000" })
      .returning();
    clientId = cl.id;
    const e = await db.query.expenseCategory.findFirst({
      where: eq(expenseCategory.code, "MATERIAL"),
    });
    if (!e) throw new Error("Seeded Material category missing");
    expenseId = e.id;
    const [m] = await db.insert(materialCategory).values({ name: prefix }).returning();
    materialCategoryId = m.id;
    owner = await person("GLOBAL");
    assigned = await person("ASSIGNED");
    warehouse = await person(
      "NONE",
      grants.filter((p) => p !== "view:budget" && p !== "view:cost" && p !== "view:vendor_bill"),
    );
  });
  beforeEach(() => as(owner));
  afterAll(() => {
    api.getSession = original;
  });

  test("owned invoice draft is ordinary form-compatible, metadata-only, revision-safe and idempotently submitted", async () => {
    const f = await fixture(),
      raw = await billInput(f),
      cashBefore = await counts(cashTransaction);
    if (raw.action !== "VENDOR_BILL_SAVE") throw new Error("Invalid test input");
    const stored = await proof(raw);
    expect(ok(await read(stored.identity)).status).toBe("READY");
    const saved = ok(await save(stored.identity));
    const draft = await db.query.formDraft.findFirst({ where: eq(formDraft.id, saved.resultId) });
    expect(draft?.formType).toBe("VENDOR_BILL_CREATE");
    expect(draft?.status).toBe("ACTIVE");
    expect(await actual(f)).toBe(0);
    expect((await stock(f)).currentStock).toBe("100.00");
    expect(await counts(cashTransaction)).toBe(cashBefore);
    expect(ok(await save(stored.identity)).alreadyConfirmed).toBe(true);
    const edited = ok(
      await withTestRequest(saveVendorBillDraft)({
        draftId: saved.resultId,
        expectedRevision: 1,
        payload: {
          ...raw.payload,
          projectBudgetItemId: "",
          projectCategoryPlanItemId: "",
          notes: "Koreksi manusia dari form",
        },
      }),
    );
    const submit = await proof({ action: "VENDOR_BILL_SUBMIT", draftId: edited.id });
    const results = await Promise.all([save(submit.identity), save(submit.identity)]);
    expect(ok(results[0]).resultId).toBe(ok(results[1]).resultId);
    const bill = await db.query.vendorBill.findFirst({
      where: eq(vendorBill.id, ok(results[0]).resultId),
    });
    expect(bill?.status).toBe("UNPAID");
    expect(bill?.materialId).toBe(f.materialId);
    expect(bill?.projectRapItemId).toBe(f.rapItemId);
    expect(await actual(f)).toBe(0);
    expect(await counts(cashTransaction)).toBe(cashBefore);
    const consumed = await db.query.formDraft.findFirst({ where: eq(formDraft.id, edited.id) });
    expect(consumed?.status).toBe("CONSUMED");
    expect(consumed?.submissionGroupId).toBe(bill?.id);
    expect(consumed?.payload).toHaveProperty("invoice.lines");
  });
  test("invoice creation rejects duplicate numbers, cross-project category/links and inactive vendor", async () => {
    const f = await fixture(),
      other = await fixture(),
      raw = await billInput(f);
    if (raw.action !== "VENDOR_BILL_SAVE") throw new Error("Invalid test input");
    await expect(
      prepareProcurementWarehouseProposal(await actor(), {
        ...raw,
        payload: { ...raw.payload, projectBudgetCategoryId: other.categoryId },
      }),
    ).rejects.toThrow();
    await expect(
      prepareProcurementWarehouseProposal(await actor(), {
        ...raw,
        payload: { ...raw.payload, projectRapItemId: other.rapItemId },
      }),
    ).rejects.toThrow();
    const draftId = ok(await save((await proof(raw)).identity)).resultId;
    ok(await withTestRequest(submitVendorBillDraft)({ draftId, expectedRevision: 1 }));
    await expect(prepareProcurementWarehouseProposal(await actor(), raw)).rejects.toThrow(
      "Nomor tagihan",
    );
    await db.update(vendor).set({ isActive: false }).where(eq(vendor.id, raw.payload.vendorId));
    await expect(
      prepareProcurementWarehouseProposal(await actor(), {
        ...raw,
        payload: { ...raw.payload, billNumber: randomUUID() },
      }),
    ).rejects.toThrow("Vendor aktif");
  });
  test("invoice attachment ownership, proposal ownership, expiry, strict identity and live grant/scope are enforced", async () => {
    const f = await fixture(),
      raw = await billInput(f);
    if (raw.action !== "VENDOR_BILL_SAVE") throw new Error("Invalid test input");
    const [file] = await db
      .insert(attachment)
      .values({
        fileName: "invoice-qa.txt",
        fileUrl: "https://fixture.invalid/qa",
        storageFileId: "synthetic",
        fileSize: 10,
        mimeType: "text/plain",
        uploadedById: assigned.id,
        referenceType: "private_ai_chat",
        referenceId: assigned.id,
      })
      .returning();
    const source = `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/api/media/attachments/${file.id}`;
    await expect(
      prepareProcurementWarehouseProposal(await actor(), {
        ...raw,
        payload: { ...raw.payload, invoice: { ...raw.payload.invoice, urls: [source] } },
      }),
    ).rejects.toThrow();
    await db.update(attachment).set({ uploadedById: owner.id }).where(eq(attachment.id, file.id));
    const stored = await proof({
      ...raw,
      payload: { ...raw.payload, invoice: { ...raw.payload.invoice, urls: [source] } },
    });
    expect(stored.proposal.rows[0]?.details.some((d) => d.value === "invoice-qa.txt")).toBe(true);
    expect((await save({ ...stored.identity, amount: 2 })).success).toBe(false);
    as(assigned);
    expect((await read(stored.identity)).success).toBe(false);
    as(owner);
    const limited = await person("NONE", grants);
    as(limited);
    await expect(prepareProcurementWarehouseProposal(await actor(), raw)).rejects.toThrow(
      "FORBIDDEN",
    );
    as(owner);
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, stored.messageId));
    expect(ok(await read(stored.identity)).status).toBe("EXPIRED");
    expect((await save(stored.identity)).success).toBe(false);
    const revoked = await person("GLOBAL", grants);
    as(revoked);
    const proposal = await proof(await billInput(f));
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, revoked.roleId),
          eq(rolePermission.permissionKey, "create:vendor_bill"),
        ),
      );
    expect((await save(proposal.identity)).success).toBe(false);
    const outsider = await person("ASSIGNED", grants);
    as(outsider);
    await expect(prepareProcurementWarehouseProposal(await actor(), raw)).rejects.toThrow(
      "FORBIDDEN",
    );
  });
  test("warehouse NONE transfer preserves aggregate quantity/value, reservations, dual movement/audit and zero cash", async () => {
    const f = await fixture(),
      raw = await transferInput(f),
      cashBefore = await counts(cashTransaction);
    if (raw.action !== "WAREHOUSE_TRANSFER") throw new Error("Invalid test input");
    await db
      .update(materialInventory)
      .set({ reservedStock: "20.00" })
      .where(eq(materialInventory.id, f.inventoryId));
    as(warehouse);
    const stored = await proof(raw);
    expect(stored.proposal.budget).toBeNull();
    ok(await save(stored.identity));
    expect(ok(await save(stored.identity)).alreadyConfirmed).toBe(true);
    const destination = await db.query.materialInventory.findFirst({
      where: and(
        eq(materialInventory.materialId, f.materialId),
        eq(materialInventory.locationId, raw.toLocationId),
      ),
    });
    expect((await stock(f)).currentStock).toBe("90.00");
    expect((await stock(f)).reservedStock).toBe("20.00");
    expect(destination?.currentStock).toBe("20.00");
    expect(destination?.averageCost).toBe("15.00");
    const movements = await db.query.stockMovement.findMany({
      where: eq(stockMovement.referenceId, ok(await save(stored.identity)).resultId),
    });
    expect(movements.map((m) => m.movementDirection).sort()).toEqual(["IN", "OUT"]);
    expect(await actual(f)).toBe(0);
    expect(await counts(cashTransaction)).toBe(cashBefore);
    expect(
      (
        await db.query.auditLog.findMany({
          where: eq(auditLog.targetId, ok(await save(stored.identity)).resultId),
        })
      ).length,
    ).toBe(1);
  });
  test("stock opname draft/submit does not move stock, checker applies exact audited correction and rejects repeated decisions", async () => {
    const f = await fixture(),
      cashBefore = await counts(cashTransaction);
    const stored = await proof({
      action: "STOCK_COUNT_SAVE",
      countNumber: `${prefix}-${randomUUID().slice(0, 8)}`,
      inventoryLocationId: f.locationId,
      countedAt: "2026-10-10",
      note: "Hasil penghitungan fisik oleh manusia",
      items: [{ materialId: f.materialId, countedQuantity: 95 }],
    });
    const countId = ok(await save(stored.identity)).resultId;
    const counted = await db.query.stockCount.findFirst({ where: eq(stockCount.id, countId) });
    if (!counted) throw new Error("Count fixture missing");
    await expect(
      prepareProcurementWarehouseProposal(await actor(), {
        action: "STOCK_COUNT_SAVE",
        countNumber: counted.countNumber,
        inventoryLocationId: f.locationId,
        countedAt: "2026-10-10",
        note: "Hasil penghitungan lain oleh manusia",
        items: [{ materialId: f.materialId, countedQuantity: 95 }],
      }),
    ).rejects.toThrow("Nomor stock opname");
    expect((await stock(f)).currentStock).toBe("100.00");
    const submit = await proof({ action: "STOCK_COUNT_SUBMIT", stockCountId: countId });
    ok(await save(submit.identity));
    expect((await stock(f)).currentStock).toBe("100.00");
    await expect(
      prepareProcurementWarehouseProposal(await actor(), {
        action: "STOCK_COUNT_APPROVE",
        stockCountId: countId,
      }),
    ).rejects.toThrow("pengguna lain");
    as(assigned);
    const approve = await proof({ action: "STOCK_COUNT_APPROVE", stockCountId: countId });
    ok(await save(approve.identity));
    expect((await stock(f)).currentStock).toBe("95.00");
    expect((await stock(f)).averageCost).toBe("10.00");
    expect(await actual(f)).toBe(0);
    expect(await counts(cashTransaction)).toBe(cashBefore);
    expect(ok(await save(approve.identity)).alreadyConfirmed).toBe(true);
    const header = await db.query.stockCount.findFirst({ where: eq(stockCount.id, countId) });
    expect(header?.status).toBe("POSTED");
    const movement = await db.query.stockMovement.findFirst({
      where: eq(stockMovement.referenceId, countId),
    });
    expect(movement?.quantity).toBe("5.00");
    expect(movement?.movementDirection).toBe("OUT");
    await expect(
      prepareProcurementWarehouseProposal(await actor(), {
        action: "STOCK_COUNT_REJECT",
        stockCountId: countId,
        reason: "Tidak sesuai kondisi lapangan",
      }),
    ).rejects.toThrow();
  });
  test("rejection records human reason without inventory/cash changes; changed stock and reserved coverage block approval", async () => {
    const f = await fixture();
    const make = async (): Promise<string> => {
      as(owner);
      const countId = ok(
        await save(
          (
            await proof({
              action: "STOCK_COUNT_SAVE",
              countNumber: randomUUID(),
              inventoryLocationId: f.locationId,
              countedAt: "2026-10-10",
              note: "Hasil hitung dari lembar lapangan",
              items: [{ materialId: f.materialId, countedQuantity: 95 }],
            })
          ).identity,
        ),
      ).resultId;
      ok(
        await save((await proof({ action: "STOCK_COUNT_SUBMIT", stockCountId: countId })).identity),
      );
      return countId;
    };
    const countId = await make();
    as(assigned);
    ok(
      await save(
        (
          await proof({
            action: "STOCK_COUNT_REJECT",
            stockCountId: countId,
            reason: "Perhitungan perlu dilakukan ulang",
          })
        ).identity,
      ),
    );
    expect((await stock(f)).currentStock).toBe("100.00");
    expect(
      (await db.query.stockCount.findFirst({ where: eq(stockCount.id, countId) }))?.rejectionReason,
    ).toBe("Perhitungan perlu dilakukan ulang");
    const changed = await make();
    as(owner);
    ok(
      await withTestRequest(reserveMaterialForProject)({
        projectId: f.projectId,
        materialId: f.materialId,
        inventoryLocationId: f.locationId,
        quantity: 96,
        note: "Kebutuhan kuota proyek",
      }),
    );
    as(assigned);
    await expect(
      prepareProcurementWarehouseProposal(await actor(), {
        action: "STOCK_COUNT_APPROVE",
        stockCountId: changed,
      }),
    ).rejects.toThrow("reservasi");
    await db
      .update(materialInventory)
      .set({ currentStock: "101.00" })
      .where(eq(materialInventory.id, f.inventoryId));
    await expect(
      prepareProcurementWarehouseProposal(await actor(), {
        action: "STOCK_COUNT_APPROVE",
        stockCountId: changed,
      }),
    ).rejects.toThrow("Stok berubah");
  });
  test("manual transfer after preview makes AI stale; later writer failure rolls back rows/movements/audit/receipt", async () => {
    const f = await fixture(),
      raw = await transferInput(f);
    if (raw.action !== "WAREHOUSE_TRANSFER") throw new Error("Invalid test input");
    const stored = await proof(raw);
    ok(
      await withTestRequest(createStockTransfer)({
        ...raw,
        transferNumber: randomUUID(),
        quantity: undefined,
        items: [{ materialId: f.materialId, quantity: 2 }],
      }),
    );
    expect(ok(await read(stored.identity)).status).toBe("STALE");
    expect((await save(stored.identity)).success).toBe(false);
    const current = await proof({ ...raw, transferNumber: randomUUID() });
    const before = await stock(f),
      writer = transferWriter.createStockTransferTx;
    const spy = spyOn(transferWriter, "createStockTransferTx").mockImplementation(
      async (tx, a, i) => {
        await writer(tx, a, i);
        throw new Error("Synthetic failure after business writes");
      },
    );
    try {
      expect((await save(current.identity)).success).toBe(false);
    } finally {
      spy.mockRestore();
    }
    expect((await stock(f)).currentStock).toBe(before.currentStock);
    expect(
      (
        await db.query.stockTransfer.findMany({
          where: eq(
            stockTransfer.transferNumber,
            current.proposal.input.action === "WAREHOUSE_TRANSFER"
              ? current.proposal.input.transferNumber
              : "",
          ),
        })
      ).length,
    ).toBe(0);
    expect(
      (
        await db.query.aiProposalConfirmation.findMany({
          where: eq(aiProposalConfirmation.toolCallId, current.identity.toolCallId),
        })
      ).length,
    ).toBe(0);
    ok(await save(current.identity));
  });
  test("bill source edits and budget permission changes invalidate preview; read tools mask unauthorized project/budget data", async () => {
    const f = await fixture(),
      raw = await billInput(f),
      scoped = await person("GLOBAL", grants);
    as(scoped);
    const saved = await proof(raw);
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, scoped.roleId),
          eq(rolePermission.permissionKey, "view:budget"),
        ),
      );
    const masked = ok(await read(saved.identity));
    expect(masked.proposal.budget).toBeNull();
    expect(masked.status).toBe("STALE");
    expect((await save(saved.identity)).success).toBe(false);
    const context = buildProcurementWarehouseTools(await actor());
    const getter = context.getVendorBillContext.execute;
    if (!getter) throw new Error("Missing tool executor");
    const lookup = await withTestRequest(() =>
      getter(
        { projectId: f.projectId, offset: 0 },
        { toolCallId: randomUUID(), messages: [], context: undefined },
      ),
    )();
    expect(lookup).toHaveProperty("budget", null);
    const outsider = await person("ASSIGNED", grants);
    as(outsider);
    const ownTool = buildProcurementWarehouseTools(await actor()).getVendorBillContext.execute;
    if (!ownTool) throw new Error("Missing tool executor");
    expect(
      await withTestRequest(() =>
        ownTool(
          { projectId: f.projectId, offset: 0 },
          { toolCallId: randomUUID(), messages: [], context: undefined },
        ),
      )(),
    ).toHaveProperty("error");
  });
  test("complete invoice→unpaid bill→partial receipts→payment→reserve/use/return recognizes Material once and separates cash", async () => {
    const f = await fixture("0.00"),
      raw = await billInput(f);
    const draftId = ok(await save((await proof(raw)).identity)).resultId;
    const billId = ok(
      await save((await proof({ action: "VENDOR_BILL_SUBMIT", draftId })).identity),
    ).resultId;
    const receive = withTestRequest(postGoodsReceipt),
      cashBefore = await counts(cashTransaction);
    const receiptIds: string[] = [];
    for (const quantity of [8, 12])
      receiptIds.push(
        ok(
          await receive({
            projectId: f.projectId,
            vendorBillId: billId,
            inventoryLocationId: f.locationId,
            receiptNumber: randomUUID(),
            receivedAt: new Date(),
            note: "Penerimaan parsial panel dapur",
            items: [
              { materialId: f.materialId, projectRapItemId: f.rapItemId, quantity, unitCost: 10 },
            ],
          }),
        ).id,
      );
    ok(
      await withTestRequest(requestGoodsReceiptReversal)({
        goodsReceiptId: receiptIds[0],
        reason: "Penerimaan pertama perlu dikoreksi",
      }),
    );
    as(assigned);
    ok(
      await withTestRequest(approveGoodsReceiptReversal)({
        goodsReceiptId: receiptIds[0],
        emergencyOverride: false,
      }),
    );
    as(owner);
    expect((await stock(f)).currentStock).toBe("12.00");
    expect(await counts(cashTransaction)).toBe(cashBefore);
    ok(
      await receive({
        projectId: f.projectId,
        vendorBillId: billId,
        inventoryLocationId: f.locationId,
        receiptNumber: randomUUID(),
        receivedAt: new Date(),
        note: "Penerimaan pengganti yang sudah dikoreksi",
        items: [
          { materialId: f.materialId, projectRapItemId: f.rapItemId, quantity: 8, unitCost: 10 },
        ],
      }),
    );
    expect((await stock(f)).currentStock).toBe("20.00");
    expect(await actual(f)).toBe(0);
    expect(await counts(cashTransaction)).toBe(cashBefore);
    const [bank] = await db
      .insert(bankAccount)
      .values({
        name: prefix,
        bankName: "QA",
        holderName: "QA",
        accountNumber: randomUUID(),
        balance: "1000.00",
        isActive: true,
      })
      .returning();
    const payment = ok(
      await withTestRequest(scheduleVendorBillPayment)({
        vendorBillId: billId,
        bankAccountId: bank.id,
        paymentDate: new Date(),
        amountPaid: 200,
      }),
    );
    ok(
      await withTestRequest(payVendorBill)({
        vendorPaymentId: payment.id,
        bankAccountId: bank.id,
        referenceNumber: randomUUID(),
      }),
    );
    expect(
      Number(
        (await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, bank.id) }))?.balance,
      ),
    ).toBe(800);
    expect(await counts(cashTransaction)).toBe(cashBefore + 1);
    expect(await actual(f)).toBe(0);
    const move = async (action: "RESERVE" | "USE" | "RETURN", quantity: number): Promise<void> => {
      const a = await actor(),
        proposal = await prepareProjectStockProposal(a, {
          projectId: f.projectId,
          action,
          rows: [
            {
              materialId: f.materialId,
              inventoryLocationId: f.locationId,
              projectRapItemId: f.rapItemId,
              vendorBillId: billId,
              quantity,
              note: "Kebutuhan finishing dapur",
            },
          ],
        });
      const [conversation] = await db
        .insert(aiConversation)
        .values({ userId: a.userId, title: prefix })
        .returning();
      const toolCallId = randomUUID();
      await db.insert(aiMessage).values({
        conversationId: conversation.id,
        role: "assistant",
        parts: [
          {
            type: "tool-proposeProjectStock",
            state: "output-available",
            toolCallId,
            output: { proposal },
          },
        ],
      });
      ok(
        await withTestRequest(confirmAiProjectStockProposal)({
          conversationId: conversation.id,
          toolCallId,
        }),
      );
    };
    await move("RESERVE", 12);
    expect(await actual(f)).toBe(0);
    await move("USE", 5);
    expect(await actual(f)).toBe(50);
    await move("RETURN", 2);
    expect(await actual(f)).toBe(30);
    expect((await stock(f)).currentStock).toBe("17.00");
    expect((await stock(f)).reservedStock).toBe("7.00");
    expect(await counts(cashTransaction)).toBe(cashBefore + 1);
    expect(
      (
        await receive({
          projectId: f.projectId,
          vendorBillId: billId,
          inventoryLocationId: f.locationId,
          receiptNumber: randomUUID(),
          receivedAt: new Date(),
          note: "Penerimaan berlebihan",
          items: [
            { materialId: f.materialId, projectRapItemId: f.rapItemId, quantity: 1, unitCost: 10 },
          ],
        })
      ).success,
    ).toBe(false);
  });
  test("receipt request/independent approval/rejection share ordinary writers, atomic receipts and zero cash", async () => {
    const f = await fixture(),
      cashBefore = await counts(cashTransaction);
    const receipt = ok(
      await withTestRequest(postGoodsReceipt)({
        projectId: f.projectId,
        inventoryLocationId: f.locationId,
        receiptNumber: `${prefix}-${randomUUID()}`,
        receivedAt: new Date(),
        items: [
          { materialId: f.materialId, projectRapItemId: f.rapItemId, quantity: 10, unitCost: 10 },
        ],
        note: "Pengujian pembatalan penerimaan",
      }),
    );
    const request = await proof(
      procurementWarehouseInputSchema.parse({
        action: "RECEIPT_REVERSAL_REQUEST",
        goodsReceiptId: receipt.id,
        reason: "Barang salah dikirim vendor",
      }),
    );
    expect(ok(await read(request.identity)).status).toBe("READY");
    ok(await save(request.identity));
    expect((await stock(f)).currentStock).toBe("110.00");
    expect(ok(await save(request.identity)).alreadyConfirmed).toBe(true);
    await expect(
      proof({ action: "RECEIPT_REVERSAL_APPROVE", goodsReceiptId: receipt.id }),
    ).rejects.toThrow("pengguna lain");
    as(warehouse);
    const approval = await proof({
      action: "RECEIPT_REVERSAL_APPROVE",
      goodsReceiptId: receipt.id,
    });
    expect(approval.proposal.budget).toBeNull();
    const replies = await Promise.all([save(approval.identity), save(approval.identity)]);
    expect(replies.every((r) => r.success)).toBe(true);
    expect(replies.some((r) => r.success && r.data.alreadyConfirmed)).toBe(true);
    expect((await stock(f)).currentStock).toBe("100.00");
    expect((await stock(f)).averageCost).toBe("10.00");
    const movements = await db.query.stockMovement.findMany({
      where: and(
        eq(stockMovement.referenceId, receipt.id),
        eq(stockMovement.movementType, "GOODS_RECEIPT_REVERSAL"),
      ),
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].movementDirection).toBe("OUT");
    expect(await actual(f)).toBe(0);
    as(owner);
    const second = ok(
      await withTestRequest(postGoodsReceipt)({
        projectId: f.projectId,
        inventoryLocationId: f.locationId,
        receiptNumber: `${prefix}-${randomUUID()}`,
        receivedAt: new Date(),
        items: [{ materialId: f.materialId, quantity: 5, unitCost: 10 }],
      }),
    );
    ok(
      await withTestRequest(requestGoodsReceiptReversal)({
        goodsReceiptId: second.id,
        reason: "Perlu periksa kesesuaian barang",
      }),
    );
    as(warehouse);
    const rejection = await proof({
      action: "RECEIPT_REVERSAL_REJECT",
      goodsReceiptId: second.id,
      reason: "Barang sesuai bukti penerimaan",
    });
    ok(await save(rejection.identity));
    expect((await stock(f)).currentStock).toBe("105.00");
    expect(
      (await db.query.goodsReceipt.findFirst({ where: eq(goodsReceipt.id, second.id) }))?.status,
    ).toBe("POSTED");
    expect(await counts(cashTransaction)).toBe(cashBefore);
    expect(
      (await db.query.auditLog.findMany({ where: eq(auditLog.targetId, receipt.id) })).map(
        (a) => a.action,
      ),
    ).toEqual(
      expect.arrayContaining(["REQUEST_GOODS_RECEIPT_REVERSAL", "APPROVE_GOODS_RECEIPT_REVERSAL"]),
    );
  });
  test("receipt previews protect assignments, permission revocation, reservation and stale manual races", async () => {
    const f = await fixture("0.00");
    const receipt = ok(
      await withTestRequest(postGoodsReceipt)({
        projectId: f.projectId,
        inventoryLocationId: f.locationId,
        receiptNumber: `${prefix}-${randomUUID()}`,
        receivedAt: new Date(),
        items: [{ materialId: f.materialId, quantity: 10, unitCost: 10 }],
      }),
    );
    const other = await person("ASSIGNED");
    as(other);
    await expect(
      proof({
        action: "RECEIPT_REVERSAL_REQUEST",
        goodsReceiptId: receipt.id,
        reason: "Barang tidak sesuai pesanan",
      }),
    ).rejects.toThrow("akses");
    as(owner);
    const req = await proof({
      action: "RECEIPT_REVERSAL_REQUEST",
      goodsReceiptId: receipt.id,
      reason: "Barang tidak sesuai pesanan",
    });
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, owner.roleId),
          eq(rolePermission.permissionKey, "request:goods_receipt_reversal"),
        ),
      );
    try {
      expect((await save(req.identity)).success).toBe(false);
    } finally {
      await db
        .insert(rolePermission)
        .values({ roleId: owner.roleId, permissionKey: "request:goods_receipt_reversal" });
    }
    ok(await save(req.identity));
    as(warehouse);
    const approve = await proof({ action: "RECEIPT_REVERSAL_APPROVE", goodsReceiptId: receipt.id });
    ok(
      await withTestRequest(reserveMaterialForProject)({
        projectId: f.projectId,
        materialId: f.materialId,
        inventoryLocationId: f.locationId,
        quantity: 1,
        note: "Reservasi pengujian stale",
      }),
    );
    expect((await save(approve.identity)).success).toBe(false);
    await expect(
      proof({ action: "RECEIPT_REVERSAL_APPROVE", goodsReceiptId: receipt.id }),
    ).rejects.toThrow("direservasi");
    expect((await stock(f)).currentStock).toBe("10.00");
    expect(
      (await db.query.goodsReceipt.findFirst({ where: eq(goodsReceipt.id, receipt.id) }))?.status,
    ).toBe("REVERSAL_REQUESTED");
  });
  test("receipt approval rollback includes all stock items, audit and AI receipt", async () => {
    const f = await fixture();
    const receipt = ok(
      await withTestRequest(postGoodsReceipt)({
        projectId: f.projectId,
        inventoryLocationId: f.locationId,
        receiptNumber: `${prefix}-${randomUUID()}`,
        receivedAt: new Date(),
        items: [
          { materialId: f.materialId, quantity: 5, unitCost: 10 },
          { materialId: f.materialId, projectRapItemId: f.rapItemId, quantity: 5, unitCost: 10 },
        ],
      }),
    );
    ok(
      await withTestRequest(requestGoodsReceiptReversal)({
        goodsReceiptId: receipt.id,
        reason: "Dua baris penerimaan perlu dibatalkan",
      }),
    );
    as(warehouse);
    const p = await proof({ action: "RECEIPT_REVERSAL_APPROVE", goodsReceiptId: receipt.id });
    const originalWrite = receiptWriters.writeReceiptReversalTx;
    const fault = spyOn(receiptWriters, "writeReceiptReversalTx").mockImplementation(
      async (...args: Parameters<typeof originalWrite>) => {
        await originalWrite(...args);
        throw new Error("synthetic post-write failure");
      },
    );
    try {
      expect((await save(p.identity)).success).toBe(false);
    } finally {
      fault.mockRestore();
    }
    expect((await stock(f)).currentStock).toBe("110.00");
    expect(
      (
        await db.query.goodsReceiptItem.findMany({
          where: eq(goodsReceiptItem.goodsReceiptId, receipt.id),
        })
      ).every((i) => !i.reversalStockMovementId),
    ).toBe(true);
    expect(
      await db.query.aiProposalConfirmation.findMany({
        where: eq(aiProposalConfirmation.conversationId, p.identity.conversationId),
      }),
    ).toHaveLength(0);
    expect(
      await db.query.auditLog.findMany({
        where: and(
          eq(auditLog.targetId, receipt.id),
          eq(auditLog.action, "APPROVE_GOODS_RECEIPT_REVERSAL"),
        ),
      }),
    ).toHaveLength(0);
    ok(await save(p.identity));
    expect((await stock(f)).currentStock).toBe("100.00");
    expect(
      ok(await withTestRequest(approveGoodsReceiptReversal)({ goodsReceiptId: receipt.id })).status,
    ).toBe("REVERSED");
  });
});
