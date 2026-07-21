"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import React from "react";

import { PageState } from "@/components/ui";
import {
  ExclusiveSearchFilterBar,
  type SearchFilterMode,
} from "@/components/ui/exclusive-search-filter-bar";
import { MoneyValue } from "@/components/ui/page-primitives";
import { WORKSPACE_STICKY_CONTROLS_ENABLED } from "@/lib/ui/presentation-flags";
import { transitionEaseSmooth, transitionSpringSmooth } from "@/lib/utils/motion";
import { formatIdr, formatShortIdr } from "@/lib/utils/money";
import type { FilterId } from "./project-list-types";
import { PROJECT_FILTERS, type ProjectPortfolioSummary } from "./project-list-utils";

export function ProjectListHeader({
  summary,
}: {
  readonly summary: ProjectPortfolioSummary;
}): React.JSX.Element {
  const hasAttention = summary.attentionCount > 0;

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="text-on-surface text-[28px] leading-8 font-semibold tracking-tight">
          Proyek
        </h1>
        <p className="text-on-surface-variant mt-1 text-xs leading-5">
          Pantau pekerjaan aktif dan kesehatan budget project.
        </p>
      </header>

      <section
        className="relative isolate overflow-hidden rounded-[26px] bg-white/88 p-4 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 backdrop-blur-xl max-[430px]:rounded-[24px] max-[430px]:p-3.5"
        aria-label="Portfolio proyek aktif"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="bg-surface-container-high/65 text-on-surface-variant flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] ring-1 ring-black/[0.035]">
              <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                folder_open
              </span>
            </span>
            <p className="text-on-surface-variant/60 truncate text-[10px] font-bold tracking-[0.13em] uppercase">
              Aktif
            </p>
          </div>
          <span
            className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[9px] font-semibold ring-1 ${hasAttention ? "bg-warning/9 text-warning ring-warning/8" : "bg-success/8 text-success ring-success/8"}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {hasAttention ? `${summary.attentionCount} perlu perhatian` : "Terkendali"}
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-on-surface font-mono text-[29px] font-black max-[430px]:text-[27px]">
              {summary.activeCount}
            </p>
            <p className="text-on-surface-variant mt-1 text-[10px] font-semibold">
              proyek sedang berjalan
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-on-surface-variant/60 text-[9px] font-semibold">
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

        <div className="bg-surface-container-low/65 mt-3.5 grid grid-cols-3 divide-x divide-black/5.5 rounded-[18px] px-3 py-2.5">
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
      <p className="text-on-surface-variant/60 truncate text-[9px] font-semibold">{label}</p>
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

export function ProjectSearchAndFilters({
  activeFilter,
  filterCounts,
  mode,
  searchQuery,
  onFilterChange,
  onModeChange,
  onSearchChange,
}: {
  readonly activeFilter: FilterId;
  readonly filterCounts: Readonly<Partial<Record<FilterId, number>>>;
  readonly mode: SearchFilterMode;
  readonly searchQuery: string;
  readonly onFilterChange: (filter: FilterId) => void;
  readonly onModeChange: (mode: SearchFilterMode) => void;
  readonly onSearchChange: (value: string) => void;
}): React.JSX.Element {
  const stickyControlRef = React.useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = React.useState(false);
  const stickyActive = WORKSPACE_STICKY_CONTROLS_ENABLED && isSticky;
  const shouldReduceMotion = useReducedMotion();
  const stickyTransition = shouldReduceMotion ? { duration: 0 } : transitionSpringSmooth;
  const surfaceTransition = shouldReduceMotion ? { duration: 0 } : transitionEaseSmooth;

  React.useEffect(() => {
    if (!WORKSPACE_STICKY_CONTROLS_ENABLED) return;

    const stickyControl = stickyControlRef.current;
    if (!stickyControl) return;
    let frameId: number | null = null;

    const updateStickyState = (): void => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        const nextSticky = window.scrollY > 0 && stickyControl.getBoundingClientRect().top <= 64.5;
        setIsSticky((current) => (current === nextSticky ? current : nextSticky));
      });
    };

    updateStickyState();
    window.addEventListener("scroll", updateStickyState, { passive: true });
    window.addEventListener("resize", updateStickyState);
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", updateStickyState);
      window.removeEventListener("resize", updateStickyState);
    };
  }, []);

  const handleSearchChange = React.useCallback(
    (value: string): void => {
      const isStartingSearch = searchQuery.length === 0 && value.length > 0;
      onSearchChange(value);
      if (isStartingSearch && window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    },
    [onSearchChange, searchQuery],
  );

  return (
    <motion.div
      ref={stickyControlRef}
      data-sticky={stickyActive ? "true" : "false"}
      data-density={stickyActive ? "floating" : "inline"}
      animate={{
        marginLeft: stickyActive ? -8 : 0,
        marginRight: stickyActive ? -8 : 0,
        padding: stickyActive ? 8 : 0,
      }}
      transition={stickyTransition}
      className={WORKSPACE_STICKY_CONTROLS_ENABLED ? "sticky top-16 z-20" : "relative"}
    >
      <AnimatePresence initial={false}>
        {stickyActive ? (
          <motion.div
            key="sticky-search-surface"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={surfaceTransition}
            className="pointer-events-none absolute inset-0 rounded-[24px] bg-white/96 shadow-[0_1px_2px_rgba(17,17,17,0.03),0_12px_30px_rgba(17,17,17,0.08)] ring-1 ring-black/[0.035] backdrop-blur-xl"
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>
      <div className="relative">
        <ExclusiveSearchFilterBar
          mode={mode}
          filterValue={activeFilter}
          onFilterChange={onFilterChange}
          filterAriaLabel="Filter proyek"
          filterLayoutId="project-list-filter"
          searchLayoutId="project-list-search-control"
          searchValue={searchQuery}
          onSearchChange={handleSearchChange}
          onModeChange={onModeChange}
          searchPlaceholder="Cari proyek, klien, lokasi"
          searchAriaLabel="Cari proyek"
          filterOptions={PROJECT_FILTERS.map((filter) => ({
            value: filter.id,
            label: filter.label,
            count:
              (filter.id === "WARNING" || filter.id === "CRITICAL") &&
              (filterCounts[filter.id] ?? 0) > 0
                ? filterCounts[filter.id]
                : undefined,
          }))}
        />
      </div>
    </motion.div>
  );
}

export function ProjectListEmptyState({
  mode,
  onReset,
}: {
  readonly mode: SearchFilterMode;
  readonly onReset: () => void;
}): React.JSX.Element {
  return (
    <PageState
      kind="filtered-empty"
      title="Proyek tidak ditemukan"
      description={
        mode === "search"
          ? "Coba kata kunci lain atau tutup pencarian."
          : "Pilih filter lain untuk melihat proyek."
      }
      actionLabel={mode === "search" ? "Tutup pencarian" : "Reset filter"}
      onAction={onReset}
    />
  );
}
