import { createHash } from "node:crypto";
import { and, eq, asc, inArray } from "drizzle-orm";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  vendorBill,
  vendor,
  project,
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
  vendorPayment,
  bankAccount,
  approval,
  cashTransaction,
} from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import { readApprovalThresholds } from "@backend/lib/finance/approval-thresholds";
import { parseNumericToCents } from "@backend/lib/finance/balance-mutation";
import { vendorPaymentRequiresOwnerApproval } from "@atria/core/finance/vendor-payment-rules";
import {
  vendorPaymentWorkflowInputSchema,
  vendorPaymentWorkflowPermission,
  vendorPaymentWorkflowProposalSchema,
  VENDOR_PAYMENT_WORKFLOW_KIND,
  type VendorPaymentWorkflowInput,
  type VendorPaymentWorkflowProposal,
} from "@atria/core/ai/vendor-payment-workflow";
import { FinanceInputError } from "./finance-input-context";
export type VendorPaymentContext = {
  readonly bill: typeof vendorBill.$inferSelect & {
    vendor: typeof vendor.$inferSelect;
    project: typeof project.$inferSelect;
    budgetCategory: typeof projectBudgetCategory.$inferSelect & {
      expenseCategory: typeof expenseCategory.$inferSelect;
      budget: typeof projectBudgets.$inferSelect;
    };
  };
  readonly payments: (typeof vendorPayment.$inferSelect)[];
  readonly decisions: (typeof approval.$inferSelect)[];
  readonly accounts: (typeof bankAccount.$inferSelect)[];
  readonly threshold: bigint;
  readonly committed: bigint;
  readonly paid: bigint;
};
type Viewer = Pick<Actor, "userId" | "permissions" | "dataScope">;
type Reader = Pick<FinanceTransaction, "query" | "select">;
export function assertVendorWorkflowRights(
  actor: Viewer,
  input?: VendorPaymentWorkflowInput,
): void {
  if (
    !actorCan(actor, "use:ai_chat") ||
    !actorCan(actor, "view:vendor_bill") ||
    !actorCan(actor, "view:project") ||
    actor.dataScope === "NONE" ||
    (input && !actorCan(actor, vendorPaymentWorkflowPermission(input))) ||
    (input && ["SCHEDULE", "PAY"].includes(input.action) && !actorCan(actor, "view:bank_account"))
  )
    throw new FinanceInputError(
      "FORBIDDEN",
      "Akses tagihan, proyek atau tindakan pembayaran tidak tersedia.",
    );
}
export async function readVendorPaymentContext(
  actor: Viewer,
  vendorBillId: string,
  connection: Reader = db,
): Promise<VendorPaymentContext> {
  assertVendorWorkflowRights(actor);
  const bill = await connection.query.vendorBill.findFirst({
    where: and(eq(vendorBill.id, vendorBillId), eq(vendorBill.tenantId, INSTANCE_TENANT_ID)),
    with: {
      vendor: true,
      project: true,
      budgetCategory: { with: { expenseCategory: true, budget: true } },
    },
  });
  if (
    !bill ||
    bill.project.tenantId !== INSTANCE_TENANT_ID ||
    bill.vendor.tenantId !== INSTANCE_TENANT_ID ||
    (actor.dataScope === "ASSIGNED" && bill.project.projectManagerId !== actor.userId)
  )
    throw new FinanceInputError(
      "FORBIDDEN",
      "Tagihan tidak ditemukan atau proyek di luar akses Anda.",
    );
  const payments = await connection.query.vendorPayment.findMany({
    where: eq(vendorPayment.vendorBillId, bill.id),
    orderBy: [asc(vendorPayment.createdAt), asc(vendorPayment.id)],
  });
  const decisions = await connection.query.approval.findMany({
    where: and(
      eq(approval.referenceType, "vendor_payment"),
      eq(approval.tenantId, INSTANCE_TENANT_ID),
      inArray(
        approval.referenceId,
        payments.length ? payments.map((p) => p.id) : ["00000000-0000-0000-0000-000000000000"],
      ),
    ),
    orderBy: [asc(approval.id)],
  });
  const accounts = actorCan(actor, "view:bank_account")
    ? await connection.query.bankAccount.findMany({
        where: and(eq(bankAccount.tenantId, INSTANCE_TENANT_ID), eq(bankAccount.isActive, true)),
        orderBy: [asc(bankAccount.name), asc(bankAccount.id)],
      })
    : [];
  const threshold = (await readApprovalThresholds(connection)).vendorPaymentCents;
  const committed = payments
    .filter((p) => ["PENDING", "PROCESSING", "COMPLETED"].includes(p.status))
    .reduce((sum, p) => sum + parseNumericToCents(p.amountPaid), 0n);
  const paid = payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + parseNumericToCents(p.amountPaid), 0n);
  return {
    bill,
    payments,
    decisions: decisions.filter((a) => payments.some((p) => p.id === a.referenceId)),
    accounts,
    threshold,
    committed,
    paid,
  };
}
export async function prepareVendorPaymentWorkflow(
  actor: Viewer,
  raw: VendorPaymentWorkflowInput,
  connection: Reader = db,
): Promise<VendorPaymentWorkflowProposal> {
  const input = vendorPaymentWorkflowInputSchema.parse(raw);
  assertVendorWorkflowRights(actor, input);
  const payment =
    input.action !== "SCHEDULE"
      ? await connection.query.vendorPayment.findFirst({
          where: and(
            eq(vendorPayment.id, input.vendorPaymentId),
            eq(vendorPayment.tenantId, INSTANCE_TENANT_ID),
          ),
        })
      : null;
  if (input.action !== "SCHEDULE" && !payment)
    throw new FinanceInputError("NOT_FOUND", "Jadwal pembayaran tidak tersedia.");
  const context = await readVendorPaymentContext(
    actor,
    input.action === "SCHEDULE" ? input.vendorBillId : payment!.vendorBillId,
    connection,
  );
  const { bill } = context;
  if (bill.project.status !== "ACTIVE")
    throw new FinanceInputError("CONFLICT", "Pembayaran hanya tersedia untuk proyek aktif.");
  if (["PAID", "VOID"].includes(bill.status))
    throw new FinanceInputError("CONFLICT", "Tagihan sudah lunas atau dibatalkan.");
  const amount = input.action === "SCHEDULE" ? input.amount : Number(payment!.amountPaid),
    category = bill.budgetCategory;
  if (
    !category ||
    category.tenantId !== INSTANCE_TENANT_ID ||
    category.budget.projectId !== bill.projectId ||
    category.expenseCategory.tenantId !== INSTANCE_TENANT_ID
  )
    throw new FinanceInputError("CONFLICT", "Kategori budget tagihan tidak tersedia.");
  const required =
    (payment?.requiresOwnerApproval ?? false) ||
    vendorPaymentRequiresOwnerApproval({
      amountCents: parseNumericToCents(amount.toFixed(2)),
      categoryAllocatedCents: parseNumericToCents(category.allocatedAmount),
      categoryActualCents: parseNumericToCents(category.actualAmount),
      ownerApprovalThresholdCents: context.threshold,
    });
  const decision = payment ? context.decisions.find((a) => a.referenceId === payment.id) : null;
  if (payment && payment.status !== "PENDING")
    throw new FinanceInputError("CONFLICT", "Jadwal telah selesai, ditolak atau sedang diproses.");
  if (
    input.action === "SCHEDULE" &&
    parseNumericToCents(amount.toFixed(2)) + context.committed > parseNumericToCents(bill.amount)
  )
    throw new FinanceInputError(
      "CONFLICT",
      "Nominal melebihi sisa tagihan yang belum dijadwalkan.",
    );
  if (input.action === "APPROVE" || input.action === "REJECT") {
    if (!decision || decision.status !== "PENDING")
      throw new FinanceInputError("CONFLICT", "Tidak ada persetujuan tertunda untuk jadwal ini.");
    if (input.action === "APPROVE" && payment?.paidById === actor.userId)
      throw new FinanceInputError(
        "FORBIDDEN",
        "Pembuat jadwal tidak dapat menyetujui sendiri. Gunakan pemeriksa lain; emergency override hanya melalui alur manual.",
      );
  }
  const account =
    input.action === "SCHEDULE" || input.action === "PAY"
      ? context.accounts.find((a) => a.id === input.bankAccountId)
      : (context.accounts.find((a) => a.id === payment?.bankAccountId) ?? null);
  if ((input.action === "SCHEDULE" || input.action === "PAY") && !account)
    throw new FinanceInputError("CONFLICT", "Rekening terpilih tidak aktif atau tidak tersedia.");
  if (input.action === "PAY") {
    if (required && decision?.status !== "APPROVED")
      throw new FinanceInputError(
        "CONFLICT",
        "Pembayaran masih membutuhkan persetujuan. Persetujuan tidak otomatis mencairkan dana.",
      );
    if (context.paid + parseNumericToCents(amount.toFixed(2)) > parseNumericToCents(bill.amount))
      throw new FinanceInputError("CONFLICT", "Nominal melebihi sisa tagihan.");
    if (account && parseNumericToCents(account.balance) < parseNumericToCents(amount.toFixed(2)))
      throw new FinanceInputError("CONFLICT", "Saldo rekening tidak mencukupi.");
    const duplicate = await connection.query.cashTransaction.findFirst({
      where: and(
        eq(cashTransaction.bankAccountId, input.bankAccountId),
        eq(cashTransaction.bankReference, input.referenceNumber),
      ),
    });
    if (duplicate)
      throw new FinanceInputError(
        "CONFLICT",
        "Nomor referensi mutasi bank sudah tercatat. Periksa transaksi sebelumnya.",
      );
  }
  const facts: VendorPaymentWorkflowProposal["facts"] = [
    { label: "Proyek", value: bill.project.name, money: false },
    { label: "Vendor", value: bill.vendor.name, money: false },
    { label: "Tagihan", value: bill.billNumber, money: false },
    { label: "Nominal", value: amount, money: true },
  ];
  const date =
    input.action === "SCHEDULE"
      ? input.paymentDate
      : payment!.paymentDate.toISOString().slice(0, 10);
  facts.push({
    label: "Tanggal pembayaran",
    value: new Date(date + "T00:00:00Z").toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    money: false,
  });
  if (account)
    facts.push({ label: "Rekening", value: `${account.bankName} · ${account.name}`, money: false });
  if (input.action === "SCHEDULE")
    facts.push(
      {
        label: "Belum dijadwalkan",
        value: Number(parseNumericToCents(bill.amount) - context.committed) / 100,
        money: true,
      },
      {
        label: "Persetujuan",
        value: required
          ? "Menunggu pemeriksa setelah jadwal disimpan"
          : "Tidak diperlukan menurut aturan saat ini",
        money: false,
      },
    );
  if (input.action === "PAY")
    facts.push({ label: "Referensi mutasi", value: input.referenceNumber, money: false });
  if (input.action === "APPROVE" || input.action === "REJECT")
    facts.push({ label: "Alasan keputusan", value: input.notes, money: false });
  if (actorCan(actor, "view:budget"))
    facts.push(
      {
        label: `Alokasi ${category.expenseCategory.name}`,
        value: Number(category.allocatedAmount),
        money: true,
      },
      { label: "Realisasi kategori", value: Number(category.actualAmount), money: true },
    );
  const comparisons: VendorPaymentWorkflowProposal["comparisons"] =
    input.action === "PAY" && account
      ? [
          {
            label: "Saldo rekening",
            before: Number(account.balance),
            after:
              Number(
                parseNumericToCents(account.balance) - parseNumericToCents(amount.toFixed(2)),
              ) / 100,
            money: true,
          },
          {
            label: "Sisa tagihan",
            before: Number(parseNumericToCents(bill.amount) - context.paid) / 100,
            after:
              Number(
                parseNumericToCents(bill.amount) -
                  context.paid -
                  parseNumericToCents(amount.toFixed(2)),
              ) / 100,
            money: true,
          },
        ]
      : input.action === "APPROVE" || input.action === "REJECT"
        ? [
            {
              label: "Keputusan",
              before: "Menunggu persetujuan",
              after: input.action === "APPROVE" ? "Disetujui" : "Ditolak",
              money: false,
            },
          ]
        : [];
  const titles = {
    SCHEDULE: "Jadwal pembayaran vendor",
    APPROVE: "Persetujuan pembayaran vendor",
    REJECT: "Penolakan pembayaran vendor",
    PAY: "Pembayaran vendor",
  };
  const source = {
    bill,
    payment,
    payments: context.payments,
    decisions: context.decisions,
    account: account
      ? { ...account, balance: input.action === "PAY" ? account.balance : undefined }
      : null,
    threshold: context.threshold.toString(),
  };
  return vendorPaymentWorkflowProposalSchema.parse({
    kind: VENDOR_PAYMENT_WORKFLOW_KIND,
    input,
    projectId: bill.projectId,
    vendorBillId: bill.id,
    title: titles[input.action],
    entityName: `${bill.billNumber} · ${bill.vendor.name}`,
    expectedContext: createHash("sha256").update(JSON.stringify(source)).digest("hex"),
    effect:
      input.action === "PAY"
        ? "Konfirmasi mencatat pembayaran di Atria, mengurangi saldo kas dan membuat catatan ledger. Tidak mengirim transfer ke bank; stok tetap."
        : input.action === "SCHEDULE"
          ? "Hanya membuat jadwal dan permintaan persetujuan bila diperlukan. Saldo kas dan stok tetap."
          : input.action === "APPROVE"
            ? "Jadwal disetujui untuk pembayaran terpisah. Saldo kas dan stok tetap."
            : "Jadwal ditolak; nominalnya tersedia untuk dijadwalkan ulang. Saldo kas dan stok tetap.",
    facts,
    comparisons,
  });
}
