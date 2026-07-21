"use client";

import React, { useMemo, useState } from "react";
import { ProjectDrawer } from "./project-drawer";
import type { SearchFilterMode } from "@/components/ui/exclusive-search-filter-bar";
import { updateUrlSearchParam, useUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { ProjectListCard } from "./project-list-card";
import {
  ProjectListEmptyState,
  ProjectListHeader,
  ProjectSearchAndFilters,
} from "./project-list-header";
import type { ClientData, FilterId, ProjectItem, UserData } from "./project-list-types";
import { matchesFilter, summarizeProjectPortfolio, toFilterId } from "./project-list-utils";

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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [controlMode, setControlMode] = useState<SearchFilterMode>("filter");
  const [resultsMinHeight, setResultsMinHeight] = useState<number | null>(null);
  const resultsRef = React.useRef<HTMLDivElement | null>(null);
  const pendingScrollYRef = React.useRef<number | null>(null);
  const activeFilter = toFilterId(useUrlSearchParam("filter"));
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

  React.useLayoutEffect(() => {
    const pendingScrollY = pendingScrollYRef.current;
    if (pendingScrollY === null) return;
    window.scrollTo({ top: pendingScrollY, behavior: "auto" });
    pendingScrollYRef.current = null;
  }, [activeFilter]);

  function changeFilter(filter: FilterId): void {
    if (filter === activeFilter) return;
    const currentResultsHeight = resultsRef.current?.getBoundingClientRect().height ?? 0;
    setResultsMinHeight((current) => Math.max(current ?? 0, currentResultsHeight));
    pendingScrollYRef.current = window.scrollY;
    selectFilter(filter);
  }

  function changeControlMode(mode: SearchFilterMode): void {
    setSearchQuery("");
    setControlMode(mode);
    if (mode === "search" && activeFilter !== "ALL") {
      pendingScrollYRef.current = window.scrollY;
      selectFilter("ALL");
    }
  }

  return (
    <div className="space-y-lg pb-10 max-[430px]:space-y-5 max-[430px]:pb-8">
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

      <div
        ref={resultsRef}
        style={resultsMinHeight === null ? undefined : { minHeight: `${resultsMinHeight}px` }}
      >
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
            <div className="flex min-h-10 items-center justify-between gap-3 px-1">
              <h2
                id="project-list-title"
                className="text-on-surface text-[17px] leading-6 font-bold tracking-[-0.015em] max-[430px]:text-[15px]"
              >
                Daftar proyek
              </h2>
              <span className="text-on-surface-variant/65 shrink-0 text-[9px] font-semibold">
                {filteredProjects.length} dari {projects.length}
              </span>
            </div>
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
