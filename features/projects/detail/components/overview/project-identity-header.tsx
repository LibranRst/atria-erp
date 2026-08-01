"use client";

import React, { useState } from "react";

import { AppIcon, BottomSheet } from "@/components/ui";
import {
  projectHealthLabel,
  projectHealthReasonLabel,
  type EffectiveProjectHealth,
  type EffectiveProjectHealthReason,
} from "@/lib/project/effective-health";
import { DetailRow } from "./project-overview-primitives";
import {
  ProjectCoverMedia,
  ProjectHeroStatusPill,
  projectStatusLabel,
} from "@/features/projects/shared/components/project-cover-hero";

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

  return (
    <>
      <section className="overflow-hidden rounded-[28px] bg-primary shadow-inverse ring-1 ring-ring-subtle">
        <div className="relative aspect-square overflow-hidden bg-primary">
          <ProjectCoverMedia coverImageUrl={project.coverImageUrl} name={project.name} />

          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_40%,rgba(0,0,0,0.82)_100%)]"
            aria-hidden="true"
          />

          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 shadow-control backdrop-blur-2xl"
            aria-label="Lihat detail proyek"
          >
            <AppIcon name="info" className="text-[20px]" />
          </button>

          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <p className="min-w-0 flex-1 truncate text-[9px] font-bold tracking-[0.14em] text-white/65 uppercase">
                {project.client?.name ?? "Klien belum diisi"}
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                <ProjectHeroStatusPill label={projectStatusLabel(project.status)} />
                <ProjectHeroStatusPill
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
              <AppIcon name="location_on" className="shrink-0 text-[13px]" />
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
        <div className="overflow-hidden rounded-[22px] bg-white shadow-surface ring-1 ring-ring-subtle">
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
