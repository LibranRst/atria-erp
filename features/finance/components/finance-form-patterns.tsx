"use client";

import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

import { ConfirmationModal, WorkflowFormSheet } from "@/components/ui";
import { cx } from "@/components/ui/form-control-utils";
import { transitionSpringBouncy, transitionSpringSnappy } from "@/lib/utils/motion";

export type FinanceOperationSuccess = {
  readonly title: string;
  readonly description: string;
  readonly facts: readonly { readonly label: string; readonly value: string }[];
};

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
    <div className="rounded-2xl bg-surface-container-low px-4 py-3 ring-1 ring-outline-variant/10">
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
          <p className="text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
            Sebelum
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">{money(before)}</p>
        </div>
        <span className="text-on-surface-variant" aria-hidden="true">
          →
        </span>
        <div>
          <p className="text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
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

export function FinanceSuccessSheet({
  success,
  secondaryLabel,
  onClose,
  onSecondary,
}: {
  readonly success: FinanceOperationSuccess | null;
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
        <dl className="divide-y divide-outline-variant/15 overflow-hidden rounded-[22px] bg-white px-4 text-left ring-1 ring-black/[0.035]">
          {success?.facts.map((fact) => (
            <div key={fact.label} className="flex items-start justify-between gap-4 py-3.5">
              <dt className="text-xs font-medium text-on-surface-variant">{fact.label}</dt>
              <dd className="text-right text-xs font-bold text-on-surface">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </WorkflowFormSheet>
  );
}

export function FinanceUnsavedChangesModal({
  open,
  pending = false,
  onKeep,
  onDiscard,
  onContinue,
}: {
  readonly open: boolean;
  readonly pending?: boolean;
  readonly onKeep: () => void;
  readonly onDiscard: () => void;
  readonly onContinue: () => void;
}): React.JSX.Element {
  return (
    <ConfirmationModal
      open={open}
      title="Perubahan belum selesai"
      description="Data ini tersimpan di perangkat. Anda dapat menutup dan melanjutkannya nanti tanpa mencatat transaksi keuangan."
      tone="warning"
      onClose={onContinue}
      actions={
        <div className="space-y-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            transition={transitionSpringSnappy}
            disabled={pending}
            onClick={onKeep}
            className="min-h-12 w-full rounded-full bg-primary px-5 text-sm font-bold text-white disabled:opacity-45"
          >
            {pending ? "Memproses…" : "Simpan & Tutup"}
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
