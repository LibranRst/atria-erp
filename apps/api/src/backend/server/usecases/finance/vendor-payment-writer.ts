import { and, eq, inArray } from "drizzle-orm";
import crypto from "node:crypto";
import { z } from "zod";
import {
  auditLog,
  bankAccount,
  vendorBill,
  vendorPayment,
  projectBudgetCategory,
  approval,
  appConfig,
  user,
  role,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { APPROVAL_THRESHOLD_CONFIG_KEYS } from "@atria/core/finance/approval-thresholds";
import { readApprovalThresholds } from "@backend/lib/finance/approval-thresholds";
import { reconcileVendorBillAction } from "@backend/server/services/notification-job";
import { recordNotificationEvent } from "@backend/server/services/notification-events";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import {
  assertFinancePermission,
  lockFinanceProject,
  type FinanceTransaction,
} from "./mutation-access";
import { assertProjectStatusIsOperational } from "@backend/lib/auth/scoping";
import { parseNumericToCents } from "@backend/lib/finance/balance-mutation";
import { exceedsVendorBillOutstanding } from "@atria/core/finance/vendor-payment-rules";
import { schedulePaymentSchema, type SchedulePaymentInput } from "@atria/core/validations/finance";
import { hasTwoDecimalPrecision, RAP_COST_MAX } from "@atria/core/project/rap-cost";
import { formatIdr } from "@atria/core/utils/money";
import {
  upsertApprovalTx,
  writeFieldRequestAuditTx,
} from "@backend/app/actions/finance/field-request-utils";

export async function scheduleVendorPaymentTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: SchedulePaymentInput,
): Promise<typeof vendorPayment.$inferSelect> {
  const input = schedulePaymentSchema.parse(raw);
  assertFinancePermission(actor, "pay:vendor_bill");
  if (
    !Number.isFinite(input.amountPaid) ||
    input.amountPaid > RAP_COST_MAX ||
    !hasTwoDecimalPrecision(input.amountPaid)
  )
    throw new Error("PAYMENT_AMOUNT_INVALID");
  const { vendorBillId, bankAccountId, paymentDate, amountPaid } = input;
  // 1. Verify vendor bill status is UNPAID or PARTIALLY_PAID
  const [bill] = await tx
    .select()
    .from(vendorBill)
    .where(eq(vendorBill.id, vendorBillId))
    .for("update");

  if (!bill) {
    throw new Error("VENDOR_BILL_NOT_FOUND");
  }

  if (bill.tenantId !== INSTANCE_TENANT_ID) throw new Error("VENDOR_BILL_NOT_FOUND");
  const billProject = await lockFinanceProject(tx, actor, bill.projectId);
  if (billProject.tenantId !== INSTANCE_TENANT_ID) throw new Error("PROJECT_NOT_FOUND");
  assertProjectStatusIsOperational(billProject.status);
  await tx
    .select()
    .from(appConfig)
    .where(
      and(
        eq(appConfig.key, APPROVAL_THRESHOLD_CONFIG_KEYS.vendorPayment),
        eq(appConfig.tenantId, INSTANCE_TENANT_ID),
      ),
    )
    .for("update");
  const ownerApprovalThresholdCents = (await readApprovalThresholds(tx)).vendorPaymentCents;

  if (bill.status === "PAID" || bill.status === "VOID") {
    throw new Error("VENDOR_BILL_CLOSED");
  }

  const [account] = await tx
    .select()
    .from(bankAccount)
    .where(
      and(
        eq(bankAccount.id, bankAccountId),
        eq(bankAccount.isActive, true),
        eq(bankAccount.tenantId, INSTANCE_TENANT_ID),
      ),
    )
    .for("update");
  if (!account) throw new Error("BANK_ACCOUNT_NOT_FOUND");

  const committedPayments = await tx.query.vendorPayment.findMany({
    where: and(
      eq(vendorPayment.vendorBillId, vendorBillId),
      inArray(vendorPayment.status, ["PENDING", "PROCESSING", "COMPLETED"]),
    ),
  });
  const committedAmountCents = committedPayments.reduce(
    (sum, payment) => sum + parseNumericToCents(payment.amountPaid),
    BigInt(0),
  );
  const amountPaidCents = parseNumericToCents(amountPaid.toFixed(2));
  if (
    exceedsVendorBillOutstanding({
      billAmountCents: parseNumericToCents(bill.amount),
      committedCents: committedAmountCents,
      amountCents: amountPaidCents,
    })
  ) {
    throw new Error("PAYMENT_EXCEEDS_VENDOR_BILL_OUTSTANDING");
  }

  // 2. Fetch the canonical budget category to check category overrun
  const budgetCategory = await tx.query.projectBudgetCategory.findFirst({
    where: eq(projectBudgetCategory.id, bill.projectBudgetCategoryId),
  });

  if (!budgetCategory || budgetCategory.tenantId !== INSTANCE_TENANT_ID) {
    throw new Error("PROJECT_BUDGET_CATEGORY_NOT_FOUND");
  }

  const allocatedCents = parseNumericToCents(budgetCategory.allocatedAmount);
  const spentCents = parseNumericToCents(budgetCategory.actualAmount);
  const isOverrun = spentCents > allocatedCents;
  const requiresApproval = amountPaidCents >= ownerApprovalThresholdCents || isOverrun;

  // 3. Pre-generate payment UUID
  const paymentId = crypto.randomUUID();

  // 4. If approval is required, insert an approval record for the Owner
  if (requiresApproval) {
    const ownerRole = await tx.query.role.findFirst({
      where: eq(role.name, "owner"),
    });
    const ownerUser = ownerRole
      ? await tx.query.user.findFirst({
          where: and(eq(user.roleId, ownerRole.id), eq(user.isActive, true)),
        })
      : null;

    if (!ownerUser) {
      throw new Error("OWNER_USER_NOT_FOUND");
    }

    const notes = isOverrun
      ? "Pembayaran melebihi plafon anggaran belanja (Budget Overrun)."
      : "Nominal transaksi mencapai ambang persetujuan Owner.";

    await tx.insert(approval).values({
      approverId: ownerUser.id,
      referenceType: "vendor_payment",
      referenceId: paymentId,
      status: "PENDING",
      notes,
      createdAt: new Date(),
    });
  }

  // 5. Insert vendor payment request in PENDING state
  const [newPayment] = await tx
    .insert(vendorPayment)
    .values({
      id: paymentId,
      vendorBillId,
      bankAccountId,
      cashTransactionId: null,
      amountPaid: amountPaid.toFixed(2),
      status: "PENDING",
      paymentDate,
      paidById: actor.userId,
      requiresOwnerApproval: requiresApproval,
      referenceNumber: null,
      createdAt: new Date(),
    })
    .returning();

  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "SCHEDULE_VENDOR_PAYMENT",
    targetTable: "vendor_payment",
    targetId: newPayment.id,
    newState: JSON.stringify({
      vendorBillId,
      bankAccountId,
      amountPaid: newPayment.amountPaid,
      paymentDate,
      requiresApproval,
    }),
  });

  await recordNotificationEvent(tx, {
    referenceType: "vendor_payment",
    referenceId: newPayment.id,
    projectId: bill.projectId,
    stage: "SCHEDULED",
    title: requiresApproval
      ? "Pembayaran vendor menunggu persetujuan"
      : "Pembayaran vendor siap diproses",
    message: `Pembayaran senilai ${formatIdr(Number(newPayment.amountPaid))}.`,
    permission: requiresApproval ? "decide:all_approvals" : "pay:vendor_bill",
    actionRequired: true,
    actionUrl: requiresApproval ? "/approvals" : `/projects/${bill.projectId}?tab=budget`,
    actorId: actor.userId,
  });
  await reconcileVendorBillAction(tx, vendorBillId);
  return newPayment;
}

const decisionSchema = z
  .object({
    vendorPaymentId: z.string().guid(),
    notes: z.string().trim().max(1000).optional(),
    status: z.enum(["APPROVED", "REJECTED"]),
    emergencyOverride: z.boolean(),
  })
  .strict();
export async function decideVendorPaymentTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: z.infer<typeof decisionSchema>,
): Promise<{ paymentId: string; status: string }> {
  const { vendorPaymentId, notes, status, emergencyOverride } = decisionSchema.parse(raw);
  assertFinancePermission(actor, "approve:cost");
  const [payment] = await tx
    .select()
    .from(vendorPayment)
    .where(eq(vendorPayment.id, vendorPaymentId))
    .for("update");

  if (!payment || payment.tenantId !== INSTANCE_TENANT_ID) {
    throw new Error("PAYMENT_RECORD_NOT_FOUND");
  }
  const bill = await tx.query.vendorBill.findFirst({
    where: eq(vendorBill.id, payment.vendorBillId),
  });
  if (!bill || bill.tenantId !== INSTANCE_TENANT_ID) throw new Error("VENDOR_BILL_NOT_FOUND");
  const currentProject = await lockFinanceProject(tx, actor, bill.projectId);
  if (currentProject.tenantId !== INSTANCE_TENANT_ID) throw new Error("PROJECT_NOT_FOUND");
  assertProjectStatusIsOperational(currentProject.status);
  const existingDecision = await tx.query.approval.findFirst({
    where: and(eq(approval.referenceType, "vendor_payment"), eq(approval.referenceId, payment.id)),
  });
  if (existingDecision && existingDecision.status !== "PENDING")
    throw new Error("PAYMENT_DECISION_ALREADY_FINAL");
  if (payment.status !== "PENDING") {
    throw new Error("PAYMENT_NOT_PENDING");
  }
  if (status === "APPROVED" && payment.paidById === actor.userId) {
    if (
      !actorCan(actor, "override:self_approval") ||
      !emergencyOverride ||
      (notes?.trim().length ?? 0) < 10
    )
      throw new Error("MAKER_CHECKER_REQUIRED");
  }

  await upsertApprovalTx(tx, {
    approverId: actor.userId,
    referenceType: "vendor_payment",
    referenceId: vendorPaymentId,
    status,
    notes,
  });

  if (status === "REJECTED") {
    // `referenceNumber` adalah nomor referensi mutasi bank — pada jalur
    // pencairan ia menjadi `cashTransaction.bankReference` yang dipakai
    // rekonsiliasi dan deteksi duplikat. Alasan penolakan tidak boleh
    // menempatinya; alasan itu sudah tersimpan pada `approval.notes` lewat
    // `upsertApprovalTx` di atas, yang memang tempat auditnya.
    await tx
      .update(vendorPayment)
      .set({
        status: "FAILED",
        paymentDate: new Date(),
      })
      .where(eq(vendorPayment.id, vendorPaymentId));
  }

  await writeFieldRequestAuditTx(tx, {
    userId: actor.userId,
    action:
      status === "APPROVED"
        ? payment.paidById === actor.userId
          ? "EMERGENCY_APPROVE_VENDOR_PAYMENT"
          : "APPROVE_VENDOR_PAYMENT"
        : "REJECT_VENDOR_PAYMENT",
    targetTable: "vendor_payment",
    targetId: vendorPaymentId,
    originalState: { paymentStatus: payment.status },
    newState: {
      paymentStatus: status === "REJECTED" ? "FAILED" : payment.status,
      approved: status === "APPROVED",
      status,
    },
  });

  const notificationBill = await tx.query.vendorBill.findFirst({
    where: eq(vendorBill.id, payment.vendorBillId),
  });
  if (notificationBill)
    await recordNotificationEvent(tx, {
      referenceType: "vendor_payment",
      referenceId: payment.id,
      projectId: notificationBill.projectId,
      stage: status,
      title:
        status === "APPROVED" ? "Pembayaran vendor siap diproses" : "Pembayaran vendor ditolak",
      message: notificationBill.billNumber,
      permission: status === "APPROVED" ? "pay:vendor_bill" : "view:vendor_bill",
      recipients: status === "REJECTED" ? [payment.paidById] : undefined,
      actionRequired: status === "APPROVED",
      actionUrl: `/projects/${notificationBill.projectId}?tab=budget`,
      actorId: actor.userId,
    });
  await reconcileVendorBillAction(tx, payment.vendorBillId);
  return { paymentId: vendorPaymentId, status };
}
