import { db } from "@backend/db";
import { resolveActor } from "@backend/server/actor";
import { payVendorBillTx } from "@backend/server/usecases/finance/pay-vendor-bill";
import type { ActionResponse } from "@atria/core/types/action-response";
import { payVendorBillSchema, type PayVendorBillInput } from "@atria/core/validations/finance";
import { getErrorMessage } from "@atria/core/utils/error-message";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
export async function payVendorBill(
  input: PayVendorBillInput,
): Promise<ActionResponse<{ paymentId: string; nextBalance: number }>> {
  const validation = payVendorBillSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Form pembayaran tidak lengkap." },
    };
  }

  try {
    const actor = await resolveActor();
    if (!actor) {
      return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
    }
    const result = await db.transaction((tx) => payVendorBillTx(tx, actor, validation.data));

    revalidatePath(`/projects/${result.projectId}`);
    revalidatePath("/ledger");
    revalidatePath("/reconciliation");
    return {
      success: true,
      data: { paymentId: result.paymentId, nextBalance: result.nextBalance },
    };
  } catch (error: unknown) {
    return mapPayVendorBillError(error);
  }
}

export function mapPayVendorBillError(error: unknown): ActionResponse<never> {
  const errMsg = getErrorMessage(error, "");
  let code: "NOT_FOUND" | "INSUFFICIENT_FUNDS" | "FORBIDDEN" | "TRANSACTION_FAILED" =
    "TRANSACTION_FAILED";
  let displayMessage = errMsg;

  if (errMsg.startsWith("FORBIDDEN:") || errMsg.startsWith("PROJECT_NOT_ACTIVE:")) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses proyek atau pembayaran ditolak." },
    };
  }
  if (
    errMsg === "PAYMENT_RECORD_NOT_FOUND" ||
    errMsg === "BANK_ACCOUNT_NOT_FOUND" ||
    errMsg === "VENDOR_BILL_NOT_FOUND" ||
    errMsg === "PROJECT_BUDGET_CATEGORY_NOT_FOUND"
  ) {
    code = "NOT_FOUND";
    displayMessage = "Data keuangan yang dibutuhkan untuk transaksi tidak ditemukan.";
  } else if (errMsg.startsWith("INSUFFICIENT_FUNDS")) {
    code = "INSUFFICIENT_FUNDS";
    displayMessage = "Pencairan dibatalkan: Saldo akun bank perusahaan tidak mencukupi.";
  } else if (
    errMsg === "PAYMENT_ALREADY_COMPLETED" ||
    errMsg === "PAYMENT_NOT_PENDING" ||
    errMsg === "PAYMENT_EXCEEDS_VENDOR_BILL_OUTSTANDING" ||
    errMsg === "APPROVAL_REQUIRED_BUT_PENDING" ||
    errMsg === "APPROVAL_RECORD_MISSING" ||
    errMsg === "DUPLICATE_BANK_REFERENCE"
  ) {
    code = "FORBIDDEN";
    displayMessage =
      errMsg === "PAYMENT_ALREADY_COMPLETED"
        ? "Pembayaran ini sudah diselesaikan sebelumnya."
        : errMsg === "PAYMENT_NOT_PENDING"
          ? "Pembayaran ini sudah ditolak atau tidak lagi menunggu pencairan."
          : errMsg === "PAYMENT_EXCEEDS_VENDOR_BILL_OUTSTANDING"
            ? "Nominal pembayaran melebihi sisa tagihan vendor."
            : errMsg === "DUPLICATE_BANK_REFERENCE"
              ? "Referensi mutasi bank sudah tercatat pada rekening ini."
              : "Pembayaran memerlukan persetujuan Owner dan belum disetujui.";
  }

  return {
    success: false,
    error: { code, message: displayMessage },
  };
}
