"use client";

import React from "react";

import { PageState, SearchInput } from "@/components/ui";
import type { FilterId } from "./project-list-types";
import { PROJECT_FILTERS } from "./project-list-utils";

export function ProjectListHeader({
  activeCount,
  warningCount,
}: {
  readonly activeCount: number;
  readonly warningCount: number;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 px-1">
      <div className="min-w-0">
        <h1 className="text-[28px] font-semibold leading-8 tracking-tight text-on-surface">
          Proyek
        </h1>
        <p className="mt-1 text-xs text-on-surface-variant">
          {activeCount} aktif, {warningCount} perlu perhatian
        </p>
      </div>
    </div>
  );
}

export function ProjectSearchAndFilters({
  activeFilter,
  searchQuery,
  onFilterChange,
  onSearchChange,
}: {
  readonly activeFilter: FilterId;
  readonly searchQuery: string;
  readonly onFilterChange: (filter: FilterId) => void;
  readonly onSearchChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <div className="sticky top-16 z-20 rounded-[28px] border border-outline-variant/20 bg-white/95 p-sm shadow-[0_14px_34px_rgba(17,17,17,0.055)] backdrop-blur-md">
      <SearchInput
        value={searchQuery}
        onChange={onSearchChange}
        placeholder="Cari proyek, klien, lokasi"
        ariaLabel="Cari proyek"
      />

      <div className="mt-2 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
        {PROJECT_FILTERS.map((filter) => {
          const isActive = activeFilter === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => onFilterChange(filter.id)}
              className={`mt-1 h-9 shrink-0 rounded-full px-4 text-[11px] font-bold transition active:scale-95 ${
                isActive
                  ? "bg-primary text-on-primary shadow-sm"
                  : "bg-surface-container text-on-surface-variant ring-1 ring-outline-variant/35"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProjectListEmptyState({
  onReset,
}: {
  readonly onReset: () => void;
}): React.JSX.Element {
  return (
    <PageState
      kind="filtered-empty"
      title="Tidak ada proyek"
      description="Tidak ada proyek yang cocok dengan pencarian atau filter saat ini."
      actionLabel="Reset Filter"
      onAction={onReset}
    />
  );
}
