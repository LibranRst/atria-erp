"use server";

import { revalidatePath } from "next/cache";
import { recordNotificationEvent } from "@/server/services/notification-events";
import { reconcileClientInvoiceAction } from "@/server/services/notification-job";

import { db } from "@/db";
import {
  cashTransaction,
  clientInvoice,
  clientPayment,
  bankAccount,
  auditLog,
  project,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { assertPermission } from "@/lib/auth/permissions";
import { mutateBalance, parseNumericToCents } from "@/lib/finance/balance-mutation";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { ActionResponse } from "@atria/core/types/action-response";
import {
  recordClientPaymentSchema,
  RecordClientPaymentInput,
} from "@atria/core/validations/budget";
import { getErrorMessage } from "@atria/core/utils/error-message";
import crypto from "crypto";
import { assertProjectStatusIsOperational } from "@/lib/auth/scoping";

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

  const { clientInvoiceId, bankAccountId, amountPaid, paymentDate, referenceNumber } =
    validation.data;

  try {
    // 1. Verifikasi Sesi
    const session = await auth.api.getSession({
      headers: {
        cookie: (await (await import("next/headers")).cookies()).toString(),
      },
    });

    if (!session || !session.user) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Harap login kembali." },
      };
    }

    // 2. Verifikasi Izin RBAC
    try {
      await assertPermission(session.user, "reconcile:ledger");
    } catch (err) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: err instanceof Error ? err.message : "Izin ditolak." },
      };
    }

    // 3. Jalankan Transaksi Database
    const result = await db.transaction(async (tx) => {
      // 3.1 Ambil data invoice dan pastikan tidak lunas / void
      const [invoice] = await tx
        .select()
        .from(clientInvoice)
        .where(eq(clientInvoice.id, clientInvoiceId))
        .for("update");

      if (!invoice) {
        throw new Error("INVOICE_NOT_FOUND: Tagihan klien tidak ditemukan.");
      }

      const [invoiceProject] = await tx
        .select({ status: project.status })
        .from(project)
        .where(eq(project.id, invoice.projectId))
        .for("update");
      assertProjectStatusIsOperational(invoiceProject?.status);

      if (invoice.status === "PAID" || invoice.status === "VOID") {
        throw new Error(
          `INVOICE_CLOSED: Tagihan berstatus ${formatBusinessLabel(invoice.status)} tidak dapat menerima pembayaran.`,
        );
      }

      const duplicateReference = await tx.query.cashTransaction.findFirst({
        where: and(
          eq(cashTransaction.bankAccountId, bankAccountId),
          eq(cashTransaction.bankReference, referenceNumber),
        ),
      });
      if (duplicateReference) {
        throw new Error("DUPLICATE_BANK_REFERENCE: Referensi mutasi bank sudah tercatat.");
      }

      const existingPayments = await tx
        .select({ amountPaid: clientPayment.amountPaid })
        .from(clientPayment)
        .where(eq(clientPayment.clientInvoiceId, clientInvoiceId));
      const alreadyPaidCents = existingPayments.reduce(
        (sum, payment) => sum + parseNumericToCents(payment.amountPaid),
        BigInt(0),
      );
      const invoiceAmountCents = parseNumericToCents(invoice.amount);
      const paymentCents = parseNumericToCents(amountPaid.toFixed(2));
      if (paymentCents > invoiceAmountCents - alreadyPaidCents) {
        throw new Error(
          "PAYMENT_EXCEEDS_INVOICE_OUTSTANDING: Nominal pembayaran melebihi sisa piutang invoice.",
        );
      }

      // 3.2 Pre-generate UUID untuk clientPayment agar siklus referensi kueri bersih
      const clientPaymentId = crypto.randomUUID();
      const amountPaidStr = amountPaid.toFixed(2);

      // 3.3 Mutasikan saldo bank secara aman via mutateBalance helper (DEBIT)
      const ledgerTx = await mutateBalance({
        tx,
        bankAccountId,
        type: "INFLOW",
        amount: amountPaidStr,
        description: `Terima termin pembayaran Invoice #${invoice.invoiceNumber} (Ref: ${referenceNumber})`,
        category: "client_payment",
        referenceType: "client_payment",
        referenceId: clientPaymentId,
        bankReference: referenceNumber,
        userId: session.user.id,
        transactionDate: paymentDate,
      });

      // 3.4 Ambil saldo bank terbaru pasca-mutasi untuk dikembalikan ke client
      const updatedAccount = await tx.query.bankAccount.findFirst({
        where: eq(bankAccount.id, bankAccountId),
      });

      const newBalanceStr = updatedAccount?.balance || "0.00";

      // 3.5 Sisipkan rekaman detail pembayaran klien
      const [payment] = await tx
        .insert(clientPayment)
        .values({
          id: clientPaymentId,
          clientInvoiceId,
          bankAccountId,
          cashTransactionId: ledgerTx.id,
          amountPaid: amountPaidStr,
          paymentDate,
          receivedById: session.user.id,
          referenceNumber,
          createdAt: new Date(),
        })
        .returning();

      if (!payment) {
        throw new Error("PAYMENT_INSERT_FAILED: Gagal menyisipkan rekaman pembayaran klien.");
      }

      // 3.6 Hitung total pembayaran sebelumnya untuk menentukan status akhir invoice
      const previousPayments = await tx
        .select({ amountPaid: clientPayment.amountPaid })
        .from(clientPayment)
        .where(eq(clientPayment.clientInvoiceId, clientInvoiceId));

      const totalPaidCents = previousPayments.reduce(
        (sum, p) => sum + parseNumericToCents(p.amountPaid),
        BigInt(0),
      );

      // Update status invoice (PAID jika total pembayaran >= nominal invoice)
      const nextStatus = totalPaidCents >= invoiceAmountCents ? "PAID" : "PARTIALLY_PAID";

      await tx
        .update(clientInvoice)
        .set({
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(clientInvoice.id, clientInvoiceId));

      // 3.7 Catat ke riwayat audit untuk aksi pencatatan pembayaran klien
      await tx.insert(auditLog).values({
        userId: session.user.id,
        action: "RECORD_CLIENT_PAYMENT",
        targetTable: "client_payment",
        targetId: clientPaymentId,
        originalState: JSON.stringify({ invoiceStatus: invoice.status }),
        newState: JSON.stringify({ invoiceStatus: nextStatus, paymentId: clientPaymentId }),
        createdAt: new Date(),
      });

      await recordNotificationEvent(tx, {
        referenceType: "client_payment",
        referenceId: payment.id,
        projectId: invoice.projectId,
        stage: nextStatus,
        title:
          nextStatus === "PAID" ? "Invoice klien telah lunas" : "Pembayaran invoice klien diterima",
        message: invoice.invoiceNumber,
        permission: "view:client_invoice",
        actionUrl: `/projects/${invoice.projectId}?tab=payments`,
        actorId: session.user.id,
      });
      await reconcileClientInvoiceAction(tx, invoice.id);

      return {
        paymentId: clientPaymentId,
        newBalance: newBalanceStr,
        projectId: invoice.projectId,
      };
    });

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
function mapRecordClientPaymentError(error: unknown): ActionResponse<never> {
  const errMsg = getErrorMessage(error, "Gagal mencatatkan pembayaran termin klien.");

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
