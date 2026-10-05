"use client";

import React from "react";
import Link from "@/lib/navigation/workspace-link";
import { motion, useReducedMotion } from "framer-motion";

import { AppIcon, DuotoneIconTile, MoneyValue, StatusBadge } from "@/components/ui";
import type { DashboardRiskyProject } from "@/features/finance-dashboard/types/dashboard-types";
import { shortMoney } from "@/features/finance-dashboard/utils/dashboard-formatters";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { cn } from "@/lib/utils/cn";
const dashboardRowPressScale = { scale: 0.985 } as const;

function projectHealthLabel(health: DashboardRiskyProject["effectiveHealth"]): string {
  if (health === "CRITICAL") return "Kritis";
  if (health === "WARNING") return "Perhatian";
  return "Terkendali";
}

export function ProjectRiskRow({
  project,
  compact = false,
}: {
  readonly project: DashboardRiskyProject;
  readonly compact?: boolean;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const overBudget = project.remainingBudget < 0;

  return (
    <motion.div
      tabIndex={-1}
      whileTap={reduceMotion ? undefined : dashboardRowPressScale}
      transition={transitionSpringSnappy}
    >
      <Link
        href={`/projects/${project.projectId}?tab=overview`}
        className="block rounded-owner px-3.5 py-3 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-black/2.5 max-[430px]:px-3"
      >
        <div className="flex items-start gap-3">
          <DuotoneIconTile
            name="monitoring"
            tone={overBudget ? "critical" : "attention"}
            className="h-9 w-9"
            iconClassName="icon-md"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-row font-semibold tracking-[-0.01em] text-on-surface">
              {project.projectName}
            </p>
            <p className="mt-0.5 truncate text-meta text-on-surface-variant/75">
              {project.riskReason}
            </p>
          </div>
          <div className="flex flex-row items-center gap-2">
            <span
              className={`shrink-0 text-[9px] leading-4 font-semibold ${overBudget ? "text-error" : "text-warning"}`}
            >
              {projectHealthLabel(project.effectiveHealth)}
            </span>
            <AppIcon name="chevron_right" className="icon-sm text-on-surface-variant/55" />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="flex min-w-0 flex-col gap-1 rounded-inset bg-surface-container-low p-3 pr-3">
            <p className="text-[8px] leading-none font-semibold tracking-[0.08em] text-on-surface-variant/55 uppercase">
              Aktual
            </p>
            <MoneyValue
              amount={project.actualCost}
              variant="fullDynamic"
              size="md"
              className="mt-1"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1 rounded-inset bg-surface-container-low p-3 pl-3 text-right">
            <p className="text-[8px] leading-none font-semibold tracking-[0.08em] text-on-surface-variant/55 uppercase">
              Internal budget
            </p>
            <MoneyValue
              amount={project.internalBudget}
              variant="fullDynamic"
              size="md"
              align="right"
              className="mt-1"
            />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 rounded-inset bg-surface-container-low p-3 text-[10px] font-semibold">
          <span className="leading-4 text-on-surface-variant">
            Terpakai {project.usedPercentage.toFixed(0)}%
          </span>
          <span className={cn("leading-4", overBudget ? "text-error" : "text-on-surface")}>
            {overBudget ? "Melebihi" : "Sisa"} {shortMoney(Math.abs(project.remainingBudget))}
          </span>
        </div>

        {!compact && (
          <>
            <div className="mt-2.5 flex items-center justify-between px-1 text-meta font-semibold text-on-surface-variant">
              <span>Margin target {project.targetMarginPercentage.toFixed(1)}%</span>
              <span
                className={
                  project.projectedMarginPercentage < project.targetMarginPercentage
                    ? "text-error"
                    : "text-on-surface"
                }
              >
                Proyeksi {project.projectedMarginPercentage.toFixed(1)}%
              </span>
            </div>
            {project.riskyCategories.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5 px-0.5">
                {project.riskyCategories.map((category) => (
                  <StatusBadge
                    key={category.code}
                    tone="warning"
                    label={`${category.name} ${category.usedPercentage.toFixed(0)}%`}
                  />
                ))}
              </div>
            ) : null}
          </>
        )}
      </Link>
    </motion.div>
  );
}
