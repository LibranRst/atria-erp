"use client";

import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

import { ConfirmationModal, WorkflowFormSheet } from "@/components/ui";
import { cx } from "@/components/ui/form-control-utils";
import {
  transitionSpringBouncy,
  transitionSpringSnappy,
} from "@/lib/utils/motion";
import { calculateStockImpact } from "@/features/materials/lib/material-ui-utils";

export type MaterialOperationSuccess = {
  readonly title: string;
  readonly description: string;
  readonly facts: readonly { readonly label: string; readonly value: string }[];
};

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
  const normalizeZero = (value: number): number =>
    Math.abs(value) < Number.EPSILON ? 0 : value;
  const normalizedDelta = normalizeZero(delta);
  const quantity = (value: number): string =>
    `${normalizeZero(value).toLocaleString("id-ID", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
  const deltaLabel =
    normalizedDelta === 0
      ? "Tidak berubah"
      : `${normalizedDelta > 0 ? "+" : ""}${quantity(normalizedDelta)}`;

  return (
    <section className="overflow-hidden rounded-[22px] bg-surface-container-lowest shadow-[0_8px_24px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/15">
      <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5">
        <p className="min-w-0 truncate text-xs font-bold text-on-surface">
          {label}
        </p>
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
          <p className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
            Sebelum
          </p>
          <p className="mt-1 whitespace-nowrap font-mono text-[13px] font-bold tabular-nums">
            {quantity(before)}
          </p>
        </div>
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-lowest text-sm text-on-surface-variant ring-1 ring-outline-variant/15"
          aria-hidden="true"
        >
          →
        </span>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
            Sesudah
          </p>
          <p
            className={cx(
              "mt-1 whitespace-nowrap font-mono text-[13px] font-bold tabular-nums",
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
            "border-t border-outline-variant/15 px-4 py-2.5 text-[10px] leading-4",
            unsafe
              ? "bg-error-container/10 text-error"
              : "text-on-surface-variant",
          )}
        >
          Stok terreservasi {quantity(reserved)}
          {unsafe ? " · jumlah sesudah perubahan tidak aman" : ""}
        </p>
      ) : null}
    </section>
  );
}

export function MaterialSuccessSheet({
  success,
  secondaryLabel,
  onClose,
  onSecondary,
}: {
  readonly success: MaterialOperationSuccess | null;
  readonly secondaryLabel?: string;
  readonly onClose: () => void;
  readonly onSecondary?: () => void;
}): React.JSX.Element {
  return (
    <WorkflowFormSheet
      open={Boolean(success)}
      title={success?.title ?? "Berhasil"}
      primaryLabel="Selesai"
      secondaryLabel={secondaryLabel}
      onClose={onClose}
      onPrimary={onClose}
      onSecondary={onSecondary}
    >
      <div className="space-y-5 py-2 text-center">
        <motion.div
          initial={{ scale: 0.75, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={transitionSpringBouncy}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </motion.div>
        <div>
          <p className="text-lg font-bold text-on-surface">{success?.title}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-on-surface-variant">
            {success?.description}
          </p>
        </div>
        <dl className="divide-y divide-outline-variant/15 rounded-[22px] bg-white ring-1 ring-black/[0.035] px-4 text-left overflow-hidden">
          {success?.facts.map((fact) => (
            <div
              key={fact.label}
              className="flex items-start justify-between gap-4 py-3.5"
            >
              <dt className="text-xs text-on-surface-variant font-medium">
                {fact.label}
              </dt>
              <dd className="text-right text-xs font-bold text-on-surface">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </WorkflowFormSheet>
  );
}

export function MaterialUnsavedChangesModal({
  open,
  pending = false,
  onSave,
  onDiscard,
  onContinue,
}: {
  readonly open: boolean;
  readonly pending?: boolean;
  readonly onSave: () => void;
  readonly onDiscard: () => void;
  readonly onContinue: () => void;
}): React.JSX.Element {
  return (
    <ConfirmationModal
      open={open}
      title="Perubahan belum disimpan"
      description="Simpan hasil hitung sebagai draft agar dapat dilanjutkan tanpa mengubah stok."
      tone="warning"
      onClose={onContinue}
      actions={
        <div className="space-y-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            transition={transitionSpringSnappy}
            disabled={pending}
            onClick={onSave}
            className="min-h-12 w-full rounded-full bg-primary px-5 text-sm font-bold text-white disabled:opacity-45"
          >
            {pending ? "Menyimpan…" : "Simpan Draft & Tutup"}
          </motion.button>
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              disabled={pending}
              onClick={onDiscard}
              className="min-h-12 rounded-full bg-error-container/25 px-4 text-xs font-bold text-error disabled:opacity-45"
            >
              Buang Perubahan
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              disabled={pending}
              onClick={onContinue}
              className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold text-on-surface disabled:opacity-45"
            >
              Lanjut Mengisi
            </motion.button>
          </div>
        </div>
      }
    />
  );
}
