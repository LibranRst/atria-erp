"use client";

import React from "react";

import { cx } from "@/components/ui/form/form-control-utils";

/**
 * Dampak satu operasi terhadap sebuah saldo: nilai sebelum, selisih, dan nilai
 * sesudah. Dipakai sebelum commit agar konsekuensi kas terbaca lebih dulu.
 *
 * Saldo akhir negatif ditandai sebagai kondisi kritis, bukan sekadar angka
 * merah; itulah kondisi yang menghalangi persetujuan.
 */
export function MoneyImpactRow({
  label,
  before,
  delta,
  after,
}: {
  readonly label: string;
  readonly before: number;
  readonly delta: number;
  readonly after: number;
}): React.JSX.Element {
  const unsafe = after < 0;
  const money = (value: number): string =>
    `Rp ${Math.abs(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
  return (
    <div className="rounded-2xl bg-surface-container-low px-4 py-3 ring-1 ring-ring-subtle">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold text-on-surface">{label}</p>
        <p
          className={cx(
            "shrink-0 text-xs font-bold",
            unsafe ? "text-error" : delta >= 0 ? "text-primary" : "text-on-surface",
          )}
        >
          {delta >= 0 ? "+" : "−"}
          {money(delta)}
        </p>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <div>
          <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
            Sebelum
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">{money(before)}</p>
        </div>
        <span className="text-on-surface-variant" aria-hidden="true">
          →
        </span>
        <div>
          <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
            Sesudah
          </p>
          <p
            className={cx(
              "mt-0.5 text-sm font-bold tabular-nums",
              unsafe ? "text-error" : "text-primary",
            )}
          >
            {unsafe ? "−" : ""}
            {money(after)}
          </p>
        </div>
      </div>
    </div>
  );
}
