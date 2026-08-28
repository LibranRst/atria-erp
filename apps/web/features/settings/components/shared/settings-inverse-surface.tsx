"use client";

import React from "react";

/**
 * Satu-satunya implementasi permukaan fokus gelap di Settings.
 *
 * Grammar mengikuti focal surface ledger: `rounded-owner` + `bg-surface-inverse`
 * + `shadow-inverse`, rim-light hairline di tepi atas, inset cell memakai
 * `bg-white/8`. Jangan menyalin ulang blok ini di file lain — tambahkan slot
 * di sini bila kontennya butuh variasi.
 */
export function SettingsInverseSurface({
  label,
  className = "",
  children,
}: {
  readonly label: string;
  readonly className?: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      aria-label={label}
      className={`relative isolate overflow-hidden rounded-owner bg-surface-inverse px-5 py-5 text-on-primary shadow-inverse ring-1 ring-white/8 max-[430px]:px-4 max-[430px]:py-4 ${className}`}
    >
      <span
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/20"
        aria-hidden="true"
      />
      {children}
    </section>
  );
}
