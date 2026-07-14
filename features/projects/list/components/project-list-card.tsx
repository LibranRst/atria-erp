"use client";

import Link from "next/link";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { MoneyValue } from "@/components/ui/page-primitives";
import {
  projectHealthLabel,
  projectHealthReasonLabel,
} from "@/lib/project/effective-health";
import type { ProjectItem } from "./project-list-types";
import { getUsedPercentage } from "./project-list-utils";

export function ProjectListCard({
  project,
  isAllowedToCreate,
  onEdit,
}: {
  readonly project: ProjectItem;
  readonly isAllowedToCreate: boolean;
  readonly onEdit: (project: ProjectItem) => void;
}): React.JSX.Element {
  const hasOverrun = project.remainingBudget < 0;
  const usedPercentage = getUsedPercentage(project);
  const editable = project.status !== "COMPLETED" && project.status !== "CANCELLED";

  const primaryReason = project.healthReasons[0];

  return (
    <article className="group relative overflow-hidden rounded-[28px] border border-outline-variant/20 bg-white shadow-[0_10px_26px_rgba(17,17,17,0.05)]">
      <div className="relative">
        <Link
          href={`/projects/${project.id}`}
          className="block h-40 bg-surface-container outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35"
          aria-label={`Buka project ${project.name}`}
        >
          <ProjectCover project={project} />
          <span className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5 rounded-full bg-white/95 p-1 shadow-[0_6px_18px_rgba(17,17,17,0.10)]">
            <Badge status={project.status === "ACTIVE" ? "APPROVED" : project.status === "DRAFT" ? "DRAFT" : "WARNING"}>
              {project.status}
            </Badge>
            <Badge status={project.effectiveHealth} title={primaryReason ? projectHealthReasonLabel(primaryReason) : undefined}>
              {projectHealthLabel(project.effectiveHealth)}
            </Badge>
          </span>
        </Link>

        {isAllowedToCreate && editable ? (
          <button
            type="button"
            onClick={() => onEdit(project)}
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-on-surface shadow-[0_6px_18px_rgba(17,17,17,0.12)] outline-none transition-colors hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-primary/35 active:bg-surface-container"
            aria-label={`Edit ${project.name}`}
          >
            <span className="material-symbols-outlined text-[20px]">more_horiz</span>
          </button>
        ) : (
          <span className="material-symbols-outlined absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[20px] text-on-surface-variant shadow-[0_6px_18px_rgba(17,17,17,0.12)]">
            arrow_outward
          </span>
        )}
      </div>

      <div className="p-3.5">
        <Link
          href={`/projects/${project.id}`}
          className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="line-clamp-2 text-[17px] font-bold leading-[22px] tracking-[-0.01em] text-on-surface">
                {project.name}
              </h2>
              <p className="mt-1 truncate text-[11px] leading-4 text-on-surface-variant">
                {project.clientName} · {project.location || "Lokasi belum diisi"}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-surface-container-low px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
              {project.budgetStatus}
            </span>
          </div>
        </Link>

        <Link
          href={`/projects/${project.id}`}
          className="mt-3 block rounded-[20px] bg-surface-container-low px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <div className="grid grid-cols-3 gap-2">
            <CompactValue label="Nilai" amount={project.totalContractValue} />
            <div className="min-w-0 text-center">
              <p className="text-[8px] font-bold uppercase tracking-wide text-on-surface-variant">
                Terpakai
              </p>
              <p className={`mt-1 font-mono text-[12px] font-bold ${hasOverrun ? "text-error" : "text-on-surface"}`}>
                {usedPercentage.toFixed(0)}%
              </p>
            </div>
            <CompactValue
              label={hasOverrun ? "Over" : "Sisa"}
              amount={project.remainingBudget}
              danger={hasOverrun}
              align="right"
            />
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
            <div
              className={`h-full rounded-full ${hasOverrun ? "bg-error" : usedPercentage >= 75 ? "bg-warning" : "bg-primary"}`}
              style={{ width: `${Math.min(usedPercentage, 100)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-[9px] text-on-surface-variant">
            <span className="truncate">PM {project.pmName}</span>
            {primaryReason ? (
              <span className="shrink-0 font-bold">
                {projectHealthReasonLabel(primaryReason)}
              </span>
            ) : (
              <span className="shrink-0 font-semibold">Budget terkendali</span>
            )}
          </div>
        </Link>
      </div>
    </article>
  );
}

function ProjectCover({
  project,
}: {
  readonly project: ProjectItem;
}): React.JSX.Element {
  if (project.coverImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={project.coverImageUrl}
        alt={`Cover ${project.name}`}
        className="h-full w-full object-cover"
      />
    );
  }

  const initial = project.name.trim().charAt(0).toUpperCase() || "P";

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-primary text-on-primary">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <span className="absolute bottom-3 left-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/55">
        Project workspace
      </span>
      <span className="relative text-[52px] font-semibold leading-none tracking-[-0.05em] text-white/90">
        {initial}
      </span>
    </div>
  );
}

function CompactValue({
  label,
  amount,
  danger = false,
  align = "left",
}: {
  readonly label: string;
  readonly amount: number;
  readonly danger?: boolean;
  readonly align?: "left" | "right";
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <p className={`text-[8px] font-bold uppercase tracking-wide text-on-surface-variant ${align === "right" ? "text-right" : ""}`}>{label}</p>
      <MoneyValue amount={amount} variant="compactWithFull" tone={danger ? "danger" : "default"} align={align} size="xs" className="mt-1" />
    </div>
  );
}
