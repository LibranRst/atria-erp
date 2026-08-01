"use client";

import React from "react";
import { motion } from "framer-motion";

import { AppIcon, MoneyValue } from "@/components/ui";
import type { IndicatorTone } from "@/lib/types/indicator-tone";
import type { DashboardCategory } from "@/features/finance-dashboard/types/dashboard-types";
import { transitionSpringSmooth } from "@/lib/utils/motion";
import { categoryTone } from "@/features/finance-dashboard/components/shared/dashboard-tone";
function getCategoryIcon(code: string): {
  readonly icon: string;
  readonly color: string;
} {
  const normalized = code.toUpperCase();
  if (normalized.includes("MATERIAL"))
    return { icon: "architecture", color: "bg-accent/10 text-accent" };
  if (normalized.includes("TUKANG") || normalized.includes("LABOR"))
    return { icon: "construction", color: "bg-warning-container text-warning" };
  if (normalized.includes("OPERASIONAL") || normalized.includes("OPERATIONAL"))
    return { icon: "local_shipping", color: "bg-success-container text-success" };
  if (normalized.includes("SUBCON"))
    return { icon: "handshake", color: "bg-purple-500/10 text-purple-600" };
  return { icon: "more_horiz", color: "bg-surface-container text-on-surface-variant" };
}

function CircularProgress({
  value,
  size = 40,
  strokeWidth = 3.5,
  tone = "positive",
}: {
  readonly value: number;
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly tone?: IndicatorTone;
}): React.JSX.Element {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(Math.max(value, 0), 100);
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const toneColor = {
    critical: "stroke-error",
    warning: "stroke-secondary",
    positive: "stroke-primary",
    neutral: "stroke-outline-variant",
  }[tone];

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          className="stroke-outline-variant/40"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <motion.circle
          className={toneColor}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={transitionSpringSmooth}
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <span className="absolute font-mono text-[9px] leading-none font-bold text-on-surface">
        {Math.round(percentage)}%
      </span>
    </div>
  );
}

export function CategoryHealthMeter({
  category,
  isFullWidth,
}: {
  readonly category: DashboardCategory;
  readonly isFullWidth?: boolean;
}): React.JSX.Element {
  const tone = categoryTone(category);
  const { icon, color } = getCategoryIcon(category.code);

  return (
    <div
      className={`top-11/12 flex flex-col justify-between gap-3 rounded-2xl border border-outline-variant/20 bg-white p-2 shadow-surface ${
        isFullWidth ? "col-span-2" : "col-span-1"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full ${color}`}>
          <AppIcon name={icon} className="text-[15px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] leading-tight font-extrabold text-on-surface">
            {category.name}
          </span>
        </span>
      </div>

      <div className="mt-0.5 flex items-center justify-between gap-3">
        <CircularProgress value={category.usedPercentage} tone={tone} size={40} strokeWidth={3} />
        <div className="min-w-0 text-right">
          <MoneyValue
            amount={category.remainingAmount}
            variant="compactWithFull"
            tone={category.remainingAmount < 0 ? "danger" : "default"}
            align="right"
            size="xs"
          />
          <span className="mt-0.5 block text-[8px] leading-none font-bold tracking-wider text-on-surface-variant/50 uppercase">
            tersisa
          </span>
        </div>
      </div>
    </div>
  );
}
