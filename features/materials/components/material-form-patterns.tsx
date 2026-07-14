"use client";

import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

import { ConfirmationModal, WorkflowFormSheet } from "@/components/ui";
import { cx } from "@/components/ui/form-control-utils";
import { transitionSpringBouncy, transitionSpringSnappy } from "@/lib/utils/motion";
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
  const quantity = (value: number): string =>
    `${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;

  return (
    <div className="rounded-2xl bg-surface-container-low px-4 py-3 ring-1 ring-outline-variant/10">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-xs font-bold text-on-surface">{label}</p>
        <p className={cx("shrink-0 text-xs font-bold", unsafe ? "text-error" : "text-primary")}>
          {delta > 0 ? "+" : ""}{quantity(delta)}
        </p>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">Sebelum</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">{quantity(before)}</p>
        </div>
        <span className="text-on-surface-variant" aria-hidden="true">→</span>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">Sesudah</p>
          <p className={cx("mt-0.5 text-sm font-bold tabular-nums", unsafe ? "text-error" : "text-primary")}>{quantity(after)}</p>
        </div>
      </div>
      {typeof reserved === "number" ? (
        <p className={cx("mt-2 text-[10px] leading-4", unsafe ? "text-error" : "text-on-surface-variant")}>
          Stok terreservasi {quantity(reserved)}{unsafe ? " · jumlah sesudah perubahan tidak aman" : ""}
        </p>
      ) : null}
    </div>
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
          <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-on-surface-variant">{success?.description}</p>
        </div>
        <dl className="divide-y divide-outline-variant/35 rounded-2xl bg-surface-container-low px-4 text-left">
          {success?.facts.map((fact) => (
            <div key={fact.label} className="flex items-start justify-between gap-4 py-3">
              <dt className="text-xs text-on-surface-variant">{fact.label}</dt>
              <dd className="text-right text-xs font-bold text-on-surface">{fact.value}</dd>
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
          <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} disabled={pending} onClick={onSave} className="min-h-12 w-full rounded-full bg-primary px-5 text-sm font-bold text-white disabled:opacity-45">
            {pending ? "Menyimpan…" : "Simpan Draft & Tutup"}
          </motion.button>
          <div className="grid grid-cols-2 gap-2">
            <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} disabled={pending} onClick={onDiscard} className="min-h-12 rounded-full bg-error-container/25 px-4 text-xs font-bold text-error disabled:opacity-45">Buang Perubahan</motion.button>
            <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} disabled={pending} onClick={onContinue} className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold text-on-surface disabled:opacity-45">Lanjut Mengisi</motion.button>
          </div>
        </div>
      }
    />
  );
}
