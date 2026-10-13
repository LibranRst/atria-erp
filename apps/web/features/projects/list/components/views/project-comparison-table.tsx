"use client";

import React from "react";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import {
  Button,
  ButtonLink,
  DesktopTable,
  GroupedSurface,
  MoneyValue,
  StatusBadge,
  type DesktopTableProps,
} from "@/components/ui";
import type { ProjectItem } from "../../types/project-list-types";

export type ProjectComparisonSort = NonNullable<DesktopTableProps<ProjectItem>["sortDescriptor"]>;

export function ProjectComparisonTable({
  projects,
  selectedProjectId,
  sort,
  canEdit,
  onSelect,
  onSort,
  onEdit,
}: {
  readonly projects: readonly ProjectItem[];
  readonly selectedProjectId: string | null;
  readonly sort: ProjectComparisonSort;
  readonly canEdit: boolean;
  readonly onSelect: (projectId: string | null) => void;
  readonly onSort: (sort: ProjectComparisonSort) => void;
  readonly onEdit: (project: ProjectItem) => void;
}): React.JSX.Element {
  const selected = projects.find((project) => project.id === selectedProjectId) ?? null;
  return (
    <div className={selected ? "grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_272px]" : "min-w-0"}>
      <DesktopTable
        ariaLabel="Perbandingan budget proyek"
        rows={projects}
        rowKey={(project) => project.id}
        selectedRowKey={selected?.id ?? null}
        onRowAction={(project) => onSelect(project.id)}
        sortDescriptor={sort}
        onSortChange={onSort}
        footer={
          <span className="text-meta text-on-surface-variant">
            Pilih baris untuk ringkasan proyek.
          </span>
        }
        columns={[
          {
            key: "project",
            label: "Proyek",
            sortValue: (project) => project.name,
            render: (project) => (
              <div className="max-w-56">
                <p className="font-semibold">{project.name}</p>
                <p className="mt-0.5 truncate text-meta text-on-surface-variant">
                  {project.clientName} · {project.pmName}
                </p>
              </div>
            ),
          },
          {
            key: "value",
            label: "Nilai proyek",
            align: "end",
            sortValue: (project) => project.totalContractValue,
            render: (project) => (
              <MoneyValue
                amount={project.totalContractValue}
                variant="compact"
                align="right"
                size="sm"
              />
            ),
          },
          {
            key: "budget",
            label: "Budget",
            align: "end",
            sortValue: (project) => project.internalBudget,
            render: (project) => (
              <MoneyValue
                amount={project.internalBudget}
                variant="compact"
                align="right"
                size="sm"
              />
            ),
          },
          {
            key: "actual",
            label: "Terpakai",
            align: "end",
            sortValue: (project) => project.actualCost,
            render: (project) => (
              <MoneyValue amount={project.actualCost} variant="compact" align="right" size="sm" />
            ),
          },
          {
            key: "remaining",
            label: "Sisa budget",
            align: "end",
            sortValue: (project) => project.remainingBudget,
            render: (project) => (
              <MoneyValue
                amount={project.remainingBudget}
                variant="compact"
                align="right"
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
                  label={formatBusinessLabel(project.effectiveHealth)}
                />
                <p className="text-meta text-on-surface-variant">
                  {formatBusinessLabel(project.status)} ·{" "}
                  {project.usedPercentage.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
                </p>
              </div>
            ),
          },
          {
            key: "action",
            label: "Tindakan",
            render: (project) => (
              <div className="flex gap-2">
                <ButtonLink href={`/projects/${project.id}`} variant="secondary" size="compact">
                  Buka
                </ButtonLink>
                {canEdit && project.status !== "COMPLETED" && project.status !== "CANCELLED" ? (
                  <Button variant="tertiary" size="compact" onClick={() => onEdit(project)}>
                    Edit
                  </Button>
                ) : null}
              </div>
            ),
          },
        ]}
      />
      {selected ? (
        <GroupedSurface as="section" className="self-start p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-row font-semibold">{selected.name}</h3>
            <Button
              size="compact"
              variant="tertiary"
              aria-label="Tutup ringkasan proyek"
              onClick={() => onSelect(null)}
            >
              Tutup
            </Button>
          </div>
          <p className="mt-1 text-support text-on-surface-variant">{selected.clientName}</p>
          <dl className="my-4 space-y-3">
            {[
              { label: "Nilai proyek", amount: selected.totalContractValue },
              { label: "Budget internal", amount: selected.internalBudget },
              { label: "Terpakai", amount: selected.actualCost },
              { label: "Sisa budget", amount: selected.remainingBudget },
            ].map((metric) => (
              <div key={metric.label} className="flex flex-wrap justify-between gap-2">
                <dt className="text-support text-on-surface-variant">{metric.label}</dt>
                <dd>
                  <MoneyValue amount={metric.amount} variant="compact" size="sm" />
                </dd>
              </div>
            ))}
          </dl>
          <div className="space-y-2 border-t border-outline-variant/25 pt-3 text-support text-on-surface-variant">
            <p>{selected.pmName}</p>
            <p>{selected.location || "Lokasi belum diisi"}</p>
            <p>Budget {formatBusinessLabel(selected.budgetStatus)}</p>
          </div>
          <ButtonLink
            href={`/projects/${selected.id}`}
            variant="secondary"
            size="compact"
            className="mt-4"
          >
            Buka proyek
          </ButtonLink>
        </GroupedSurface>
      ) : null}
    </div>
  );
}
