"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import React from "react";

import {
  ExclusiveSearchFilterBar,
  MoneyValue,
  PageState,
  type SearchFilterMode,
  SectionHeader,
  SummaryFact,
  SummarySurface,
} from "@/components/ui";
import { WORKSPACE_STICKY_CONTROLS_ENABLED } from "@atria/core/presentation/presentation-flags";
import { transitionEaseSmooth, transitionSpringSmooth } from "@/lib/utils/motion";
import { formatTightIdr } from "@atria/core/utils/money";
import type { FilterId } from "../../types/project-list-types";
import { PROJECT_FILTERS, type ProjectPortfolioSummary } from "../../utils/project-list-utils";
export function ProjectListHeader({
  summary,
}: {
  readonly summary: ProjectPortfolioSummary;
}): React.JSX.Element {
  const hasAttention = summary.attentionCount > 0;

  return (
    <div className="space-y-sm">
      <header className="px-1">
        <h1 className="text-[28px] leading-8 font-semibold tracking-tight text-on-surface">
          Proyek
        </h1>
        <p className="mt-1 text-xs leading-5 text-on-surface-variant">
          Pantau pekerjaan aktif dan kesehatan budget project.
        </p>
      </header>

      <SummarySurface
        ariaLabel="Portfolio proyek aktif"
        eyebrow="Proyek aktif"
        icon="folder_open"
        status={hasAttention ? `${summary.attentionCount} perlu perhatian` : "Terkendali"}
        statusTone={hasAttention ? "warning" : "positive"}
      >
        <div className="flex flex-row items-end justify-between px-3.5 pt-3.5 pb-2">
          <div className="min-w-0">
            <p className="font-mono text-[36px] leading-none font-black text-on-surface max-[430px]:text-[32px]">
              {summary.activeCount}
            </p>
            <p className="text-meta font-semibold text-on-surface-variant">
              proyek sedang berjalan
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-eyebrow font-semibold text-on-surface-variant/60">
              Nilai kontrak aktif
            </p>
            <MoneyValue
              amount={summary.activeContractValue}
              variant="compact"
              size="lg"
              align="right"
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 px-2 pt-2 pb-2">
          <SummaryFact label="Budget" value={formatTightIdr(summary.activeInternalBudget)} />
          <SummaryFact label="Aktual" value={formatTightIdr(summary.activeActualCost)} />
          <SummaryFact
            label="Sisa budget"
            value={formatTightIdr(summary.activeRemainingBudget)}
            tone={summary.activeRemainingBudget < 0 ? "danger" : "default"}
          />
        </div>
      </SummarySurface>
    </div>
  );
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
  readonly filterCounts: Partial<Record<FilterId, number>>;
  readonly mode: SearchFilterMode;
  readonly searchQuery: string;
  readonly onFilterChange: (filter: FilterId) => void;
  readonly onModeChange: (mode: SearchFilterMode) => void;
  readonly onSearchChange: (query: string) => void;
}): React.JSX.Element {
  const stickyControlRef = React.useRef<HTMLDivElement | null>(null);
  const [stickyActive, setStickyActive] = React.useState(false);
  const surfaceTransition = useReducedMotion() ? { duration: 0 } : transitionEaseSmooth;
  const stickyTransition = useReducedMotion() ? { duration: 0 } : transitionSpringSmooth;

  React.useEffect(() => {
    if (!WORKSPACE_STICKY_CONTROLS_ENABLED) return;
    const element = stickyControlRef.current;
    if (!element) return;

    function updateStickyState(): void {
      const rect = element?.getBoundingClientRect();
      if (!rect) return;
      setStickyActive(rect.top <= 64.5);
    }

    updateStickyState();
    window.addEventListener("scroll", updateStickyState, { passive: true });
    window.addEventListener("resize", updateStickyState, { passive: true });

    return () => {
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
            className="pointer-events-none absolute inset-0 rounded-3xl bg-white/96 ring-1 ring-ring-subtle backdrop-blur-xl"
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

export function ProjectListSectionHeader({ count }: { readonly count: number }): React.JSX.Element {
  return (
    <SectionHeader
      id="project-list-title"
      title="Daftar proyek"
      count={count}
      countLabel="Proyek"
    />
  );
}
