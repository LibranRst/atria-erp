"use client";

import React from "react";

import { Badge } from "@/components/ui/badge";
import {
  MetricGrid,
  MoneyMetricPill,
  MoneyValue,
} from "@/components/ui/page-primitives";
import type { ClientInvoiceItem } from "./project-invoices-types";
import {
  calculateInvoicePaidAmount,
  calculateInvoiceRemaining,
} from "./project-invoices-utils";

export function ProjectInvoicesList({
  invoices,
  isOwnerOrFinance,
  onRecordPayment,
}: {
  readonly invoices: readonly ClientInvoiceItem[];
  readonly isOwnerOrFinance: boolean;
  readonly onRecordPayment: (invoice: ClientInvoiceItem) => void;
}): React.JSX.Element {
  return (
    <div className="rounded-[28px] border border-outline-variant/20 bg-white p-md shadow-[0_14px_34px_rgba(17,17,17,0.045)]">
      <div className="mb-sm flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
            Invoice List
          </p>
          <h3 className="text-[17px] font-semibold leading-6 text-on-surface">
            Daftar Termin Penagihan
          </h3>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-container-low py-10 text-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-on-surface-variant shadow-sm">
            <span className="material-symbols-outlined text-[20px]">
              receipt_long
            </span>
          </div>
          <p className="font-sans text-[12px] leading-[18px] text-on-surface-variant">
            Tidak ada invoice/tagihan klien yang terbit untuk proyek ini.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-outline-variant/35 overflow-hidden rounded-2xl bg-surface-container-low">
          {invoices.map((invoice) => (
            <ProjectInvoiceCard
              key={invoice.id}
              invoice={invoice}
              isOwnerOrFinance={isOwnerOrFinance}
              onRecordPayment={onRecordPayment}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectInvoiceCard({
  invoice,
  isOwnerOrFinance,
  onRecordPayment,
}: {
  readonly invoice: ClientInvoiceItem;
  readonly isOwnerOrFinance: boolean;
  readonly onRecordPayment: (invoice: ClientInvoiceItem) => void;
}): React.JSX.Element {
  const amount = Number(invoice.amount);
  const totalPaid = calculateInvoicePaidAmount(invoice);
  const remaining = calculateInvoiceRemaining(invoice);

  return (
    <div className="space-y-md p-md">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
            Nomor Invoice
          </span>
          <h4 className="text-sm font-bold text-on-surface">
            {invoice.invoiceNumber}
          </h4>
        </div>
        <Badge status={invoice.status}>{invoice.status}</Badge>
      </div>

      <div className="border-t border-outline-variant/5 pt-2">
        <MetricGrid minColumnWidth={118}>
          <MoneyMetricPill
            label="Nominal Tagihan"
            amount={amount}
          />
          <MoneyMetricPill
            label="Sisa Tagihan"
            amount={remaining}
            tone={remaining > 0 ? "danger" : "primary"}
          />
        </MetricGrid>
      </div>

      {invoice.payments.length > 0 && (
        <div className="space-y-1 rounded-xl bg-white/70 p-2 text-xs font-semibold">
          <span className="block border-b border-outline-variant/10 pb-1 text-[8px] font-bold uppercase tracking-wide text-on-surface-variant">
            Riwayat Pembayaran Termin
          </span>
          <div className="space-y-1 pt-1">
            {invoice.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between text-[10px]"
              >
                <span className="max-w-[180px] truncate text-on-surface-variant">
                  {new Date(payment.paymentDate).toLocaleDateString("id-ID")} (
                  {payment.referenceNumber})
                </span>
                <MoneyValue
                  amount={Number(payment.amountPaid)}
                  variant="compactWithFull"
                  prefix="+"
                  tone="primary"
                  align="right"
                  size="sm"
                  className="ml-2 shrink-0"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {remaining > 0 && isOwnerOrFinance && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => onRecordPayment(invoice)}
            className="flex h-9 cursor-pointer items-center justify-center gap-1 rounded-full bg-primary px-4 text-[11px] font-bold text-on-primary shadow-sm transition-all hover:bg-primary/95 active:scale-95"
          >
            <span className="material-symbols-outlined text-[14px]">add_card</span>
            Catat Pembayaran
          </button>
        </div>
      )}
      {totalPaid > amount && (
        <p className="rounded-2xl bg-error-container/20 px-3 py-2 text-[10px] font-bold text-error">
          Pembayaran tercatat melebihi nominal invoice.
        </p>
      )}
    </div>
  );
}
