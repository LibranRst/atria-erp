import React from "react";

export function InfoPill({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-container-low px-3 py-2.5">
      <p className="text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-bold text-on-surface">{value}</p>
    </div>
  );
}
