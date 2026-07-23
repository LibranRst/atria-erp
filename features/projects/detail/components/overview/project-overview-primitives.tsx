"use client";

import React from "react";

import { MoneyValue } from "@/components/ui/feedback/page-primitives";

export function SummaryMetric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}): React.JSX.Element {
  return (
    <div className="min-w-0 rounded-2xl bg-white/8 p-3">
      <p className="truncate text-[9px] font-bold tracking-wide text-white/55 uppercase">{label}</p>
      <MoneyValue amount={value} variant="compactWithFull" tone="inverse" className="mt-1" />
    </div>
  );
}

export function DetailMetric({
  label,
  value,
  danger = false,
}: {
  readonly label: string;
  readonly value: number;
  readonly danger?: boolean;
}): React.JSX.Element {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-container-low p-3">
      <p className="truncate text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
        {label}
      </p>
      <MoneyValue
        amount={value}
        variant="compactWithFull"
        tone={danger ? "danger" : "default"}
        className="mt-1"
      />
    </div>
  );
}

export function DetailRow({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
}): React.JSX.Element {
  return (
    <div className="border-t border-outline-variant/25 px-4 py-3 first:border-t-0">
      <p className="text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm leading-5 font-bold text-on-surface">{value}</p>
      {detail && (
        <p className="mt-1 text-[10px] leading-4 wrap-break-word text-on-surface-variant">
          {detail}
        </p>
      )}
    </div>
  );
}
