import { afterAll, beforeAll, beforeEach, expect, test, spyOn } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { db } from "@backend/db";
import {
  user,
  role,
  rolePermission,
  client,
  project,
  vendor,
  vendorBill,
  vendorPayment,
  bankAccount,
  expenseCategory,
  projectBudgets,
  projectBudgetCategory,
  projectExpenses,
  materialMaster,
  materialCategory,
  inventoryLocation,
  stockMovement,
  auditLog,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  cashTransaction,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { withTestRequest } from "@backend/lib/testing/request";
import { resolveActor, type Actor } from "@backend/server/actor";
import { createVendorBillTx } from "@backend/lib/finance/vendor-bill-write";
import * as writer from "@backend/server/usecases/finance/vendor-bill-correction-writer";
import { prepareProcurementWarehouseProposal } from "@backend/server/usecases/ai/procurement-warehouse-context";
import { correctVendorBill } from "../finance/correct-vendor-bill";
import {
  getAiProcurementWarehouseProposal,
  confirmAiProcurementWarehouseProposal,
} from "./procurement-warehouse";
import { buildVendorBillCorrectionTools } from "@backend/lib/ai/tools/vendor-bill-correction-tools";
import {
  vendorBillCorrectionInputSchema,
  type VendorBillCorrectionInput,
} from "@atria/core/ai/procurement-warehouse";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
const prefix = `BILLCOR-${randomUUID().slice(0, 8)}`;
const grants: readonly PermissionKey[] = [
  "use:ai_chat",
  "view:vendor_bill",
  "update:vendor_bill",
  "view:budget",
];
type Person = {
  id: string;
  roleId: string;
  name: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
};
let owner: Person,
  assigned: Person,
  none: Person,
  clientId: string,
  bankId: string,
  materialCategoryId: string;
const api = auth.api as unknown as { getSession: unknown },
  original = api.getSession;
function as(person: Person): void {
  api.getSession = async () => ({
    user: person,
    session: { id: randomUUID(), userId: person.id, expiresAt: new Date(Date.now() + 3600000) },
  });
}
function ok<T>(result: ActionResponse<T>): T {
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}
async function actor(): Promise<Actor> {
  const a = await withTestRequest(resolveActor)();
  if (!a) throw new Error("No actor");
  return a;
}
async function person(scope: "GLOBAL" | "ASSIGNED" | "NONE"): Promise<Person> {
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
async function fixture(material = false): Promise<{
  billId: string;
  projectId: string;
  categoryId: string;
  materialId: string;
  locationId: string;
}> {
  const category = await db.query.expenseCategory.findFirst({
    where: eq(expenseCategory.code, material ? "MATERIAL" : "OPERASIONAL"),
  });
  if (!category) throw new Error("Seed category missing");
  const [p] = await db
    .insert(project)
    .values({
      name: `${prefix} ${randomUUID()}`,
      clientId,
      projectManagerId: assigned.id,
      status: "ACTIVE",
      totalContractValue: "50000.00",
    })
    .returning();
  const [b] = await db
    .insert(projectBudgets)
    .values({
      projectId: p.id,
      contractValue: "50000.00",
      internalBudget: "30000.00",
      budgetCapRatio: "0.6000",
      targetGrossPercentage: "40.00",
    })
    .returning();
  const [c] = await db
    .insert(projectBudgetCategory)
    .values({
      projectBudgetId: b.id,
      expenseCategoryId: category.id,
      ratioPercentage: "0.5000",
      allocatedAmount: "15000.00",
      actualAmount: "0.00",
      remainingAmount: "15000.00",
    })
    .returning();
  const [v] = await db
    .insert(vendor)
    .values({ name: `${prefix} pemasok ${randomUUID()}`, phone: "000000", isActive: true })
    .returning();
  const bill = await db.transaction((tx) =>
    createVendorBillTx(tx, {
      vendorId: v.id,
      projectId: p.id,
      projectBudgetCategoryId: c.id,
      billNumber: `${prefix}-${randomUUID()}`,
      amount: 10000,
      dueDate: new Date("2026-10-20T00:00:00Z"),
      notes: "Invoice pemasok awal",
      requestedById: owner.id,
    }),
  );
  const [m] = await db
    .insert(materialMaster)
    .values({
      name: `${prefix} panel ${randomUUID()}`,
      categoryId: materialCategoryId,
      unit: "lembar",
    })
    .returning();
  const [l] = await db
    .insert(inventoryLocation)
    .values({ name: `${prefix} gudang ${randomUUID()}` })
    .returning();
  return { billId: bill.id, projectId: p.id, categoryId: c.id, materialId: m.id, locationId: l.id };
}
function input(id: string, patch: VendorBillCorrectionInput["patch"]): VendorBillCorrectionInput {
  return vendorBillCorrectionInputSchema.parse({
    action: "VENDOR_BILL_CORRECT",
    vendorBillId: id,
    patch,
    reason: "Koreksi mengikuti invoice pemasok terbaru",
  });
}
async function proof(
  i: VendorBillCorrectionInput,
): Promise<{ conversationId: string; toolCallId: string }> {
  const a = await actor(),
    proposal = await prepareProcurementWarehouseProposal(a, i),
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
        type: "tool-proposeVendorBillCorrection",
        state: "output-available",
        toolCallId,
        output: { proposal },
      },
    ],
  });
  return { conversationId: c.id, toolCallId };
}
const save = withTestRequest(confirmAiProcurementWarehouseProposal),
  read = withTestRequest(getAiProcurementWarehouseProposal),
  manual = withTestRequest(correctVendorBill);
async function bill(id: string): Promise<typeof vendorBill.$inferSelect> {
  const b = await db.query.vendorBill.findFirst({ where: eq(vendorBill.id, id) });
  if (!b) throw new Error("Missing bill");
  return b;
}
async function cashCount(): Promise<number> {
  return (await db.select({ n: count() }).from(cashTransaction))[0].n;
}
async function pay(
  f: Awaited<ReturnType<typeof fixture>>,
  amount: string,
  status = "COMPLETED",
): Promise<void> {
  await db.insert(vendorPayment).values({
    vendorBillId: f.billId,
    bankAccountId: bankId,
    amountPaid: amount,
    status,
    paymentDate: new Date("2026-10-12T00:00:00Z"),
    paidById: owner.id,
  });
}
describeIntegration("stored vendor bill correction workflow", () => {
  beforeAll(async () => {
    owner = await person("GLOBAL");
    assigned = await person("ASSIGNED");
    none = await person("NONE");
    as(owner);
    const [c] = await db
      .insert(client)
      .values({ name: prefix, email: `${prefix}@fixture.invalid`, phone: "000000" })
      .returning();
    clientId = c.id;
    const [bank] = await db
      .insert(bankAccount)
      .values({
        name: prefix,
        bankName: "QA",
        holderName: "Synthetic QA",
        accountNumber: randomUUID(),
        balance: "50000.00",
      })
      .returning();
    bankId = bank.id;
    const [mc] = await db.insert(materialCategory).values({ name: prefix }).returning();
    materialCategoryId = mc.id;
  });
  beforeEach(() => as(owner));
  afterAll(() => {
    api.getSession = original;
  });
  test("documentary patch preserves amount and omitted sources; retries consume one identity", async () => {
    const f = await fixture(),
      before = await bill(f.billId),
      cash = await cashCount();
    const identity = await proof(input(f.billId, { dueDate: "2026-10-27", notes: null }));
    expect(ok(await read(identity)).status).toBe("READY");
    const r = ok(await save(identity));
    expect(r.alreadyConfirmed).toBe(false);
    expect(ok(await save(identity)).alreadyConfirmed).toBe(true);
    const next = await bill(f.billId);
    expect(next.amount).toBe(before.amount);
    expect(next.vendorId).toBe(before.vendorId);
    expect(next.projectId).toBe(before.projectId);
    expect(next.projectBudgetCategoryId).toBe(before.projectBudgetCategoryId);
    expect(next.notes).toBeNull();
    expect(next.dueDate.toISOString().slice(0, 10)).toBe("2026-10-27");
    expect(await cashCount()).toBe(cash);
    expect(
      (
        await db.query.aiProposalConfirmation.findMany({
          where: eq(aiProposalConfirmation.documentId, f.billId),
        })
      ).length,
    ).toBe(1);
    expect(
      (
        await db.query.auditLog.findMany({
          where: and(eq(auditLog.targetId, f.billId), eq(auditLog.action, "CORRECT_VENDOR_BILL")),
        })
      ).length,
    ).toBe(1);
  });
  test("amount updates the same non-Material expense and category, while Material remains inventory asset", async () => {
    for (const material of [false, true]) {
      const f = await fixture(material),
        cash = await cashCount();
      const expenses = await db.query.projectExpenses.findMany({
        where: eq(projectExpenses.vendorBillId, f.billId),
      });
      ok(await save(await proof(input(f.billId, { amount: 12000.49 }))));
      const after = await db.query.projectExpenses.findMany({
        where: eq(projectExpenses.vendorBillId, f.billId),
      });
      expect(after.length).toBe(1);
      expect(after[0].id).toBe(expenses[0].id);
      expect(after[0].amount).toBe("12000.49");
      expect(after[0].sourceType).toBe(material ? "INVENTORY_PURCHASE" : "VENDOR_BILL");
      const cat = await db.query.projectBudgetCategory.findFirst({
        where: eq(projectBudgetCategory.id, f.categoryId),
      });
      expect(Number(cat?.actualAmount)).toBe(material ? 0 : 12000.49);
      expect(await cashCount()).toBe(cash);
    }
  });
  test("completed payment and net receipt floors block undercutting; valid partial correction can settle outstanding", async () => {
    const f = await fixture(true);
    await pay(f, "4000.00");
    await db
      .update(vendorBill)
      .set({ status: "PARTIALLY_PAID" })
      .where(eq(vendorBill.id, f.billId));
    await db.insert(stockMovement).values({
      materialId: f.materialId,
      inventoryLocationId: f.locationId,
      projectId: f.projectId,
      vendorBillId: f.billId,
      movementType: "GOODS_RECEIPT",
      movementDirection: "IN",
      quantity: "1.00",
      unitCost: "6000.00",
      createdById: owner.id,
    });
    await expect(
      prepareProcurementWarehouseProposal(await actor(), input(f.billId, { amount: 3500 })),
    ).rejects.toThrow("lebih kecil");
    await expect(
      prepareProcurementWarehouseProposal(await actor(), input(f.billId, { amount: 5000 })),
    ).rejects.toThrow("lebih kecil");
    ok(await save(await proof(input(f.billId, { amount: 7000 }))));
    expect((await bill(f.billId)).status).toBe("PARTIALLY_PAID");
    const g = await fixture();
    await pay(g, "4000.00");
    await db
      .update(vendorBill)
      .set({ status: "PARTIALLY_PAID" })
      .where(eq(vendorBill.id, g.billId));
    ok(await save(await proof(input(g.billId, { amount: 4000 }))));
    expect((await bill(g.billId)).status).toBe("PAID");
  });
  test("active schedules block amount but not documentary correction; PAID and VOID keep protection", async () => {
    const f = await fixture();
    await pay(f, "2000.00", "PENDING");
    await expect(
      prepareProcurementWarehouseProposal(await actor(), input(f.billId, { amount: 12000 })),
    ).rejects.toThrow("jadwal pembayaran aktif");
    ok(await manual(input(f.billId, { notes: "Catatan dokumen yang diperbaiki" })));
    await db.update(vendorBill).set({ status: "PAID" }).where(eq(vendorBill.id, f.billId));
    await expect(
      prepareProcurementWarehouseProposal(await actor(), input(f.billId, { amount: 12000 })),
    ).rejects.toThrow("lunas terkunci");
    ok(await manual(input(f.billId, { dueDate: "2026-10-28" })));
    await db.update(vendorBill).set({ status: "VOID" }).where(eq(vendorBill.id, f.billId));
    expect((await manual(input(f.billId, { notes: null }))).success).toBe(false);
  });
  test("no-op, duplicate numbers and inconsistent accounting sources block only the applicable correction", async () => {
    const f = await fixture(),
      g = await fixture();
    await expect(
      prepareProcurementWarehouseProposal(await actor(), input(f.billId, { amount: 10000 })),
    ).rejects.toThrow("Tidak ada perubahan");
    expect(
      (await manual(input(f.billId, { billNumber: (await bill(g.billId)).billNumber }))).success,
    ).toBe(false);
    await db
      .update(projectExpenses)
      .set({ amount: "9999.00" })
      .where(eq(projectExpenses.vendorBillId, f.billId));
    await expect(
      prepareProcurementWarehouseProposal(await actor(), input(f.billId, { amount: 12000 })),
    ).rejects.toThrow("belum konsisten");
    expect((await manual(input(f.billId, { notes: null }))).success).toBe(true);
    const h = await fixture();
    await db
      .update(vendorBill)
      .set({ status: "PARTIALLY_PAID" })
      .where(eq(vendorBill.id, h.billId));
    await expect(
      prepareProcurementWarehouseProposal(await actor(), input(h.billId, { amount: 12000 })),
    ).rejects.toThrow("Riwayat pembayaran sebagian");
    expect((await manual(input(h.billId, { notes: null }))).success).toBe(true);
  });
  test("actual custom grant works without create rights, NONE and unassigned actors cannot read/write", async () => {
    const f = await fixture(),
      identity = await proof(input(f.billId, { amount: 11000 }));
    as(none);
    expect((await read(identity)).success).toBe(false);
    expect((await manual(input(f.billId, { notes: null }))).success).toBe(false);
    as(assigned);
    ok(await manual(input(f.billId, { notes: "Catatan dari PM yang ditugaskan" })));
    await db.update(project).set({ projectManagerId: owner.id }).where(eq(project.id, f.projectId));
    expect((await manual(input(f.billId, { notes: null }))).success).toBe(false);
    as(owner);
    expect((await read(identity)).success).toBe(true);
    const closedIdentity = await proof(input(f.billId, { notes: null }));
    await db.update(project).set({ status: "COMPLETED" }).where(eq(project.id, f.projectId));
    const closed = await read(closedIdentity);
    expect(closed.success).toBe(false);
    if (!closed.success) expect(closed.error.message).toContain("Proyek sudah terkunci");
    expect((await manual(input(f.billId, { notes: null }))).success).toBe(false);
  });
  test("ownership, live revocation, changed sources and schedule races invalidate immutable proofs", async () => {
    const f = await fixture(),
      i = await proof(input(f.billId, { amount: 12000 }));
    as(assigned);
    expect((await read(i)).success).toBe(false);
    as(owner);
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, owner.roleId),
          eq(rolePermission.permissionKey, "update:vendor_bill"),
        ),
      );
    expect((await save(i)).success).toBe(false);
    await db
      .insert(rolePermission)
      .values({ roleId: owner.roleId, permissionKey: "update:vendor_bill" });
    await pay(f, "1000.00", "PENDING");
    const blocked = await read(i);
    expect(blocked.success).toBe(false);
    if (!blocked.success) expect(blocked.error.message).toContain("jadwal pembayaran aktif");
    expect((await save(i)).success).toBe(false);
    expect((await bill(f.billId)).amount).toBe("10000.00");
    const g = await fixture(),
      j = await proof(input(g.billId, { notes: null }));
    ok(await manual(input(g.billId, { dueDate: "2026-10-24" })));
    expect(ok(await read(j)).status).toBe("STALE");
  });
  test("a failed final writer step rolls back amount/budget/audit/receipt; concurrent retry writes once", async () => {
    const f = await fixture(),
      i = await proof(input(f.billId, { amount: 12000 })),
      native = writer.correctVendorBillTx;
    const fault = spyOn(writer, "correctVendorBillTx").mockImplementation(async (tx, a, p) => {
      await native(tx, a, p);
      throw new Error("Injected after final write");
    });
    try {
      expect((await save(i)).success).toBe(false);
      expect((await bill(f.billId)).amount).toBe("10000.00");
      expect(
        (
          await db.query.auditLog.findMany({
            where: and(eq(auditLog.targetId, f.billId), eq(auditLog.action, "CORRECT_VENDOR_BILL")),
          })
        ).length,
      ).toBe(0);
    } finally {
      fault.mockRestore();
    }
    const results = await Promise.all([save(i), save(i)]);
    expect(results.every((r) => r.success)).toBe(true);
    expect(
      (
        await db.query.aiProposalConfirmation.findMany({
          where: eq(aiProposalConfirmation.documentId, f.billId),
        })
      ).length,
    ).toBe(1);
    expect((await bill(f.billId)).amount).toBe("12000.00");
  });
  test("lookup searches one character, pages20, provides actual fields/blockers and refuses another project", async () => {
    const f = await fixture();
    for (let i = 0; i < 21; i++) {
      const current = await bill(f.billId);
      await db.insert(vendorBill).values({
        ...current,
        id: randomUUID(),
        billNumber: `${prefix}-lookup-${String(i).padStart(2, "0")}`,
      });
    }
    const a = await actor(),
      tool = buildVendorBillCorrectionTools(a).getVendorBillCorrectionContext;
    const execute = tool.execute;
    if (!execute) throw new Error("No tool execute");
    const options = { toolCallId: randomUUID(), messages: [], context: undefined };
    const raw: unknown = await withTestRequest(() =>
      execute({ billQuery: prefix[0], offset: 0 }, options),
    )();
    const page = raw as { items: unknown[]; hasMore: boolean; nextOffset: number };
    expect(page.items.length).toBe(20);
    expect(page.hasMore).toBe(true);
    expect(page.nextOffset).toBe(20);
    const detail: unknown = await withTestRequest(() =>
      execute({ vendorBillId: f.billId, projectId: randomUUID(), offset: 0 }, options),
    )();
    expect(JSON.stringify(detail)).toContain("tidak sesuai proyek");
  });
});
