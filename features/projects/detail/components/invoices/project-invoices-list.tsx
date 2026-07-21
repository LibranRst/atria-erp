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
        <h2 className="text-on-surface text-[17px] leading-6 font-semibold">Termin penagihan</h2>
        <p className="text-on-surface-variant mt-0.5 text-[11px] leading-4">
          Urut berdasarkan tanggal jatuh tempo.
        </p>
      </header>
      {orderedInvoices.length === 0 ? (
        <div className="text-on-surface-variant rounded-[22px] bg-white px-4 py-4 text-xs leading-5 shadow-[0_10px_26px_rgba(17,17,17,0.04)]">
          <span className="text-on-surface font-bold">Belum ada invoice.</span> Buat termin saat
          jadwal penagihan klien sudah siap.
        </div>
      ) : (
        <div className="rounded-[24px] bg-white px-4 py-2 shadow-[0_12px_30px_rgba(17,17,17,0.05)] ring-1 ring-black/2.5">
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
      className="focus-visible:bg-surface-container-low active:bg-surface-container-low/70 relative flex min-h-12 gap-3 py-3 outline-none"
      aria-label={`Lihat detail invoice ${invoice.invoiceNumber}`}
    >
      {connected ? (
        <span
          className="-bottom-sm bg-outline-variant/45 absolute top-11 left-[17px] w-px"
          aria-hidden="true"
        />
      ) : null}
      <div className="bg-surface-container-low relative z-10 flex w-9 shrink-0 flex-col items-center gap-0.5 rounded-[12px] py-1 ring-4 ring-white">
        <span className="font-mono text-[12px] font-black">
          {due.toLocaleDateString("id-ID", { day: "2-digit" })}
        </span>
        <span className="text-on-surface-variant text-[7px] font-bold uppercase">
          {due.toLocaleDateString("id-ID", { month: "short" })}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-on-surface truncate text-xs font-bold">{invoice.invoiceNumber}</p>
            <p className="text-on-surface-variant mt-0.5 text-[10px]">
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
            <p className="text-on-surface-variant text-[8px] font-bold tracking-wide uppercase">
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
              className="bg-primary/7 text-primary inline-flex min-h-12 shrink-0 items-center rounded-full px-4 text-[11px] font-bold"
            >
              Catat bayar
            </button>
          ) : (
            <ActivityDetailChevron />
          )}
        </div>
        {invoice.payments.length > 0 ? (
          <div className="mt-2 space-y-1">
            <p className="text-on-surface-variant text-[9px]">
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
                className="bg-surface-container-low text-on-surface focus-visible:ring-primary/25 flex min-h-12 w-full items-center justify-between gap-3 rounded-full px-3 text-left text-[10px] font-semibold outline-none focus-visible:ring-2"
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
          <p className="text-error mt-2 text-[10px] font-bold">
            Pembayaran melebihi nominal invoice.
          </p>
        ) : null}
      </div>
    </div>
  );
}
