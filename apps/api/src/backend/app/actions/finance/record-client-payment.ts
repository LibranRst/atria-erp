import { db } from "@backend/db";
import { resolveActor } from "@backend/server/actor";
import { recordClientPaymentTx } from "@backend/server/usecases/finance/record-client-payment";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  recordClientPaymentSchema,
  type RecordClientPaymentInput,
} from "@atria/core/validations/budget";
import { getErrorMessage } from "@atria/core/utils/error-message";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
/**
 * Mencatat penerimaan kas masuk termin dari klien.
 * Mengubah saldo rekening kas (DEBIT), menyisipkan entri jurnal ledger,
 * membuat rekaman client_payment, dan memperbarui status invoice.
 *
 * @param input Objek data masukan pembayaran klien
 * @returns Status respons aksi dan ID pembayaran beserta saldo baru
 */
export async function recordClientPayment(
  input: RecordClientPaymentInput,
): Promise<ActionResponse<{ paymentId: string; newBalance: string }>> {
  const validation = recordClientPaymentSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Validasi form pembayaran gagal." },
    };
  }

  try {
    const actor = await resolveActor();
    if (!actor) {
      return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
    }
    const result = await db.transaction((tx) => recordClientPaymentTx(tx, actor, validation.data));

    // Pembayaran klien memindahkan kas, jadi surface yang membacanya harus ikut
    // diperbarui: termin proyek, posisi kas di Dashboard, dan antrean
    // rekonsiliasi yang baru saja menerima transaksi belum cocok.
    revalidatePath(`/projects/${result.projectId}`);
    revalidatePath("/ledger");
    revalidatePath("/reconciliation");

    return {
      success: true,
      data: result,
    };
  } catch (error: unknown) {
    return mapRecordClientPaymentError(error);
  }
}

/**
 * Menerjemahkan sentinel internal menjadi pesan yang layak dibaca pengguna.
 * Sentinel seperti `PAYMENT_EXCEEDS_INVOICE_OUTSTANDING` hanya penanda alur di
 * dalam transaksi; menyalurkannya apa adanya ke `error.message` membuat kode
 * internal muncul di sheet "Tinjau penerimaan klien". Kode mesin tetap
 * tersampaikan lewat `error.code`.
 */
export function mapRecordClientPaymentError(error: unknown): ActionResponse<never> {
  const errMsg = getErrorMessage(error, "Gagal mencatatkan pembayaran termin klien.");

  if (errMsg.startsWith("FORBIDDEN:") || errMsg.startsWith("PROJECT_NOT_ACTIVE:")) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses proyek atau penerimaan pembayaran ditolak." },
    };
  }
  if (errMsg.startsWith("INVOICE_NOT_FOUND")) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Tagihan klien tidak ditemukan." },
    };
  }
  if (errMsg.startsWith("INVOICE_CLOSED")) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Tagihan ini sudah ditutup dan tidak dapat menerima pembayaran lagi.",
      },
    };
  }
  if (errMsg.startsWith("PAYMENT_EXCEEDS_INVOICE_OUTSTANDING")) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Nominal pembayaran melebihi sisa piutang invoice.",
      },
    };
  }
  if (errMsg.startsWith("DUPLICATE_BANK_REFERENCE")) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Nomor referensi mutasi bank ini sudah pernah dicatat.",
      },
    };
  }
  if (errMsg.startsWith("PAYMENT_INSERT_FAILED")) {
    return {
      success: false,
      error: {
        code: "TRANSACTION_FAILED",
        message: "Gagal menyimpan rekaman pembayaran klien. Coba ulangi.",
      },
    };
  }

  return {
    success: false,
    error: { code: "INTERNAL_SERVER_ERROR", message: errMsg },
  };
}
