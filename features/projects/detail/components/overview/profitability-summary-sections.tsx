"use client";

import React from "react";

import { MoneyValue } from "@/components/ui/feedback/page-primitives";
import { cn } from "@/lib/utils/cn";

export function ProfitProjectionSection({
  contractValue,
  totalAllocated,
  projectedGrossProfit,
  projectedGrossMargin,
  totalRemaining,
}: {
  readonly contractValue: number;
  readonly totalAllocated: number;
  readonly projectedGrossProfit: number;
  readonly projectedGrossMargin: number;
  readonly totalRemaining: number;
}): React.JSX.Element {
  const risky = projectedGrossProfit < 0 || projectedGrossMargin < 10;
  return (
    <section className="rounded-[28px] bg-primary p-5 text-white shadow-inverse max-[430px]:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold tracking-[0.16em] text-white/55 uppercase">
            Margin proyeksi
          </p>
          <MoneyValue
            amount={projectedGrossProfit}
            variant="fullDynamic"
            tone={projectedGrossProfit < 0 ? "danger" : "inverse"}
            size="hero"
            className="mt-1"
          />
          <p className="mt-1 text-[10px] text-white/60">
            Nilai kontrak dikurangi plafon budget internal
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${risky ? "bg-error/20 text-[#ffb5ae]" : "bg-white/10 text-white"}`}
        >
          {projectedGrossMargin.toFixed(1)}%
        </span>
      </div>
      <div className="mt-2 flex flex-row gap-3">
        <MarginFact label="Kontrak" amount={contractValue} />
        <MarginFact label="Plafon" amount={totalAllocated} />
        <MarginFact label="Sisa plafon" amount={totalRemaining} danger={totalRemaining < 0} />
      </div>
      <div className="mt-3 rounded-[18px] bg-white/[0.07] px-3 py-2.5 text-meta text-white/65">
        {risky
          ? "Margin berada di bawah batas aman. Periksa realisasi biaya dan perubahan scope."
          : "Margin proyeksi masih positif berdasarkan budget yang disetujui."}
      </div>
    </section>
  );
}

export function CashRealizationSection({
  totalReceived,
  totalSpent,
  cashPosition,
}: {
  readonly totalReceived: number;
  readonly totalSpent: number;
  readonly cashPosition: number;
}): React.JSX.Element {
  return (
    <section className="space-y-2.5">
      <header className="px-1">
        <h2 className="text-[17px] font-semibold text-on-surface">Realisasi kas</h2>
        <p className="mt-0.5 text-support text-on-surface-variant">
          Dana klien yang diterima dibanding pengeluaran kas proyek.
        </p>
      </header>
      <div className="overflow-hidden rounded-3xl bg-white shadow-surface ring-1 ring-ring-subtle">
        <CashRow label="Dana diterima" amount={totalReceived} />
        <CashRow label="Pengeluaran kas" amount={totalSpent} />
        <CashRow label="Posisi kas bersih" amount={cashPosition} strong danger={cashPosition < 0} />
      </div>
      <p className="px-1 text-meta text-on-surface-variant">
        Posisi kas bukan laba dan tidak memasukkan pemakaian stok non-kas.
      </p>
    </section>
  );
}

function MarginFact({
  label,
  amount,
  align = "left",
  danger = false,
}: {
  readonly label: string;
  readonly amount: number;
  readonly align?: "left" | "center" | "right";
  readonly danger?: boolean;
}): React.JSX.Element {
  const className = align === "right" ? "pl-2 text-right" : "pr-2";
  return (
    <div className={cn("flex w-full flex-col gap-2 rounded-2xl bg-white/7.5 p-3", className)}>
      <p className="truncate text-[8px] leading-none font-bold tracking-wide text-white/50 uppercase">
        {label}
      </p>
      <MoneyValue
        amount={amount}
        variant="compactWithFull"
        tone={danger ? "danger" : "inverse"}
        size="xs"
        align={align === "right" ? "right" : "left"}
        className={align === "center" ? "text-center" : ""}
      />
    </div>
  );
}
function CashRow({
  label,
  amount,
  strong = false,
  danger = false,
}: {
  readonly label: string;
  readonly amount: number;
  readonly strong?: boolean;
  readonly danger?: boolean;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex min-h-16 items-center justify-between gap-3 border-t border-outline-variant/20 px-4 py-3 first:border-t-0",
        strong ? "mx-3 mt-1 mb-3 min-h-0 rounded-2xl border-t-0 bg-surface-container-low p-3" : "",
      )}
    >
      <span
        className={`text-xs ${strong ? "font-bold text-on-surface" : "font-semibold text-on-surface-variant"}`}
      >
        {label}
      </span>
      <MoneyValue
        amount={amount}
        variant="compactWithFull"
        tone={danger ? "danger" : strong ? "primary" : "default"}
        align="right"
        size="sm"
      />
    </div>
  );
}
