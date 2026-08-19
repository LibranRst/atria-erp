"use client";

import { AppIcon } from "@/components/ui";
import { transitionSpringSmooth } from "@/lib/utils/motion";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import * as React from "react";

/**
 * Cangkang bersama untuk semua kartu hasil tool.
 *
 * Menyatukan tiga hal yang harus sama di setiap kartu: judul dengan eyebrow,
 * permukaan pemilik putih, dan baris tautan opsional ke data aslinya. Renderer
 * hanya mengisi isinya, sehingga tidak ada radius atau shadow tulisan tangan
 * yang menyelinap masuk satu per satu.
 */

type ResultShellProps = {
  readonly eyebrow: string;
  readonly title: string;
  readonly trailing?: React.ReactNode;
  /** Keterangan kecil di bawah judul, misalnya cakupan penilaian. */
  readonly meta?: string;
  /**
   * Penanda bahwa hasil ini sudah dipersempit, misalnya `Cocok "Sudirman"`.
   *
   * Ini yang menjaga kejujuran kartu: daftar berisi satu baris harus terbaca
   * sebagai hasil pencarian, bukan sebagai klaim bahwa memang hanya ada satu.
   */
  readonly appliedFilters?: readonly string[];
  /** Tautan ke data aslinya. `null` berarti kartu tampil tanpa affordance tekan. */
  readonly href?: string | null;
  readonly linkLabel?: string;
  /** Dipanggil saat tautan di atas ditekan, biasanya untuk menutup sheet chat. */
  readonly onNavigate?: () => void;
  readonly children: React.ReactNode;
};

export function ResultShell({
  eyebrow,
  title,
  trailing,
  meta,
  appliedFilters,
  href,
  linkLabel = "Buka di aplikasi",
  onNavigate,
  children,
}: ResultShellProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitionSpringSmooth}
      className="overflow-hidden rounded-owner bg-white shadow-surface ring-1 ring-ring-subtle"
      aria-label={title}
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2.5">
        <div className="min-w-0">
          <p className="text-eyebrow font-bold tracking-widest text-on-surface-variant uppercase">
            {eyebrow}
          </p>
          <h4 className="mt-1 truncate text-section font-bold tracking-[-0.015em] text-on-surface">
            {title}
          </h4>
          {meta && (
            <p className="mt-0.5 truncate text-meta font-semibold text-on-surface-variant">
              {meta}
            </p>
          )}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </header>

      {appliedFilters && appliedFilters.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 px-4 pb-3" aria-label="Cakupan hasil">
          {appliedFilters.map((filter) => (
            <li
              key={filter}
              className="inline-flex min-h-6 items-center rounded-full bg-surface-container-low px-2.5 text-meta font-semibold text-on-surface-variant"
            >
              {filter}
            </li>
          ))}
        </ul>
      )}

      {children}

      {href && (
        <Link
          href={href}
          onClick={onNavigate}
          className="flex min-h-12 items-center justify-between gap-3 border-t border-black/5.5 px-4 text-support font-semibold text-on-surface-variant transition-colors duration-200 hover:bg-surface-container-low hover:text-on-surface focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
        >
          <span>{linkLabel}</span>
          <AppIcon name="chevron_right" aria-hidden="true" className="icon-sm shrink-0" />
        </Link>
      )}
    </motion.section>
  );
}

/**
 * Baris label→nilai di dalam kartu. Sengaja tidak memakai `FactRow` bersama
 * karena nilai uang di sini butuh ruang penuh di kolom kanan dan ukuran teks
 * yang lebih besar daripada baris fakta di sheet detail.
 */
export function ResultRow({
  label,
  meta,
  value,
  leading,
}: {
  readonly label: string;
  readonly meta?: string;
  readonly value: React.ReactNode;
  readonly leading?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
      {leading}
      <div className="min-w-0 flex-1">
        <p className="truncate text-row font-semibold text-on-surface">{label}</p>
        {meta && <p className="truncate text-meta font-semibold text-on-surface-variant">{meta}</p>}
      </div>
      <div className="min-w-0 shrink-0 text-right">{value}</div>
    </div>
  );
}
