"use client";

import React, { useState } from "react";

import { StatusBadge } from "@/components/ui/badge/badge";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";
import type { EffectiveProjectHealth } from "@/lib/project/effective-health";

/**
 * Cover proyek untuk surface identitas: foto penuh dengan fallback inisial ketika
 * cover belum diisi atau URL-nya gagal dimuat. Dipakai bersama oleh kartu daftar
 * proyek dan header halaman detail agar tinggi dan perilaku fallback-nya identik.
 */
export function ProjectCoverMedia({
  coverImageUrl,
  name,
  fallbackPlacement = "centered",
}: {
  readonly coverImageUrl: string | null;
  readonly name: string;
  /**
   * `centered` untuk hero tinggi seperti halaman detail; `corner` untuk hero yang
   * lebih pendek, agar monogram tidak bertabrakan dengan pil status dan judul.
   */
  readonly fallbackPlacement?: "centered" | "corner";
}): React.JSX.Element {
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
  const initial = name.trim().charAt(0).toUpperCase() || "P";
  const showCover = Boolean(coverImageUrl && failedCoverUrl !== coverImageUrl);

  if (showCover && coverImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverImageUrl}
        alt={`Cover ${name}`}
        onError={() => setFailedCoverUrl(coverImageUrl)}
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }

  if (fallbackPlacement === "corner") {
    return (
      <div className="relative h-full w-full overflow-hidden bg-primary text-on-primary">
        <span className="absolute top-3.5 left-3.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[22px] leading-none font-semibold text-white/90 ring-1 ring-white/12">
          {initial}
        </span>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-primary text-on-primary">
      <span className="relative flex h-20 w-20 -translate-y-5 items-center justify-center rounded-3xl bg-white/10 text-[32px] leading-none font-semibold text-white/90 shadow-surface ring-1 ring-white/12">
        {initial}
      </span>
    </div>
  );
}

/**
 * Pil status yang dibaca di atas foto: tone netral memakai kapsul putih, sedangkan
 * warning dan kritis memakai container semantiknya agar tetap kontras.
 */
export function ProjectHeroStatusPill({
  label,
  health,
  title,
}: {
  readonly label: string;
  readonly health?: EffectiveProjectHealth;
  readonly title?: string;
}): React.JSX.Element {
  const tone = health === "CRITICAL" ? "critical" : health === "WARNING" ? "warning" : "neutral";
  const surfaceClass =
    health === "CRITICAL"
      ? "!bg-critical-container !text-critical"
      : health === "WARNING"
        ? "!bg-warning-container !text-warning"
        : health === "HEALTHY"
          ? "!bg-white/92 !text-success"
          : "!bg-white/92 !text-on-surface";

  return <StatusBadge className={surfaceClass} tone={tone} label={label} title={title} />;
}

export function projectStatusLabel(status: string): string {
  if (status === "ACTIVE") return "Aktif";
  if (status === "ON_HOLD") return "Ditunda";
  if (status === "COMPLETED") return "Selesai";
  if (status === "CANCELLED") return "Dibatalkan";
  if (status === "DRAFT") return "Draf";
  return formatBusinessLabel(status);
}
