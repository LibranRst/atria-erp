"use client";

import { AppIcon, Button, StatusBadge } from "@/components/ui";
import * as React from "react";

/**
 * Shell kontainer bersama untuk semua kartu usulan aksi AI.
 *
 * Menerapkan estetika Calm Modern Luxury dengan radius konsisten (rounded-owner),
 * bayangan halus (shadow-surface), ring-subtle, grid komparasi Sebelum vs Sesudah (Diff),
 * dan tombol konfirmasi 1-klik yang idempoten.
 */

export type ProposalCardShellProps = {
  readonly eyebrow?: string;
  readonly headerAction?: React.ReactNode;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  readonly showConfirmAction?: boolean;
  readonly title: string;
  readonly status: "idle" | "submitting" | "submitted" | "failed";
  readonly statusLabel?: string;
  readonly errorMessage?: string;
  readonly isAlreadyConfirmed: boolean;
  readonly warningMessage?: string | null;
  /**
   * Bobot tombol konfirmasi.
   *
   * `quiet` untuk keputusan yang justru sebaiknya ditimbang, bukan ditekan
   * cepat: footer-nya memakai kanvas aplikasi dan tombolnya jadi pil putih
   * alih-alih balok hitam selebar kartu. Perubahan izin memakai ini — satu
   * ketukan yang terlihat "besar" mendorong orang menekannya lebih dulu dan
   * membacanya belakangan.
   */
  readonly confirmEmphasis?: "primary" | "quiet";
  readonly confirmLabel?: string;
  readonly submittedMessage?: string;
  readonly onConfirm: () => Promise<void>;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly viewActionLabel?: string;
  readonly onViewAction?: () => void;
};

export function ProposalCardShell({
  eyebrow,
  headerAction,
  disabled = false,
  disabledReason,
  showConfirmAction = true,
  title,
  status,
  statusLabel,
  errorMessage,
  isAlreadyConfirmed,
  warningMessage,
  confirmEmphasis = "primary",
  confirmLabel = "Konfirmasi dan Eksekusi",
  submittedMessage = "Aksi berhasil dikonfirmasi dan tercatat di sistem.",
  onConfirm,
  children,
  footer,
  viewActionLabel,
  onViewAction,
}: ProposalCardShellProps): React.JSX.Element {
  const isSubmitted = status === "submitted" || isAlreadyConfirmed;
  const isSubmitting = status === "submitting";
  const quiet = confirmEmphasis === "quiet";

  return (
    <section
      className="overflow-hidden rounded-owner bg-white shadow-surface ring-1 ring-ring-subtle"
      aria-label={title}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-eyebrow font-bold tracking-widest text-on-surface-variant uppercase">
              {eyebrow}
            </p>
          )}
          <h4
            className={`${eyebrow ? "mt-1" : ""} truncate text-section font-bold tracking-[-0.015em] text-on-surface`}
          >
            {title}
          </h4>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge
            tone={isSubmitted ? "completed" : isSubmitting ? "neutral" : "pending"}
            label={statusLabel ?? (isSubmitted ? "Selesai" : isSubmitting ? "Proses" : "Usulan")}
            className="shrink-0"
          />
          {headerAction}
        </div>
      </header>

      {/* Main Content & Diff Breakdown */}
      <div className="border-t border-black/5.5">{children}</div>

      {/* Peringatan / Warning Banner */}
      {warningMessage && !isSubmitted && (
        <p className="flex items-start gap-2 border-t border-black/5.5 bg-critical-container px-4 py-3 text-support font-semibold text-critical">
          <AppIcon name="warning" aria-hidden="true" className="mt-px icon-sm shrink-0" />
          <span>{warningMessage}</span>
        </p>
      )}

      {/* Footer / Aksi Konfirmasi */}
      <div className={`border-t border-black/5.5 px-4 py-3.5 ${quiet ? "bg-surface" : ""}`}>
        {footer !== undefined ? (
          footer
        ) : isSubmitted ? (
          <div className="space-y-2">
            <p className="flex items-start gap-2 text-support font-semibold text-on-surface-variant">
              <AppIcon
                name="check_circle"
                aria-hidden="true"
                className="mt-px icon-sm shrink-0 text-primary"
              />
              <span>{submittedMessage}</span>
            </p>
            {onViewAction && viewActionLabel && (
              <Button
                variant="secondary"
                size="compact"
                className="mt-1 w-full"
                onClick={onViewAction}
              >
                {viewActionLabel}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {status === "failed" && errorMessage && (
              <p
                className="flex items-start gap-2 text-support font-semibold text-critical"
                role="alert"
              >
                <AppIcon name="warning" aria-hidden="true" className="mt-px icon-sm shrink-0" />
                <span>{errorMessage}</span>
              </p>
            )}
            {showConfirmAction && (
              <Button
                variant={quiet ? "secondary" : "primary"}
                className="w-full"
                disabled={isSubmitting || disabled}
                onClick={() => void onConfirm()}
              >
                {isSubmitting ? "Memproses…" : confirmLabel}
              </Button>
            )}
            <p className="text-center text-meta font-semibold text-on-surface-variant">
              {disabledReason ??
                "Aksi baru dieksekusi setelah Anda menekan tombol konfirmasi di atas."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export function ProposalDiffRow({
  label,
  before,
  after,
  tone = "neutral",
  layout = "inline",
  inset = true,
  strikeBefore = true,
}: {
  readonly label: string;
  readonly before: string | React.ReactNode;
  readonly after: string | React.ReactNode;
  readonly tone?: "neutral" | "positive" | "negative";
  readonly layout?: "inline" | "stacked" | "vertical";
  readonly inset?: boolean;
  readonly strikeBefore?: boolean;
}): React.JSX.Element {
  if (layout !== "inline")
    return (
      <div className={`min-w-0 space-y-2 py-3 ${inset ? "px-4" : ""}`}>
        <p className="text-support font-semibold text-on-surface">{label}</p>
        <dl
          className={`grid min-w-0 gap-3 ${layout === "vertical" ? "grid-cols-1" : "grid-cols-2"}`}
        >
          <div className="min-w-0">
            <dt className="text-meta text-on-surface-variant">Sebelum</dt>
            <dd className="mt-1 text-support wrap-anywhere whitespace-pre-wrap text-on-surface-variant">
              {before}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-meta text-on-surface-variant">Sesudah</dt>
            <dd
              className={`mt-1 text-support font-semibold wrap-anywhere whitespace-pre-wrap ${tone === "negative" ? "text-critical" : tone === "positive" ? "text-primary" : "text-on-surface"}`}
            >
              {after}
            </dd>
          </div>
        </dl>
      </div>
    );
  return (
    <div
      className={`${strikeBefore ? "grid grid-cols-12" : "flex flex-wrap justify-between"} items-center gap-2 py-2.5 text-support ${inset ? "px-4" : ""}`}
    >
      <span
        className={`${strikeBefore ? "col-span-4" : "max-w-full"} font-semibold text-on-surface-variant`}
      >
        {label}
      </span>
      <div
        className={`${strikeBefore ? "col-span-8" : "max-w-full flex-wrap"} flex items-center justify-end gap-2 text-right font-semibold`}
      >
        <span
          className={
            strikeBefore
              ? "text-meta text-on-surface-variant/70 line-through"
              : "text-support text-on-surface-variant"
          }
        >
          <span className="sr-only">Sebelum: </span>
          {before}
        </span>
        <span className="text-on-surface-variant/40">→</span>
        <span
          className={
            tone === "positive"
              ? "font-bold text-primary"
              : tone === "negative"
                ? "font-bold text-critical"
                : "font-bold text-on-surface"
          }
        >
          <span className="sr-only">Sesudah: </span>
          {after}
        </span>
      </div>
    </div>
  );
}

export function ProposalItemRow({
  label,
  value,
  subvalue,
  wrapLabel = false,
}: {
  readonly label: string;
  readonly value: string | React.ReactNode;
  readonly subvalue?: React.ReactNode;
  readonly wrapLabel?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <dt
        className={`${wrapLabel ? "min-w-0 flex-1" : "shrink-0"} text-support font-semibold text-on-surface-variant`}
      >
        {label}
      </dt>
      <dd className={wrapLabel ? "min-w-0 shrink-0 text-right" : "min-w-0 text-right"}>
        <div className="text-row font-semibold text-on-surface">{value}</div>
        {subvalue && <div className="text-meta text-on-surface-variant">{subvalue}</div>}
      </dd>
    </div>
  );
}
