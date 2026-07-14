"use client";

import React from "react";

import {
  MetricGrid,
  MoneyMetricPill,
  MoneyValue,
  NativeSection,
} from "@/components/ui/page-primitives";

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
  return (
    <NativeSection eyebrow="Projection" title="Kalkulasi Margin Kontrak">
      <MetricGrid>
        <MoneyMetricPill
          label="Nilai Kontrak"
          amount={contractValue}
        />
        <MoneyMetricPill
          label="Plafon Anggaran"
          amount={totalAllocated}
        />
        <MoneyMetricPill
          label="Projected Margin"
          amount={projectedGrossProfit}
          tone={projectedGrossProfit < 0 ? "danger" : "default"}
        />
        <MoneyMetricPill
          label="Sisa Plafon"
          amount={totalRemaining}
          tone={totalRemaining < 0 ? "danger" : "default"}
        />
      </MetricGrid>
      <div className="mt-md rounded-2xl bg-surface-container-low p-sm">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-on-surface-variant">Projected margin</span>
          <span
            className={projectedGrossMargin < 0 ? "text-error" : "text-primary"}
          >
            {projectedGrossMargin.toFixed(1)}%
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container">
          <div
            className={`h-full rounded-full ${projectedGrossMargin < 0 ? "bg-error" : "bg-primary"}`}
            style={{
              width: `${Math.min(Math.max(projectedGrossMargin, 0), 100)}%`,
            }}
          />
        </div>
      </div>
    </NativeSection>
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
    <NativeSection eyebrow="Cash Realization" title="Realisasi Kas Bersih">
      <MetricGrid>
        <MoneyMetricPill
          label="Uang Masuk"
          amount={totalReceived}
        />
        <MoneyMetricPill
          label="Belanja Riil"
          amount={totalSpent}
          tone="muted"
        />
      </MetricGrid>
      <div className="mt-md rounded-[28px] bg-primary p-md text-on-primary">
        <p className="text-[10px] font-bold uppercase tracking-wide text-white/65">
          Cash Position
        </p>
        <MoneyValue
          amount={cashPosition}
          variant="fullDynamic"
          tone={cashPosition < 0 ? "danger" : "inverse"}
          size="lg"
          className="mt-1"
        />
        <p className="mt-1 text-xs leading-5 text-white/70">
          Client cash received dikurangi paid cash cost. Ini bukan profit dan tidak
          memasukkan stock usage non-cash.
        </p>
      </div>
    </NativeSection>
  );
}
