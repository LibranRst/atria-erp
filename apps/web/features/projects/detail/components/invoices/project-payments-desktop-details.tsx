"use client";

import React from "react";
import {
  Button,
  FactRow,
  GroupedSurface,
  MoneyValue,
  SectionHeader,
  StatusBadge,
} from "@/components/ui";
import type { ClientInvoiceItem } from "../../types/project-invoices-types";
import {
  calculateInvoicePaidAmount,
  calculateInvoiceRemaining,
} from "../../utils/project-invoices-utils";
import {
  invoiceStageLabel,
  invoiceStatusLabel,
  projectInvoiceDisplayStatus,
  type ProjectReceiptRow,
} from "./project-payments-desktop-model";

const formatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});
export function paymentDateLabel(value: Date): string {
  return formatter.format(new Date(value));
}
export function ProjectPaymentAmount({
  amount,
  exact = false,
  danger = false,
}: {
  readonly amount: number;
  readonly exact?: boolean;
  readonly danger?: boolean;
}): React.JSX.Element {
  return (
    <MoneyValue
      amount={amount}
      variant={exact ? "fullDynamic" : "compact"}
      fractionDigits={exact && !Number.isInteger(amount) ? 2 : undefined}
      size="sm"
      tone={danger ? "danger" : "default"}
      align="right"
    />
  );
}
export function InvoiceStatus({
  invoice,
}: {
  readonly invoice: ClientInvoiceItem;
}): React.JSX.Element {
  return (
    <StatusBadge
      label={invoiceStatusLabel(projectInvoiceDisplayStatus(invoice))}
      tone={projectInvoiceDisplayStatus(invoice) === "OVERDUE" ? "warning" : "neutral"}
    />
  );
}
export function InvoiceDesktopDetail({
  invoice,
  canRecordPayment,
  onRecordPayment,
  onOpenInvoice,
  onOpenReceipt,
}: {
  readonly invoice: ClientInvoiceItem;
  readonly canRecordPayment: boolean;
  readonly onRecordPayment: (invoice: ClientInvoiceItem) => void;
  readonly onOpenInvoice: (invoice: ClientInvoiceItem) => void;
  readonly onOpenReceipt: (id: string) => void;
}): React.JSX.Element {
  const remaining = calculateInvoiceRemaining(invoice);
  const paid = calculateInvoicePaidAmount(invoice);
  const receipts = [...invoice.payments].sort(
    (left, right) => new Date(right.paymentDate).getTime() - new Date(left.paymentDate).getTime(),
  );
  return (
    <section aria-label="Rincian invoice" className="min-w-0 space-y-3">
      <SectionHeader title="Rincian invoice" />
      <GroupedSurface variant="desktopPanel">
        <div className="space-y-2 p-4">
          <h3 className="text-sm font-semibold wrap-anywhere">{invoice.invoiceNumber}</h3>
          <p className="text-support text-on-surface-variant">{invoiceStageLabel(invoice.stage)}</p>
          <InvoiceStatus invoice={invoice} />
        </div>
        <div className="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
          <FactRow
            label="Nilai invoice"
            value={<ProjectPaymentAmount amount={Number(invoice.amount)} exact />}
          />
          <FactRow
            label="Kas diterima"
            value={<ProjectPaymentAmount amount={calculateInvoicePaidAmount(invoice)} exact />}
          />
          <FactRow
            label="Sisa piutang"
            value={
              <ProjectPaymentAmount
                amount={remaining}
                danger={projectInvoiceDisplayStatus(invoice) === "OVERDUE"}
                exact
              />
            }
          />
          <FactRow label="Jatuh tempo" value={paymentDateLabel(invoice.dueDate)} />
          <FactRow label="Dibuat" value={paymentDateLabel(invoice.createdAt)} />
        </div>
        {invoice.status !== "VOID" && paid > Number(invoice.amount) && (
          <p className="border-t border-outline-variant/20 p-4 text-support leading-relaxed text-error">
            Penerimaan melebihi nilai invoice. Periksa riwayat kas sebelum menutup proyek.
          </p>
        )}
        {invoice.status === "VOID" && (
          <p className="border-t border-outline-variant/20 p-4 text-support leading-relaxed text-on-surface-variant">
            Invoice dibatalkan dan tidak dihitung sebagai piutang aktif. Penerimaan yang sudah
            tercatat tetap menjadi riwayat kas.
          </p>
        )}
        <div className="space-y-2 border-t border-outline-variant/20 p-4">
          <h4 className="text-support font-semibold">Riwayat penerimaan · {receipts.length}</h4>
          {receipts.length ? (
            <div className="divide-y divide-outline-variant/20">
              {receipts.map((receipt) => (
                <Button
                  key={receipt.id}
                  type="button"
                  variant="ghost"
                  size="compact"
                  fullWidth
                  className="h-auto! justify-start! py-3! text-left"
                  onClick={(): void => onOpenReceipt(receipt.id)}
                >
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="text-support font-medium">
                      {paymentDateLabel(receipt.paymentDate)}
                    </span>
                    <span className="text-support wrap-anywhere text-on-surface-variant">
                      {receipt.referenceNumber || "Tanpa nomor referensi"}
                    </span>
                    <ProjectPaymentAmount amount={Number(receipt.amountPaid)} exact />
                  </span>
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-support text-on-surface-variant">
              Belum ada penerimaan kas untuk invoice ini.
            </p>
          )}
        </div>
        <div className="space-y-2 border-t border-outline-variant/20 p-4">
          {canRecordPayment && remaining > 0 && invoice.status !== "VOID" && (
            <Button
              type="button"
              variant="primary"
              size="compact"
              fullWidth
              onClick={(): void => onRecordPayment(invoice)}
            >
              Catat penerimaan
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="compact"
            fullWidth
            onClick={(): void => onOpenInvoice(invoice)}
          >
            Buka detail invoice
          </Button>
        </div>
      </GroupedSurface>
    </section>
  );
}
export function ReceiptDesktopDetail({
  receipt,
  onOpenInvoice,
  onOpenReceipt,
}: {
  readonly receipt: ProjectReceiptRow;
  readonly onOpenInvoice: (invoice: ClientInvoiceItem) => void;
  readonly onOpenReceipt: (id: string) => void;
}): React.JSX.Element {
  return (
    <section aria-label="Rincian penerimaan" className="min-w-0 space-y-3">
      <SectionHeader title="Rincian penerimaan" />
      <GroupedSurface variant="desktopPanel">
        <div className="space-y-2 p-4">
          <h3 className="text-sm font-semibold wrap-anywhere">{receipt.invoice.invoiceNumber}</h3>
          <p className="text-support text-on-surface-variant">
            {invoiceStageLabel(receipt.invoice.stage)}
          </p>
          <StatusBadge label="Kas tercatat" tone="neutral" />
        </div>
        <div className="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
          <FactRow
            label="Dana diterima"
            value={<ProjectPaymentAmount amount={Number(receipt.amountPaid)} exact />}
          />
          <FactRow label="Tanggal terima" value={paymentDateLabel(receipt.paymentDate)} />
          <FactRow
            label="Referensi"
            layout="stacked"
            wrapLabel
            value={receipt.referenceNumber || "Belum dicantumkan"}
          />
          <FactRow
            label="Status invoice"
            value={invoiceStatusLabel(projectInvoiceDisplayStatus(receipt.invoice))}
          />
        </div>
        <p className="border-t border-outline-variant/20 p-4 text-support leading-relaxed text-on-surface-variant">
          Ini adalah penerimaan kas yang sudah dicatat, terpisah dari nilai dan jatuh tempo invoice.
        </p>
        <div className="space-y-2 border-t border-outline-variant/20 p-4">
          <Button
            type="button"
            variant="primary"
            size="compact"
            fullWidth
            onClick={(): void => onOpenReceipt(receipt.id)}
          >
            Buka detail penerimaan
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            fullWidth
            onClick={(): void => onOpenInvoice(receipt.invoice)}
          >
            Lihat invoice terkait
          </Button>
        </div>
      </GroupedSurface>
    </section>
  );
}
