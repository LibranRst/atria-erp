"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { ConfirmationDialog } from "@/components/ui/overlay/dialogs";
import { buttonTapActiveScale, transitionSpringSnappy } from "@/lib/utils/motion";

/**
 * Konfirmasi tiga pilihan saat pengguna menutup form yang belum selesai:
 * simpan lalu tutup, buang perubahan, atau lanjut mengisi.
 *
 * Judul, deskripsi, dan label aksi simpan sengaja dijadikan prop, bukan
 * disamakan: konsekuensinya berbeda per domain — draft material tidak mengubah
 * stok, sedangkan form keuangan belum mencatat transaksi. Menyeragamkan
 * salinannya akan mengaburkan perbedaan itu.
 *
 * Gunakan preset `FinanceUnsavedChangesModal` atau `MaterialUnsavedChangesModal`
 * di bawah alih-alih menyalin ulang salinan tersebut di setiap call site.
 */
export function UnsavedChangesModal({
  open,
  title,
  description,
  keepLabel,
  keepPendingLabel,
  pending = false,
  onKeep,
  onDiscard,
  onContinue,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly keepLabel: string;
  readonly keepPendingLabel: string;
  readonly pending?: boolean;
  readonly onKeep: () => void;
  readonly onDiscard: () => void;
  readonly onContinue: () => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  return (
    <ConfirmationDialog
      open={open}
      title={title}
      description={description}
      tone="warning"
      onClose={onContinue}
      actions={
        <div className="space-y-2">
          <motion.button
            type="button"
            whileTap={{ scale: reduceMotion ? 1 : buttonTapActiveScale }}
            transition={transitionSpringSnappy}
            disabled={pending}
            onClick={onKeep}
            className="min-h-12 w-full rounded-full bg-primary px-5 text-sm font-bold text-white outline-none active:shadow-raised active:z-10 disabled:opacity-45"
          >
            {pending ? keepPendingLabel : keepLabel}
          </motion.button>
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: reduceMotion ? 1 : buttonTapActiveScale }}
              transition={transitionSpringSnappy}
              disabled={pending}
              onClick={onDiscard}
              className="min-h-12 rounded-full bg-error-container/25 px-4 text-xs font-bold text-error outline-none active:shadow-raised active:z-10 disabled:opacity-45"
            >
              Buang Perubahan
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: reduceMotion ? 1 : buttonTapActiveScale }}
              transition={transitionSpringSnappy}
              disabled={pending}
              onClick={onContinue}
              className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold text-on-surface outline-none active:shadow-raised active:z-10 disabled:opacity-45"
            >
              Lanjut Mengisi
            </motion.button>
          </div>
        </div>
      }
    />
  );
}

type UnsavedChangesPresetProps = {
  readonly open: boolean;
  readonly pending?: boolean;
  readonly onKeep: () => void;
  readonly onDiscard: () => void;
  readonly onContinue: () => void;
};

/** Form keuangan: menutup form belum mencatat transaksi apa pun. */
export function FinanceUnsavedChangesModal(props: UnsavedChangesPresetProps): React.JSX.Element {
  return (
    <UnsavedChangesModal
      {...props}
      title="Perubahan belum selesai"
      description="Data ini tersimpan di perangkat. Anda dapat menutup dan melanjutkannya nanti tanpa mencatat transaksi keuangan."
      keepLabel="Simpan & Tutup"
      keepPendingLabel="Memproses…"
    />
  );
}

/** Alur material: draft disimpan tanpa mengubah stok. */
export function MaterialUnsavedChangesModal(props: UnsavedChangesPresetProps): React.JSX.Element {
  return (
    <UnsavedChangesModal
      {...props}
      title="Perubahan belum disimpan"
      description="Simpan hasil hitung sebagai draft agar dapat dilanjutkan tanpa mengubah stok."
      keepLabel="Simpan Draft & Tutup"
      keepPendingLabel="Menyimpan…"
    />
  );
}
