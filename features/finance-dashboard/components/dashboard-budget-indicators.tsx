"use client";

import React from "react";

import type { DashboardTone } from "@/features/finance-dashboard/lib/dashboard-types";

export const RISK_WARNING_THRESHOLD = 80;
export const RISK_LIMIT_THRESHOLD = 100;

export type BudgetGeometry = {
  readonly clampedPercentage: number;
  readonly overflowPercentage: number;
  readonly remainingPercentage: number;
};

export type ApprovalBudgetImpact = {
  readonly beforePercentage: number;
  readonly afterPercentage: number;
  readonly overflowPercentage: number;
};

export function getBudgetGeometry(value: number): BudgetGeometry {
  const normalized = Number.isFinite(value) ? value : 0;
  const clampedPercentage = Math.min(
    Math.max(normalized, 0),
    RISK_LIMIT_THRESHOLD,
  );
  return {
    clampedPercentage,
    overflowPercentage: Math.max(0, normalized - RISK_LIMIT_THRESHOLD),
    remainingPercentage: Math.max(0, RISK_LIMIT_THRESHOLD - clampedPercentage),
  };
}

export function getUsageBlockFill(value: number, index: number): number {
  const blockStart = index * 20;
  return Math.min(Math.max((value - blockStart) * 5, 0), 100);
}

export function getApprovalBudgetImpact(
  allocatedAmount: number,
  actualSpent: number,
  requestAmount: number,
): ApprovalBudgetImpact {
  if (allocatedAmount <= 0) {
    return { beforePercentage: 0, afterPercentage: 0, overflowPercentage: 0 };
  }
  const beforePercentage = (actualSpent / allocatedAmount) * 100;
  const afterPercentage = ((actualSpent + requestAmount) / allocatedAmount) * 100;
  return {
    beforePercentage,
    afterPercentage,
    overflowPercentage: Math.max(0, afterPercentage - 100),
  };
}

function indicatorToneClass(tone: DashboardTone): string {
  if (tone === "critical") return "bg-error";
  if (tone === "warning") return "bg-warning";
  if (tone === "positive") return "bg-primary";
  return "bg-on-surface-variant";
}

export function BudgetSplitIndicator({
  value,
  inverse = false,
  danger = false,
  tone = "positive",
}: {
  readonly value: number;
  readonly inverse?: boolean;
  readonly danger?: boolean;
  readonly tone?: DashboardTone;
}): React.JSX.Element {
  const geometry = getBudgetGeometry(value);
  const usedClass = inverse
    ? danger || tone === "critical" ? "bg-[#ff9f96]" : "bg-white"
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
      aria-label={`Budget terpakai ${value.toFixed(1)} persen${geometry.overflowPercentage > 0 ? `, melebihi batas ${geometry.overflowPercentage.toFixed(1)} persen` : `, tersisa ${geometry.remainingPercentage.toFixed(1)} persen`}`}
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
          <span className={`absolute -right-0.5 -top-1 h-4 w-1 rounded-full ${usedClass}`} />
        ) : null}
      </div>
      <div className={`mt-1.5 flex items-center justify-between text-[8px] font-bold uppercase tracking-wide ${secondaryText}`}>
        <span>Terpakai</span>
        <span>
          {geometry.overflowPercentage > 0
            ? `Lebih ${geometry.overflowPercentage.toFixed(0)}%`
            : `Tersisa ${geometry.remainingPercentage.toFixed(0)}%`}
        </span>
      </div>
    </div>
  );
}

export function RiskThresholdRail({
  value,
  tone,
}: {
  readonly value: number;
  readonly tone: DashboardTone;
}): React.JSX.Element {
  const geometry = getBudgetGeometry(value);
  const markerClass = indicatorToneClass(tone);
  return (
    <div
      className="relative mt-2.5 h-7"
      role="img"
      aria-label={`Penggunaan budget ${value.toFixed(0)} persen. Batas perhatian ${RISK_WARNING_THRESHOLD} persen dan batas budget ${RISK_LIMIT_THRESHOLD} persen.`}
    >
      <div className="absolute inset-x-0 top-2 h-px bg-outline-variant/55" aria-hidden="true" />
      <span
        className="absolute top-0 h-4 w-px bg-warning/70"
        style={{ left: `${RISK_WARNING_THRESHOLD}%` }}
        aria-hidden="true"
      />
      <span className="absolute right-0 top-0 h-4 w-px bg-error/70" aria-hidden="true" />
      <span
        className={`absolute top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${markerClass}`}
        style={{
          left: `${geometry.clampedPercentage}%`,
          transform:
            geometry.clampedPercentage <= 0
              ? "translateX(0)"
              : geometry.clampedPercentage >= 100
                ? "translateX(-100%)"
                : "translateX(-50%)",
        }}
        aria-hidden="true"
      />
      <span
        className="absolute top-4 -translate-x-1/2 font-mono text-[8px] font-bold text-warning"
        style={{ left: `${RISK_WARNING_THRESHOLD}%` }}
      >
        {RISK_WARNING_THRESHOLD}
      </span>
      <span className="absolute right-0 top-4 font-mono text-[8px] font-bold text-error">{RISK_LIMIT_THRESHOLD}</span>
      {geometry.overflowPercentage > 0 ? (
        <span className="absolute right-0 -top-2 font-mono text-[8px] font-black text-error">
          +{geometry.overflowPercentage.toFixed(0)}%
        </span>
      ) : null}
    </div>
  );
}

export function UsageBlockMeter({
  value,
  tone,
}: {
  readonly value: number;
  readonly tone: DashboardTone;
}): React.JSX.Element {
  const fillClass = indicatorToneClass(tone);
  return (
    <div
      className="mt-2.5 flex gap-1"
      role="img"
      aria-label={`Penggunaan kategori ${value.toFixed(0)} persen dalam lima bagian masing-masing 20 persen`}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const fill = getUsageBlockFill(value, index);
        return (
          <span key={index} className="h-2 min-w-0 flex-1 overflow-hidden rounded-[3px] bg-surface-container-high" aria-hidden="true">
            <span className={`block h-full ${fillClass}`} style={{ width: `${fill}%` }} />
          </span>
        );
      })}
    </div>
  );
}
