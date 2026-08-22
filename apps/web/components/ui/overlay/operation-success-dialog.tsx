"use client";

import React from "react";

import { SuccessDialog } from "./dialogs";

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
 * Dialog ini hanya melaporkan hasil; ia tidak pernah melakukan mutasi sendiri.
 */
export function OperationSuccessDialog({
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
    <SuccessDialog
      open={Boolean(success)}
      title={success?.title ?? "Berhasil"}
      description={success?.description ?? "Operasi selesai."}
      facts={success?.facts ?? []}
      primaryLabel="Selesai"
      secondaryLabel={secondaryLabel}
      onClose={onClose}
      onPrimary={onClose}
      onSecondary={onSecondary}
    />
  );
}

/** @deprecated Gunakan `OperationSuccessDialog`. */
export const OperationSuccessSheet = OperationSuccessDialog;
