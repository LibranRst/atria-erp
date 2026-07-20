"use server";

import { cookies } from "next/headers";
import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertPermission, resolveRoleName, type PermissionKey } from "@/lib/auth/permissions";
import { assertProjectAccess } from "@/lib/auth/scoping";
import {
  dateValue,
  moneyValue,
  quantityValue,
  textValue,
  type ActivityDetailRequest,
  type ActivityDetailView,
  type ActivityFact,
  type ActivityStatusTone,
} from "@/lib/activity-detail/types";
import { activityDetailRequestSchema } from "@/lib/activity-detail/validation";
import type { ActionResponse } from "@/lib/types/action-response";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";

type ActivityUser = { readonly id: string; readonly roleId: string };
type AuditEvidence = { readonly actorName: string; readonly action: string } | null;

const permissionByKind: Record<ActivityDetailRequest["kind"], PermissionKey> = {
  STOCK_MOVEMENT: "view:inventory",
  GOODS_RECEIPT: "view:inventory",
  STOCK_TRANSFER: "view:inventory",
  STOCK_COUNT: "view:inventory",
  INVENTORY_OPENING: "view:inventory",
  PROJECT_COST: "view:cost",
  VENDOR_BILL: "view:vendor_bill",
  VENDOR_PAYMENT: "view:vendor_bill",
  CASH_TRANSACTION: "view:ledger",
  CLIENT_INVOICE: "view:client_invoice",
  CLIENT_PAYMENT: "view:client_invoice",
  RAB_REVISION: "view:rab",
  CHANGE_ORDER: "view:rab",
  APPROVAL_DECISION: "view:cost",
};

function statusTone(status: string): ActivityStatusTone {
  const value = status.toUpperCase();
  if (["POSTED", "PAID", "COMPLETED", "APPROVED", "VERIFIED", "RECONCILED"].includes(value)) return "SUCCESS";
  if (["REJECTED", "FAILED", "VOID", "REVERSED", "OVERDUE"].includes(value)) return "DANGER";
  if (["PENDING", "PENDING_APPROVAL", "SUBMITTED", "PROCESSING", "DRAFT"].includes(value)) return "PENDING";
  if (["PARTIALLY_PAID", "ADJUSTMENT", "WASTE"].includes(value)) return "WARNING";
  return "NEUTRAL";
}

function fact(label: string, value: ActivityFact["value"]): ActivityFact {
  return { label, value };
}

function total(items: readonly { readonly quantity: string; readonly unitCost: string }[]): number {
  return items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitCost), 0);
}

async function latestAudit(targetTable: string, targetId: string): Promise<AuditEvidence> {
  const row = await db.query.auditLog.findFirst({
    where: (table, { and }) => and(eq(table.targetTable, targetTable), eq(table.targetId, targetId)),
    with: { user: { columns: { name: true } } },
    orderBy: [desc(auditLog.createdAt)],
    columns: { action: true },
  });
  return row ? { actorName: row.user.name, action: row.action } : null;
}

async function requireProject(projectId: string, user: ActivityUser, roleName: string): Promise<void> {
  await assertProjectAccess(projectId, user.id, roleName);
}

async function enforceAssignedProject(projectId: string, user: ActivityUser, roleName: string): Promise<void> {
  if (roleName === "PROJECT_MANAGER" || roleName === "DESIGNER") {
    await requireProject(projectId, user, roleName);
  }
}

function canLinkProject(roleName: string): boolean {
  return ["OWNER", "FINANCE_ADMIN", "PROJECT_MANAGER", "DESIGNER"].includes(roleName);
}

async function resolveStockMovement(id: string, user: ActivityUser, roleName: string): Promise<ActivityDetailView | null> {
  const row = await db.query.stockMovement.findFirst({
    where: (table) => eq(table.id, id),
    with: { material: true, location: true, project: true, createdBy: true, vendorBill: true, projectCost: true },
  });
  if (!row) return null;
  if (row.projectId) await enforceAssignedProject(row.projectId, user, roleName);
  const direction = row.movementDirection === "IN" ? "Masuk" : row.movementDirection === "OUT" ? "Keluar" : "Tidak mengubah stok fisik";
  const stockValue = Number(row.quantity) * Number(row.unitCost);
  return {
    kind: "STOCK_MOVEMENT", id: row.id, title: "Detail mutasi stok", subtitle: row.material.name,
    status: row.movementType, statusTone: statusTone(row.movementType), occurredAt: row.createdAt.toISOString(), actorName: row.createdBy.name,
    facts: [fact("Material", textValue(row.material.name)), fact("Lokasi", textValue(row.location.name)), fact("Arah", textValue(direction)), fact("Quantity", quantityValue(Number(row.quantity), row.material.unit)), fact("Unit cost", moneyValue(Number(row.unitCost))), fact("Nilai mutasi", moneyValue(stockValue)), ...(row.project ? [fact("Proyek", textValue(row.project.name))] : [])],
    comparisons: [],
    impacts: [fact("Dampak stok", textValue(direction === "Masuk" ? "Menambah stok lokasi" : direction === "Keluar" ? "Mengurangi stok lokasi" : "Tidak mengubah stok fisik")), fact("Dampak kas", textValue(row.projectCostId || row.vendorBillId ? "Dampak kas mengikuti transaksi finansial sumber" : "Tidak ada mutasi kas langsung"))],
    notes: [fact("Catatan", textValue(row.note?.trim() || "Tidak ada catatan")), ...(row.referenceType ? [fact("Referensi", textValue(formatBusinessLabel(row.referenceType)))] : [])],
    source: row.project && canLinkProject(roleName) ? { label: "Lihat proyek", href: `/projects/${row.project.id}?tab=stok` } : row.vendorBill ? { label: "Buka tagihan", href: "/expenses?tab=vendor-bills" } : null,
    evidenceIncomplete: false,
  };
}

async function resolveGoodsReceipt(id: string, user: ActivityUser, roleName: string): Promise<ActivityDetailView | null> {
  const row = await db.query.goodsReceipt.findFirst({ where: (table) => eq(table.id, id), with: { project: true, inventoryLocation: true, vendorBill: true, receivedBy: true, items: { with: { material: true } } } });
  if (!row) return null;
  await enforceAssignedProject(row.projectId, user, roleName);
  const receiptTotal = total(row.items);
  const inventoryRows = row.items.length > 0 ? await db.query.materialInventory.findMany({
    where: (table, { and }) => and(eq(table.locationId, row.inventoryLocationId), inArray(table.materialId, row.items.map((item) => item.materialId))),
  }) : [];
  const inventoryByMaterial = new Map(inventoryRows.map((inventory) => [inventory.materialId, inventory]));
  return {
    kind: "GOODS_RECEIPT", id: row.id, title: row.receiptNumber, subtitle: "Penerimaan barang", status: row.status, statusTone: statusTone(row.status), occurredAt: row.receivedAt.toISOString(), actorName: row.receivedBy.name,
    facts: [fact("Proyek", textValue(row.project.name)), fact("Lokasi", textValue(row.inventoryLocation.name)), ...(row.vendorBill ? [fact("Tagihan vendor", textValue(row.vendorBill.billNumber))] : []), fact("Jumlah item", quantityValue(row.items.length, "item")), fact("Total penerimaan", moneyValue(receiptTotal)), ...row.items.flatMap((item, index) => { const inventory = inventoryByMaterial.get(item.materialId); return [fact(`${index + 1}. ${item.material.name}`, quantityValue(Number(item.quantity), item.material.unit)), fact(`Unit cost ${index + 1}`, moneyValue(Number(item.unitCost))), fact(`Subtotal ${index + 1}`, moneyValue(Number(item.quantity) * Number(item.unitCost))), ...(inventory ? [fact(`Current stock ${index + 1}`, quantityValue(Number(inventory.currentStock), item.material.unit)), fact(`Reserved stock ${index + 1}`, quantityValue(Number(inventory.reservedStock), item.material.unit)), fact(`Available stock ${index + 1}`, quantityValue(Math.max(0, Number(inventory.currentStock) - Number(inventory.reservedStock)), item.material.unit)), fact(`Average cost ${index + 1}`, moneyValue(Number(inventory.averageCost))), fact(`Nilai inventory ${index + 1}`, moneyValue(Number(inventory.currentStock) * Number(inventory.averageCost)))] : [])]; })],
    comparisons: [],
    impacts: [fact("Stok", textValue(row.status === "REVERSED" ? "Penerimaan telah dibalik dari stok" : "Menambah stok lokasi dan memperbarui valuasi")), fact("Kas", textValue("Tidak berubah oleh penerimaan barang")), fact("Actual cost proyek", textValue("Tidak berubah oleh penerimaan barang"))],
    notes: [fact("Catatan", textValue(row.note?.trim() || "Tidak ada catatan")), ...(row.reversalReason ? [fact("Alasan reversal", textValue(row.reversalReason))] : [])],
    source: canLinkProject(roleName) ? { label: "Lihat proyek", href: `/projects/${row.projectId}?tab=stok` } : { label: "Buka material", href: "/materials?tab=activity" }, evidenceIncomplete: false,
  };
}

async function resolveStockTransfer(id: string): Promise<ActivityDetailView | null> {
  const row = await db.query.stockTransfer.findFirst({ where: (table) => eq(table.id, id), with: { fromLocation: true, toLocation: true, createdBy: true, items: { with: { material: true } } } });
  if (!row) return null;
  const transferTotal = total(row.items);
  return { kind: "STOCK_TRANSFER", id: row.id, title: row.transferNumber, subtitle: "Transfer antar lokasi", status: row.status, statusTone: statusTone(row.status), occurredAt: row.transferredAt.toISOString(), actorName: row.createdBy.name,
    facts: [fact("Dari", textValue(row.fromLocation.name)), fact("Ke", textValue(row.toLocation.name)), fact("Jumlah item", quantityValue(row.items.length, "item")), fact("Total nilai", moneyValue(transferTotal)), ...row.items.flatMap((item, index) => [fact(`${index + 1}. ${item.material.name}`, quantityValue(Number(item.quantity), item.material.unit)), fact(`Subtotal ${index + 1}`, moneyValue(Number(item.quantity) * Number(item.unitCost)))])], comparisons: [],
    impacts: [fact("Lokasi asal", textValue("Stok berkurang")), fact("Lokasi tujuan", textValue("Stok bertambah")), fact("Stok global", textValue("Net stock nol")), fact("Kas", textValue("Tidak ada mutasi kas"))], notes: [fact("Catatan", textValue(row.note))], source: { label: "Buka aktivitas material", href: "/materials?tab=activity" }, evidenceIncomplete: false };
}

async function resolveStockCount(id: string): Promise<ActivityDetailView | null> {
  const row = await db.query.stockCount.findFirst({ where: (table) => eq(table.id, id), with: { location: true, createdBy: true, approvedBy: true, items: { with: { material: true } } } });
  if (!row) return null;
  const varianceValue = row.items.reduce((sum, item) => sum + Number(item.varianceQuantity) * Number(item.unitCost), 0);
  return { kind: "STOCK_COUNT", id: row.id, title: row.countNumber, subtitle: "Stock opname", status: row.status, statusTone: statusTone(row.status), occurredAt: row.countedAt.toISOString(), actorName: row.createdBy.name,
    facts: [fact("Lokasi", textValue(row.location.name)), fact("Jumlah item", quantityValue(row.items.length, "item")), ...(row.approvedBy ? [fact("Checker", textValue(row.approvedBy.name))] : [])],
    comparisons: row.items.map((item) => ({ label: item.material.name, before: quantityValue(Number(item.systemQuantity), item.material.unit), after: quantityValue(Number(item.countedQuantity), item.material.unit) })),
    impacts: [fact("Variance quantity", quantityValue(row.items.reduce((sum, item) => sum + Number(item.varianceQuantity), 0))), fact("Variance nilai", moneyValue(varianceValue)), fact("Kas", textValue("Tidak ada mutasi kas"))], notes: [fact("Catatan", textValue(row.note?.trim() || "Tidak ada catatan")), ...(row.rejectionReason ? [fact("Alasan keputusan", textValue(row.rejectionReason))] : [])], source: { label: "Buka aktivitas material", href: "/materials?tab=activity" }, evidenceIncomplete: row.status === "REJECTED" && !row.rejectionReason };
}

async function resolveOpening(id: string): Promise<ActivityDetailView | null> {
  const row = await db.query.inventoryOpeningBatch.findFirst({ where: (table) => eq(table.id, id), with: { requestedBy: true, approvedBy: true, reversedBy: true, items: { with: { inventory: { with: { material: true, location: true } }, stockMovement: true } } } });
  if (!row) return null;
  const openingTotal = total(row.items);
  const reason = row.decisionReason ?? row.rejectedReason ?? null;
  return { kind: "INVENTORY_OPENING", id: row.id, title: row.batchNumber, subtitle: "Saldo awal stok", status: row.status, statusTone: statusTone(row.status), occurredAt: row.postedAt?.toISOString() ?? row.approvedAt?.toISOString() ?? row.createdAt.toISOString(), actorName: row.requestedBy.name,
    facts: [fact("Tanggal cutover", dateValue(row.cutoverDate)), fact("Pengaju", textValue(row.requestedBy.name)), ...(row.approvedBy ? [fact("Pemeriksa", textValue(row.approvedBy.name))] : []), fact("Jumlah item", quantityValue(row.items.length, "item")), fact("Total batch", moneyValue(openingTotal)), ...row.items.flatMap((item, index) => [fact(`${index + 1}. ${item.inventory.material.name}`, quantityValue(Number(item.quantity), item.inventory.material.unit)), fact(`Lokasi ${index + 1}`, textValue(item.inventory.location.name)), fact(`Biaya satuan ${index + 1}`, moneyValue(Number(item.unitCost))), fact(`Subtotal ${index + 1}`, moneyValue(Number(item.quantity) * Number(item.unitCost))), ...(row.status === "POSTED" || row.status === "REVERSED" ? [fact(`Stok fisik ${index + 1}`, quantityValue(Number(item.inventory.currentStock), item.inventory.material.unit)), fact(`Stok direservasi ${index + 1}`, quantityValue(Number(item.inventory.reservedStock), item.inventory.material.unit)), fact(`Stok tersedia ${index + 1}`, quantityValue(Math.max(0, Number(item.inventory.currentStock) - Number(item.inventory.reservedStock)), item.inventory.material.unit)), fact(`Harga rata-rata ${index + 1}`, moneyValue(Number(item.inventory.averageCost))), fact(`Nilai inventori ${index + 1}`, moneyValue(Number(item.inventory.currentStock) * Number(item.inventory.averageCost)))] : []), ...(item.stockMovement ? [fact(`Mutasi stok ${index + 1}`, textValue(formatBusinessLabel(item.stockMovement.movementType, "INVENTORY")))] : [])])], comparisons: [],
    impacts: [fact("Stok", textValue(row.status === "POSTED" ? "Menambah current dan available stock" : row.status === "REVERSED" ? "Saldo awal telah dibalik" : "Belum mengubah stok")), fact("Nilai inventory", moneyValue(row.status === "POSTED" ? openingTotal : 0)), fact("Kas", textValue("Tidak berubah")), fact("Utang vendor", textValue("Tidak berubah")), fact("Actual cost proyek", textValue("Tidak berubah"))], notes: [fact("Catatan", textValue(row.note)), ...(row.referenceNumber ? [fact("Dokumen sumber", textValue(row.referenceNumber))] : []), fact("Alasan keputusan", textValue(reason ?? "Alasan keputusan belum tercatat pada data lama")), ...(row.reversalReason ? [fact("Alasan reversal", textValue(row.reversalReason))] : [])], source: { label: "Buka saldo awal", href: "/materials/opening" }, evidenceIncomplete: ["POSTED", "REJECTED"].includes(row.status) && !reason };
}

async function resolveProjectCost(id: string, user: ActivityUser, roleName: string): Promise<ActivityDetailView | null> {
  const row = await db.query.projectCost.findFirst({ where: (table) => eq(table.id, id), with: { project: true, budgetCategory: { with: { expenseCategory: true } }, material: true, requestedBy: true, bankAccount: true, verifiedBy: true, approvedBy: true, paidBy: true, cashTransaction: true } });
  if (!row) return null;
  await requireProject(row.projectId, user, roleName);
  return { kind: "PROJECT_COST", id: row.id, title: row.description, subtitle: "Pengeluaran proyek", status: row.status, statusTone: statusTone(row.status), occurredAt: (row.paidAt ?? row.approvedAt ?? row.verifiedAt ?? row.createdAt).toISOString(), actorName: row.paidBy?.name ?? row.approvedBy?.name ?? row.verifiedBy?.name ?? row.requestedBy.name,
    facts: [fact("Proyek", textValue(row.project.name)), fact("Kategori", textValue(row.budgetCategory.expenseCategory.name)), ...(row.material ? [fact("Material", textValue(row.material.name))] : []), fact("Quantity", quantityValue(Number(row.quantity))), fact("Unit cost", moneyValue(Number(row.unitPrice))), fact("Subtotal", moneyValue(Number(row.amount))), fact("Pengaju", textValue(row.requestedBy.name)), ...(row.bankAccount ? [fact("Rekening", textValue(row.bankAccount.name))] : [])], comparisons: [],
    impacts: [fact("Budget aktual", textValue(["APPROVED", "PAID"].includes(row.status) ? "Menambah pemakaian kategori budget" : "Belum menjadi actual spend")), fact("Kas", textValue(row.cashTransaction ? `Kas berkurang ${Number(row.amount).toLocaleString("id-ID")}` : "Belum ada mutasi kas"))], notes: [fact("Bukti", textValue(row.receiptImageUrl ? "Tersedia" : "Tidak ada")), ...(row.budgetOverrun ? [fact("Budget", textValue("Melebihi budget dan membutuhkan perhatian"))] : [])], source: { label: "Buka pengeluaran", href: "/expenses?tab=field-claims" }, evidenceIncomplete: false };
}

async function resolveVendorBill(id: string, user: ActivityUser, roleName: string): Promise<ActivityDetailView | null> {
  const row = await db.query.vendorBill.findFirst({ where: (table) => eq(table.id, id), with: { vendor: true, project: true, budgetCategory: { with: { expenseCategory: true } }, payments: true, goodsReceipts: true } });
  if (!row) return null;
  await requireProject(row.projectId, user, roleName);
  const audit = await latestAudit("vendor_bill", row.id);
  const paid = row.payments.filter((payment) => payment.status === "COMPLETED").reduce((sum, payment) => sum + Number(payment.amountPaid), 0);
  return { kind: "VENDOR_BILL", id: row.id, title: row.billNumber, subtitle: row.vendor.name, status: row.status, statusTone: statusTone(row.status), occurredAt: row.createdAt.toISOString(), actorName: audit?.actorName ?? "Sistem",
    facts: [fact("Proyek", textValue(row.project.name)), fact("Kategori", textValue(row.budgetCategory.expenseCategory.name)), fact("Nilai tagihan", moneyValue(Number(row.amount))), fact("Sudah dibayar", moneyValue(paid)), fact("Sisa utang", moneyValue(Math.max(0, Number(row.amount) - paid))), fact("Jatuh tempo", dateValue(row.dueDate)), fact("Penerimaan barang", quantityValue(row.goodsReceipts.length, "dokumen"))], comparisons: [],
    impacts: [fact("Budget", textValue("Tagihan menambah komitmen/actual kategori sesuai status")), fact("Utang vendor", moneyValue(Math.max(0, Number(row.amount) - paid))), fact("Kas", textValue(paid > 0 ? "Berkurang melalui pembayaran yang sudah dicairkan" : "Belum berubah"))], notes: [fact("Catatan", textValue(row.notes?.trim() || "Tidak ada catatan"))], source: { label: "Buka tagihan vendor", href: "/expenses?tab=vendor-bills" }, evidenceIncomplete: audit === null };
}

async function resolveVendorPayment(id: string, user: ActivityUser, roleName: string): Promise<ActivityDetailView | null> {
  const row = await db.query.vendorPayment.findFirst({ where: (table) => eq(table.id, id), with: { vendorBill: { with: { vendor: true, project: true } }, bankAccount: true, cashTransaction: true, paidBy: true } });
  if (!row) return null;
  await requireProject(row.vendorBill.projectId, user, roleName);
  return { kind: "VENDOR_PAYMENT", id: row.id, title: `Pembayaran ${row.vendorBill.billNumber}`, subtitle: row.vendorBill.vendor.name, status: row.status, statusTone: statusTone(row.status), occurredAt: row.paymentDate.toISOString(), actorName: row.paidBy.name,
    facts: [fact("Proyek", textValue(row.vendorBill.project.name)), fact("Rekening", textValue(row.bankAccount.name)), fact("Nilai dibayar", moneyValue(Number(row.amountPaid))), ...(row.referenceNumber ? [fact("Referensi transfer", textValue(row.referenceNumber))] : [])], comparisons: [], impacts: [fact("Utang vendor", textValue(row.status === "COMPLETED" ? "Berkurang" : "Belum berubah")), fact("Kas", textValue(row.cashTransaction ? "Berkurang dari rekening sumber" : "Belum ada mutasi kas"))], notes: [], source: { label: "Buka pembayaran vendor", href: "/expenses?tab=vendor-bills" }, evidenceIncomplete: false };
}

async function resolveCashTransaction(id: string): Promise<ActivityDetailView | null> {
  const row = await db.query.cashTransaction.findFirst({ where: (table) => eq(table.id, id), with: { bankAccount: true, reconciledBy: true } });
  if (!row) return null;
  const directAudit = await latestAudit("cash_transaction", row.id);
  const sourceAudit = !directAudit && row.referenceType && row.referenceId
    ? await latestAudit(row.referenceType, row.referenceId)
    : null;
  const audit = directAudit ?? sourceAudit;
  return { kind: "CASH_TRANSACTION", id: row.id, title: row.description, subtitle: row.bankAccount.name, status: row.reconciled ? "RECONCILED" : "BELUM DIREKONSILIASI", statusTone: row.reconciled ? "SUCCESS" : "PENDING", occurredAt: row.createdAt.toISOString(), actorName: audit?.actorName ?? "Sistem",
    facts: [fact("Arah", textValue(formatBusinessLabel(row.type, "FINANCE"))), fact("Kategori", textValue(formatBusinessLabel(row.category, "FINANCE"))), fact("Nilai", moneyValue(Number(row.amount))), fact("Rekening", textValue(`${row.bankAccount.bankName} · ${row.bankAccount.name}`)), ...(row.referenceType ? [fact("Sumber", textValue(formatBusinessLabel(row.referenceType, "FINANCE")))] : [])], comparisons: [], impacts: [fact("Saldo rekening", textValue(row.type === "DEBIT" ? "Bertambah" : "Berkurang")), fact("Nilai perubahan", moneyValue(row.type === "DEBIT" ? Number(row.amount) : -Number(row.amount)))], notes: [...(row.reconciledBy ? [fact("Pemeriksa rekonsiliasi", textValue(row.reconciledBy.name))] : []), ...(row.reconciliationDate ? [fact("Tanggal rekonsiliasi", dateValue(row.reconciliationDate))] : [])], source: { label: "Buka rekening", href: "/ledger?tab=accounts" }, evidenceIncomplete: audit === null };
}

async function resolveClientInvoice(id: string, user: ActivityUser, roleName: string): Promise<ActivityDetailView | null> {
  const row = await db.query.clientInvoice.findFirst({ where: (table) => eq(table.id, id), with: { project: true, payments: true } });
  if (!row) return null;
  await requireProject(row.projectId, user, roleName);
  const audit = await latestAudit("client_invoice", row.id);
  const paid = row.payments.reduce((sum, payment) => sum + Number(payment.amountPaid), 0);
  return { kind: "CLIENT_INVOICE", id: row.id, title: row.invoiceNumber, subtitle: row.project.name, status: row.status, statusTone: statusTone(row.status), occurredAt: row.createdAt.toISOString(), actorName: audit?.actorName ?? "Sistem",
    facts: [fact("Tahap", textValue(row.stage)), fact("Nilai invoice", moneyValue(Number(row.amount))), fact("Sudah diterima", moneyValue(paid)), fact("Sisa piutang", moneyValue(Math.max(0, Number(row.amount) - paid))), fact("Jatuh tempo", dateValue(row.dueDate))], comparisons: [], impacts: [fact("Piutang", moneyValue(Math.max(0, Number(row.amount) - paid))), fact("Kas", textValue(paid > 0 ? "Bertambah melalui pembayaran klien" : "Belum berubah"))], notes: [fact("Catatan", textValue(row.notes?.trim() || "Tidak ada catatan"))], source: { label: "Buka invoice proyek", href: `/projects/${row.projectId}?tab=payments` }, evidenceIncomplete: audit === null };
}

async function resolveClientPayment(id: string, user: ActivityUser, roleName: string): Promise<ActivityDetailView | null> {
  const row = await db.query.clientPayment.findFirst({ where: (table) => eq(table.id, id), with: { invoice: { with: { project: true } }, bankAccount: true, cashTransaction: true, receivedBy: true } });
  if (!row) return null;
  await requireProject(row.invoice.projectId, user, roleName);
  return { kind: "CLIENT_PAYMENT", id: row.id, title: `Pembayaran ${row.invoice.invoiceNumber}`, subtitle: row.invoice.project.name, status: "COMPLETED", statusTone: "SUCCESS", occurredAt: row.paymentDate.toISOString(), actorName: row.receivedBy.name,
    facts: [fact("Nilai diterima", moneyValue(Number(row.amountPaid))), fact("Rekening", textValue(row.bankAccount.name)), ...(row.referenceNumber ? [fact("Referensi", textValue(row.referenceNumber))] : [])], comparisons: [], impacts: [fact("Piutang", textValue("Berkurang")), fact("Kas", textValue("Bertambah pada rekening penerima")), fact("Nilai perubahan", moneyValue(Number(row.amountPaid)))], notes: [], source: { label: "Buka invoice proyek", href: `/projects/${row.invoice.projectId}?tab=payments` }, evidenceIncomplete: false };
}

async function resolveRabRevision(id: string, user: ActivityUser, roleName: string): Promise<ActivityDetailView | null> {
  const row = await db.query.rabEstimate.findFirst({ where: (table) => eq(table.id, id), with: { project: true, supersedes: true, voidedBy: true, items: true, bundles: true } });
  if (!row) return null;
  await requireProject(row.projectId, user, roleName);
  const audit = await latestAudit("rab_estimate", row.id);
  const currentValue = Number(row.approvedValue);
  const previousValue = row.supersedes ? Number(row.supersedes.approvedValue) : null;
  return { kind: "RAB_REVISION", id: row.id, title: `${row.title} · R${row.revision}`, subtitle: row.project.name, status: row.status, statusTone: statusTone(row.status), occurredAt: (row.approvedAt ?? row.voidedAt ?? row.createdAt).toISOString(), actorName: row.voidedBy?.name ?? audit?.actorName ?? "Sistem",
    facts: [fact("Revisi", quantityValue(row.revision)), fact("Nilai RAB", moneyValue(currentValue)), fact("Baris client", quantityValue(row.items.filter((item) => !item.isHidden).length + row.bundles.filter((bundle) => !bundle.isHidden).length, "baris"))], comparisons: previousValue === null ? [] : [{ label: "Nilai kontrak", before: moneyValue(previousValue), after: moneyValue(currentValue) }], impacts: [fact("Perubahan nilai", moneyValue(previousValue === null ? 0 : currentValue - previousValue)), fact("Client", textValue("Hanya data client-safe yang ditampilkan"))], notes: [fact("Catatan client", textValue(row.clientNotes?.trim() || "Tidak ada catatan")), ...(row.voidReason ? [fact("Alasan dibatalkan", textValue(row.voidReason))] : [])], source: { label: "Buka RAB proyek", href: `/projects/${row.projectId}?tab=rab` }, evidenceIncomplete: audit === null };
}

async function resolveChangeOrder(id: string, user: ActivityUser, roleName: string): Promise<ActivityDetailView | null> {
  const row = await db.query.projectChangeOrder.findFirst({ where: (table) => eq(table.id, id), with: { project: true, baseRab: true, revisedRab: true, createdBy: true, approvedBy: true } });
  if (!row) return null;
  await requireProject(row.projectId, user, roleName);
  return { kind: "CHANGE_ORDER", id: row.id, title: `Change Order R${row.baseRab.revision} → R${row.revisedRab.revision}`, subtitle: row.project.name, status: row.status, statusTone: statusTone(row.status), occurredAt: (row.approvedAt ?? row.createdAt).toISOString(), actorName: row.approvedBy?.name ?? row.createdBy.name,
    facts: [fact("Pengaju", textValue(row.createdBy.name)), ...(row.approvedBy ? [fact("Approver", textValue(row.approvedBy.name))] : []), ...(row.clientConfirmationReference ? [fact("Konfirmasi client", textValue(row.clientConfirmationReference))] : [])], comparisons: [{ label: "Nilai kontrak", before: moneyValue(Number(row.previousContractValue)), after: moneyValue(Number(row.revisedContractValue)) }], impacts: [fact("Perubahan kontrak", moneyValue(Number(row.valueDelta))), fact("Status konfirmasi client", textValue(row.clientConfirmedAt ? "Sudah dikonfirmasi" : "Belum dikonfirmasi"))], notes: [fact("Alasan", textValue(row.reason)), fact("Ringkasan scope", textValue(row.scopeSummary))], source: { label: "Buka RAB proyek", href: `/projects/${row.projectId}?tab=rab` }, evidenceIncomplete: false };
}

async function resolveApproval(id: string): Promise<ActivityDetailView | null> {
  const row = await db.query.approval.findFirst({ where: (table) => eq(table.id, id), with: { approver: true } });
  if (!row) return null;
  return { kind: "APPROVAL_DECISION", id: row.id, title: "Keputusan persetujuan", subtitle: formatBusinessLabel(row.referenceType), status: row.status, statusTone: statusTone(row.status), occurredAt: row.createdAt.toISOString(), actorName: row.approver.name, facts: [fact("Jenis sumber", textValue(formatBusinessLabel(row.referenceType)))], comparisons: [], impacts: [fact("Keputusan", textValue(row.status === "APPROVED" ? "Transaksi dapat melanjutkan workflow canonical" : "Transaksi dihentikan atau dikembalikan untuk perbaikan"))], notes: [fact("Alasan keputusan", textValue(row.notes?.trim() || "Alasan keputusan belum tercatat pada data lama"))], source: null, evidenceIncomplete: !row.notes };
}

async function resolveDetail(input: ActivityDetailRequest, user: ActivityUser, roleName: string): Promise<ActivityDetailView | null> {
  switch (input.kind) {
    case "STOCK_MOVEMENT": return resolveStockMovement(input.id, user, roleName);
    case "GOODS_RECEIPT": return resolveGoodsReceipt(input.id, user, roleName);
    case "STOCK_TRANSFER": return resolveStockTransfer(input.id);
    case "STOCK_COUNT": return resolveStockCount(input.id);
    case "INVENTORY_OPENING": return resolveOpening(input.id);
    case "PROJECT_COST": return resolveProjectCost(input.id, user, roleName);
    case "VENDOR_BILL": return resolveVendorBill(input.id, user, roleName);
    case "VENDOR_PAYMENT": return resolveVendorPayment(input.id, user, roleName);
    case "CASH_TRANSACTION": return resolveCashTransaction(input.id);
    case "CLIENT_INVOICE": return resolveClientInvoice(input.id, user, roleName);
    case "CLIENT_PAYMENT": return resolveClientPayment(input.id, user, roleName);
    case "RAB_REVISION": return resolveRabRevision(input.id, user, roleName);
    case "CHANGE_ORDER": return resolveChangeOrder(input.id, user, roleName);
    case "APPROVAL_DECISION": return resolveApproval(input.id);
  }
}

export async function getActivityDetail(input: unknown): Promise<ActionResponse<ActivityDetailView>> {
  const parsed = activityDetailRequestSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: { code: "VALIDATION_ERROR", message: "Referensi aktivitas tidak valid." } };
  const session = await auth.api.getSession({ headers: { cookie: (await cookies()).toString() } });
  if (!session?.user) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertPermission(session.user, permissionByKind[parsed.data.kind]);
    const roleName = await resolveRoleName(session.user.roleId);
    const detail = await resolveDetail(parsed.data, { id: session.user.id, roleId: session.user.roleId }, roleName);
    if (!detail) return { success: false, error: { code: "NOT_FOUND", message: "Aktivitas tidak ditemukan atau sumbernya sudah tidak tersedia." } };
    return { success: true, data: detail };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Detail aktivitas belum dapat dimuat.";
    const forbidden = message.includes("UNAUTHORIZED") || message.includes("FORBIDDEN");
    return { success: false, error: { code: forbidden ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR", message: forbidden ? "Anda tidak memiliki akses ke detail aktivitas ini." : message } };
  }
}
