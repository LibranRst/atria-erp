import { resolveActor } from "@backend/server/actor";
import { assertFinancePermission } from "@backend/server/usecases/finance/mutation-access";
import { scheduleVendorPaymentTx } from "@backend/server/usecases/finance/vendor-payment-writer";
import { db } from "@backend/db";
import { vendorPayment } from "@backend/db/schema";
import type { ActionResponse } from "@atria/core/types/action-response";
import { schedulePaymentSchema, type SchedulePaymentInput } from "@atria/core/validations/finance";
import { getErrorMessage } from "@atria/core/utils/error-message";

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

  try {
    const actor = await resolveActor();
    if (!actor)
      return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak ditemukan." } };
    assertFinancePermission(actor, "pay:vendor_bill");

    // Run inside database transaction block
    // Ambang dibaca sebelum transaksi; keputusannya dibekukan ke baris jadwal.
    const paymentResult = await db.transaction(async (tx) => {
      return scheduleVendorPaymentTx(tx, actor, validation.data);
    });

    return {
      success: true,
      data: paymentResult,
    };
  } catch (error: unknown) {
    const errMsg = getErrorMessage(error, "Gagal menjadwalkan pembayaran vendor.");
    if (errMsg.startsWith("FORBIDDEN:") || errMsg.startsWith("PROJECT_NOT_ACTIVE:")) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Akses proyek atau penjadwalan ditolak." },
      };
    }
    if (errMsg === "PAYMENT_AMOUNT_INVALID")
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Nominal harus positif dan memakai maksimal dua angka desimal.",
        },
      };
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
