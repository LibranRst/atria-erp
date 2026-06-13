"use server";

import { db } from "@/db";
import { vendorBill, vendorPayment, projectBudgetItem, approval, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { assertPermission } from "@/lib/auth/permissions";
import { ActionResponse } from "@/lib/types/action-response";
import { schedulePaymentSchema, SchedulePaymentInput } from "@/lib/validations/finance";
import { getErrorMessage } from "@/lib/utils/error-message";
import crypto from "crypto";

export async function scheduleVendorBillPayment(
  input: SchedulePaymentInput
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
        error: { code: "FORBIDDEN", message: err instanceof Error ? err.message : "Akses ditolak." },
      };
    }

    // Run inside database transaction block
    const paymentResult = await db.transaction(async (tx) => {
      // 1. Verify vendor bill status is UNPAID or PARTIALLY_PAID
      const bill = await tx.query.vendorBill.findFirst({
        where: eq(vendorBill.id, vendorBillId),
      });

      if (!bill) {
        throw new Error("VENDOR_BILL_NOT_FOUND");
      }

      if (bill.status === "PAID" || bill.status === "VOID") {
        throw new Error("VENDOR_BILL_CLOSED");
      }

      // 2. Fetch the budget item to check overrun
      const budgetItem = await tx.query.projectBudgetItem.findFirst({
        where: eq(projectBudgetItem.id, bill.projectBudgetItemId),
      });

      if (!budgetItem) {
        throw new Error("BUDGET_ITEM_NOT_FOUND");
      }

      const allocated = Number(budgetItem.allocatedAmount);
      const spent = Number(budgetItem.actualSpent);
      const isOverrun = (spent + amountPaid) > allocated;
      const requiresApproval = amountPaid >= 5000000 || isOverrun;

      // 3. Pre-generate payment UUID
      const paymentId = crypto.randomUUID();

      // 4. If approval is required, insert an approval record for the Owner
      if (requiresApproval) {
        const ownerUser = await tx.query.user.findFirst({
          where: eq(user.roleId, "00000000-0000-0000-0000-000000000001"), // OWNER role UUID
        });

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

      return newPayment;
    });

    return {
      success: true,
      data: paymentResult,
    };
  } catch (error: unknown) {
    const errMsg = getErrorMessage(error, "Gagal menjadwalkan pembayaran vendor.");
    let errorCode: "NOT_FOUND" | "FORBIDDEN" | "TRANSACTION_FAILED" | "INTERNAL_SERVER_ERROR" = "INTERNAL_SERVER_ERROR";
    let displayMessage = errMsg;

    if (errMsg === "VENDOR_BILL_NOT_FOUND" || errMsg === "BUDGET_ITEM_NOT_FOUND" || errMsg === "OWNER_USER_NOT_FOUND") {
      errorCode = "NOT_FOUND";
      displayMessage = "Data pendukung transaksi tidak ditemukan.";
    } else if (errMsg === "VENDOR_BILL_CLOSED") {
      errorCode = "FORBIDDEN";
      displayMessage = "Tagihan vendor sudah lunas atau dibatalkan.";
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
