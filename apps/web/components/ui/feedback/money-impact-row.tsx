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
  sublabel,
  note,
  className,
}: {
  readonly label: string;
  readonly before: number;
  readonly delta: number;
  readonly after: number;
  readonly sublabel?: string;
  readonly note?: React.ReactNode;
  readonly className?: string;
}): React.JSX.Element {
  const unsafe = after < 0;
  const money = (value: number): string =>
    `Rp ${Math.abs(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
  const deltaLabel = `${delta >= 0 ? "+" : "−"}${money(delta)}`;

  return (
    <section
      className={cx(
        "overflow-hidden rounded-[22px] bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle",
        className,
      )}
    >
      <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-on-surface">{label}</p>
          {sublabel ? (
            <p className="mt-0.5 truncate text-[11px] font-medium text-on-surface-variant">
              {sublabel}
            </p>
          ) : null}
        </div>
        <p
          className={cx(
            "shrink-0 text-meta font-bold",
            unsafe ? "text-error" : delta >= 0 ? "text-primary" : "text-on-surface",
          )}
        >
          {deltaLabel}
        </p>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-center">
        <div className="min-w-0">
          <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
            Sebelum
          </p>
          <p className="mt-1 font-mono text-xs font-bold text-on-surface tabular-nums min-[360px]:text-sm">
            {money(before)}
          </p>
        </div>
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-lowest text-sm text-on-surface-variant ring-1 ring-ring-subtle"
          aria-hidden="true"
        >
          →
        </span>
        <div className="min-w-0">
          <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
            Sesudah
          </p>
          <p
            className={cx(
              "mt-1 font-mono text-xs font-bold tabular-nums min-[360px]:text-sm",
              unsafe ? "text-error" : "text-primary",
            )}
          >
            {unsafe ? "−" : ""}
            {money(after)}
          </p>
        </div>
      </div>

      {note ? (
        <div className="border-t border-outline-variant/15 px-4 py-2.5 text-meta text-on-surface-variant">
          {note}
        </div>
      ) : null}
    </section>
  );
}
