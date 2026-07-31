"use client";

import Link from "next/link";
import React from "react";

import { MoneyValue } from "@/components/ui/feedback/page-primitives";
import { BudgetSplitIndicator } from "@/features/finance-dashboard/components/cards/budget-split-indicator";
import { projectHealthReasonLabel } from "@/lib/project/effective-health";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";
import type { ProjectItem, ProjectStatus } from "../../types/project-list-types";
import { getUsedPercentage } from "../../utils/project-list-utils";
import { AppIcon } from "@/components/ui/icon/app-icon";
import { MetadataChip, StatusBadge } from "@/components/ui/badge/badge";

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
  const hasBudget = project.budgetStatus !== "TIDAK ADA";
  const usedPercentage = getUsedPercentage(project);
  const editable = project.status !== "COMPLETED" && project.status !== "CANCELLED";
  const primaryReason = project.healthReasons[0];
  const needsAttention = project.effectiveHealth !== "HEALTHY";
  const budgetIndicatorRelevant =
    usedPercentage >= 75 || primaryReason === "BUDGET_OVERRUN" || primaryReason === "BUDGET_WATCH";
  const healthTone =
    project.effectiveHealth === "CRITICAL"
      ? "critical"
      : project.effectiveHealth === "WARNING"
        ? "warning"
        : "healthy";
  const healthLabel =
    project.effectiveHealth === "CRITICAL"
      ? "Kritis"
      : project.effectiveHealth === "WARNING"
        ? "Perhatian"
        : "Terkendali";
  return (
    <article className="group relative overflow-hidden rounded-[26px] bg-white/90 shadow-surface ring-1 ring-ring-subtle backdrop-blur-xl max-[430px]:rounded-3xl">
      <Link
        href={`/projects/${project.id}`}
        className="block p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-black/[0.018]"
        aria-label={`Buka project ${project.name}`}
      >
        <div
          className={`flex min-h-10 min-w-0 items-center gap-1.5 ${isAllowedToCreate && editable ? "pr-11" : ""}`}
        >
          <MetadataChip>{projectStatusLabel(project.status)}</MetadataChip>
          <StatusBadge tone={healthTone} label={healthLabel} />
        </div>

        <div className="mt-1.5 flex items-start gap-3">
          <ProjectCover project={project} />
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 text-[15px] leading-5 font-bold tracking-[-0.01em] text-on-surface">
              {project.name}
            </h2>
            <p className="mt-1 truncate text-[10px] leading-4 text-on-surface-variant">
              {project.clientName}
            </p>
            <p className="truncate text-[9px] leading-4 text-on-surface-variant/65">
              {project.location || "Lokasi belum diisi"}
            </p>
          </div>
        </div>

        <div className="mt-3 border-t border-black/5.5 pt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold text-on-surface-variant/60">Nilai project</p>
              <MoneyValue
                amount={project.totalContractValue}
                variant="compactWithFull"
                size="lg"
                className="mt-1"
              />
            </div>
            <div className="min-w-0 text-right">
              <p className="text-[9px] font-semibold text-on-surface-variant/60">Status budget</p>
              <p className="mt-1 truncate text-[10px] font-bold text-on-surface">
                {budgetStatusLabel(project.budgetStatus)}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 divide-x divide-black/5.5 rounded-[18px] bg-surface-container-low/65 px-3 py-2.5">
            <ProjectMoneyMetric label="Aktual" amount={project.actualCost} />
            <ProjectMoneyMetric
              label={hasOverrun ? "Melebihi budget" : "Sisa budget"}
              amount={project.remainingBudget}
              align="right"
              danger={hasOverrun}
            />
          </div>

          {needsAttention ? (
            <div
              className={`mt-3 rounded-[18px] px-3 py-2.5 ${healthTone === "critical" ? "bg-error/5.5" : "bg-warning/[0.07]"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`min-w-0 text-[10px] font-bold ${healthTone === "critical" ? "text-error" : "text-warning"}`}
                >
                  {primaryReason
                    ? projectHealthReasonLabel(primaryReason)
                    : "Project perlu ditinjau"}
                </span>
                <span
                  className={`shrink-0 font-mono text-[10px] font-black ${healthTone === "critical" ? "text-error" : "text-warning"}`}
                >
                  {usedPercentage.toFixed(0)}%
                </span>
              </div>
              {budgetIndicatorRelevant ? (
                <BudgetSplitIndicator
                  value={usedPercentage}
                  tone={healthTone === "critical" ? "critical" : "warning"}
                  danger={hasOverrun}
                />
              ) : null}
            </div>
          ) : (
            <div className="mt-3 flex min-h-8 items-center justify-between gap-3 px-1 text-[9px] font-semibold text-on-surface-variant/70">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <AppIcon
                  name={hasBudget ? "check_circle" : "info"}
                  className={`h-[15px] w-[15px] ${hasBudget ? "text-success" : "text-on-surface-variant/55"}`}
                />
                <span className="truncate">
                  {hasBudget ? "Budget masih terkendali" : "Budget belum disiapkan"}
                </span>
              </span>
              <span className="shrink-0 font-mono font-bold">
                {usedPercentage.toFixed(0)}% terpakai
              </span>
            </div>
          )}

          <div className="mt-1 flex min-h-10 items-center justify-between gap-3 px-1 text-[9px] text-on-surface-variant/65">
            <span className="truncate">PM {project.pmName}</span>
            <span className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full bg-accent/8 px-3 text-[10px] font-semibold text-accent group-active:bg-accent/[0.14]">
              Buka project
              <AppIcon name="chevron_right" className="text-[14px]" />
            </span>
          </div>
        </div>
      </Link>

      {isAllowedToCreate && editable ? (
        <button
          type="button"
          onClick={() => onEdit(project)}
          className="absolute top-3.5 right-3.5 flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low/95 text-on-surface-variant shadow-control outline-none after:absolute after:-inset-1 after:rounded-full focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-surface-container"
          aria-label={`Edit ${project.name}`}
        >
          <AppIcon name="more_horiz" className="text-[19px]" />
        </button>
      ) : null}
    </article>
  );
}

function ProjectCover({ project }: { readonly project: ProjectItem }): React.JSX.Element {
  if (project.coverImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={project.coverImageUrl}
        alt={`Cover ${project.name}`}
        className="h-18.5 w-18.5 shrink-0 rounded-[20px] bg-surface-container object-cover ring-1 ring-ring-subtle"
      />
    );
  }

  const initial = project.name.trim().charAt(0).toUpperCase() || "P";
  return (
    <span className="flex h-18.5 w-18.5 shrink-0 items-center justify-center overflow-hidden rounded-[20px] bg-surface-inverse text-white shadow-surface">
      <span className="font-mono text-[28px] leading-none font-black text-white/90">{initial}</span>
    </span>
  );
}

function ProjectMoneyMetric({
  label,
  amount,
  align = "left",
  danger = false,
}: {
  readonly label: string;
  readonly amount: number;
  readonly align?: "left" | "right";
  readonly danger?: boolean;
}): React.JSX.Element {
  return (
    <div
      className={`min-w-0 px-2.5 first:pl-0 last:pr-0 ${align === "right" ? "text-right" : "text-left"}`}
    >
      <p className="truncate text-[9px] font-semibold text-on-surface-variant/60">{label}</p>
      <MoneyValue
        amount={amount}
        variant="compactWithFull"
        size="sm"
        align={align}
        tone={danger ? "danger" : "default"}
        className="mt-1"
      />
    </div>
  );
}

function projectStatusLabel(status: ProjectStatus): string {
  if (status === "ACTIVE") return "Aktif";
  if (status === "ON_HOLD") return "Ditunda";
  if (status === "COMPLETED") return "Selesai";
  if (status === "CANCELLED") return "Dibatalkan";
  return "Draft";
}

function budgetStatusLabel(status: string): string {
  if (status === "TIDAK ADA") return "Belum disiapkan";
  if (status === "PENDING_REVIEW") return "Menunggu review";
  if (status === "APPROVED") return "Disetujui";
  if (status === "DRAFT") return "Draft";
  return formatBusinessLabel(status);
}
