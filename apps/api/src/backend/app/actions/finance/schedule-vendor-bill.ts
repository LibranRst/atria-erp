import { resolveActor } from "@backend/server/actor";
import { assertFinancePermission, lockFinanceProject } from "@backend/server/usecases/finance/mutation-access";
import { reconcileVendorBillAction } from "@backend/server/services/notification-job";
import { recordNotificationEvent } from "@backend/server/services/notification-events";

import { getVendorPaymentApprovalThresholdCents } from "@backend/lib/finance/approval-thresholds";
import { db } from "@backend/db";
import {
  auditLog,
  bankAccount,
  vendorBill,
  vendorPayment,
  projectBudgetCategory,
  approval,
  user,
  role,
} from "@backend/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { ActionResponse } from "@atria/core/types/action-response";
import { exceedsVendorBillOutstanding } from "@atria/core/finance/vendor-payment-rules";
import { schedulePaymentSchema, SchedulePaymentInput } from "@atria/core/validations/finance";
import { getErrorMessage } from "@atria/core/utils/error-message";
import crypto from "crypto";
import { assertProjectStatusIsOperational } from "@backend/lib/auth/scoping";
import { parseNumericToCents } from "@backend/lib/finance/balance-mutation";
import { formatIdr } from "@atria/core/utils/money";

export async function scheduleVendorBillPayment(
  input: SchedulePaymentInput,
): Promise<ActionResponse<typeof vendorPayment.$inferSelect>> {
  const validation = schedulePaymentSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data penjadwalan pembayaran tidak valid." },
    };
  }

  const { vendorBillId, bankAccountId, paymentDate, amountPaid } = validation.data;

  try {
    const actor = await resolveActor();
    if (!actor) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak ditemukan." } };
    assertFinancePermission(actor, "pay:vendor_bill");

    // Run inside database transaction block
    // Ambang dibaca sebelum transaksi; keputusannya dibekukan ke baris jadwal.
    const ownerApprovalThresholdCents = await getVendorPaymentApprovalThresholdCents();
    const paymentResult = await db.transaction(async (tx) => {
      // 1. Verify vendor bill status is UNPAID or PARTIALLY_PAID
      const [bill] = await tx
        .select()
        .from(vendorBill)
        .where(eq(vendorBill.id, vendorBillId))
        .for("update");

      if (!bill) {
        throw new Error("VENDOR_BILL_NOT_FOUND");
      }

      const billProject = await lockFinanceProject(tx, actor, bill.projectId);
      assertProjectStatusIsOperational(billProject.status);

      if (bill.status === "PAID" || bill.status === "VOID") {
        throw new Error("VENDOR_BILL_CLOSED");
      }

      const account = await tx.query.bankAccount.findFirst({
        where: and(eq(bankAccount.id, bankAccountId), eq(bankAccount.isActive, true)),
      });
      if (!account) throw new Error("BANK_ACCOUNT_NOT_FOUND");

      const committedPayments = await tx.query.vendorPayment.findMany({
        where: and(
          eq(vendorPayment.vendorBillId, vendorBillId),
          inArray(vendorPayment.status, ["PENDING", "COMPLETED"]),
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

      if (!budgetCategory) {
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
          ? await tx.query.user.findFirst({ where: eq(user.roleId, ownerRole.id) })
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
    });

    return {
      success: true,
      data: paymentResult,
    };
  } catch (error: unknown) {
    const errMsg = getErrorMessage(error, "Gagal menjadwalkan pembayaran vendor.");
    if (errMsg.startsWith("FORBIDDEN:") || errMsg.startsWith("PROJECT_NOT_ACTIVE:")) {
      return { success: false, error: { code: "FORBIDDEN", message: "Akses proyek atau penjadwalan ditolak." } };
    }
    let errorCode: "NOT_FOUND" | "FORBIDDEN" | "TRANSACTION_FAILED" | "INTERNAL_SERVER_ERROR" =
      "INTERNAL_SERVER_ERROR";
    let displayMessage = errMsg;

    if (
      errMsg === "VENDOR_BILL_NOT_FOUND" ||
      errMsg === "PROJECT_BUDGET_CATEGORY_NOT_FOUND" ||
      errMsg === "OWNER_USER_NOT_FOUND" ||
      errMsg === "BANK_ACCOUNT_NOT_FOUND"
    ) {
      errorCode = "NOT_FOUND";
      displayMessage = "Data pendukung transaksi tidak ditemukan.";
    } else if (errMsg === "VENDOR_BILL_CLOSED") {
      errorCode = "FORBIDDEN";
      displayMessage = "Tagihan vendor sudah lunas atau dibatalkan.";
    } else if (errMsg === "PAYMENT_EXCEEDS_VENDOR_BILL_OUTSTANDING") {
      errorCode = "FORBIDDEN";
      displayMessage = "Nominal pembayaran melebihi sisa tagihan yang belum dijadwalkan.";
    } else {
      errorCode = "TRANSACTION_FAILED";
      displayMessage = errMsg;
    }

    return {
      success: false,
      error: { code: errorCode, message: displayMessage },
    };
  }
}
