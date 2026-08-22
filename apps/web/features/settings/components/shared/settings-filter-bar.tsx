"use client";

import React from "react";

import {
  AnchoredFilterPanel,
  AppIcon,
  ExclusiveSearchFilterBar,
  type SegmentedTabOption,
} from "@/components/ui";
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
  onClearFilters,
  onOpenFilters,
  onApplyFilters,
  onResetFilterDraft,
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
  readonly onClearFilters: () => void;
  readonly onOpenFilters: () => void;
  readonly onApplyFilters: () => void;
  readonly onResetFilterDraft: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const [mode, setMode] = React.useState<"filter" | "search">("filter");
  const [filterOpen, setFilterOpen] = React.useState(false);

  function changeMode(next: "filter" | "search"): void {
    if (next === "search") onClearFilters();
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
          <AnchoredFilterPanel
            open={filterOpen}
            title={filterTitle}
            trigger={
              <button
                type="button"
                className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/96 text-on-surface shadow-surface ring-1 ring-ring-subtle outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                aria-label={`Buka ${filterTitle.toLocaleLowerCase("id-ID")}`}
              >
                <AppIcon name="tune" className="icon-md" aria-hidden="true" />
                {filterCount > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary font-mono text-[8px] leading-none font-black text-white">
                    {filterCount}
                  </span>
                ) : null}
              </button>
            }
            onOpenChange={(nextOpen) => {
              if (nextOpen) {
                onSearchChange("");
                onOpenFilters();
              }
              setFilterOpen(nextOpen);
            }}
            onDismiss={onOpenFilters}
            actions={
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onResetFilterDraft}
                  className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold text-on-surface"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onApplyFilters();
                    setFilterOpen(false);
                  }}
                  className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-white"
                >
                  Terapkan filter
                </button>
              </div>
            }
          >
            {children}
          </AnchoredFilterPanel>
        ) : null}
      </div>
    </>
  );
}
