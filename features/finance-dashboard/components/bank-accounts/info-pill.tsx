import React from "react";

export function InfoPill({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div className="bg-surface-container-low min-w-0 rounded-2xl px-3 py-2.5">
      <p className="text-on-surface-variant text-[9px] font-bold tracking-wide uppercase">
        {label}
      </p>
      <p className="text-on-surface mt-1 truncate text-xs font-bold">{value}</p>
    </div>
  );
}
