import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  dateValue,
  moneyValue,
  quantityValue,
  textValue,
  type ActivityDetailView,
} from "@/lib/activity-detail/types";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";
import {
  fact,
  latestAudit,
  requireProject,
  statusTone,
  type ActivityUser,
} from "./activity-detail-resolver-utils";
export async function resolveProjectCost(
  id: string,
  user: ActivityUser,
  roleName: string,
): Promise<ActivityDetailView | null> {
  const row = await db.query.projectCost.findFirst({
    where: (table) => eq(table.id, id),
    with: {
      project: true,
      budgetCategory: { with: { expenseCategory: true } },
      material: true,
      requestedBy: true,
      bankAccount: true,
      verifiedBy: true,
      approvedBy: true,
      paidBy: true,
      cashTransaction: true,
    },
  });
  if (!row) return null;
  await requireProject(row.projectId, user, roleName);
  return {
    kind: "PROJECT_COST",
    id: row.id,
    title: row.description,
    subtitle: "Pengeluaran proyek",
    status: row.status,
    statusTone: statusTone(row.status),
    occurredAt: (row.paidAt ?? row.approvedAt ?? row.verifiedAt ?? row.createdAt).toISOString(),
    actorName:
      row.paidBy?.name ?? row.approvedBy?.name ?? row.verifiedBy?.name ?? row.requestedBy.name,
    facts: [
      fact("Proyek", textValue(row.project.name)),
      fact("Kategori", textValue(row.budgetCategory.expenseCategory.name)),
      ...(row.material ? [fact("Material", textValue(row.material.name))] : []),
      fact("Jumlah", quantityValue(Number(row.quantity))),
      fact("Harga satuan", moneyValue(Number(row.unitPrice))),
      fact("Subtotal", moneyValue(Number(row.amount))),
      fact("Pengaju", textValue(row.requestedBy.name)),
      ...(row.bankAccount ? [fact("Rekening", textValue(row.bankAccount.name))] : []),
    ],
    comparisons: [],
    impacts: [
      fact(
        "Budget aktual",
        textValue(
          ["APPROVED", "PAID"].includes(row.status)
            ? "Menambah pemakaian kategori budget"
            : "Belum menjadi realisasi biaya",
        ),
      ),
      fact(
        "Kas",
        textValue(
          row.cashTransaction
            ? `Kas berkurang ${Number(row.amount).toLocaleString("id-ID")}`
            : "Kas belum berubah",
        ),
      ),
    ],
    notes: [
      fact("Bukti", textValue(row.receiptImageUrl ? "Tersedia" : "Tidak ada")),
      ...(row.budgetOverrun
        ? [fact("Budget", textValue("Melebihi budget dan membutuhkan perhatian"))]
        : []),
    ],
    source: { label: "Buka pengeluaran", href: "/expenses?tab=field-claims" },
    evidenceIncomplete: false,
  };
}

export async function resolveVendorBill(
  id: string,
  user: ActivityUser,
  roleName: string,
): Promise<ActivityDetailView | null> {
  const row = await db.query.vendorBill.findFirst({
    where: (table) => eq(table.id, id),
    with: {
      vendor: true,
      project: true,
      budgetCategory: { with: { expenseCategory: true } },
      payments: true,
      goodsReceipts: true,
    },
  });
  if (!row) return null;
  await requireProject(row.projectId, user, roleName);
  const audit = await latestAudit("vendor_bill", row.id);
  const paid = row.payments
    .filter((payment) => payment.status === "COMPLETED")
    .reduce((sum, payment) => sum + Number(payment.amountPaid), 0);
  return {
    kind: "VENDOR_BILL",
    id: row.id,
    title: row.billNumber,
    subtitle: row.vendor.name,
    status: row.status,
    statusTone: statusTone(row.status),
    occurredAt: row.createdAt.toISOString(),
    actorName: audit?.actorName ?? "Sistem",
    facts: [
      fact("Proyek", textValue(row.project.name)),
      fact("Kategori", textValue(row.budgetCategory.expenseCategory.name)),
      fact("Nilai tagihan", moneyValue(Number(row.amount))),
      fact("Sudah dibayar", moneyValue(paid)),
      fact("Sisa utang", moneyValue(Math.max(0, Number(row.amount) - paid))),
      fact("Jatuh tempo", dateValue(row.dueDate)),
      fact("Penerimaan barang", quantityValue(row.goodsReceipts.length, "dokumen")),
    ],
    comparisons: [],
    impacts: [
      fact("Budget", textValue("Tagihan menambah komitmen atau realisasi kategori sesuai status")),
      fact("Utang vendor", moneyValue(Math.max(0, Number(row.amount) - paid))),
      fact(
        "Kas",
        textValue(paid > 0 ? "Berkurang melalui pembayaran yang sudah dicairkan" : "Belum berubah"),
      ),
    ],
    notes: [fact("Catatan", textValue(row.notes?.trim() || "Tidak ada catatan"))],
    source: { label: "Buka tagihan vendor", href: "/expenses?tab=vendor-bills" },
    evidenceIncomplete: audit === null,
  };
}

export async function resolveVendorPayment(
  id: string,
  user: ActivityUser,
  roleName: string,
): Promise<ActivityDetailView | null> {
  const row = await db.query.vendorPayment.findFirst({
    where: (table) => eq(table.id, id),
    with: {
      vendorBill: { with: { vendor: true, project: true } },
      bankAccount: true,
      cashTransaction: true,
      paidBy: true,
    },
  });
  if (!row) return null;
  await requireProject(row.vendorBill.projectId, user, roleName);
  return {
    kind: "VENDOR_PAYMENT",
    id: row.id,
    title: `Pembayaran ${row.vendorBill.billNumber}`,
    subtitle: row.vendorBill.vendor.name,
    status: row.status,
    statusTone: statusTone(row.status),
    occurredAt: row.paymentDate.toISOString(),
    actorName: row.paidBy.name,
    facts: [
      fact("Proyek", textValue(row.vendorBill.project.name)),
      fact("Rekening", textValue(row.bankAccount.name)),
      fact("Nilai dibayar", moneyValue(Number(row.amountPaid))),
      ...(row.referenceNumber ? [fact("Referensi transfer", textValue(row.referenceNumber))] : []),
    ],
    comparisons: [],
    impacts: [
      fact("Utang vendor", textValue(row.status === "COMPLETED" ? "Berkurang" : "Belum berubah")),
      fact(
        "Kas",
        textValue(row.cashTransaction ? "Berkurang dari rekening sumber" : "Belum ada mutasi kas"),
      ),
    ],
    notes: [],
    source: { label: "Buka pembayaran vendor", href: "/expenses?tab=vendor-bills" },
    evidenceIncomplete: false,
  };
}

export async function resolveCashTransaction(id: string): Promise<ActivityDetailView | null> {
  const row = await db.query.cashTransaction.findFirst({
    where: (table) => eq(table.id, id),
    with: { bankAccount: true, reconciledBy: true, reconciliationExceptionBy: true },
  });
  if (!row) return null;
  const directAudit = await latestAudit("cash_transaction", row.id);
  const sourceAudit =
    !directAudit && row.referenceType && row.referenceId
      ? await latestAudit(row.referenceType, row.referenceId)
      : null;
  const audit = directAudit ?? sourceAudit;
  return {
    kind: "CASH_TRANSACTION",
    id: row.id,
    title: row.description,
    subtitle: row.bankAccount.name,
    status: row.reconciled
      ? "SUDAH COCOK"
      : row.reconciliationExceptionAt
        ? "PENGECUALIAN TERCATAT"
        : "BELUM COCOK",
    statusTone: row.reconciled ? "SUCCESS" : row.reconciliationExceptionAt ? "WARNING" : "PENDING",
    occurredAt: row.createdAt.toISOString(),
    actorName: audit?.actorName ?? "Sistem",
    facts: [
      fact("Arah", textValue(formatBusinessLabel(row.type, "FINANCE"))),
      fact("Kategori", textValue(formatBusinessLabel(row.category, "FINANCE"))),
      fact("Nilai", moneyValue(Number(row.amount))),
      fact("Rekening", textValue(`${row.bankAccount.bankName} · ${row.bankAccount.name}`)),
      ...(row.referenceType
        ? [fact("Sumber", textValue(formatBusinessLabel(row.referenceType, "FINANCE")))]
        : []),
    ],
    comparisons: [],
    impacts: [
      fact("Saldo rekening", textValue(row.type === "INFLOW" ? "Bertambah" : "Berkurang")),
      fact(
        "Nilai perubahan",
        moneyValue(row.type === "INFLOW" ? Number(row.amount) : -Number(row.amount)),
      ),
    ],
    notes: [
      ...(row.reconciledBy
        ? [fact("Pemeriksa rekonsiliasi", textValue(row.reconciledBy.name))]
        : []),
      ...(row.reconciliationDate
        ? [fact("Tanggal rekonsiliasi", dateValue(row.reconciliationDate))]
        : []),
      ...(row.reconciliationExceptionReason
        ? [fact("Alasan pengecualian", textValue(row.reconciliationExceptionReason))]
        : []),
      ...(row.reconciliationExceptionBy
        ? [fact("Pemeriksa pengecualian", textValue(row.reconciliationExceptionBy.name))]
        : []),
      ...(row.reconciliationExceptionAt
        ? [fact("Pengecualian dicatat", dateValue(row.reconciliationExceptionAt))]
        : []),
    ],
    source: { label: "Buka rekening", href: "/ledger?tab=accounts" },
    evidenceIncomplete: audit === null,
  };
}

export async function resolveClientInvoice(
  id: string,
  user: ActivityUser,
  roleName: string,
): Promise<ActivityDetailView | null> {
  const row = await db.query.clientInvoice.findFirst({
    where: (table) => eq(table.id, id),
    with: { project: true, payments: true },
  });
  if (!row) return null;
  await requireProject(row.projectId, user, roleName);
  const audit = await latestAudit("client_invoice", row.id);
  const paid = row.payments.reduce((sum, payment) => sum + Number(payment.amountPaid), 0);
  return {
    kind: "CLIENT_INVOICE",
    id: row.id,
    title: row.invoiceNumber,
    subtitle: row.project.name,
    status: row.status,
    statusTone: statusTone(row.status),
    occurredAt: row.createdAt.toISOString(),
    actorName: audit?.actorName ?? "Sistem",
    facts: [
      fact("Tahap", textValue(row.stage)),
      fact("Nilai invoice", moneyValue(Number(row.amount))),
      fact("Sudah diterima", moneyValue(paid)),
      fact("Sisa piutang", moneyValue(Math.max(0, Number(row.amount) - paid))),
      fact("Jatuh tempo", dateValue(row.dueDate)),
    ],
    comparisons: [],
    impacts: [
      fact("Piutang", moneyValue(Math.max(0, Number(row.amount) - paid))),
      fact("Kas", textValue(paid > 0 ? "Bertambah melalui pembayaran klien" : "Belum berubah")),
    ],
    notes: [fact("Catatan", textValue(row.notes?.trim() || "Tidak ada catatan"))],
    source: { label: "Buka invoice proyek", href: `/projects/${row.projectId}?tab=payments` },
    evidenceIncomplete: audit === null,
  };
}

export async function resolveClientPayment(
  id: string,
  user: ActivityUser,
  roleName: string,
): Promise<ActivityDetailView | null> {
  const row = await db.query.clientPayment.findFirst({
    where: (table) => eq(table.id, id),
    with: {
      invoice: { with: { project: true } },
      bankAccount: true,
      cashTransaction: true,
      receivedBy: true,
    },
  });
  if (!row) return null;
  await requireProject(row.invoice.projectId, user, roleName);
  return {
    kind: "CLIENT_PAYMENT",
    id: row.id,
    title: `Pembayaran ${row.invoice.invoiceNumber}`,
    subtitle: row.invoice.project.name,
    status: "COMPLETED",
    statusTone: "SUCCESS",
    occurredAt: row.paymentDate.toISOString(),
    actorName: row.receivedBy.name,
    facts: [
      fact("Nilai diterima", moneyValue(Number(row.amountPaid))),
      fact("Rekening", textValue(row.bankAccount.name)),
      ...(row.referenceNumber ? [fact("Referensi", textValue(row.referenceNumber))] : []),
    ],
    comparisons: [],
    impacts: [
      fact("Piutang", textValue("Berkurang")),
      fact("Kas", textValue("Bertambah pada rekening penerima")),
      fact("Nilai perubahan", moneyValue(Number(row.amountPaid))),
    ],
    notes: [],
    source: {
      label: "Buka invoice proyek",
      href: `/projects/${row.invoice.projectId}?tab=payments`,
    },
    evidenceIncomplete: false,
  };
}
