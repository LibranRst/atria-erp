"use client";

import React from "react";
import type { CashFlowBucket } from "@atria/core/finance/dashboard-cash-flow";
import { formatIdr, formatShortIdr } from "@atria/core/utils/money";
import { Tooltip } from "../overlay/anchored-surfaces";

export type CashFlowTrendChartProps = {
  readonly buckets: readonly CashFlowBucket[];
  readonly ariaLabel?: string;
};
export function CashFlowTrendChart({
  buckets,
  ariaLabel = "Tren kas bulanan",
}: CashFlowTrendChartProps): React.JSX.Element {
  const peak = Math.max(1, ...buckets.flatMap((row) => [row.cashIn, row.cashOut]));
  const step = 540 / Math.max(1, buckets.length);
  const monthLabel = (key: string): string =>
    new Date(`${key}-01T00:00:00+07:00`).toLocaleDateString("id-ID", {
      month: "short",
      timeZone: "Asia/Jakarta",
    });
  return (
    <figure aria-label={ariaLabel} className="space-y-3">
      <div className="flex items-center gap-4 text-support text-on-surface-variant">
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-sm bg-primary" aria-hidden />
          Kas masuk
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-sm bg-accent" aria-hidden />
          Kas keluar
        </span>
      </div>
      <div className="relative">
        <div
          className="absolute top-[13.5%] bottom-[8%] left-0 flex flex-col justify-between text-meta text-on-surface-variant"
          aria-hidden
        >
          {[1, 0.5, 0].map((ratio) => (
            <span key={ratio}>{formatShortIdr(peak * ratio)}</span>
          ))}
        </div>
        <svg
          viewBox="0 0 600 178"
          preserveAspectRatio="none"
          className="block h-40 w-full"
          aria-hidden="true"
        >
          {[0, 0.5, 1].map((ratio) => (
            <g key={ratio}>
              <line
                x1={46}
                y1={164 - ratio * 140}
                x2={590}
                y2={164 - ratio * 140}
                stroke="var(--ring-subtle)"
              />
            </g>
          ))}
          {buckets.map((row, index) => {
            const x = 46 + step * index + step * 0.2,
              width = Math.min(22, step * 0.22);
            return (
              <g key={row.monthKey}>
                <rect
                  x={x}
                  y={164 - (row.cashIn / peak) * 140}
                  width={width}
                  height={(row.cashIn / peak) * 140}
                  rx={3}
                  fill="var(--primary)"
                />
                <rect
                  x={x + width + 4}
                  y={164 - (row.cashOut / peak) * 140}
                  width={width}
                  height={(row.cashOut / peak) * 140}
                  rx={3}
                  fill="var(--accent)"
                />
              </g>
            );
          })}
        </svg>
        <div
          className="absolute inset-y-0 right-[1.6%] left-[7.7%] grid"
          style={{ gridTemplateColumns: `repeat(${buckets.length},minmax(0,1fr))` }}
        >
          {buckets.map((row) => (
            <Tooltip
              key={row.monthKey}
              touch
              content={`${monthLabel(row.monthKey)} ${row.monthKey.slice(0, 4)}${row.isPartial ? " · Bulan berjalan" : ""}\nMasuk ${formatIdr(row.cashIn)}\nKeluar ${formatIdr(row.cashOut)}\nBersih ${formatIdr(row.net)}`}
            >
              <span
                tabIndex={0}
                role="img"
                aria-label={`${row.monthKey}: masuk ${formatIdr(row.cashIn)}, keluar ${formatIdr(row.cashOut)}, bersih ${formatIdr(row.net)}`}
                className="min-h-12 min-w-0 rounded-icon bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              />
            </Tooltip>
          ))}
        </div>
      </div>
      <div
        className="mr-[1.6%] ml-[7.7%] grid text-center text-meta text-on-surface-variant"
        style={{ gridTemplateColumns: `repeat(${buckets.length},minmax(0,1fr))` }}
      >
        {buckets.map((row) => (
          <span key={row.monthKey}>
            {monthLabel(row.monthKey)}
            {row.isPartial ? "*" : ""}
          </span>
        ))}
      </div>
      <figcaption className="text-meta text-on-surface-variant">
        * Bulan berjalan belum lengkap. Berdasarkan catatan kas Paduna Build.
      </figcaption>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th>Bulan</th>
            <th>Kas masuk</th>
            <th>Kas keluar</th>
            <th>Arus bersih</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((row) => (
            <tr key={row.monthKey}>
              <th>
                {row.monthKey}
                {row.isPartial ? " (berjalan)" : ""}
              </th>
              <td>{formatIdr(row.cashIn)}</td>
              <td>{formatIdr(row.cashOut)}</td>
              <td>{formatIdr(row.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
