/** Authentic proofs for the named disposable Browser database only. */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import {
  user,
  rolePermission,
  client,
  project,
  vendor,
  bankAccount,
  vendorPayment,
  expenseCategory,
  projectBudgets,
  projectBudgetCategory,
  aiConversation,
  aiMessage,
} from "../src/backend/db/schema";
import { getRoleAccess } from "../src/backend/lib/auth/role-access";
import { createVendorBillTx } from "../src/backend/lib/finance/vendor-bill-write";
import { correctVendorBillTx } from "../src/backend/server/usecases/finance/vendor-bill-correction-writer";
import { prepareProcurementWarehouseProposal } from "../src/backend/server/usecases/ai/procurement-warehouse-context";
import type { Actor } from "../src/backend/server/actor";
import type { PermissionKey } from "@atria/core/auth/permissions";
import {
  vendorBillCorrectionInputSchema,
  type VendorBillCorrectionInput,
  type ProcurementWarehouseProposal,
} from "@atria/core/ai/procurement-warehouse";
const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.protocol !== "postgresql:" ||
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Only named disposable Browser database is allowed.");
const qa = await db.query.user.findFirst({
  where: eq(user.email, "reconciliation-qa@fixture.invalid"),
});
if (!qa?.roleId) throw new Error("Synthetic QA actor missing");
const permissions: readonly PermissionKey[] = [
  "use:ai_chat",
  "view:vendor_bill",
  "update:vendor_bill",
  "view:budget",
  "view:project",
];
await db
  .insert(rolePermission)
  .values(permissions.map((permissionKey) => ({ roleId: qa.roleId!, permissionKey })))
  .onConflictDoNothing();
const access = await getRoleAccess(qa.roleId);
if (!access) throw new Error("QA role missing");
const actor: Actor = {
  userId: qa.id,
  roleId: qa.roleId,
  roleName: access.roleName,
  name: qa.name,
  email: qa.email,
  isActive: true,
  mustChangePassword: false,
  sessionId: randomUUID(),
  permissions: access.permissions,
  dataScope: access.dataScope,
  developerActorUserId: null,
};
const prefix = randomUUID().slice(0, 8);
const [cl] = await db
  .insert(client)
  .values({
    name: "Klien QA · Koreksi tagihan",
    phone: "000000",
    email: `bill-${prefix}@fixture.invalid`,
  })
  .returning();
const [supplier] = await db
  .insert(vendor)
  .values({ name: "Pemasok QA · data sintetis", phone: "000000" })
  .returning();
const [bank] = await db
  .insert(bankAccount)
  .values({
    name: `Rekening QA · jadwal koreksi · ${prefix}`,
    bankName: "QA",
    holderName: "Synthetic QA",
    accountNumber: `QA-${prefix}`,
    balance: "0.00",
  })
  .returning();
async function fixture(label: string, material: boolean): Promise<string> {
  let category = await db.query.expenseCategory.findFirst({
    where: eq(expenseCategory.code, material ? "MATERIAL" : "OPERASIONAL"),
  });
  if (!category) {
    await db
      .insert(expenseCategory)
      .values({
        code: material ? "MATERIAL" : "OPERASIONAL",
        name: material ? "Material" : "Operasional",
        sortOrder: material ? 0 : 2,
      })
      .onConflictDoNothing();
    category = await db.query.expenseCategory.findFirst({
      where: eq(expenseCategory.code, material ? "MATERIAL" : "OPERASIONAL"),
    });
  }
  if (!category) throw new Error("Canonical QA category missing");
  const [proj] = await db
    .insert(project)
    .values({
      name: `Proyek QA · ${label}`,
      clientId: cl.id,
      status: "ACTIVE",
      totalContractValue: "20000000.00",
    })
    .returning();
  const [budget] = await db
    .insert(projectBudgets)
    .values({
      projectId: proj.id,
      contractValue: "20000000.00",
      internalBudget: "16000000.00",
      budgetCapRatio: "0.8000",
      targetGrossPercentage: "20.00",
    })
    .returning();
  const [c] = await db
    .insert(projectBudgetCategory)
    .values({
      projectBudgetId: budget.id,
      expenseCategoryId: category.id,
      ratioPercentage: "0.3125",
      allocatedAmount: "5000000.00",
      actualAmount: "0.00",
      remainingAmount: "5000000.00",
    })
    .returning();
  return (
    await db.transaction((tx) =>
      createVendorBillTx(tx, {
        vendorId: supplier.id,
        projectId: proj.id,
        projectBudgetCategoryId: c.id,
        billNumber: `INV-QA-${label.replaceAll(" ", "-")}-${prefix}`,
        amount: 2000000,
        dueDate: new Date("2026-10-20T00:00:00Z"),
        notes: "Invoice asli pemasok · data sintetis",
        requestedById: qa!.id,
      }),
    )
  ).id;
}
const cases: {
  label: string;
  billId: string;
  patch: VendorBillCorrectionInput["patch"];
  blocked?: boolean;
  stale?: boolean;
}[] = [
  {
    label: "Dokumen",
    billId: await fixture("Dokumen", false),
    patch: { dueDate: "2026-10-27", notes: "Pengiriman tahap pertama dikonfirmasi pemasok" },
  },
  {
    label: "Nominal Material",
    billId: await fixture("Nominal Material", true),
    patch: { amount: 2400000 },
  },
  {
    label: "Koreksi lengkap",
    billId: await fixture("Koreksi lengkap", false),
    patch: {
      amount: 7500000,
      billNumber: `INV-QA-REVISI-${prefix}`,
      dueDate: "2026-10-29",
      notes: "Tambahan lingkup operasional sesuai invoice revisi pemasok",
    },
  },
  {
    label: "Jadwal aktif",
    billId: await fixture("Jadwal aktif", false),
    patch: { amount: 3000000 },
    blocked: true,
  },
  {
    label: "Sumber berubah",
    billId: await fixture("Sumber berubah", false),
    patch: { notes: "Catatan usulan yang belum disimpan" },
    stale: true,
  },
];
const proposals: ProcurementWarehouseProposal[] = [];
for (const c of cases) {
  const input = vendorBillCorrectionInputSchema.parse({
    action: "VENDOR_BILL_CORRECT",
    vendorBillId: c.billId,
    patch: c.patch,
    reason: "Koreksi sesuai invoice revisi pemasok yang diperiksa",
  });
  proposals.push(await prepareProcurementWarehouseProposal(actor, input));
  if (c.blocked)
    await db.insert(vendorPayment).values({
      vendorBillId: c.billId,
      bankAccountId: bank.id,
      amountPaid: "1000000.00",
      status: "PENDING",
      paymentDate: new Date("2026-10-22T00:00:00Z"),
      paidById: qa.id,
    });
  if (c.stale)
    await db.transaction((tx) =>
      correctVendorBillTx(
        tx,
        actor,
        vendorBillCorrectionInputSchema.parse({
          action: "VENDOR_BILL_CORRECT",
          vendorBillId: c.billId,
          patch: { dueDate: "2026-10-25" },
          reason: "Koreksi manual setelah preview untuk uji stale",
        }),
      ),
    );
}
const [conversation] = await db
  .insert(aiConversation)
  .values({ userId: qa.id, title: "QA koreksi tagihan vendor · database disposable" })
  .returning();
await db.insert(aiMessage).values({
  conversationId: conversation.id,
  role: "user",
  parts: [
    {
      type: "text",
      text: "Contoh QA koreksi tagihan tersimpan: dokumen, nominal Material, koreksi lengkap dan budget, jadwal pembayaran aktif, serta sumber berubah. Seluruh data sintetis untuk database disposable.",
    },
  ],
});
await db.insert(aiMessage).values({
  conversationId: conversation.id,
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Lima contoh memakai proof tersimpan dan API nyata. Kas, stok, pembayaran dan sumber proyek tetap terlindungi; ini data sintetis untuk uji UI dan transaksi.",
    },
    ...proposals.map((proposal) => ({
      type: "tool-proposeVendorBillCorrection",
      toolCallId: randomUUID(),
      state: "output-available",
      output: { proposal },
    })),
  ],
});
console.log({
  conversationId: conversation.id,
  prefix,
  cases: cases.map((c) => ({ label: c.label, billId: c.billId })),
  proposals: proposals.length,
});
await pool.end();
