"use client";

import React from "react";

import { MoneyValue } from "@/components/ui/feedback/page-primitives";
import { AppIcon } from "@/components/ui/icon/app-icon";
import { cn } from "@/lib/utils/cn";

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
    <section className="rounded-[28px] bg-primary p-5 text-white shadow-inverse max-[430px]:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold tracking-[0.16em] text-white/55 uppercase">
            Sisa tagihan klien
          </p>
          <MoneyValue
            amount={unpaidAmount}
            variant="fullDynamic"
            tone="inverse"
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
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white ring-1 ring-white/15"
          >
            <AppIcon name="add" className="text-[17px]" /> Invoice
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex flex-row gap-3">
        <InvoiceFact label="Kontrak" amount={contractValue} />
        <InvoiceFact label="Ditagihkan" amount={totalInvoiceAmount} />
        <InvoiceFact label="Diterima" amount={totalPaidAmount} />
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
          className={`mt-3 rounded-2xl px-3 py-2 text-[11px] ${createError ? "bg-error/18 text-critical-on-inverse" : "bg-white/10 text-white"}`}
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
    <div className={cn("flex w-full flex-col gap-2 rounded-2xl bg-white/7.5 p-3", className)}>
      <p className="truncate text-[8px] leading-none font-bold tracking-wide text-white/50 uppercase">
        {label}
      </p>
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
