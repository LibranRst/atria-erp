"use client";

import React from "react";
import Link from "next/link";

import { MoneyValue, StatusBadge, type StatusBadgeTone } from "@/components/ui";
import type { DashboardRiskyProject } from "@/features/finance-dashboard/types/dashboard-types";
import {
  ProgressBar,
  projectTone,
} from "@/features/finance-dashboard/components/shared/dashboard-tone";
export function ProjectRiskCard({
  project,
}: {
  readonly project: DashboardRiskyProject;
}): React.JSX.Element {
  const tone = projectTone(project);
  const initial = project.projectName.trim().charAt(0).toUpperCase() || "P";

  const circleColor = {
    critical: "bg-error/10 text-error",
    warning: "bg-secondary/10 text-secondary",
    positive: "bg-primary/10 text-primary",
    neutral: "bg-surface-container-high text-on-surface-variant",
  }[tone];
  const healthBadge: { readonly label: string; readonly tone: StatusBadgeTone } =
    project.effectiveHealth === "CRITICAL"
      ? { label: "Kritis", tone: "critical" }
      : project.effectiveHealth === "WARNING"
        ? { label: "Perhatian", tone: "warning" }
        : { label: "Terkendali", tone: "healthy" };

  return (
    <Link
      href={`/projects/${project.projectId}?tab=overview`}
      className="block w-60 shrink-0 snap-start rounded-2xl bg-white p-3.5 shadow-surface ring-1 ring-ring-subtle transition hover:bg-white active:scale-[0.99]"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-meta font-bold ${circleColor}`}
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs leading-tight font-extrabold text-on-surface">
            {project.projectName}
          </p>
        </div>
        <StatusBadge tone={healthBadge.tone} label={healthBadge.label} />
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[8px] leading-none font-bold tracking-wider text-on-surface-variant/60 uppercase">
          <span>Budget Terpakai</span>
          <span className="font-mono leading-none font-extrabold text-on-surface">
            {project.usedPercentage.toFixed(0)}%
          </span>
        </div>
        <ProgressBar value={project.usedPercentage} tone={tone} className="mt-0" />
      </div>

      <div className="mt-3.5 flex items-center justify-between border-t border-on-surface-variant/10 pt-2.5">
        <div className="min-w-0 flex-1">
          <span className="block text-[8px] leading-none font-bold tracking-wide text-on-surface-variant/50 uppercase">
            Sisa budget
          </span>
          <MoneyValue
            amount={project.remainingBudget}
            variant="compactWithFull"
            tone={project.remainingBudget < 0 ? "danger" : "default"}
            size="sm"
            className="mt-1"
          />
        </div>

        <span className="mx-2.5 h-5 w-px shrink-0 bg-on-surface-variant/10" />

        <div className="min-w-0 flex-1 text-right">
          <span className="block text-[8px] leading-none font-bold tracking-wide text-on-surface-variant/50 uppercase">
            Margin
          </span>
          <span className="financial-amount mt-1 block font-mono text-[10px] leading-none font-extrabold text-on-surface">
            {project.projectedMarginPercentage.toFixed(1)}%
          </span>
        </div>
      </div>
    </Link>
  );
}
