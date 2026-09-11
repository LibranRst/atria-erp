"use client";

import React from "react";

export function InventoryStockStatusCard({
  locationName,
  currentStock,
  reservedStock,
  availableStock,
  unit,
}: {
  readonly locationName: string;
  readonly currentStock: number;
  readonly reservedStock: number;
  readonly availableStock: number;
  readonly unit?: string;
}): React.JSX.Element {
  const formatQty = (val: number): string =>
    `${val.toLocaleString("id-ID", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;

  return (
    <div className="overflow-hidden rounded-owner bg-white p-3.5 shadow-surface ring-1 ring-ring-subtle">
      <div className="flex items-center justify-between gap-2">
        <p className="text-eyebrow font-bold tracking-[0.14em] text-on-surface-variant uppercase">
          Posisi Stok Lokasi
        </p>
        <span className="truncate text-meta font-medium text-on-surface-variant/80">
          {locationName}
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-outline-variant/15 pt-2.5">
        <div className="rounded-2xl bg-surface-container-low p-2 text-center">
          <p className="text-[10px] font-bold tracking-wide text-on-surface-variant uppercase">
            Fisik
          </p>
          <p className="mt-0.5 truncate font-sans text-xs font-extrabold text-on-surface tabular-nums">
            {formatQty(currentStock)}
          </p>
        </div>
        <div className="rounded-2xl bg-surface-container-low p-2 text-center">
          <p className="text-[10px] font-bold tracking-wide text-on-surface-variant uppercase">
            Reservasi
          </p>
          <p className="mt-0.5 truncate font-sans text-xs font-extrabold text-on-surface tabular-nums">
            {formatQty(reservedStock)}
          </p>
        </div>
        <div className="rounded-2xl bg-surface-container-low p-2 text-center">
          <p className="text-[10px] font-bold tracking-wide text-on-surface-variant uppercase">
            Tersedia
          </p>
          <p
            className={`mt-0.5 truncate font-sans text-xs font-extrabold tabular-nums ${
              availableStock <= 0 ? "text-warning" : "text-primary"
            }`}
          >
            {formatQty(availableStock)}
          </p>
        </div>
      </div>
    </div>
  );
}
