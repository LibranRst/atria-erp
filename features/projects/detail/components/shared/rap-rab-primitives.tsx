"use client";

import React from "react";

import { MoneyValue } from "@/components/ui/feedback/page-primitives";

export function NativePanel({
  eyebrow,
  title,
  action,
  children,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-surface ring-1 ring-ring-subtle">
      <div className="mb-sm flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
              {eyebrow}
            </p>
          )}
          <h3 className="text-[17px] leading-6 font-semibold text-on-surface">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MiniMetric({
  label,
  value,
  danger = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly danger?: boolean;
}): React.JSX.Element {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-container-low px-3 py-2.5">
      <p className="truncate text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
        {label}
      </p>
      <p
        className={`financial-amount mt-0.5 truncate font-mono text-[13px] font-bold whitespace-nowrap tabular-nums ${danger ? "text-error" : "text-on-surface"}`}
      >
        {value}
      </p>
    </div>
  );
}

export function MiniMoneyMetric({
  label,
  value,
  prefix,
  danger = false,
}: {
  readonly label: string;
  readonly value: number;
  readonly prefix?: string;
  readonly danger?: boolean;
}): React.JSX.Element {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-container-low px-3 py-2.5">
      <p className="truncate text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
        {label}
      </p>
      <MoneyValue
        amount={value}
        variant="compactWithFull"
        prefix={prefix}
        tone={danger ? "danger" : "default"}
        className="mt-0.5"
      />
    </div>
  );
}

export function RabMoneyBlock({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}): React.JSX.Element {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-container-low p-3">
      <p className="text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
        {label}
      </p>
      <MoneyValue amount={value} variant="fullDynamic" size="md" className="mt-1" />
    </div>
  );
}

export function CompactQty({
  label,
  value,
  danger = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly danger?: boolean;
}): React.JSX.Element {
  return (
    <div className="rounded-2xl bg-white/75 px-3 py-2">
      <p className="text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
        {label}
      </p>
      <p className={`mt-0.5 text-sm font-bold ${danger ? "text-warning" : "text-on-surface"}`}>
        {value}
      </p>
    </div>
  );
}

export function CompactMoney({
  label,
  value,
  danger = false,
}: {
  readonly label: string;
  readonly value: number;
  readonly danger?: boolean;
}): React.JSX.Element {
  return (
    <div className="min-w-0 rounded-2xl bg-white/75 px-3 py-2">
      <p className="truncate text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
        {label}
      </p>
      <MoneyValue
        amount={value}
        variant="compactWithFull"
        tone={danger ? "danger" : "default"}
        className="mt-0.5"
      />
    </div>
  );
}

export function rabSourceLabel(sourceType: string): string {
  if (sourceType === "RAP_MATERIAL") return "Material";
  if (sourceType === "CATEGORY_PLAN") return "Paket kerja";
  return "Manual";
}
