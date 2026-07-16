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
      <p className="truncate text-[9px] font-bold uppercase tracking-wide text-white/55">
        {label}
      </p>
      <MoneyValue
        amount={value}
        variant="compactWithFull"
        tone="inverse"
        className="mt-1"
      />
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
      <p className="truncate text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
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
      <p className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold leading-5 text-on-surface">{value}</p>
      {detail && (
        <p className="mt-1 break-words text-[10px] leading-4 text-on-surface-variant">
          {detail}
        </p>
      )}
    </div>
  );
}
