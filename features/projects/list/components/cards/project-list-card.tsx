"use client";

import Link from "next/link";
import React from "react";

import { AppIcon, BudgetSplitIndicator, MoneyValue } from "@/components/ui";
import {
  ProjectCoverMedia,
  ProjectHeroStatusPill,
  projectStatusLabel,
} from "@/features/projects/shared/components/project-cover-hero";
import { projectHealthReasonLabel } from "@/lib/project/effective-health";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";
import { formatShortIdr } from "@/lib/utils/money";
import type { ProjectItem } from "../../types/project-list-types";
import { getUsedPercentage } from "../../utils/project-list-utils";

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
  const needsAttention = project.effectiveHealth !== "HEALTHY";
  const isCritical = project.effectiveHealth === "CRITICAL";
  const healthLabel = isCritical
    ? "Kritis"
    : project.effectiveHealth === "WARNING"
      ? "Perhatian"
      : "Terkendali";

  return (
    <article className="group relative overflow-hidden rounded-[26px] bg-white/92 p-1.5 shadow-surface ring-1 ring-ring-subtle max-[430px]:rounded-3xl">
      <Link
        href={`/projects/${project.id}`}
        className="block rounded-[22px] outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-black/[0.018]"
        aria-label={`Buka project ${project.name}`}
      >
        <div className="relative aspect-4/3 overflow-hidden rounded-[22px] bg-primary">
          <ProjectCoverMedia
            coverImageUrl={project.coverImageUrl ?? null}
            name={project.name}
            fallbackPlacement="corner"
          />

          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_42%,rgba(0,0,0,0.80)_100%)]"
            aria-hidden="true"
          />

          <div
            className={`absolute inset-x-0 bottom-0 p-3.5 ${isAllowedToCreate && editable ? "pr-14" : ""}`}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <ProjectHeroStatusPill label={projectStatusLabel(project.status)} />
              <ProjectHeroStatusPill
                label={healthLabel}
                health={project.effectiveHealth}
                title={
                  primaryReason
                    ? projectHealthReasonLabel(primaryReason)
                    : "Tidak ada sinyal risiko aktif"
                }
              />
            </div>
            <h2 className="mt-2 line-clamp-2 text-[17px] leading-5.5 font-bold tracking-tight text-white">
              {project.name}
            </h2>
            <p className="mt-1 truncate text-support text-white/70">
              {project.location || "Lokasi belum diisi"}
            </p>
          </div>
        </div>

        <div className={`px-2.5 pt-3 ${needsAttention ? "pb-3" : "pb-4"}`}>
          <p className="truncate text-support font-semibold text-on-surface-variant">
            Klien {project.clientName} · PM {project.pmName}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <ProjectMoneyFact
              label="Aktual"
              amount={project.actualCost}
              detail={
                project.actualCost <= 0 && project.internalBudget > 0
                  ? `dari ${formatShortIdr(project.internalBudget)}`
                  : undefined
              }
            />
            <ProjectMoneyFact
              label={hasOverrun ? "Melebihi budget" : "Sisa budget"}
              amount={project.remainingBudget}
              tone={hasOverrun ? "danger" : project.remainingBudget > 0 ? "success" : "default"}
            />
          </div>

          <BudgetSplitIndicator
            value={usedPercentage}
            danger={hasOverrun}
            tone={
              isCritical
                ? "critical"
                : project.effectiveHealth === "WARNING"
                  ? "warning"
                  : "positive"
            }
          />

          {needsAttention ? (
            <p
              className={`mt-2.5 flex items-start gap-1.5 text-support font-bold ${isCritical ? "text-error" : "text-warning"}`}
            >
              <AppIcon name="warning" className="mt-px shrink-0 text-[13px]" />
              <span className="min-w-0">
                {primaryReason ? projectHealthReasonLabel(primaryReason) : "Project perlu ditinjau"}
              </span>
            </p>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/30 pt-2.5">
            <span className="truncate text-meta font-semibold text-on-surface-variant/70">
              Kontrak {formatShortIdr(project.totalContractValue)}
            </span>
            <span className="shrink-0 text-meta font-bold text-on-surface-variant">
              {budgetStatusLabel(project.budgetStatus)}
            </span>
          </div>
        </div>
      </Link>

      {isAllowedToCreate && editable ? (
        <button
          type="button"
          onClick={() => onEdit(project)}
          className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-on-surface shadow-control backdrop-blur-2xl outline-none after:absolute after:-inset-1 after:rounded-full focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-white"
          aria-label={`Edit ${project.name}`}
        >
          <AppIcon name="edit" className="text-[18px]" />
        </button>
      ) : null}
    </article>
  );
}

function ProjectMoneyFact({
  label,
  amount,
  tone = "default",
  detail,
}: {
  readonly label: string;
  readonly amount: number;
  readonly tone?: "default" | "success" | "danger";
  readonly detail?: string;
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <p className="truncate text-meta font-semibold text-on-surface-variant/60">{label}</p>
      <MoneyValue
        amount={amount}
        variant="compactWithFull"
        size="xl"
        tone={tone}
        className="mt-0.5"
      />
      {detail ? (
        <p className="mt-0.5 truncate text-eyebrow font-bold text-on-surface-variant/75">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function budgetStatusLabel(status: string): string {
  if (status === "TIDAK ADA") return "Belum disiapkan";
  if (status === "PENDING_REVIEW") return "Menunggu review";
  if (status === "APPROVED") return "Disetujui";
  if (status === "DRAFT") return "Draft";
  return formatBusinessLabel(status);
}
