import { reconcileVendorBillAction } from "@backend/server/services/notification-job";
import { recordNotificationEvent } from "@backend/server/services/notification-events";

import { readApprovalThresholds } from "@backend/lib/finance/approval-thresholds";

import {
  vendorBill,
  vendorPayment,
  bankAccount,
  projectBudgetCategory,
  projectExpenses,
  auditLog,
  approval,
  cashTransaction,
} from "@backend/db/schema";
import { eq, and } from "drizzle-orm";

import {
  checkVendorPaymentApprovalGate,
  exceedsVendorBillOutstanding,
  vendorPaymentRequiresOwnerApproval,
} from "@atria/core/finance/vendor-payment-rules";
import { payVendorBillSchema, PayVendorBillInput } from "@atria/core/validations/finance";

import { syncProjectBudgetCategory } from "@backend/lib/budget/budget-sync";
import { mutateBalance, parseNumericToCents } from "@backend/lib/finance/balance-mutation";
import { assertProjectStatusIsOperational } from "@backend/lib/auth/scoping";
import { formatIdr } from "@atria/core/utils/money";

import type { Actor } from "@backend/server/actor";
import {
  assertFinancePermission,
  lockFinanceProject,
  type FinanceTransaction,
} from "./mutation-access";

export async function payVendorBillTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: PayVendorBillInput,
): Promise<{ paymentId: string; nextBalance: number; amountPaid: number; projectId: string }> {
  assertFinancePermission(actor, "pay:vendor_bill");
  const { vendorPaymentId, referenceNumber, bankAccountId } = payVendorBillSchema.parse(input);
  const ownerApprovalThresholdCents = (await readApprovalThresholds(tx)).vendorPaymentCents;

  // 1. Fetch and Lock the vendor payment record
  const [payment] = await tx
    .select()
    .from(vendorPayment)
    .where(eq(vendorPayment.id, vendorPaymentId))
    .for("update");

  if (!payment) {
    throw new Error("PAYMENT_RECORD_NOT_FOUND");
  }

  if (payment.status !== "PENDING") {
    throw new Error(
      payment.status === "COMPLETED" ? "PAYMENT_ALREADY_COMPLETED" : "PAYMENT_NOT_PENDING",
    );
  }

  // 2. Fetch and lock the vendor bill so concurrent payments cannot overpay it.
  const [bill] = await tx
    .select()
    .from(vendorBill)
    .where(eq(vendorBill.id, payment.vendorBillId))
    .for("update");

  if (!bill) {
    throw new Error("VENDOR_BILL_NOT_FOUND");
  }

  const billProject = await lockFinanceProject(tx, actor, bill.projectId);
  assertProjectStatusIsOperational(billProject.status);

  // 3. Fetch the canonical budget category for overrun checks.
  const budgetCategory = await tx.query.projectBudgetCategory.findFirst({
    where: eq(projectBudgetCategory.id, bill.projectBudgetCategoryId),
  });

  if (!budgetCategory) {
    throw new Error("PROJECT_BUDGET_CATEGORY_NOT_FOUND");
  }

  // 4. Verify Approval status if payment amount >= 5M or causes budget overrun
  const paymentAmountCents = parseNumericToCents(payment.amountPaid);
  const completedPayments = await tx
    .select({ amountPaid: vendorPayment.amountPaid })
    .from(vendorPayment)
    .where(
      and(
        eq(vendorPayment.vendorBillId, payment.vendorBillId),
        eq(vendorPayment.status, "COMPLETED"),
      ),
    );
  const paidBeforeCents = completedPayments.reduce(
    (sum, row) => sum + parseNumericToCents(row.amountPaid),
    BigInt(0),
  );
  const billAmountCents = parseNumericToCents(bill.amount);
  if (
    exceedsVendorBillOutstanding({
      billAmountCents,
      committedCents: paidBeforeCents,
      amountCents: paymentAmountCents,
    })
  ) {
    throw new Error("PAYMENT_EXCEEDS_VENDOR_BILL_OUTSTANDING");
  }
  const requiresApproval =
    payment.requiresOwnerApproval ||
    vendorPaymentRequiresOwnerApproval({
      amountCents: paymentAmountCents,
      categoryAllocatedCents: parseNumericToCents(budgetCategory.allocatedAmount),
      categoryActualCents: parseNumericToCents(budgetCategory.actualAmount),
      ownerApprovalThresholdCents,
    });

  const appRecord = requiresApproval
    ? await tx.query.approval.findFirst({
        where: and(
          eq(approval.referenceType, "vendor_payment"),
          eq(approval.referenceId, payment.id),
        ),
      })
    : null;
  const approvalGate = checkVendorPaymentApprovalGate({
    requiresApproval,
    approvalStatus: appRecord?.status,
  });
  if (!approvalGate.allowed) {
    throw new Error(approvalGate.reason);
  }

  const targetBankAccountId = bankAccountId || payment.bankAccountId;

  const accountBefore = await tx.query.bankAccount.findFirst({
    where: eq(bankAccount.id, targetBankAccountId),
  });
  if (!accountBefore) throw new Error("BANK_ACCOUNT_NOT_FOUND");
  const duplicateReference = await tx.query.cashTransaction.findFirst({
    where: and(
      eq(cashTransaction.bankAccountId, targetBankAccountId),
      eq(cashTransaction.bankReference, referenceNumber),
    ),
  });
  if (duplicateReference) throw new Error("DUPLICATE_BANK_REFERENCE");
  const ledgerTx = await mutateBalance({
    tx,
    bankAccountId: targetBankAccountId,
    type: "OUTFLOW",
    amount: payment.amountPaid,
    category: "vendor_payment",
    description: `Bayar tagihan Vendor Bill #${bill.billNumber} (Ref: ${referenceNumber})`,
    referenceType: "vendor_payment",
    referenceId: payment.id,
    bankReference: referenceNumber,
    userId: actor.userId,
    transactionDate: payment.paymentDate,
  });
  const accountAfter = await tx.query.bankAccount.findFirst({
    where: eq(bankAccount.id, targetBankAccountId),
  });
  if (!accountAfter) throw new Error("BANK_ACCOUNT_NOT_FOUND");
  const newBalance = Number(accountAfter.balance);

  // 8. Update vendor payment details
  await tx
    .update(vendorPayment)
    .set({
      bankAccountId: targetBankAccountId,
      cashTransactionId: ledgerTx.id,
      status: "COMPLETED",
      referenceNumber,
      paymentDate: payment.paymentDate,
    })
    .where(eq(vendorPayment.id, vendorPaymentId));

  // 9. Update vendor bill status to PAID or PARTIALLY_PAID
  const totalPaidCents = paidBeforeCents + paymentAmountCents;
  const nextBillStatus = totalPaidCents >= billAmountCents ? "PAID" : "PARTIALLY_PAID";

  await tx
    .update(vendorBill)
    .set({
      status: nextBillStatus,
      updatedAt: new Date(),
    })
    .where(eq(vendorBill.id, payment.vendorBillId));

  await tx
    .update(projectExpenses)
    .set({
      paymentStatus: nextBillStatus === "PAID" ? "PAID" : "PARTIALLY_PAID",
      updatedAt: new Date(),
    })
    .where(eq(projectExpenses.vendorBillId, bill.id));

  await syncProjectBudgetCategory({
    tx,
    projectBudgetCategoryId: bill.projectBudgetCategoryId,
  });

  // 11. Write Audit Log
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "PAY_VENDOR_BILL",
    targetTable: "vendor_payment",
    targetId: payment.id,
    originalState: JSON.stringify({
      balance: accountBefore.balance,
      paymentStatus: payment.status,
      billStatus: bill.status,
      canonicalCategoryActual: budgetCategory.actualAmount,
    }),
    newState: JSON.stringify({
      balance: accountAfter.balance,
      paymentStatus: "COMPLETED",
      billStatus: nextBillStatus,
      canonicalCategoryActual: budgetCategory.actualAmount,
      cashTransactionId: ledgerTx.id,
    }),
    createdAt: new Date(),
  });

  await recordNotificationEvent(tx, {
    referenceType: "vendor_payment",
    referenceId: payment.id,
    projectId: bill.projectId,
    stage: "COMPLETED",
    title: "Pembayaran vendor selesai",
    message: `Pembayaran senilai ${formatIdr(Number(payment.amountPaid))}.`,
    permission: "view:project",
    actionUrl: `/projects/${bill.projectId}?tab=budget`,
    actorId: actor.userId,
  });
  await reconcileVendorBillAction(tx, bill.id);
  return {
    paymentId: payment.id,
    nextBalance: newBalance,
    amountPaid: Number(payment.amountPaid),
    projectId: bill.projectId,
  };
}
