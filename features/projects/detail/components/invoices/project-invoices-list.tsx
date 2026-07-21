"use client";

import React from "react";

import { Badge } from "@/components/ui/badge";
import { MoneyValue } from "@/components/ui/page-primitives";
import type { ClientInvoiceItem } from "./project-invoices-types";
import { calculateInvoicePaidAmount, calculateInvoiceRemaining } from "./project-invoices-utils";
import {
  ActivityDetailChevron,
  useActivityDetail,
} from "@/features/activity-detail/components/activity-detail-provider";

export function ProjectInvoicesList({
  invoices,
  isOwnerOrFinance,
  onRecordPayment,
}: {
  readonly invoices: readonly ClientInvoiceItem[];
  readonly isOwnerOrFinance: boolean;
  readonly onRecordPayment: (invoice: ClientInvoiceItem) => void;
}): React.JSX.Element {
  const orderedInvoices = [...invoices].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );
  return (
    <section className="space-y-2.5">
      <header className="px-1">
        <h2 className="text-[17px] leading-6 font-semibold text-on-surface">Termin penagihan</h2>
        <p className="mt-0.5 text-[11px] leading-4 text-on-surface-variant">
          Urut berdasarkan tanggal jatuh tempo.
        </p>
      </header>
      {orderedInvoices.length === 0 ? (
        <div className="rounded-[22px] bg-white px-4 py-4 text-xs leading-5 text-on-surface-variant shadow-[0_10px_26px_rgba(17,17,17,0.04)]">
          <span className="font-bold text-on-surface">Belum ada invoice.</span> Buat termin saat
          jadwal penagihan klien sudah siap.
        </div>
      ) : (
        <div className="rounded-3xl bg-white px-4 py-2 shadow-[0_12px_30px_rgba(17,17,17,0.05)] ring-1 ring-black/2.5">
          {orderedInvoices.map((invoice, index) => (
            <ProjectInvoiceTimelineRow
              key={invoice.id}
              invoice={invoice}
              isOwnerOrFinance={isOwnerOrFinance}
              onRecordPayment={onRecordPayment}
              connected={index < orderedInvoices.length - 1}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectInvoiceTimelineRow({
  invoice,
  isOwnerOrFinance,
  onRecordPayment,
  connected,
}: {
  readonly invoice: ClientInvoiceItem;
  readonly isOwnerOrFinance: boolean;
  readonly onRecordPayment: (invoice: ClientInvoiceItem) => void;
  readonly connected: boolean;
}): React.JSX.Element {
  const { openActivityDetail } = useActivityDetail();
  const amount = Number(invoice.amount);
  const totalPaid = calculateInvoicePaidAmount(invoice);
  const remaining = calculateInvoiceRemaining(invoice);
  const due = new Date(invoice.dueDate);
  const isCritical = invoice.status === "OVERDUE";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openActivityDetail({ kind: "CLIENT_INVOICE", id: invoice.id })}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openActivityDetail({ kind: "CLIENT_INVOICE", id: invoice.id });
        }
      }}
      className="relative flex min-h-12 gap-3 py-3 outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/70"
      aria-label={`Lihat detail invoice ${invoice.invoiceNumber}`}
    >
      {connected ? (
        <span
          className="absolute top-11 -bottom-sm left-4.25 w-px bg-outline-variant/45"
          aria-hidden="true"
        />
      ) : null}
      <div className="relative z-10 flex w-9 shrink-0 flex-col items-center gap-0.5 rounded-xl bg-surface-container-low py-1 ring-4 ring-white">
        <span className="font-mono text-[12px] font-black">
          {due.toLocaleDateString("id-ID", { day: "2-digit" })}
        </span>
        <span className="text-[7px] font-bold text-on-surface-variant uppercase">
          {due.toLocaleDateString("id-ID", { month: "short" })}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-on-surface">{invoice.invoiceNumber}</p>
            <p className="mt-0.5 text-[10px] text-on-surface-variant">
              Jatuh tempo{" "}
              {due.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <Badge status={invoice.status}>
            {invoice.status === "PARTIALLY_PAID"
              ? "Sebagian"
              : invoice.status === "UNPAID"
                ? "Belum dibayar"
                : invoice.status === "OVERDUE"
                  ? "Terlambat"
                  : invoice.status === "PAID"
                    ? "Lunas"
                    : "Dibatalkan"}
          </Badge>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-[8px] font-bold tracking-wide text-on-surface-variant uppercase">
              Sisa dari tagihan
            </p>
            <MoneyValue
              amount={remaining}
              variant="compactWithFull"
              tone={isCritical ? "danger" : "default"}
              size="sm"
            />
          </div>
          {remaining > 0 && isOwnerOrFinance ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRecordPayment(invoice);
              }}
              className="inline-flex min-h-12 shrink-0 items-center rounded-full bg-primary/7 px-4 text-[11px] font-bold text-primary"
            >
              Catat bayar
            </button>
          ) : (
            <ActivityDetailChevron />
          )}
        </div>
        {invoice.payments.length > 0 ? (
          <div className="mt-2 space-y-1">
            <p className="text-[9px] text-on-surface-variant">
              {invoice.payments.length} pembayaran · diterima Rp {totalPaid.toLocaleString("id-ID")}
            </p>
            {invoice.payments.map((payment) => (
              <button
                key={payment.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openActivityDetail({ kind: "CLIENT_PAYMENT", id: payment.id });
                }}
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-full bg-surface-container-low px-3 text-left text-[10px] font-semibold text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
              >
                <span>
                  {new Date(payment.paymentDate).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-2 font-mono font-bold tabular-nums">
                  Rp {Number(payment.amountPaid).toLocaleString("id-ID")}
                  <ActivityDetailChevron />
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {totalPaid > amount ? (
          <p className="mt-2 text-[10px] font-bold text-error">
            Pembayaran melebihi nominal invoice.
          </p>
        ) : null}
      </div>
    </div>
  );
}
