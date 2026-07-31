"use client";

import { SlidersHorizontal } from "lucide-react";
import React from "react";

import { BottomSheet } from "@/components/ui/overlay/bottom-sheet";
import { ExclusiveSearchFilterBar } from "@/components/ui/navigation/exclusive-search-filter-bar";
import type { SegmentedTabOption } from "@/components/ui/navigation/segmented-tabs";

export function SettingsFilterBar<TValue extends string>({
  status,
  statusOptions,
  search,
  filterCount,
  searchPlaceholder,
  searchAriaLabel,
  layoutPrefix,
  filterTitle,
  onStatusChange,
  onSearchChange,
  onResetFilters,
  children,
}: {
  readonly status: TValue;
  readonly statusOptions: readonly SegmentedTabOption<TValue>[];
  readonly search: string;
  readonly filterCount: number;
  readonly searchPlaceholder: string;
  readonly searchAriaLabel: string;
  readonly layoutPrefix: string;
  readonly filterTitle: string;
  readonly onStatusChange: (value: TValue) => void;
  readonly onSearchChange: (value: string) => void;
  readonly onResetFilters: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const [mode, setMode] = React.useState<"filter" | "search">("filter");
  const [filterOpen, setFilterOpen] = React.useState(false);

  function changeMode(next: "filter" | "search"): void {
    if (next === "search") onResetFilters();
    if (next === "filter") onSearchChange("");
    setMode(next);
  }

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <ExclusiveSearchFilterBar
            mode={mode}
            filterValue={status}
            filterOptions={statusOptions}
            searchValue={search}
            onFilterChange={onStatusChange}
            onSearchChange={onSearchChange}
            onModeChange={changeMode}
            filterAriaLabel="Filter status data pengaturan"
            searchAriaLabel={searchAriaLabel}
            searchPlaceholder={searchPlaceholder}
            filterLayoutId={`${layoutPrefix}-status`}
            searchLayoutId={`${layoutPrefix}-search`}
            fillAvailableSpace
          />
        </div>
        {mode === "filter" ? (
          <button
            type="button"
            onClick={() => {
              onSearchChange("");
              setFilterOpen(true);
            }}
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/96 text-on-surface shadow-surface ring-1 ring-ring-subtle outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            aria-label={`Buka ${filterTitle.toLowerCase()}`}
          >
            <SlidersHorizontal className="h-4.5 w-4.5" aria-hidden="true" />
            {filterCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary font-mono text-[8px] leading-none font-black text-white">
                {filterCount}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>
      <BottomSheet
        open={filterOpen}
        title={filterTitle}
        onClose={() => setFilterOpen(false)}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onResetFilters}
              className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold text-on-surface"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setFilterOpen(false)}
              className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-white"
            >
              Terapkan filter
            </button>
          </div>
        }
      >
        <div className="space-y-3">{children}</div>
      </BottomSheet>
    </>
  );
}
