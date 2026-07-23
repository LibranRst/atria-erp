"use client";

import React from "react";

import type { DashboardTone } from "@/features/finance-dashboard/types/dashboard-types";
import {
  getBudgetGeometry,
  indicatorToneClass,
  RISK_LIMIT_THRESHOLD,
  RISK_WARNING_THRESHOLD,
} from "@/features/finance-dashboard/utils/budget-indicator-utils";

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
      <span className="absolute top-0 right-0 h-4 w-px bg-error/70" aria-hidden="true" />
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
      <span className="absolute top-4 right-0 font-mono text-[8px] font-bold text-error">
        {RISK_LIMIT_THRESHOLD}
      </span>
      {geometry.overflowPercentage > 0 ? (
        <span className="absolute -top-2 right-0 font-mono text-[8px] font-black text-error">
          +{geometry.overflowPercentage.toFixed(0)}%
        </span>
      ) : null}
    </div>
  );
}
