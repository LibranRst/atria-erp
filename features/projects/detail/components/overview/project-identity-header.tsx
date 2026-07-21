"use client";

import React, { useState } from "react";

import { BottomSheet } from "@/components/ui";
import {
  projectHealthLabel,
  projectHealthReasonLabel,
  type EffectiveProjectHealth,
  type EffectiveProjectHealthReason,
} from "@/lib/project/effective-health";
import { DetailRow } from "./project-overview-primitives";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";

export type IdentityProject = {
  readonly name: string;
  readonly status: string;
  readonly financialHealth: string;
  readonly coverImageUrl: string | null;
  readonly location: string | null;
  readonly roomArea: string | null;
  readonly projectType: string | null;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly startDate?: Date | null;
  readonly endDate?: Date | null;
  readonly client: {
    readonly name: string;
    readonly email: string | null;
    readonly phone: string | null;
    readonly address: string | null;
  } | null;
  readonly projectManager: {
    readonly name: string;
    readonly email: string | null;
  } | null;
};

export function ProjectIdentityHeader({
  project,
  effectiveHealth,
  healthReasons,
}: {
  readonly project: IdentityProject;
  readonly effectiveHealth: EffectiveProjectHealth;
  readonly healthReasons: readonly EffectiveProjectHealthReason[];
}): React.JSX.Element {
  const [detailOpen, setDetailOpen] = useState(false);
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
  const initial = project.name.trim().charAt(0).toUpperCase() || "P";
  const showCover = Boolean(project.coverImageUrl && failedCoverUrl !== project.coverImageUrl);

  return (
    <>
      <section className="overflow-hidden rounded-[28px] bg-primary shadow-[0_16px_38px_rgba(17,17,17,0.11)] ring-1 ring-black/4">
        <div className="relative aspect-square overflow-hidden bg-primary">
          {showCover && project.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.coverImageUrl}
              alt={`Cover ${project.name}`}
              onError={() => setFailedCoverUrl(project.coverImageUrl)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <ProjectCoverFallback initial={initial} />
          )}

          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_40%,rgba(0,0,0,0.82)_100%)]"
            aria-hidden="true"
          />

          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 shadow-[0_4px_12px_rgba(0,0,0,0.1)] backdrop-blur-2xl"
            aria-label="Lihat detail proyek"
          >
            <span className="material-symbols-outlined text-[20px]">info</span>
          </button>

          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <p className="min-w-0 flex-1 truncate text-[9px] font-bold tracking-[0.14em] text-white/65 uppercase">
                {project.client?.name ?? "Klien belum diisi"}
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                <HeroStatusPill label={projectStatusLabel(project.status)} />
                <HeroStatusPill
                  label={projectHealthLabel(effectiveHealth)}
                  health={effectiveHealth}
                  title={
                    healthReasons[0]
                      ? projectHealthReasonLabel(healthReasons[0])
                      : "Tidak ada sinyal risiko aktif"
                  }
                />
              </div>
            </div>
            <h1 className="mt-2 line-clamp-2 max-w-[95%] text-[21px] leading-6.5 font-bold tracking-tight text-white">
              {project.name}
            </h1>
            <p className="mt-2 flex min-w-0 items-center gap-1.5 truncate text-[10px] font-medium text-white/65">
              <span className="material-symbols-outlined shrink-0 text-[13px]">location_on</span>
              <span className="truncate">{project.location || "Lokasi belum diisi"}</span>
              <span className="shrink-0 text-white/30">·</span>
              <span className="max-w-[42%] shrink-0 truncate">
                PM {project.projectManager?.name || "belum diisi"}
              </span>
            </p>
          </div>
        </div>
      </section>
      <BottomSheet open={detailOpen} title="Detail Proyek" onClose={() => setDetailOpen(false)}>
        <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/15">
          <DetailRow
            label="Klien"
            value={project.client?.name ?? "Belum diisi"}
            detail={
              [project.client?.email, project.client?.phone].filter(Boolean).join(" · ") ||
              project.client?.address ||
              undefined
            }
          />
          <DetailRow
            label="Penanggung jawab"
            value={project.projectManager?.name ?? "Belum diisi"}
            detail={project.projectManager?.email ?? undefined}
          />
          <DetailRow
            label="Kesehatan finansial"
            value={projectHealthLabel(effectiveHealth)}
            detail={
              healthReasons.length > 0
                ? healthReasons.map(projectHealthReasonLabel).join(" · ")
                : "Tidak ada sinyal risiko aktif"
            }
          />
          <DetailRow label="Lokasi" value={project.location ?? "Belum diisi"} />
          <DetailRow
            label="Area / Tipe"
            value={
              [project.roomArea, project.projectType].filter(Boolean).join(" · ") || "Belum diisi"
            }
          />
          <DetailRow
            label="Periode"
            value={
              project.startDate || project.endDate
                ? `${project.startDate ? new Date(project.startDate).toLocaleDateString("id-ID") : "—"} – ${project.endDate ? new Date(project.endDate).toLocaleDateString("id-ID") : "—"}`
                : `Dibuat ${new Date(project.createdAt).toLocaleDateString("id-ID")}`
            }
          />
          {project.notes && <DetailRow label="Catatan" value={project.notes} />}
        </div>
      </BottomSheet>
    </>
  );
}

function projectStatusLabel(status: string): string {
  if (status === "ACTIVE") return "Aktif";
  if (status === "ON_HOLD") return "Ditunda";
  if (status === "COMPLETED") return "Selesai";
  if (status === "CANCELLED") return "Dibatalkan";
  if (status === "DRAFT") return "Draf";
  return formatBusinessLabel(status);
}

function HeroStatusPill({
  label,
  health,
  title,
}: {
  readonly label: string;
  readonly health?: EffectiveProjectHealth;
  readonly title?: string;
}): React.JSX.Element {
  const tone =
    health === "CRITICAL"
      ? "border-error/25 bg-error/90 text-white"
      : health === "WARNING"
        ? "border-warning-light/20 bg-warning/85 text-white"
        : "border-white/15 bg-black/35 text-white";

  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full border px-2.5 text-[9px] font-bold tracking-wide uppercase shadow-[0_4px_14px_rgba(0,0,0,0.12)] ${tone}`}
      title={title}
    >
      {label}
    </span>
  );
}

function ProjectCoverFallback({ initial }: { readonly initial: string }): React.JSX.Element {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-primary text-on-primary">
      <span className="relative flex h-20 w-20 -translate-y-5 items-center justify-center rounded-3xl bg-white/10 text-[32px] leading-none font-semibold text-white/90 shadow-[0_12px_30px_rgba(0,0,0,0.16)] ring-1 ring-white/12">
        {initial}
      </span>
    </div>
  );
}
