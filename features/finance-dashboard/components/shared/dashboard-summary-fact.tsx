"use client";

import React from "react";

export function SummaryFact({
  label,
  value,
  tone = "default",
}: {
  readonly label: string;
  readonly value: string;
  readonly tone?: "default" | "danger" | "warning" | "positive";
}): React.JSX.Element {
  const toneClass =
    tone === "danger"
      ? "text-error"
      : tone === "warning"
        ? "text-warning"
        : tone === "positive"
          ? "text-success"
          : "text-on-surface";
  return (
    <div className="min-w-0">
      <p className="truncate text-[9px] font-bold tracking-wide text-on-surface-variant/55 uppercase">
        {label}
      </p>
      <p className={`mt-1 truncate font-mono text-sm font-black ${toneClass}`}>{value}</p>
    </div>
  );
}
