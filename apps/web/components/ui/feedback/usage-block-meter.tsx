"use client";

import React from "react";

import type { IndicatorTone } from "@atria/core/types/indicator-tone";
import { getUsageBlockFill, indicatorToneClass } from "@atria/core/finance/budget-indicator";

export function UsageBlockMeter({
  value,
  tone,
  className = "mt-2.5",
}: {
  readonly value: number;
  readonly tone: IndicatorTone;
  readonly className?: string;
}): React.JSX.Element {
  const fillClass = indicatorToneClass(tone);
  return (
    <div
      className={`flex w-full gap-1 ${className}`}
      role="img"
      aria-label={`Penggunaan kategori ${value.toFixed(0)} persen dalam lima bagian masing-masing 20 persen`}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const fill = getUsageBlockFill(value, index);
        return (
          <span
            key={index}
            className="h-2 min-w-0 flex-1 overflow-hidden rounded-[3px] bg-surface-container-high"
            aria-hidden="true"
          >
            <span className={`block h-full ${fillClass}`} style={{ width: `${fill}%` }} />
          </span>
        );
      })}
    </div>
  );
}
