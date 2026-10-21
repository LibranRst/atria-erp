import { beforeAll, beforeEach, afterAll, expect, test, spyOn } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq, count } from "drizzle-orm";
import { db } from "@backend/db";
import {
  role,
  rolePermission,
  user,
  client,
  project,
  vendor,
  bankAccount,
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
  vendorBill,
  vendorPayment,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  cashTransaction,
  stockMovement,
  auditLog,
  appConfig,
  tenant,
} from "@backend/db/schema";
import * as paymentWriter from "@backend/server/usecases/finance/pay-vendor-bill";
import { auth } from "@backend/lib/auth";
import { resolveActor, type Actor } from "@backend/server/actor";
import { withTestRequest } from "@backend/lib/testing/request";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { prepareVendorPaymentWorkflow } from "@backend/server/usecases/ai/vendor-payment-context";
import { scheduleVendorBillPayment } from "@backend/app/actions/finance/schedule-vendor-bill";
import { approveVendorPayment } from "@backend/app/actions/finance/field-request-review";
import {
  confirmAiVendorPaymentWorkflowProposal,
  getAiVendorPaymentWorkflowProposal,
} from "./vendor-payment-workflow";
import {
  vendorPaymentWorkflowInputSchema,
  type VendorPaymentWorkflowInput,
} from "@atria/core/ai/vendor-payment-workflow";
import { APPROVAL_THRESHOLD_CONFIG_KEYS } from "@atria/core/finance/approval-thresholds";
import type { PermissionKey, RoleDataScope } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
const prefix = `VP-${randomUUID().slice(0, 8)}`;
const grants: PermissionKey[] = [
  "use:ai_chat",
  "view:project",
  "view:vendor_bill",
  "view:bank_account",
  "view:budget",
  "pay:vendor_bill",
  "approve:cost",
];
type Person = typeof user.$inferSelect;
const api = auth.api as unknown as { getSession: unknown },
  original = api.getSession;
let maker: Person,
  checker: Person,
  assigned: Person,
  none: Person,
  noPay: Person,
  billId: string,
  bankId: string,
  projectId: string,
  categoryId: string;
function as(person: Person): void {
  api.getSession = async () => ({
    user: person,
    session: { id: randomUUID(), userId: person.id, expiresAt: new Date(Date.now() + 3600000) },
  });
}
function ok<T>(r: ActionResponse<T>): T {
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}
async function actor(): Promise<Actor> {
  const a = await withTestRequest(resolveActor)();
  if (!a) throw new Error("No Actor");
  return a;
}
async function person(
  scope: RoleDataScope,
  permissions: readonly PermissionKey[] = grants,
): Promise<Person> {
  const [r] = await db
    .insert(role)
    .values({ name: prefix + randomUUID(), dataScope: scope })
    .returning();
  await db
    .insert(rolePermission)
    .values(permissions.map((permissionKey) => ({ roleId: r.id, permissionKey })));
  return (
    await db
      .insert(user)
      .values({
        name: r.name,
        email: randomUUID() + "@fixture.invalid",
        roleId: r.id,
        isActive: true,
        mustChangePassword: false,
      })
      .returning()
  )[0];
}
async function proof(raw: VendorPaymentWorkflowInput) {
  const proposal = await prepareVendorPaymentWorkflow(
    await actor(),
    vendorPaymentWorkflowInputSchema.parse(raw),
  );
  const [c] = await db
    .insert(aiConversation)
    .values({ userId: (await actor()).userId, title: prefix })
    .returning();
  const toolCallId = randomUUID();
  const tool = {
    SCHEDULE: "proposeVendorPaymentSchedule",
    APPROVE: "proposeVendorPaymentDecision",
    REJECT: "proposeVendorPaymentDecision",
    PAY: "proposeVendorBillPayment",
  }[proposal.input.action];
  const [m] = await db
    .insert(aiMessage)
    .values({
      conversationId: c.id,
      role: "assistant",
      parts: [
        { type: `tool-${tool}`, toolCallId, state: "output-available", output: { proposal } },
      ],
    })
    .returning();
  return { proposal, identity: { conversationId: c.id, toolCallId }, messageId: m.id };
}
const save = withTestRequest(confirmAiVendorPaymentWorkflowProposal),
  read = withTestRequest(getAiVendorPaymentWorkflowProposal),
  manualSchedule = withTestRequest(scheduleVendorBillPayment),
  manualDecision = withTestRequest(approveVendorPayment);
const schedule = (amount = 6000000): VendorPaymentWorkflowInput => ({
  action: "SCHEDULE",
  vendorBillId: billId,
  bankAccountId: bankId,
  amount,
  paymentDate: "2026-10-31",
});
const decide = (
  id: string,
  action: "APPROVE" | "REJECT" = "APPROVE",
): VendorPaymentWorkflowInput => ({
  action,
  vendorPaymentId: id,
  notes: "Dokumen dan nominal telah diverifikasi.",
});
const pay = (id: string, referenceNumber = prefix + randomUUID()): VendorPaymentWorkflowInput => ({
  action: "PAY",
  vendorPaymentId: id,
  bankAccountId: bankId,
  referenceNumber,
});
async function counts(): Promise<readonly number[]> {
  return Promise.all(
    [cashTransaction, stockMovement, aiProposalConfirmation].map(async (t) =>
      Number((await db.select({ n: count() }).from(t))[0].n),
    ),
  );
}
describeIntegration("AI vendor payment workflow", () => {
  beforeAll(async () => {
    maker = await person("GLOBAL");
    checker = await person("GLOBAL");
    assigned = await person("ASSIGNED");
    none = await person("NONE");
    noPay = await person(
      "GLOBAL",
      grants.filter((p) => p !== "pay:vendor_bill"),
    );
  });
  beforeEach(async () => {
    as(maker);
    await db
      .insert(appConfig)
      .values({ key: APPROVAL_THRESHOLD_CONFIG_KEYS.vendorPayment, value: "500000000" })
      .onConflictDoUpdate({
        target: [appConfig.tenantId, appConfig.key],
        set: { value: "500000000" },
      });
    const c = (
      await db
        .insert(client)
        .values({ name: prefix, phone: "08123456789", email: randomUUID() + "@fixture.invalid" })
        .returning()
    )[0];
    const p = (
      await db
        .insert(project)
        .values({
          name: prefix,
          clientId: c.id,
          projectManagerId: assigned.id,
          totalContractValue: "100000000",
          status: "ACTIVE",
        })
        .returning()
    )[0];
    projectId = p.id;
    const budget = (
      await db
        .insert(projectBudgets)
        .values({
          projectId,
          contractValue: "100000000",
          internalBudget: "90000000",
          status: "ACTIVE",
        })
        .returning()
    )[0];
    const category = await db.query.expenseCategory.findFirst({
      where: eq(expenseCategory.code, "SUBCON"),
    });
    if (!category) throw new Error("seed category missing");
    categoryId = (
      await db
        .insert(projectBudgetCategory)
        .values({
          projectBudgetId: budget.id,
          expenseCategoryId: category.id,
          allocatedAmount: "50000000",
          remainingAmount: "50000000",
        })
        .returning()
    )[0].id;
    const v = (
      await db
        .insert(vendor)
        .values({ name: prefix, phone: "08123456789", email: randomUUID() + "@fixture.invalid" })
        .returning()
    )[0];
    billId = (
      await db
        .insert(vendorBill)
        .values({
          vendorId: v.id,
          projectId,
          projectBudgetCategoryId: categoryId,
          billNumber: prefix + randomUUID(),
          amount: "20000000",
          status: "UNPAID",
          dueDate: new Date("2026-10-31"),
        })
        .returning()
    )[0].id;
    bankId = (
      await db
        .insert(bankAccount)
        .values({
          name: prefix,
          bankName: "BCA",
          holderName: prefix,
          accountNumber: randomUUID(),
          balance: "30000000",
          isActive: true,
        })
        .returning()
    )[0].id;
  });
  afterAll(() => {
    api.getSession = original;
  });
  test("schedule and independent approval do not change cash or stock; payment records one partial outflow and replay", async () => {
    const before = await counts(),
      s = await proof(schedule()),
      paymentId = ok(await save(s.identity)).resultId;
    expect((await counts()).slice(0, 2)).toEqual(before.slice(0, 2));
    expect(
      (await db.query.vendorPayment.findFirst({ where: eq(vendorPayment.id, paymentId) }))
        ?.requiresOwnerApproval,
    ).toBe(true);
    await expect(proof(decide(paymentId))).rejects.toThrow("Pembuat jadwal");
    await expect(proof(pay(paymentId))).rejects.toThrow("persetujuan");
    as(checker);
    const d = await proof(decide(paymentId));
    ok(await save(d.identity));
    expect((await counts()).slice(0, 2)).toEqual(before.slice(0, 2));
    as(maker);
    const payment = await proof(pay(paymentId));
    const [a, b] = await Promise.all([save(payment.identity), save(payment.identity)]);
    expect(a.success && b.success).toBe(true);
    expect(ok(await read(payment.identity)).status).toBe("CONFIRMED");
    expect(
      (await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, bankId) }))?.balance,
    ).toBe("24000000.00");
    expect(
      (await db.query.vendorBill.findFirst({ where: eq(vendorBill.id, billId) }))?.status,
    ).toBe("PARTIALLY_PAID");
    expect((await counts())[0]).toBe(before[0] + 1);
    expect((await counts())[1]).toBe(before[1]);
    expect(
      await db.query.auditLog.findFirst({
        where: and(eq(auditLog.targetId, paymentId), eq(auditLog.action, "PAY_VENDOR_BILL")),
      }),
    ).toBeDefined();
  });
  test("small schedules need no approval; current budget overrun and tightened Settings still require it", async () => {
    let p = await proof(schedule(1000000));
    expect(p.proposal.facts.find((f) => f.label === "Persetujuan")?.value).toContain(
      "Tidak diperlukan",
    );
    const id = ok(await save(p.identity)).resultId;
    await db
      .update(appConfig)
      .set({ value: "100" })
      .where(eq(appConfig.key, APPROVAL_THRESHOLD_CONFIG_KEYS.vendorPayment));
    await expect(proof(pay(id))).rejects.toThrow("persetujuan");
    await db
      .update(projectBudgetCategory)
      .set({ actualAmount: "60000000" })
      .where(eq(projectBudgetCategory.id, categoryId));
    p = await proof(schedule(100));
    expect(p.proposal.facts.find((f) => f.label === "Persetujuan")?.value).toContain("Menunggu");
  });
  test("reject releases scheduled amount, has independent receipt, and cannot later be paid or overwritten", async () => {
    const id = ok(await save((await proof(schedule())).identity)).resultId;
    as(checker);
    const reject = await proof(decide(id, "REJECT"));
    ok(await save(reject.identity));
    expect(
      (await db.query.vendorPayment.findFirst({ where: eq(vendorPayment.id, id) }))?.status,
    ).toBe("FAILED");
    expect((await manualDecision(id, "Late change", "APPROVED")).success).toBe(false);
    as(maker);
    await expect(proof(pay(id))).rejects.toThrow("ditolak");
    expect(
      (await proof(schedule(20000000))).proposal.facts.find((f) => f.label === "Belum dijadwalkan")
        ?.value,
    ).toBe(20000000);
  });
  test("AI/manual scheduling serialize outstanding limits and processing commitments", async () => {
    const p = await proof(schedule(12000000));
    const results = await Promise.all([
      save(p.identity),
      manualSchedule({
        vendorBillId: billId,
        bankAccountId: bankId,
        amountPaid: 12000000,
        paymentDate: new Date("2026-10-31"),
      }),
    ]);
    expect(results.filter((r) => r.success).length).toBe(1);
    const payments = await db.query.vendorPayment.findMany({
      where: eq(vendorPayment.vendorBillId, billId),
    });
    expect(payments).toHaveLength(1);
    await db
      .update(vendorPayment)
      .set({ status: "PROCESSING" })
      .where(eq(vendorPayment.id, payments[0].id));
    await expect(proof(schedule(9000000))).rejects.toThrow("sisa tagihan");
  });
  test("ownership, current permissions and project assignment are rechecked", async () => {
    const p = await proof(schedule());
    as(checker);
    expect((await save(p.identity)).success).toBe(false);
    as(none);
    await expect(proof(schedule())).rejects.toThrow("Akses");
    as(noPay);
    await expect(proof(schedule())).rejects.toThrow("Akses");
    as(assigned);
    const scoped = await proof(schedule(100));
    await db.update(project).set({ projectManagerId: checker.id }).where(eq(project.id, projectId));
    expect((await save(scoped.identity)).success).toBe(false);
    as(maker);
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, maker.roleId),
          eq(rolePermission.permissionKey, "pay:vendor_bill"),
        ),
      );
    expect((await save(p.identity)).success).toBe(false);
    await db
      .insert(rolePermission)
      .values({ roleId: maker.roleId, permissionKey: "pay:vendor_bill" });
  });
  test("foreign tenant bank/bill, inactive accounts and stale source cannot write", async () => {
    const p = await proof(schedule());
    await db.update(bankAccount).set({ isActive: false }).where(eq(bankAccount.id, bankId));
    expect(ok(await read(p.identity)).status).toBe("STALE");
    expect((await save(p.identity)).success).toBe(false);
    const t = (await db.insert(tenant).values({ name: prefix, slug: randomUUID() }).returning())[0];
    await db
      .update(bankAccount)
      .set({ tenantId: t.id, isActive: true })
      .where(eq(bankAccount.id, bankId));
    await expect(proof(schedule())).rejects.toThrow("Rekening");
    await db.update(vendorBill).set({ tenantId: t.id }).where(eq(vendorBill.id, billId));
    await expect(proof(schedule())).rejects.toThrow("akses");
  });
  test("expiry and client tampering are blocked without any record or receipt", async () => {
    const p = await proof(schedule()),
      before = await counts();
    expect((await save({ ...p.identity, amount: 1 })).success).toBe(false);
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, p.messageId));
    expect(ok(await read(p.identity)).status).toBe("EXPIRED");
    expect((await save(p.identity)).success).toBe(false);
    expect(await counts()).toEqual(before);
  });
  test("bank balance/reference changes invalidate payment and duplicate references are rejected", async () => {
    const id = ok(await save((await proof(schedule(100))).identity)).resultId,
      p = await proof(pay(id, "BANK-EXACT"));
    await db.update(bankAccount).set({ balance: "1" }).where(eq(bankAccount.id, bankId));
    expect((await save(p.identity)).success).toBe(false);
    await expect(proof(pay(id))).rejects.toThrow("Saldo");
    await db.update(bankAccount).set({ balance: "1000" }).where(eq(bankAccount.id, bankId));
    ok(await save((await proof(pay(id, "BANK-EXACT"))).identity));
    const next = ok(await save((await proof(schedule(100))).identity)).resultId;
    await expect(proof(pay(next, "BANK-EXACT"))).rejects.toThrow("referensi");
  });
  test("post-write failure rolls back actual ledger/payment/audit writes", async () => {
    const id = ok(await save((await proof(schedule(100))).identity)).resultId,
      p = await proof(pay(id)),
      before = await counts();
    const originalWriter = paymentWriter.payVendorBillTx;
    const injected = spyOn(paymentWriter, "payVendorBillTx").mockImplementation(
      async (tx, a, input) => {
        await originalWriter(tx, a, input);
        throw new Error("injected post-write failure");
      },
    );
    try {
      expect((await save(p.identity)).success).toBe(false);
    } finally {
      injected.mockRestore();
    }
    expect(await counts()).toEqual(before);
    expect(
      (await db.query.vendorPayment.findFirst({ where: eq(vendorPayment.id, id) }))?.status,
    ).toBe("PENDING");
    expect(
      (await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, bankId) }))?.balance,
    ).toBe("30000000.00");
  });
});
