"use client";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";

import { AppIcon, Badge, MoneyValue, DesktopTable, GroupedSurface } from "@/components/ui";
import type { ClientInvoiceItem } from "../../types/project-invoices-types";
import {
  calculateInvoicePaidAmount,
  calculateInvoiceRemaining,
} from "../../utils/project-invoices-utils";
import {
  ActivityDetailChevron,
  useActivityDetail,
} from "@/features/activity-detail/components/activity-detail-provider";

export function ProjectInvoicesList({
  invoices,
  canRecordPayment,
  onRecordPayment,
}: {
  readonly invoices: readonly ClientInvoiceItem[];
  readonly canRecordPayment: boolean;
  readonly onRecordPayment: (invoice: ClientInvoiceItem) => void;
}): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const orderedInvoices = [...invoices].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );
  const selected =
    orderedInvoices.find((invoice) => invoice.id === selectedId) ?? orderedInvoices[0];
  return (
    <section className="space-y-2.5">
      <header className="px-1">
        <h2 className="text-title font-semibold text-on-surface">Termin penagihan</h2>
        <p className="mt-0.5 text-support text-on-surface-variant">
          Urut berdasarkan tanggal jatuh tempo.
        </p>
      </header>
      {orderedInvoices.length === 0 ? (
        <div className="rounded-[22px] bg-white px-4 py-4 text-xs leading-5 text-on-surface-variant shadow-surface">
          <span className="font-bold text-on-surface">Belum ada invoice.</span> Buat termin saat
          jadwal penagihan klien sudah siap.
        </div>
      ) : desktop ? (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.65fr)]">
          <DesktopTable
            ariaLabel="Termin penagihan klien"
            rows={orderedInvoices}
            rowKey={(invoice) => invoice.id}
            selectedRowKey={selected?.id}
            onRowAction={(invoice) => setSelectedId(invoice.id)}
            columns={[
              { key: "invoice", label: "Invoice", render: (invoice) => invoice.invoiceNumber },
              {
                key: "due",
                label: "Jatuh tempo",
                render: (invoice) =>
                  new Date(invoice.dueDate).toLocaleDateString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  }),
              },
              {
                key: "amount",
                label: "Tagihan",
                align: "end",
                render: (invoice) => (
                  <MoneyValue amount={Number(invoice.amount)} variant="compact" size="sm" />
                ),
              },
              {
                key: "paid",
                label: "Diterima",
                align: "end",
                render: (invoice) => (
                  <MoneyValue
                    amount={calculateInvoicePaidAmount(invoice)}
                    variant="compact"
                    size="sm"
                  />
                ),
              },
              {
                key: "remaining",
                label: "Sisa",
                align: "end",
                render: (invoice) => (
                  <MoneyValue
                    amount={calculateInvoiceRemaining(invoice)}
                    variant="compact"
                    size="sm"
                  />
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (invoice) => formatBusinessLabel(invoice.status),
              },
            ]}
          />
          {selected ? (
            <section aria-label="Detail invoice" className="min-w-0 xl:sticky xl:top-24">
              <GroupedSurface>
                <ProjectInvoiceTimelineRow
                  invoice={selected}
                  canRecordPayment={canRecordPayment}
                  onRecordPayment={onRecordPayment}
                  connected={false}
                />
              </GroupedSurface>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-3xl bg-white p-2 shadow-surface ring-1 ring-ring-subtle">
          {orderedInvoices.map((invoice, index) => (
            <ProjectInvoiceTimelineRow
              key={invoice.id}
              invoice={invoice}
              canRecordPayment={canRecordPayment}
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
  canRecordPayment,
  onRecordPayment,
  connected,
}: {
  readonly invoice: ClientInvoiceItem;
  readonly canRecordPayment: boolean;
  readonly onRecordPayment: (invoice: ClientInvoiceItem) => void;
  readonly connected: boolean;
}): React.JSX.Element {
  const { openActivityDetail } = useActivityDetail();
  const amount = Number(invoice.amount);
  const totalPaid = calculateInvoicePaidAmount(invoice);
  const remaining = calculateInvoiceRemaining(invoice);
  const due = new Date(invoice.dueDate);
  const isCritical = invoice.status === "OVERDUE";
  const handleOpenDetail = React.useCallback(() => {
    openActivityDetail(
      { kind: "CLIENT_INVOICE", id: invoice.id },
      remaining > 0 && canRecordPayment
        ? {
            actions: {
              primary: {
                label: "Catat Pembayaran",
                onClick: () => onRecordPayment(invoice),
              },
            },
          }
        : remaining <= 0
          ? {
              footerStatus: {
                label: "Invoice telah lunas",
                tone: "success",
              },
            }
          : undefined,
    );
  }, [openActivityDetail, invoice, remaining, canRecordPayment, onRecordPayment]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpenDetail}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleOpenDetail();
        }
      }}
      className="relative flex min-h-12 gap-3 rounded-2xl p-2 transition-all outline-none focus-visible:bg-surface-container-low active:scale-98 active:bg-surface-container-low/40"
      aria-label={`Lihat detail invoice ${invoice.invoiceNumber}`}
    >
      {connected ? (
        <span
          className="absolute top-11 -bottom-sm left-6 w-px bg-outline-variant/45"
          aria-hidden="true"
        />
      ) : null}
      <div className="relative z-10 flex w-9 shrink-0 flex-col items-center gap-0.5 rounded-xl bg-surface-container-low py-1 ring-4 ring-white">
        <span className="font-mono text-[12px] leading-5 font-black">
          {due.toLocaleDateString("id-ID", { day: "2-digit" })}
        </span>
        <span className="text-[7px] leading-6 font-bold text-on-surface-variant uppercase">
          {due.toLocaleDateString("id-ID", { month: "short" })}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs leading-5 font-bold text-on-surface">
              {invoice.invoiceNumber}
            </p>
            <p className="text-meta text-on-surface-variant">
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
            {remaining <= 0 ? (
              <>
                <p className="text-[8px] leading-5 font-bold tracking-wide text-success uppercase">
                  Total diterima
                </p>
                <div className="flex items-center gap-1">
                  <AppIcon name="check_circle" className="text-[13px] text-success" />
                  <MoneyValue amount={totalPaid} variant="compact" tone="default" size="sm" />
                </div>
              </>
            ) : (
              <>
                <p className="text-[8px] leading-5 font-bold tracking-wide text-on-surface-variant uppercase">
                  Sisa dari tagihan
                </p>
                <MoneyValue
                  amount={remaining}
                  variant="compact"
                  tone={isCritical ? "danger" : "default"}
                  size="sm"
                />
              </>
            )}
          </div>
          {remaining > 0 && canRecordPayment ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRecordPayment(invoice);
              }}
              className="inline-flex min-h-12 shrink-0 items-center rounded-full bg-primary/7 px-4 text-support font-bold text-primary"
            >
              Catat bayar
            </button>
          ) : (
            <ActivityDetailChevron />
          )}
        </div>
        {invoice.payments.length > 0 ? (
          <div className="mt-2 space-y-1">
            <p className="text-[9px] leading-5 text-on-surface-variant">
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
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-surface-container-low p-2 text-left text-meta font-semibold text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
          <p className="mt-2 text-meta font-bold text-error">
            Pembayaran melebihi nominal invoice.
          </p>
        ) : null}
      </div>
    </div>
  );
}
