import type { ProjectItem, ProjectStatus } from "@atria/core/types/projects";

export type PortfolioView = "all" | "active" | "setup" | "attention" | "closed";
export type PortfolioHealth = "ALL" | "HEALTHY" | "WARNING" | "CRITICAL" | "MISSING";
export type PortfolioStatus = "ALL" | ProjectStatus;
export type PortfolioFilters = {
  readonly view: PortfolioView;
  readonly search: string;
  readonly client: string;
  readonly pm: string;
  readonly status: PortfolioStatus;
  readonly health: PortfolioHealth;
};

/** New reads are explicit; older compatible DTOs retain their existing absence marker. */
export function projectHasBudget(project: ProjectItem): boolean {
  return project.budgetId !== undefined
    ? project.budgetId !== null
    : Boolean(project.budgetStatus && project.budgetStatus !== "TIDAK ADA");
}
export function projectIsOperational(project: ProjectItem): boolean {
  return project.status !== "COMPLETED" && project.status !== "CANCELLED";
}
export function matchesPortfolioView(project: ProjectItem, view: PortfolioView): boolean {
  if (view === "active") return project.status === "ACTIVE";
  if (view === "closed") return !projectIsOperational(project);
  if (view === "setup")
    return (
      projectIsOperational(project) &&
      (project.status === "DRAFT" ||
        !projectHasBudget(project) ||
        project.budgetStatus === "DRAFT" ||
        project.budgetStatus === "PENDING_REVIEW")
    );
  if (view === "attention")
    return (
      projectIsOperational(project) &&
      projectHasBudget(project) &&
      project.effectiveHealth !== "HEALTHY"
    );
  return true;
}
export function filterProjectPortfolio(
  projects: readonly ProjectItem[],
  filters: PortfolioFilters,
): readonly ProjectItem[] {
  const search = filters.search.trim().toLocaleLowerCase("id-ID");
  return projects.filter(
    (project) =>
      matchesPortfolioView(project, filters.view) &&
      [
        project.name,
        project.clientName,
        project.pmName,
        project.location ?? "",
        project.projectType ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("id-ID")
        .includes(search) &&
      (filters.client === "ALL" || project.clientId === filters.client) &&
      (filters.pm === "ALL" ||
        (filters.pm === "UNASSIGNED"
          ? !project.projectManagerId
          : project.projectManagerId === filters.pm)) &&
      (filters.status === "ALL" || project.status === filters.status) &&
      (filters.health === "ALL" ||
        (filters.health === "MISSING"
          ? !projectHasBudget(project)
          : projectHasBudget(project) && project.effectiveHealth === filters.health)),
  );
}
