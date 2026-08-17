import type { FilterId, ProjectItem } from "../types/project-list-types";

export const PROJECT_FILTERS: readonly { id: FilterId; label: string }[] = [
  { id: "ALL", label: "Semua" },
  { id: "ACTIVE", label: "Aktif" },
  { id: "DRAFT", label: "Draft" },
  { id: "ON_HOLD", label: "Ditunda" },
  { id: "COMPLETED", label: "Selesai" },
  { id: "WARNING", label: "Perhatian" },
  { id: "CRITICAL", label: "Kritis" },
];

export type ProjectPortfolioSummary = {
  readonly activeCount: number;
  readonly attentionCount: number;
  readonly activeContractValue: number;
  readonly activeInternalBudget: number;
  readonly activeActualCost: number;
  readonly activeRemainingBudget: number;
};

export function summarizeProjectPortfolio(
  projects: readonly ProjectItem[],
): ProjectPortfolioSummary {
  const activeProjects = projects.filter((project) => project.status === "ACTIVE");
  const operationalProjects = projects.filter(
    (project) => project.status !== "COMPLETED" && project.status !== "CANCELLED",
  );

  return {
    activeCount: activeProjects.length,
    attentionCount: operationalProjects.filter((project) => project.effectiveHealth !== "HEALTHY")
      .length,
    activeContractValue: activeProjects.reduce(
      (sum, project) => sum + project.totalContractValue,
      0,
    ),
    activeInternalBudget: activeProjects.reduce((sum, project) => sum + project.internalBudget, 0),
    activeActualCost: activeProjects.reduce((sum, project) => sum + project.actualCost, 0),
    activeRemainingBudget: activeProjects.reduce(
      (sum, project) => sum + project.remainingBudget,
      0,
    ),
  };
}

export function getUsedPercentage(project: ProjectItem): number {
  return Math.max(0, project.usedPercentage);
}

export function matchesFilter(project: ProjectItem, filter: FilterId): boolean {
  if (filter === "ALL") return true;
  return project.status === filter || project.effectiveHealth === filter;
}

export function toFilterId(value: string | null): FilterId {
  return PROJECT_FILTERS.some((filter) => filter.id === value) ? (value as FilterId) : "ALL";
}
