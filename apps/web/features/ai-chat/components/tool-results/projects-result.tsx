"use client";

import { AppIcon, MoneyValue, StatusBadge } from "@/components/ui";
import type { StatusBadgeTone } from "@/components/ui";
import { getProjectHealthOutputSchema, listProjectsOutputSchema } from "@/lib/ai/tool-output";
import Link from "next/link";
import * as React from "react";

import { projectOverviewHref } from "../../utils/deep-links";
import { ResultShell } from "./result-shell";
import { EMPTY_TOOL_RESULT_CONTEXT, resolveProjectName, type ToolResultProps } from "./types";

/**
 * Daftar proyek dan penilaian kesehatan satu proyek.
 *
 * Keduanya disatukan di berkas ini karena memakai kosakata kesehatan yang sama;
 * memisahkannya akan menggandakan tabel terjemahan status.
 */

const MAX_PROJECTS = 6;

const HEALTH_TONE: Record<string, StatusBadgeTone> = {
  HEALTHY: "healthy",
  WARNING: "warning",
  CRITICAL: "critical",
};

const HEALTH_LABEL: Record<string, string> = {
  HEALTHY: "Sehat",
  WARNING: "Perhatian",
  CRITICAL: "Kritis",
};

const HEALTH_RANK: Record<string, number> = { CRITICAL: 0, WARNING: 1, HEALTHY: 2 };

function healthTone(health: string): StatusBadgeTone {
  return HEALTH_TONE[health] ?? "neutral";
}

function healthLabel(health: string): string {
  return HEALTH_LABEL[health] ?? health;
}

export function ProjectsResult({ output }: ToolResultProps): React.JSX.Element | null {
  const parsed = listProjectsOutputSchema.safeParse(output);
  if (!parsed.success) return null;

  const projects = parsed.data.projects;
  if (projects.length === 0) return null;

  // Proyek yang bermasalah naik ke atas: daftar ini muncul untuk pertanyaan
  // orientasi, dan yang berisiko adalah bagian yang menuntut perhatian.
  const sorted = [...projects].sort(
    (left, right) => (HEALTH_RANK[left.storedHealth] ?? 3) - (HEALTH_RANK[right.storedHealth] ?? 3),
  );
  const shown = sorted.slice(0, MAX_PROJECTS);
  const hidden = sorted.length - shown.length;

  return (
    <ResultShell
      eyebrow="Proyek"
      title={`${projects.length} proyek`}
      appliedFilters={parsed.data.appliedFilters}
    >
      <div className="divide-y divide-black/5.5 border-t border-black/5.5">
        {shown.map((item) => {
          const href = projectOverviewHref(item.projectId);
          const body = (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-row font-semibold text-on-surface">{item.name}</p>
                <p className="truncate text-meta font-semibold text-on-surface-variant">
                  {item.clientName ?? "Tanpa klien"} · {item.contractValue.formatted}
                </p>
              </div>
              <StatusBadge
                tone={healthTone(item.storedHealth)}
                label={healthLabel(item.storedHealth)}
              />
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

      {hidden > 0 && (
        <p className="border-t border-black/5.5 px-4 py-2.5 text-meta font-semibold text-on-surface-variant">
          {hidden} proyek lain tidak ditampilkan.
        </p>
      )}
    </ResultShell>
  );
}

export function ProjectHealthResult({
  output,
  context = EMPTY_TOOL_RESULT_CONTEXT,
}: ToolResultProps): React.JSX.Element | null {
  const parsed = getProjectHealthOutputSchema.safeParse(output);
  if (!parsed.success) return null;

  const data = parsed.data;
  const projectId = data.projectId ?? context.projectId;

  return (
    <ResultShell
      eyebrow="Kesehatan keuangan"
      title={resolveProjectName(context, data.projectName, projectId) ?? data.projectName}
      href={projectOverviewHref(projectId)}
      linkLabel="Buka proyek"
      trailing={<StatusBadge tone={healthTone(data.health)} label={healthLabel(data.health)} />}
    >
      {data.totalAllocated && data.totalActual && data.totalRemaining && (
        <div className="grid grid-cols-3 gap-2 px-4 pb-3">
          <HealthCell label="Alokasi" amount={data.totalAllocated.amount} />
          <HealthCell label="Realisasi" amount={data.totalActual.amount} />
          <HealthCell
            label="Sisa"
            amount={data.totalRemaining.amount}
            tone={data.totalRemaining.amount < 0 ? "danger" : "default"}
          />
        </div>
      )}

      {data.reasons.length > 0 && (
        <ul className="space-y-1.5 border-t border-black/5.5 px-4 py-3">
          {data.reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2">
              <AppIcon
                name="priority_high"
                aria-hidden="true"
                className="mt-0.5 icon-xs shrink-0 text-on-surface-variant"
              />
              <span className="text-support font-semibold text-on-surface">{reason}</span>
            </li>
          ))}
        </ul>
      )}

      {data.note && (
        <p className="border-t border-black/5.5 px-4 py-3 text-support font-semibold text-on-surface-variant">
          {data.note}
        </p>
      )}
    </ResultShell>
  );
}

function HealthCell({
  label,
  amount,
  tone = "default",
}: {
  readonly label: string;
  readonly amount: number;
  readonly tone?: "default" | "danger";
}): React.JSX.Element {
  return (
    <div className="min-w-0 rounded-inset bg-surface-container-low px-2.5 py-2">
      <p className="text-eyebrow font-bold tracking-widest text-on-surface-variant uppercase">
        {label}
      </p>
      <MoneyValue
        amount={amount}
        variant="compact"
        size="sm"
        align="left"
        tone={tone === "danger" ? "danger" : "default"}
      />
    </div>
  );
}
