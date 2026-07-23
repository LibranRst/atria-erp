"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import React from "react";

import { PageState, StatusBadge } from "@/components/ui";
import {
  ExclusiveSearchFilterBar,
  type SearchFilterMode,
} from "@/components/ui/navigation/exclusive-search-filter-bar";
import { MoneyValue } from "@/components/ui/feedback/page-primitives";
import { WORKSPACE_STICKY_CONTROLS_ENABLED } from "@/lib/presentation/presentation-flags";
import { transitionEaseSmooth, transitionSpringSmooth } from "@/lib/utils/motion";
import { formatIdr, formatShortIdr } from "@/lib/utils/money";
import type { FilterId } from "../../types/project-list-types";
import { PROJECT_FILTERS, type ProjectPortfolioSummary } from "../../utils/project-list-utils";
import { AppIcon } from "@/components/ui/icon/app-icon";

export function ProjectListHeader({
  summary,
}: {
  readonly summary: ProjectPortfolioSummary;
}): React.JSX.Element {
  const hasAttention = summary.attentionCount > 0;

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="text-[28px] leading-8 font-semibold tracking-tight text-on-surface">
          Proyek
        </h1>
        <p className="mt-1 text-xs leading-5 text-on-surface-variant">
          Pantau pekerjaan aktif dan kesehatan budget project.
        </p>
      </header>

      <section
        className="relative isolate overflow-hidden rounded-[26px] bg-white/88 p-4 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 backdrop-blur-xl max-[430px]:rounded-3xl max-[430px]:p-3.5"
        aria-label="Portfolio proyek aktif"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-container-high/65 text-on-surface-variant ring-1 ring-black/[0.035]">
              <AppIcon name="folder_open" className="text-[17px]" />
            </span>
            <p className="truncate text-[10px] font-bold tracking-[0.13em] text-on-surface-variant/60 uppercase">
              Aktif
            </p>
          </div>
          <StatusBadge
            tone={hasAttention ? "warning" : "healthy"}
            label={hasAttention ? `${summary.attentionCount} perlu perhatian` : "Terkendali"}
          />
        </div>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[29px] font-black text-on-surface max-[430px]:text-[27px]">
              {summary.activeCount}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-on-surface-variant">
              proyek sedang berjalan
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[9px] font-semibold text-on-surface-variant/60">
              Nilai kontrak aktif
            </p>
            <MoneyValue
              amount={summary.activeContractValue}
              variant="compactWithFull"
              size="lg"
              align="right"
              className="mt-1"
            />
          </div>
        </div>

        <div className="mt-3.5 grid grid-cols-3 divide-x divide-black/5.5 rounded-[18px] bg-surface-container-low/65 px-3 py-2.5">
          <ProjectPortfolioMetric label="Budget" amount={summary.activeInternalBudget} />
          <ProjectPortfolioMetric label="Aktual" amount={summary.activeActualCost} align="center" />
          <ProjectPortfolioMetric
            label="Sisa budget"
            amount={summary.activeRemainingBudget}
            align="right"
            danger={summary.activeRemainingBudget < 0}
          />
        </div>
      </section>
    </div>
  );
}

function ProjectPortfolioMetric({
  label,
  amount,
  align = "left",
  danger = false,
}: {
  readonly label: string;
  readonly amount: number;
  readonly align?: "left" | "center" | "right";
  readonly danger?: boolean;
}): React.JSX.Element {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <div className={`min-w-0 px-2 first:pl-0 last:pr-0 ${alignClass}`}>
      <p className="truncate text-[9px] font-semibold text-on-surface-variant/60">{label}</p>
      <p
        className={`mt-1 truncate font-mono text-[10px] font-black tabular-nums max-[430px]:text-[9px] ${danger ? "text-error" : "text-on-surface"}`}
        title={formatIdr(amount)}
        aria-label={formatIdr(amount)}
      >
        {formatPortfolioMetric(amount)}
      </p>
    </div>
  );
}

function formatPortfolioMetric(amount: number): string {
  if (Math.abs(amount) >= 100_000_000 && Math.abs(amount) < 1_000_000_000) {
    return `Rp ${Math.round(amount / 1_000_000).toLocaleString("id-ID")} jt`;
  }
  return formatShortIdr(amount);
}


export function ProjectSearchAndFilters(props: any): React.JSX.Element {
  return <div className="space-y-2">{props.children}</div>;
}

export function ProjectListEmptyState(props: any): React.JSX.Element {
  return <div className="p-4 text-center text-xs text-on-surface-variant">Tidak ada project</div>;
}
