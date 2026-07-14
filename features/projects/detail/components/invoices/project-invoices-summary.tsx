"use client";

import React from "react";

import { MetricGrid, MoneyMetricPill } from "@/components/ui/page-primitives";

export function ProjectInvoicesSummary({
  isOwnerOrFinance,
  invoicesCount,
  contractValue,
  schedulePending,
  createError,
  createSuccess,
  totalInvoiceAmount,
  totalPaidAmount,
  unpaidAmount,
  onCreateInvoiceClick,
  onGenerateSchedule,
}: {
  readonly isOwnerOrFinance: boolean;
  readonly invoicesCount: number;
  readonly contractValue: number;
  readonly schedulePending: boolean;
  readonly createError: string | null;
  readonly createSuccess: string | null;
  readonly totalInvoiceAmount: number;
  readonly totalPaidAmount: number;
  readonly unpaidAmount: number;
  readonly onCreateInvoiceClick: () => void;
  readonly onGenerateSchedule: () => void;
}): React.JSX.Element {
  return (
    <div className="rounded-[28px] border border-outline-variant/20 bg-white p-md shadow-[0_14px_34px_rgba(17,17,17,0.045)]">
      <div className="mb-sm flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
            Client Payments
          </p>
          <h3 className="text-[17px] font-semibold leading-6 text-on-surface">
            Tagihan Klien
          </h3>
        </div>
        {isOwnerOrFinance && (
          <button
            type="button"
            onClick={onCreateInvoiceClick}
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold text-on-primary shadow-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            Buat Invoice
          </button>
        )}
      </div>
      {isOwnerOrFinance && invoicesCount === 0 && (
        <button
          type="button"
          onClick={onGenerateSchedule}
          disabled={schedulePending || contractValue <= 0}
          className="mb-sm min-h-11 w-full rounded-full bg-primary/8 px-4 text-xs font-bold text-primary ring-1 ring-primary/15 disabled:opacity-40"
        >
          {schedulePending
            ? "Membuat termin…"
            : "Generate termin 30% · 35% · 25% · 10%"}
        </button>
      )}
      {(createError || createSuccess) && (
        <p
          className={`mb-sm rounded-2xl px-3 py-2 text-[11px] ${
            createError ? "bg-error-container/30 text-error" : "bg-primary/5 text-primary"
          }`}
        >
          {createError ?? createSuccess}
        </p>
      )}

      <MetricGrid balanceLastRow>
        <MoneyMetricPill
          label="Total Tagihan"
          amount={totalInvoiceAmount}
        />
        <MoneyMetricPill
          label="Terbayar"
          amount={totalPaidAmount}
          tone="primary"
        />
        <MoneyMetricPill
          label="Sisa"
          amount={unpaidAmount}
          tone={unpaidAmount > 0 ? "danger" : "primary"}
        />
      </MetricGrid>
    </div>
  );
}
