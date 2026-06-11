"use server";

import { db } from "@/db";
import { clientInvoice, clientPayment, bankAccount, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { assertPermission } from "@/lib/auth/permissions";
import { mutateBalance, parseNumericToCents, fromCents } from "@/lib/finance/balance-mutation";
import { ActionResponse } from "@/lib/types/action-response";
import { recordClientPaymentSchema, RecordClientPaymentInput } from "@/lib/validations/budget";
import crypto from "crypto";

/**
 * Mencatat penerimaan kas masuk termin dari klien.
 * Mengubah saldo rekening kas (DEBIT), menyisipkan entri jurnal ledger,
 * membuat rekaman client_payment, dan memperbarui status invoice.
 * 
 * @param input Objek data masukan pembayaran klien
 * @returns Status respons aksi dan ID pembayaran beserta saldo baru
 */
export async function recordClientPayment(
  input: RecordClientPaymentInput
): Promise<ActionResponse<{ paymentId: string; newBalance: string }>> {
  const validation = recordClientPaymentSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Validasi form pembayaran gagal." },
    };
  }

  const { clientInvoiceId, bankAccountId, amountPaid, paymentDate, referenceNumber } = validation.data;

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
      const invoice = await tx.query.clientInvoice.findFirst({
        where: eq(clientInvoice.id, clientInvoiceId),
      });

      if (!invoice) {
        throw new Error("INVOICE_NOT_FOUND: Tagihan klien tidak ditemukan.");
      }

      if (invoice.status === "PAID" || invoice.status === "VOID") {
        throw new Error(`INVOICE_CLOSED: Tagihan berstatus ${invoice.status} tidak dapat menerima pembayaran.`);
      }

      // 3.2 Pre-generate UUID untuk clientPayment agar siklus referensi kueri bersih
      const clientPaymentId = crypto.randomUUID();
      const amountPaidStr = amountPaid.toFixed(2);

      // 3.3 Mutasikan saldo bank secara aman via mutateBalance helper (DEBIT)
      const ledgerTx = await mutateBalance({
        tx,
        bankAccountId,
        type: "DEBIT",
        amount: amountPaidStr,
        description: `Terima termin pembayaran Invoice #${invoice.invoiceNumber} (Ref: ${referenceNumber})`,
        category: "client_payment",
        referenceType: "client_payment",
        referenceId: clientPaymentId,
        userId: session.user.id,
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
        BigInt(0)
      );

      const invoiceAmountCents = parseNumericToCents(invoice.amount);

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

      return {
        paymentId: clientPaymentId,
        newBalance: newBalanceStr,
      };
    });

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    let errorCode: "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION_ERROR" | "INSUFFICIENT_FUNDS" | "TRANSACTION_FAILED" | "NOT_FOUND" | "INTERNAL_SERVER_ERROR" = "INTERNAL_SERVER_ERROR";
    if (error.message?.startsWith("INVOICE_NOT_FOUND")) {
      errorCode = "NOT_FOUND";
    } else if (error.message?.startsWith("INVOICE_CLOSED")) {
      errorCode = "FORBIDDEN";
    }
    return {
      success: false,
      error: {
        code: errorCode,
        message: error.message || "Gagal mencatatkan pembayaran termin klien.",
      },
    };
  }
}
