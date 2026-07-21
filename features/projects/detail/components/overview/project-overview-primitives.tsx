"use client";

import React from "react";

import { MoneyValue } from "@/components/ui/page-primitives";

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
    <div className="bg-surface-container-low min-w-0 rounded-2xl p-3">
      <p className="text-on-surface-variant truncate text-[9px] font-bold tracking-wide uppercase">
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
    <div className="border-outline-variant/25 border-t px-4 py-3 first:border-t-0">
      <p className="text-on-surface-variant text-[9px] font-bold tracking-wide uppercase">
        {label}
      </p>
      <p className="text-on-surface mt-1 text-sm leading-5 font-bold">{value}</p>
      {detail && (
        <p className="text-on-surface-variant mt-1 text-[10px] leading-4 wrap-break-word">
          {detail}
        </p>
      )}
    </div>
  );
}
