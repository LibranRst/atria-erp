"use client";
import { Button } from "../button/button";

import React from "react";

import { ConfirmationDialog } from "@/components/ui/overlay/dialogs";

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
  return (
    <ConfirmationDialog
      open={open}
      title={title}
      description={description}
      tone="warning"
      pending={pending}
      onClose={onContinue}
      actions={
        <div className="space-y-2">
          <Button
            type="button"
            pending={pending}
            pendingLabel={keepPendingLabel}
            onClick={onKeep}
            fullWidth
            variant="primary"
          >
            {pending ? keepPendingLabel : keepLabel}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={onDiscard}
              className="min-w-0 px-4"
              variant="critical"
            >
              Buang Perubahan
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={onContinue}
              className="min-w-0 px-4"
              variant="secondary"
            >
              Lanjut Mengisi
            </Button>
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
