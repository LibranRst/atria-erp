"use client";

import React, { useMemo, useState } from "react";
import { ProjectDrawer } from "./project-drawer";
import {
  updateUrlSearchParam,
  useUrlSearchParam,
} from "@/lib/utils/use-url-search-param";
import { ProjectListCard } from "./project-list-card";
import {
  ProjectListEmptyState,
  ProjectListHeader,
  ProjectSearchAndFilters,
} from "./project-list-header";
import type { ClientData, FilterId, ProjectItem, UserData } from "./project-list-types";
import { matchesFilter, toFilterId } from "./project-list-utils";

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
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const activeFilter = toFilterId(useUrlSearchParam("filter"));
  const clearQueryParam = React.useCallback(
    (key: string): void => {
      updateUrlSearchParam(key, null, "replace");
    },
    [],
  );

  const closeProjectDrawer = React.useCallback((): void => {
    setIsDrawerOpen(false);
    clearQueryParam("new-project");
  }, [clearQueryParam]);

  const selectFilter = React.useCallback((filter: FilterId): void => {
    updateUrlSearchParam(
      "filter",
      filter === "ALL" ? null : filter,
      "replace",
    );
  }, []);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesSearch =
        normalizedQuery.length === 0 ||
        project.name.toLowerCase().includes(normalizedQuery) ||
        project.clientName.toLowerCase().includes(normalizedQuery) ||
        (project.location ?? "").toLowerCase().includes(normalizedQuery);

      return matchesSearch && matchesFilter(project, activeFilter);
    });
  }, [activeFilter, projects, searchQuery]);

  const activeCount = projects.filter(
    (project) => project.status === "ACTIVE",
  ).length;
  const warningCount = projects.filter(
    (project) => project.effectiveHealth !== "HEALTHY",
  ).length;

  return (
    <div className="space-y-lg pb-10">
      <div className="space-y-md">
        <ProjectListHeader
          activeCount={activeCount}
          warningCount={warningCount}
        />
        <ProjectSearchAndFilters
          activeFilter={activeFilter}
          searchQuery={searchQuery}
          onFilterChange={selectFilter}
          onSearchChange={setSearchQuery}
        />
      </div>

      {filteredProjects.length === 0 ? (
        <ProjectListEmptyState
          onReset={() => {
            setSearchQuery("");
            selectFilter("ALL");
          }}
        />
      ) : (
        <div className="space-y-2.5">
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
