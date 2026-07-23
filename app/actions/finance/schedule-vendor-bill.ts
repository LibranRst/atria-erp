"use server";

import { db } from "@/db";
import {
  auditLog,
  bankAccount,
  vendorBill,
  vendorPayment,
  project,
  projectBudgetCategory,
  approval,
  user,
  role,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { assertPermission } from "@/lib/auth/permissions";
import { ActionResponse } from "@/lib/types/action-response";
import { schedulePaymentSchema, SchedulePaymentInput } from "@/lib/validations/finance";
import { getErrorMessage } from "@/lib/utils/error-message";
import crypto from "crypto";
import { assertProjectStatusIsOperational } from "@/lib/auth/scoping";
import { parseNumericToCents } from "@/lib/finance/balance-mutation";

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
    const session = await auth.api.getSession({
      headers: {
        cookie: (await (await import("next/headers")).cookies()).toString(),
      },
    });

    if (!session || !session.user) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sesi tidak ditemukan." },
      };
    }

    try {
      await assertPermission(session.user, "pay:vendor_bill");
    } catch (err) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: err instanceof Error ? err.message : "Akses ditolak.",
        },
      };
    }

    // Run inside database transaction block
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

      const [billProject] = await tx
        .select({ status: project.status })
        .from(project)
        .where(eq(project.id, bill.projectId))
        .for("update");
      assertProjectStatusIsOperational(billProject?.status);

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
      if (amountPaidCents > parseNumericToCents(bill.amount) - committedAmountCents) {
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
      const requiresApproval = amountPaidCents >= BigInt(500_000_000) || isOverrun;

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
          : "Nominal transaksi mencapai/melebihi Rp 5.000.000.";

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
          paidById: session.user.id,
          referenceNumber: null,
          createdAt: new Date(),
        })
        .returning();

      await tx.insert(auditLog).values({
        userId: session.user.id,
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

      return newPayment;
    });

    return {
      success: true,
      data: paymentResult,
    };
  } catch (error: unknown) {
    const errMsg = getErrorMessage(error, "Gagal menjadwalkan pembayaran vendor.");
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
