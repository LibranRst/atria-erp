"use client";

import React from "react";

import type { IndicatorTone } from "@/lib/types/indicator-tone";
import { getBudgetGeometry } from "@/lib/finance/budget-indicator";
import { formatShortIdr } from "@/lib/utils/money";

export function BudgetSplitIndicator({
  value,
  inverse = false,
  danger = false,
  tone = "positive",
  usedAmount,
  remainingAmount,
}: {
  readonly value: number;
  readonly inverse?: boolean;
  readonly danger?: boolean;
  readonly tone?: IndicatorTone;
  readonly usedAmount?: number;
  readonly remainingAmount?: number;
}): React.JSX.Element {
  const geometry = getBudgetGeometry(value);
  const usedClass = inverse
    ? danger || tone === "critical"
      ? "bg-critical-on-inverse"
      : "bg-white"
    : danger || tone === "critical"
      ? "bg-error"
      : tone === "warning"
        ? "bg-warning"
        : "bg-primary";
  const remainingClass = inverse ? "bg-white/14" : "bg-surface-container-high";
  const secondaryText = inverse ? "text-white/55" : "text-on-surface-variant/65";

  return (
    <div
      className="mt-2.5"
      role="img"
      aria-label={`Budget terpakai ${value.toFixed(1)} persen${usedAmount === undefined ? "" : ` atau ${formatShortIdr(usedAmount)}`}${geometry.overflowPercentage > 0 ? `, melebihi batas ${geometry.overflowPercentage.toFixed(1)} persen` : `, tersisa ${geometry.remainingPercentage.toFixed(1)} persen${remainingAmount === undefined ? "" : ` atau ${formatShortIdr(remainingAmount)}`}`}`}
    >
      <div className="relative flex h-2 gap-1" aria-hidden="true">
        {geometry.clampedPercentage > 0 ? (
          <span
            className={`min-w-1 rounded-full ${usedClass}`}
            style={{ flexBasis: `${geometry.clampedPercentage}%` }}
          />
        ) : null}
        {geometry.remainingPercentage > 0 ? (
          <span
            className={`min-w-1 rounded-full ${remainingClass}`}
            style={{ flexBasis: `${geometry.remainingPercentage}%` }}
          />
        ) : null}
        {geometry.overflowPercentage > 0 ? (
          <span className={`absolute -top-1 -right-0.5 h-4 w-1 rounded-full ${usedClass}`} />
        ) : null}
      </div>
      <div
        className={`mt-1.5 flex items-center justify-between text-[8px] font-bold tracking-wide uppercase ${secondaryText}`}
      >
        <span>Terpakai {usedAmount === undefined ? "" : formatShortIdr(usedAmount)}</span>
        <span>
          {geometry.overflowPercentage > 0
            ? `Lebih ${geometry.overflowPercentage.toFixed(0)}%${remainingAmount === undefined ? "" : ` · ${formatShortIdr(Math.abs(remainingAmount))}`}`
            : `Tersisa ${geometry.remainingPercentage.toFixed(0)}%${remainingAmount === undefined ? "" : ` · ${formatShortIdr(remainingAmount)}`}`}
        </span>
      </div>
    </div>
  );
}
