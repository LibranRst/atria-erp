"use client";

import { AppIcon, MoneyValue, StatusBadge } from "@/components/ui";
import type { StatusBadgeTone } from "@/components/ui";
import { getProjectsAtRiskOutputSchema } from "@/lib/ai/tool-output";
import Link from "@/lib/navigation/workspace-link";
import * as React from "react";

import { projectOverviewHref } from "../../utils/deep-links";
import { ResultShell } from "./result-shell";
import { EMPTY_TOOL_RESULT_CONTEXT, type ToolResultProps } from "./types";

/**
 * Proyek yang perlu perhatian, masing-masing dengan kategori terburuknya.
 *
 * Kartu ini menggantikan pola lama: model memanggil budget tiap proyek satu per
 * satu, lalu antarmuka menampilkan kartu untuk proyek sehat sekalipun. Di sini
 * yang sehat tidak pernah masuk, dan jumlah yang dinilai tetap disebut supaya
 * daftar pendek tidak disalahartikan sebagai data yang belum lengkap.
 */

const HEALTH_TONE: Record<string, StatusBadgeTone> = {
  WARNING: "warning",
  CRITICAL: "critical",
};

const HEALTH_LABEL: Record<string, string> = {
  WARNING: "Perhatian",
  CRITICAL: "Kritis",
};

export function ProjectsAtRiskResult({
  output,
  context = EMPTY_TOOL_RESULT_CONTEXT,
}: ToolResultProps): React.JSX.Element | null {
  const parsed = getProjectsAtRiskOutputSchema.safeParse(output);
  if (!parsed.success) return null;

  const data = parsed.data;

  // Tidak ada proyek berisiko adalah jawaban yang berarti, bukan keadaan kosong.
  if (data.projects.length === 0) {
    return (
      <ResultShell eyebrow="Kesehatan portofolio" title="Semua proyek aman">
        <p className="border-t border-black/5.5 px-4 py-3 text-support font-semibold text-on-surface-variant">
          {data.assessedCount !== undefined
            ? `${data.assessedCount} proyek dinilai, tidak ada yang perlu perhatian sekarang.`
            : "Tidak ada proyek yang perlu perhatian sekarang."}
        </p>
      </ResultShell>
    );
  }

  return (
    <ResultShell
      eyebrow="Perlu perhatian"
      title={`${data.projects.length} proyek berisiko`}
      meta={
        data.assessedCount !== undefined
          ? `dari ${data.assessedCount} proyek yang dinilai`
          : undefined
      }
      trailing={
        data.appliedFilters && data.appliedFilters.length > 0 ? (
          <span className="inline-flex min-h-6 items-center rounded-full bg-surface-container-low px-2.5 text-meta font-semibold text-on-surface-variant">
            {data.appliedFilters[0]}
          </span>
        ) : undefined
      }
    >
      <div className="divide-y divide-black/5.5 border-t border-black/5.5">
        {data.projects.map((item) => {
          const href = projectOverviewHref(item.projectId);
          const body = (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-row font-semibold text-on-surface">
                  {item.projectName}
                </p>
                <p className="truncate text-meta font-semibold text-on-surface-variant">
                  {item.worstCategory
                    ? `${item.worstCategory.categoryName} ${Math.round(item.worstCategory.usedPercentage)}% terpakai`
                    : (item.reasons[0] ?? "Perlu ditinjau")}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <MoneyValue
                  amount={item.totalRemaining.amount}
                  variant="compact"
                  size="sm"
                  align="right"
                  tone={item.totalRemaining.amount < 0 ? "danger" : "default"}
                />
                <StatusBadge
                  tone={HEALTH_TONE[item.health] ?? "neutral"}
                  label={HEALTH_LABEL[item.health] ?? item.health}
                />
              </div>
              {href && (
                <AppIcon
                  name="chevron_right"
                  aria-hidden="true"
                  className="icon-sm shrink-0 text-on-surface-variant"
                />
              )}
            </>
          );

          return href ? (
            <Link
              key={item.projectId}
              href={href}
              onClick={context.onNavigate}
              className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors duration-200 hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
            >
              {body}
            </Link>
          ) : (
            <div key={item.projectId} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
              {body}
            </div>
          );
        })}
      </div>
    </ResultShell>
  );
}
