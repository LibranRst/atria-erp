"use client";

import React from "react";
import { motion } from "framer-motion";

import { AppIcon } from "@/components/ui/icon/app-icon";
import { WorkflowFormSheet } from "@/components/ui/form/form-controls";
import { transitionSpringBouncy } from "@/lib/utils/motion";

export type OperationSuccess = {
  readonly title: string;
  readonly description: string;
  readonly facts: readonly { readonly label: string; readonly value: string }[];
};

/**
 * Konfirmasi setelah satu operasi selesai: ikon, ringkasan, lalu fakta hasilnya
 * sebagai baris berpembatas. Dipakai bersama oleh alur keuangan dan material —
 * sebelumnya keduanya memelihara salinan yang identik kecuali pustaka ikonnya.
 *
 * Sheet ini hanya melaporkan hasil; ia tidak pernah melakukan mutasi sendiri.
 */
export function OperationSuccessSheet({
  success,
  secondaryLabel,
  onClose,
  onSecondary,
}: {
  readonly success: OperationSuccess | null;
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
          <AppIcon name="check_circle" className="text-[32px]" />
        </motion.div>
        <div>
          <p className="text-lg font-bold text-on-surface">{success?.title}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-on-surface-variant">
            {success?.description}
          </p>
        </div>
        <dl className="divide-y divide-outline-variant/15 overflow-hidden rounded-[22px] bg-white px-4 text-left ring-1 ring-ring-subtle">
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
