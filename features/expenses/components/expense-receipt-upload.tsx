"use client";

import React from "react";
import { motion } from "framer-motion";

import type { ExpenseReceiptAttachment } from "./expense-form-types";
import { transitionSpringSnappy } from "@/lib/utils/motion";

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
        <div className="bg-surface-container-low ring-outline-variant/15 space-y-2 rounded-[22px] p-2 ring-1">
          <div className="flex min-h-14 items-center gap-3 rounded-2xl px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachment.url}
              alt="Pratinjau nota"
              className="h-11 w-11 shrink-0 rounded-2xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-on-surface truncate text-xs font-bold">{attachment.fileName}</p>
              <p className="text-on-surface-variant truncate text-[11px]">
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
              className="text-error focus-visible:ring-error/30 min-h-12 rounded-full px-3 text-xs font-bold outline-none focus-visible:ring-2 disabled:opacity-40"
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
        <div className="bg-surface-container-lowest ring-outline-variant/15 space-y-2 rounded-[24px] p-3 shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1">
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
            <p className="text-on-surface-variant px-1 text-[11px] leading-[1.35]">
              Pilih proyek terlebih dahulu agar hasil scan memakai kategori yang benar.
            </p>
          ) : null}
        </div>
      )}

      {busy ? (
        <div className="bg-primary/8 ring-primary/15 rounded-2xl px-4 py-3 ring-1" role="status">
          <div className="text-primary flex items-center justify-between gap-3 text-[11px] font-semibold">
            <span>{isUploading ? "Mengunggah nota…" : "Membaca isi nota…"}</span>
            <span>{isUploading ? "35%" : "72%"}</span>
          </div>
          <div className="bg-primary/10 mt-2 h-1.5 overflow-hidden rounded-full">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: isUploading ? "35%" : "72%" }}
              transition={transitionSpringSnappy}
              className="bg-primary h-full rounded-full"
            />
          </div>
        </div>
      ) : null}

      {uploadError ? (
        <div
          className="bg-error-container/20 text-error ring-error/20 flex min-h-12 items-center gap-3 rounded-2xl px-4 text-xs ring-1"
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
      className={`bg-surface-container-low text-on-surface ring-outline-variant/10 flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-full px-3 ring-1 focus-within:ring-2 focus-within:ring-blue-500/25 ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
        {icon}
      </span>
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
