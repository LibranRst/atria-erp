import type { FilterId, ProjectItem } from "./project-list-types";

export const PROJECT_FILTERS: readonly { id: FilterId; label: string }[] = [
  { id: "ALL", label: "Semua" },
  { id: "ACTIVE", label: "Aktif" },
  { id: "DRAFT", label: "Draft" },
  { id: "ON_HOLD", label: "Hold" },
  { id: "COMPLETED", label: "Selesai" },
  { id: "WARNING", label: "Warning" },
  { id: "CRITICAL", label: "Critical" },
];

export function formatRp(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

export function formatCompactRp(value: number): string {
  if (value >= 1_000_000_000)
    return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}jt`;
  return formatRp(value);
}

export function getUsedPercentage(project: ProjectItem): number {
  return Math.max(0, project.usedPercentage);
}

export function matchesFilter(project: ProjectItem, filter: FilterId): boolean {
  if (filter === "ALL") return true;
  return project.status === filter || project.effectiveHealth === filter;
}

export function toFilterId(value: string | null): FilterId {
  return PROJECT_FILTERS.some((filter) => filter.id === value)
    ? value as FilterId
    : "ALL";
}
