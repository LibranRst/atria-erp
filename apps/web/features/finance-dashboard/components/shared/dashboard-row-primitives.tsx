"use client";

import React from "react";

/** Compact label+value cell used inside approval and metric surfaces. */
export function MiniSignal({
  label,
  value,
  danger = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly danger?: boolean;
}): React.JSX.Element {
  return (
    <div className="min-w-0 border-l border-outline-variant/45 px-3 py-1 first:border-l-0">
      <p className="truncate text-[8px] font-extrabold tracking-wide text-on-surface-variant/60 uppercase">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-support font-bold ${danger ? "text-error" : "text-on-surface"}`}
      >
        {value}
      </p>
    </div>
  );
}

/** Empty-state placeholder shown inside dashboard tab sections. */
export function DashboardTabEmpty({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="px-4 py-8 text-center text-xs leading-5 text-on-surface-variant">
      {children}
    </div>
  );
}
