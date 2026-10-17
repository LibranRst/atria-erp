import { recordNotificationEvent } from "@backend/server/services/notification-events";
import { reconcileClientInvoiceAction } from "@backend/server/services/notification-job";

import {
  cashTransaction,
  clientInvoice,
  clientPayment,
  bankAccount,
  auditLog,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { and, eq } from "drizzle-orm";

import { mutateBalance, parseNumericToCents } from "@backend/lib/finance/balance-mutation";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";

import {
  recordClientPaymentSchema,
  RecordClientPaymentInput,
} from "@atria/core/validations/budget";

import crypto from "crypto";
import { assertProjectStatusIsOperational } from "@backend/lib/auth/scoping";

import type { Actor } from "@backend/server/actor";
import {
  assertFinancePermission,
  lockFinanceProject,
  type FinanceTransaction,
} from "./mutation-access";

export async function recordClientPaymentTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: RecordClientPaymentInput,
): Promise<{ paymentId: string; newBalance: string; projectId: string }> {
  assertFinancePermission(actor, "reconcile:client_invoice");
  const { clientInvoiceId, bankAccountId, amountPaid, paymentDate, referenceNumber } =
    recordClientPaymentSchema.parse(input);

  // 3.1 Ambil data invoice dan pastikan tidak lunas / void
  const [invoice] = await tx
    .select()
    .from(clientInvoice)
    .where(
      and(eq(clientInvoice.id, clientInvoiceId), eq(clientInvoice.tenantId, INSTANCE_TENANT_ID)),
    )
    .for("update");

  if (!invoice) {
    throw new Error("INVOICE_NOT_FOUND: Tagihan klien tidak ditemukan.");
  }

  const invoiceProject = await lockFinanceProject(tx, actor, invoice.projectId);
  if (invoiceProject.tenantId !== INSTANCE_TENANT_ID) {
    throw new Error("FORBIDDEN: Proyek di luar akses Anda.");
  }
  assertProjectStatusIsOperational(invoiceProject.status);

  const [destinationAccount] = await tx
    .select({ id: bankAccount.id })
    .from(bankAccount)
    .where(and(eq(bankAccount.id, bankAccountId), eq(bankAccount.tenantId, INSTANCE_TENANT_ID)))
    .for("update");
  if (!destinationAccount) {
    throw new Error("FORBIDDEN: Rekening penerima tidak tersedia dalam organisasi ini.");
  }

  if (invoice.status === "PAID" || invoice.status === "VOID") {
    throw new Error(
      `INVOICE_CLOSED: Tagihan berstatus ${formatBusinessLabel(invoice.status)} tidak dapat menerima pembayaran.`,
    );
  }

  const duplicateReference = await tx.query.cashTransaction.findFirst({
    where: and(
      eq(cashTransaction.tenantId, INSTANCE_TENANT_ID),
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
    .where(
      and(
        eq(clientPayment.clientInvoiceId, clientInvoiceId),
        eq(clientPayment.tenantId, INSTANCE_TENANT_ID),
      ),
    );
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
    userId: actor.userId,
    transactionDate: paymentDate,
  });

  // 3.4 Ambil saldo bank terbaru pasca-mutasi untuk dikembalikan ke client
  const updatedAccount = await tx.query.bankAccount.findFirst({
    where: and(eq(bankAccount.id, bankAccountId), eq(bankAccount.tenantId, INSTANCE_TENANT_ID)),
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
      receivedById: actor.userId,
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
    .where(
      and(
        eq(clientPayment.clientInvoiceId, clientInvoiceId),
        eq(clientPayment.tenantId, INSTANCE_TENANT_ID),
      ),
    );

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
    .where(
      and(eq(clientInvoice.id, clientInvoiceId), eq(clientInvoice.tenantId, INSTANCE_TENANT_ID)),
    );

  // 3.7 Catat ke riwayat audit untuk aksi pencatatan pembayaran klien
  await tx.insert(auditLog).values({
    userId: actor.userId,
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
    actorId: actor.userId,
  });
  await reconcileClientInvoiceAction(tx, invoice.id);

  return {
    paymentId: clientPaymentId,
    newBalance: newBalanceStr,
    projectId: invoice.projectId,
  };
}
