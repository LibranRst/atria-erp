"use client";

import React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import { AppIcon, BudgetSplitIndicator, MoneyValue, StatusBadge } from "@/components/ui";
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

  if (compact) {
    return (
      <motion.div
        whileTap={reduceMotion ? undefined : dashboardRowPressScale}
        transition={transitionSpringSnappy}
      >
        <Link
          href={`/projects/${project.projectId}?tab=overview`}
          className="block rounded-[22px] px-3.5 py-3 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-black/2.5 max-[430px]:px-3"
        >
          <div className="flex items-start gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${overBudget ? "bg-error/7.5 text-error ring-error/5" : "bg-warning/9 text-warning ring-warning/6"}`}
            >
              <AppIcon name="monitoring" className="text-[18px]" />
            </span>
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
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high/70 text-accent"
                aria-hidden="true"
              >
                <AppIcon name="chevron_right" className="text-[16px]" />
              </span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="flex min-w-0 flex-col gap-1 rounded-2xl bg-surface-container-low/70 p-3 pr-3">
              <p className="text-[8px] leading-none font-semibold tracking-[0.08em] text-on-surface-variant/55 uppercase">
                Aktual
              </p>
              <MoneyValue
                amount={project.actualCost}
                variant="compactWithFull"
                size="sm"
                className="mt-1"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1 rounded-2xl bg-surface-container-low/70 p-3 pl-3 text-right">
              <p className="text-[8px] leading-none font-semibold tracking-[0.08em] text-on-surface-variant/55 uppercase">
                Internal budget
              </p>
              <MoneyValue
                amount={project.internalBudget}
                variant="compactWithFull"
                size="sm"
                align="right"
                className="mt-1"
              />
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-3 rounded-2xl bg-surface-container-low/70 p-3 text-[10px] font-semibold">
            <span className="leading-4 text-on-surface-variant">
              Terpakai {project.usedPercentage.toFixed(0)}%
            </span>
            <span className={cn("leading-4", overBudget ? "text-error" : "text-on-surface")}>
              {overBudget ? "Melebihi" : "Sisa"} {shortMoney(Math.abs(project.remainingBudget))}
            </span>
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileTap={reduceMotion ? undefined : dashboardRowPressScale}
      transition={transitionSpringSnappy}
      className="px-2.5 py-1.5"
    >
      <Link
        href={`/projects/${project.projectId}?tab=overview`}
        className="block rounded-[20px] px-2 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-black/2.5"
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${overBudget ? "bg-error/7.5 text-error ring-error/5" : "bg-warning/9 text-warning ring-warning/6"}`}
          >
            <AppIcon name="monitoring" className="text-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-row font-semibold tracking-[-0.01em] text-on-surface">
                {project.projectName}
              </p>
              <span
                className={`shrink-0 text-[9px] leading-4 font-semibold ${overBudget ? "text-error" : "text-warning"}`}
              >
                {projectHealthLabel(project.effectiveHealth)}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-meta text-on-surface-variant/75">
              {project.riskReason}
            </p>
          </div>
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high/70 text-accent"
            aria-hidden="true"
          >
            <AppIcon name="chevron_right" className="text-[16px]" />
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold text-on-surface-variant">
            Budget terpakai {project.usedPercentage.toFixed(0)}%
          </span>
          <MoneyValue
            amount={project.remainingBudget}
            variant="compactWithFull"
            tone={project.remainingBudget < 0 ? "danger" : "default"}
            align="right"
            size="sm"
            className="shrink-0"
          />
        </div>
        <BudgetSplitIndicator
          value={project.usedPercentage}
          danger={overBudget}
          tone={project.effectiveHealth === "CRITICAL" ? "critical" : "warning"}
        />
        <div className="mt-3 grid grid-cols-2 gap-3 text-[10px] font-semibold text-on-surface-variant">
          <span>
            Aktual
            <MoneyValue
              amount={project.actualCost}
              variant="compactWithFull"
              size="sm"
              className="mt-0.5"
            />
          </span>
          <span className="text-right">
            Internal budget
            <MoneyValue
              amount={project.internalBudget}
              variant="compactWithFull"
              size="sm"
              align="right"
              className="mt-0.5"
            />
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-outline-variant/35 pt-2 text-[10px] font-semibold text-on-surface-variant">
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
          <div className="mt-2 flex flex-wrap gap-1.5">
            {project.riskyCategories.map((category) => (
              <StatusBadge
                key={category.code}
                tone="warning"
                label={`${category.name} ${category.usedPercentage.toFixed(0)}%`}
              />
            ))}
          </div>
        ) : null}
      </Link>
    </motion.div>
  );
}
