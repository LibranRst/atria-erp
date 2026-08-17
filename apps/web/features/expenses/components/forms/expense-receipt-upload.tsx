"use client";

import React from "react";
import { motion } from "framer-motion";

import type { ExpenseReceiptAttachment } from "@/features/expenses/types/expense-form-types";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { AppIcon } from "@/components/ui";
const MAX_RECEIPT_SIZE = 12 * 1024 * 1024;

type ExpenseReceiptUploadProps = {
  readonly attachment: ExpenseReceiptAttachment | null;
  readonly selectedProjectId: string;
  readonly disabled: boolean;
  readonly isUploading: boolean;
  readonly isProcessingOCR: boolean;
  readonly uploadError?: string | null;
  readonly onSelectFile: (file: File) => void;
  readonly onClearReceipt: () => void;
  readonly onValidationError: (message: string) => void;
};

export function ExpenseReceiptUpload({
  attachment,
  selectedProjectId,
  disabled,
  isUploading,
  isProcessingOCR,
  uploadError,
  onSelectFile,
  onClearReceipt,
  onValidationError,
}: ExpenseReceiptUploadProps): React.JSX.Element {
  const [lastFile, setLastFile] = React.useState<File | null>(null);
  const busy = isUploading || isProcessingOCR;

  function acceptFile(file: File | undefined): void {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onValidationError("Pilih file gambar nota dalam format JPG, PNG, HEIC, atau WebP.");
      return;
    }
    if (file.size > MAX_RECEIPT_SIZE) {
      onValidationError("Ukuran gambar melebihi 12 MB. Kompres atau pilih gambar lain.");
      return;
    }
    setLastFile(file);
    onSelectFile(file);
  }

  return (
    <div className="space-y-2.5">
      {attachment ? (
        <div className="space-y-2 rounded-[22px] bg-surface-container-low p-2 ring-1 ring-ring-subtle">
          <div className="flex min-h-14 items-center gap-3 rounded-2xl px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachment.url}
              alt="Pratinjau nota"
              className="h-11 w-11 shrink-0 rounded-2xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-on-surface">{attachment.fileName}</p>
              <p className="truncate text-support text-on-surface-variant">
                {(attachment.size / 1024 / 1024).toLocaleString("id-ID", {
                  maximumFractionDigits: 1,
                })}{" "}
                MB · Tersimpan di draft
              </p>
            </div>
            <button
              type="button"
              onClick={onClearReceipt}
              disabled={disabled}
              className="min-h-12 rounded-full px-3 text-xs font-bold text-error outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-40"
            >
              Hapus
            </button>
          </div>
          <ReceiptUploadOption
            icon="swap_horiz"
            label="Ganti Gambar"
            disabled={disabled}
            onFile={acceptFile}
          />
        </div>
      ) : (
        <div className="space-y-2 rounded-3xl">
          <div className="grid grid-cols-2 gap-2">
            <ReceiptUploadOption
              icon="photo_camera"
              label="Foto Nota"
              disabled={!selectedProjectId || disabled}
              capture="environment"
              onFile={acceptFile}
            />
            <ReceiptUploadOption
              icon="photo_library"
              label="Pilih Gambar"
              disabled={!selectedProjectId || disabled}
              onFile={acceptFile}
            />
          </div>
          {!selectedProjectId ? (
            <p className="px-1 text-[11px] leading-[1.35] text-on-surface-variant">
              Pilih proyek terlebih dahulu agar hasil scan memakai kategori yang benar.
            </p>
          ) : null}
        </div>
      )}

      {busy ? (
        <div className="rounded-2xl bg-primary/8 px-4 py-3 ring-1 ring-primary/15" role="status">
          <div className="flex items-center justify-between gap-3 text-support font-semibold text-primary">
            <span>{isUploading ? "Mengunggah nota…" : "Membaca isi nota…"}</span>
            <span>{isUploading ? "35%" : "72%"}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: isUploading ? "35%" : "72%" }}
              transition={transitionSpringSnappy}
              className="h-full rounded-full bg-primary"
            />
          </div>
        </div>
      ) : null}

      {uploadError ? (
        <div
          className="flex min-h-12 items-center gap-3 rounded-2xl bg-error-container/20 px-4 text-xs text-error ring-1 ring-error/20"
          role="alert"
        >
          <span className="min-w-0 flex-1 leading-4">{uploadError}</span>
          {lastFile ? (
            <button
              type="button"
              onClick={() => onSelectFile(lastFile)}
              className="min-h-10 shrink-0 rounded-full px-3 font-bold"
            >
              Coba Lagi
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ReceiptUploadOption({
  icon,
  label,
  disabled,
  capture,
  onFile,
}: {
  readonly icon: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly capture?: "environment";
  readonly onFile: (file: File | undefined) => void;
}): React.JSX.Element {
  return (
    <motion.label
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={transitionSpringSnappy}
      className={`flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-full bg-surface-container-lowest px-3 text-on-surface shadow-surface ring-1 ring-ring-subtle focus-within:ring-2 focus-within:ring-focus-ring ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
    >
      <AppIcon name={icon} className="icon-md" />
      <span className="truncate text-xs font-bold">{label}</span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
        capture={capture}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
    </motion.label>
  );
}
