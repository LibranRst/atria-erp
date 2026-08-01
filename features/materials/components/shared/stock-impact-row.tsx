"use client";

import { cx } from "@/components/ui/form/form-control-utils";
import { calculateStockImpact } from "@/features/materials/utils/material-ui-utils";

export function StockImpactRow({
  label,
  before,
  delta,
  after,
  unit,
  reserved,
}: {
  readonly label: string;
  readonly before: number;
  readonly delta: number;
  readonly after: number;
  readonly unit?: string;
  readonly reserved?: number;
}): React.JSX.Element {
  const impact = calculateStockImpact({ before, delta, reserved });
  const unsafe = !impact.safe;
  const normalizeZero = (value: number): number => (Math.abs(value) < Number.EPSILON ? 0 : value);
  const normalizedDelta = normalizeZero(delta);
  const quantity = (value: number): string =>
    `${normalizeZero(value).toLocaleString("id-ID", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
  const deltaLabel =
    normalizedDelta === 0
      ? "Tidak berubah"
      : `${normalizedDelta > 0 ? "+" : ""}${quantity(normalizedDelta)}`;

  return (
    <section className="overflow-hidden rounded-[22px] bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle">
      <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5">
        <p className="min-w-0 truncate text-xs font-bold text-on-surface">{label}</p>
        <p
          className={cx(
            "shrink-0 text-[10px] font-bold",
            unsafe
              ? "text-error"
              : normalizedDelta === 0
                ? "text-on-surface-variant"
                : "text-primary",
          )}
        >
          {deltaLabel}
        </p>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-center">
        <div>
          <p className="text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
            Sebelum
          </p>
          <p className="mt-1 font-mono text-[13px] font-bold whitespace-nowrap tabular-nums">
            {quantity(before)}
          </p>
        </div>
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-lowest text-sm text-on-surface-variant ring-1 ring-ring-subtle"
          aria-hidden="true"
        >
          →
        </span>
        <div>
          <p className="text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
            Sesudah
          </p>
          <p
            className={cx(
              "mt-1 font-mono text-[13px] font-bold whitespace-nowrap tabular-nums",
              unsafe ? "text-error" : "text-on-surface",
            )}
          >
            {quantity(after)}
          </p>
        </div>
      </div>
      {typeof reserved === "number" ? (
        <p
          className={cx(
            "border-t border-outline-variant/15 px-4 py-2.5 text-meta",
            unsafe ? "bg-error-container/10 text-error" : "text-on-surface-variant",
          )}
        >
          Stok terreservasi {quantity(reserved)}
          {unsafe ? " · jumlah sesudah perubahan tidak aman" : ""}
        </p>
      ) : null}
    </section>
  );
}
