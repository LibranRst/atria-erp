"use client";

import React from "react";

/**
 * Baris detail bertumpuk untuk sheet identitas proyek: label kecil di atas,
 * nilai tebal di bawah, dengan konteks tambahan opsional. Untuk baris fakta
 * satu baris (label kiri, nilai kanan) gunakan `FactRow` dari
 * `components/ui/feedback/main-surface`.
 */
export function DetailRow({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
}): React.JSX.Element {
  return (
    <div className="border-t border-outline-variant/25 px-4 py-3 first:border-t-0">
      <p className="text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm leading-5 font-bold text-on-surface">{value}</p>
      {detail && (
        <p className="mt-1 text-[10px] leading-4 wrap-break-word text-on-surface-variant">
          {detail}
        </p>
      )}
    </div>
  );
}
