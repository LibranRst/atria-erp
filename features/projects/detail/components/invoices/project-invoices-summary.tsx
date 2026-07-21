"use client";

import React from "react";

import { MoneyValue } from "@/components/ui/page-primitives";

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
  const billedCoverage = contractValue > 0 ? (totalInvoiceAmount / contractValue) * 100 : 0;
  return (
    <section className="bg-primary rounded-[28px] p-5 text-white shadow-[0_16px_38px_rgba(17,17,17,0.13)] max-[430px]:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold tracking-[0.16em] text-white/55 uppercase">
            Sisa tagihan klien
          </p>
          <MoneyValue
            amount={unpaidAmount}
            variant="fullDynamic"
            tone={unpaidAmount > 0 ? "danger" : "inverse"}
            size="hero"
            className="mt-1"
          />
          <p className="mt-1 text-[10px] text-white/60">
            {invoicesCount} termin · {billedCoverage.toFixed(0)}% nilai kontrak sudah ditagihkan
          </p>
        </div>
        {isOwnerOrFinance ? (
          <button
            type="button"
            onClick={onCreateInvoiceClick}
            className="text-primary inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-[11px] font-bold"
          >
            <span className="material-symbols-outlined text-[17px]">add</span> Invoice
          </button>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-3 divide-x divide-white/12 border-t border-white/12 pt-4">
        <InvoiceFact label="Kontrak" amount={contractValue} />
        <InvoiceFact label="Ditagihkan" amount={totalInvoiceAmount} align="center" />
        <InvoiceFact label="Diterima" amount={totalPaidAmount} align="right" />
      </div>
      {isOwnerOrFinance && invoicesCount === 0 ? (
        <button
          type="button"
          onClick={onGenerateSchedule}
          disabled={schedulePending || contractValue <= 0}
          className="mt-4 min-h-12 w-full rounded-full bg-white/10 px-4 text-xs font-bold text-white ring-1 ring-white/15 disabled:opacity-40"
        >
          {schedulePending ? "Membuat termin…" : "Buat termin 30% · 35% · 25% · 10%"}
        </button>
      ) : null}
      {createError || createSuccess ? (
        <p
          className={`mt-3 rounded-[16px] px-3 py-2 text-[11px] ${createError ? "bg-error/18 text-[#ffb5ae]" : "bg-white/10 text-white"}`}
        >
          {createError ?? createSuccess}
        </p>
      ) : null}
    </section>
  );
}

function InvoiceFact({
  label,
  amount,
  align = "left",
}: {
  readonly label: string;
  readonly amount: number;
  readonly align?: "left" | "center" | "right";
}): React.JSX.Element {
  const className =
    align === "center" ? "px-2 text-center" : align === "right" ? "pl-2 text-right" : "pr-2";
  return (
    <div className={className}>
      <p className="truncate text-[8px] font-bold tracking-wide text-white/50 uppercase">{label}</p>
      <MoneyValue
        amount={amount}
        variant="compactWithFull"
        tone="inverse"
        size="xs"
        align={align === "right" ? "right" : "left"}
        className={align === "center" ? "text-center" : ""}
      />
    </div>
  );
}
