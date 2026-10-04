"use client";

import React, { useMemo, useState } from "react";
import { ProjectDrawer } from "../drawers/project-drawer";
import {
  DesktopTable,
  MoneyValue,
  StatusBadge,
  Button,
  ButtonLink,
  type SearchFilterMode,
} from "@/components/ui";
import {
  useWorkspacePresentation,
  useWorkspaceHref,
} from "@/lib/navigation/workspace-presentation";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { updateUrlSearchParam, useUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { usePreservedScrollHeight } from "@/lib/hooks/use-preserved-scroll-height";
import { ProjectListCard } from "../cards/project-list-card";
import {
  ProjectListEmptyState,
  ProjectListHeader,
  ProjectListSectionHeader,
  ProjectSearchAndFilters,
} from "./project-list-header";

import type { ClientData, FilterId, ProjectItem, UserData } from "../../types/project-list-types";
import {
  matchesFilter,
  summarizeProjectPortfolio,
  toFilterId,
} from "../../utils/project-list-utils";

interface ProjectListClientProps {
  readonly projects: readonly ProjectItem[];
  readonly clients: readonly ClientData[];
  readonly users: readonly UserData[];
  readonly isAllowedToCreate: boolean;
}

export function ProjectListClient({
  projects,
  clients,
  users,
  isAllowedToCreate,
}: ProjectListClientProps): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const workspaceHref = useWorkspaceHref();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [controlMode, setControlMode] = useState<SearchFilterMode>("filter");
  const activeFilter = toFilterId(useUrlSearchParam("filter"));
  const {
    containerRef: resultsRef,
    containerStyle: resultsStyle,
    preserveScrollPosition,
  } = usePreservedScrollHeight(activeFilter);
  const clearQueryParam = React.useCallback((key: string): void => {
    updateUrlSearchParam(key, null, "replace");
  }, []);

  const closeProjectDrawer = React.useCallback((): void => {
    setIsDrawerOpen(false);
    clearQueryParam("new-project");
  }, [clearQueryParam]);

  const selectFilter = React.useCallback((filter: FilterId): void => {
    updateUrlSearchParam("filter", filter === "ALL" ? null : filter, "replace");
  }, []);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesSearch =
        normalizedQuery.length === 0 ||
        project.name.toLowerCase().includes(normalizedQuery) ||
        project.clientName.toLowerCase().includes(normalizedQuery) ||
        (project.location ?? "").toLowerCase().includes(normalizedQuery);

      return controlMode === "search" ? matchesSearch : matchesFilter(project, activeFilter);
    });
  }, [activeFilter, controlMode, projects, searchQuery]);

  const summary = useMemo(() => summarizeProjectPortfolio(projects), [projects]);
  const filterCounts = useMemo<Partial<Record<FilterId, number>>>(
    () => ({
      ALL: projects.length,
      ACTIVE: projects.filter((project) => project.status === "ACTIVE").length,
      DRAFT: projects.filter((project) => project.status === "DRAFT").length,
      ON_HOLD: projects.filter((project) => project.status === "ON_HOLD").length,
      COMPLETED: projects.filter((project) => project.status === "COMPLETED").length,
      WARNING: projects.filter((project) => project.effectiveHealth === "WARNING").length,
      CRITICAL: projects.filter((project) => project.effectiveHealth === "CRITICAL").length,
    }),
    [projects],
  );

  function changeFilter(filter: FilterId): void {
    if (filter === activeFilter) return;
    preserveScrollPosition();
    selectFilter(filter);
  }

  function changeControlMode(mode: SearchFilterMode): void {
    setSearchQuery("");
    setControlMode(mode);
    if (mode === "search" && activeFilter !== "ALL") {
      preserveScrollPosition();
      selectFilter("ALL");
    }
  }

  return (
    <div className="space-y-sm pb-10 max-[430px]:pb-8">
      <ProjectListHeader summary={summary} />
      <ProjectSearchAndFilters
        activeFilter={activeFilter}
        filterCounts={filterCounts}
        mode={controlMode}
        searchQuery={searchQuery}
        onFilterChange={changeFilter}
        onModeChange={changeControlMode}
        onSearchChange={setSearchQuery}
      />

      <div ref={resultsRef} style={resultsStyle}>
        {filteredProjects.length === 0 ? (
          <ProjectListEmptyState
            mode={controlMode}
            onReset={() => {
              setSearchQuery("");
              if (controlMode === "search") {
                setControlMode("filter");
              } else {
                changeFilter("ALL");
              }
            }}
          />
        ) : (
          <section aria-labelledby="project-list-title">
            <ProjectListSectionHeader count={filteredProjects.length} />
            {desktop ? (
              <DesktopTable
                ariaLabel="Perbandingan budget proyek"
                rows={filteredProjects}
                rowKey={(project) => project.id}
                rowHref={(project) => workspaceHref(`/projects/${project.id}`)}
                columns={[
                  {
                    key: "project",
                    sortValue: (project) => project.name,
                    label: "Proyek",
                    render: (project) => (
                      <div>
                        <p className="font-semibold">{project.name}</p>
                        <p className="text-meta text-on-surface-variant">
                          {project.clientName} · {project.pmName}
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: "value",
                    sortValue: (project) => project.totalContractValue,
                    label: "Nilai proyek",
                    align: "end",
                    render: (project) => (
                      <MoneyValue amount={project.totalContractValue} variant="compact" size="sm" />
                    ),
                  },
                  {
                    key: "budget",
                    sortValue: (project) => project.internalBudget,
                    label: "Budget",
                    align: "end",
                    render: (project) => (
                      <MoneyValue amount={project.internalBudget} variant="compact" size="sm" />
                    ),
                  },
                  {
                    key: "actual",
                    sortValue: (project) => project.actualCost,
                    label: "Terpakai",
                    align: "end",
                    render: (project) => (
                      <MoneyValue amount={project.actualCost} variant="compact" size="sm" />
                    ),
                  },
                  {
                    key: "remaining",
                    sortValue: (project) => project.remainingBudget,
                    label: "Sisa budget",
                    align: "end",
                    render: (project) => (
                      <MoneyValue
                        amount={project.remainingBudget}
                        variant="compact"
                        size="sm"
                        tone={project.remainingBudget < 0 ? "danger" : "default"}
                      />
                    ),
                  },
                  {
                    key: "health",
                    label: "Kondisi",
                    render: (project) => (
                      <div className="space-y-1">
                        <StatusBadge
                          tone={
                            project.effectiveHealth === "CRITICAL"
                              ? "critical"
                              : project.effectiveHealth === "WARNING"
                                ? "warning"
                                : "healthy"
                          }
                          label={
                            project.effectiveHealth === "CRITICAL"
                              ? "Kritis"
                              : project.effectiveHealth === "WARNING"
                                ? "Perhatian"
                                : "Terkendali"
                          }
                        />
                        <p className="text-meta text-on-surface-variant">
                          {formatBusinessLabel(project.status)} ·{" "}
                          {project.usedPercentage.toFixed(1)}%
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: "action",
                    label: "Tindakan",
                    render: (project) => (
                      <div className="flex gap-2">
                        <ButtonLink
                          href={workspaceHref(`/projects/${project.id}`)}
                          variant="secondary"
                        >
                          Buka
                        </ButtonLink>
                        {isAllowedToCreate ? (
                          <Button
                            variant="tertiary"
                            onClick={() => {
                              setEditingProject(project);
                              setIsDrawerOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                        ) : null}
                      </div>
                    ),
                  },
                ]}
              />
            ) : (
              <div className="mt-2.5 space-y-3">
                {filteredProjects.map((project) => (
                  <ProjectListCard
                    key={project.id}
                    project={project}
                    isAllowedToCreate={isAllowedToCreate}
                    onEdit={(selectedProject) => {
                      setEditingProject(selectedProject);
                      setIsDrawerOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {editingProject ? (
        <ProjectDrawer
          key={editingProject.id}
          isOpen={isDrawerOpen}
          onClose={closeProjectDrawer}
          clients={clients}
          users={users}
          editProject={editingProject}
        />
      ) : null}
    </div>
  );
}
