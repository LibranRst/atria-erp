"use client";

import React from "react";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { projectHealthReasonLabel } from "@atria/core/project/effective-health";
import {
  AppIcon,
  Button,
  ButtonLink,
  DesktopTable,
  FactRow,
  GroupedSurface,
  MoneyValue,
  useListDetailFocus,
  StatusBadge,
  type DesktopTableColumn,
  type DesktopTableProps,
} from "@/components/ui";
import { useWorkspaceViewportAtLeast } from "@/lib/navigation/workspace-viewport";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import type { ProjectItem } from "../../types/project-list-types";
import { projectHasBudget, projectIsOperational } from "../../utils/project-desktop-portfolio";

export type ProjectComparisonSort = NonNullable<DesktopTableProps<ProjectItem>["sortDescriptor"]>;

export function ProjectPortfolioAmount({
  amount,
  compact = true,
  size = "sm",
  align = "left",
}: {
  readonly amount: number;
  readonly compact?: boolean;
  readonly size?: "sm" | "lg";
  readonly align?: "left" | "right";
}): React.JSX.Element {
  return (
    <MoneyValue
      amount={amount}
      fractionDigits={Number.isInteger(amount) ? 0 : 2}
      variant={compact ? "compact" : "fullDynamic"}
      size={size}
      align={align}
      tone={amount < 0 ? "danger" : "default"}
    />
  );
}
function BudgetAmount({
  project,
  field,
}: {
  readonly project: ProjectItem;
  readonly field: "internalBudget" | "actualCost" | "remainingBudget";
}): React.JSX.Element {
  return projectHasBudget(project) ? (
    <ProjectPortfolioAmount amount={project[field]} align="right" />
  ) : (
    <span aria-label="Budget belum disiapkan" className="text-support text-on-surface-variant">
      —
    </span>
  );
}
function Condition({ project }: { readonly project: ProjectItem }): React.JSX.Element {
  const available = projectHasBudget(project);
  return (
    <div className="space-y-1">
      <StatusBadge
        label={
          !available
            ? "Belum budget"
            : project.effectiveHealth === "CRITICAL"
              ? "Kritis"
              : project.effectiveHealth === "WARNING"
                ? "Perhatian"
                : "Terkendali"
        }
        tone={
          !available
            ? "neutral"
            : project.effectiveHealth === "CRITICAL"
              ? "critical"
              : project.effectiveHealth === "WARNING"
                ? "warning"
                : "neutral"
        }
      />
      <p className="text-meta text-on-surface-variant">{formatBusinessLabel(project.status)}</p>
    </div>
  );
}
export const projectComparisonColumns: readonly DesktopTableColumn<ProjectItem>[] = [
  {
    key: "project",
    label: "Proyek",
    widthPercent: 28,
    sortValue: (p) => p.name,
    render: (p) => (
      <div className="min-w-0 space-y-1">
        <p className="line-clamp-2 font-semibold">{p.name}</p>
        <p
          className="truncate text-support text-on-surface-variant"
          title={`${p.clientName} · ${p.pmName}`}
        >
          {p.clientName} · {p.pmName}
        </p>
      </div>
    ),
  },
  {
    key: "value",
    label: "Nilai proyek",
    widthPercent: 14,
    align: "end",
    sortValue: (p) => p.totalContractValue,
    render: (p) => <ProjectPortfolioAmount amount={p.totalContractValue} align="right" />,
  },
  {
    key: "budget",
    label: "Budget",
    widthPercent: 14,
    align: "end",
    sortValue: (p) => (projectHasBudget(p) ? p.internalBudget : -Number.MAX_VALUE),
    render: (p) => <BudgetAmount project={p} field="internalBudget" />,
  },
  {
    key: "actual",
    label: "Terpakai",
    widthPercent: 14,
    align: "end",
    sortValue: (p) => (projectHasBudget(p) ? p.actualCost : -Number.MAX_VALUE),
    render: (p) => <BudgetAmount project={p} field="actualCost" />,
  },
  {
    key: "remaining",
    label: "Sisa",
    widthPercent: 14,
    align: "end",
    sortValue: (p) => (projectHasBudget(p) ? p.remainingBudget : -Number.MAX_VALUE),
    render: (p) => <BudgetAmount project={p} field="remainingBudget" />,
  },
  {
    key: "health",
    label: "Kondisi",
    widthPercent: 16,
    sortValue: (p) =>
      !projectHasBudget(p)
        ? 1
        : p.effectiveHealth === "CRITICAL"
          ? 3
          : p.effectiveHealth === "WARNING"
            ? 2
            : 0,
    render: (p) => <Condition project={p} />,
  },
];
function dateCopy(value: string | null | undefined): string {
  return value
    ? new Date(value).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      })
    : "Belum diisi";
}
function ProjectContext({
  project,
  canEdit,
  onEdit,
}: {
  readonly project: ProjectItem;
  readonly canEdit: boolean;
  readonly onEdit: (project: ProjectItem) => void;
}): React.JSX.Element {
  const hasBudget = projectHasBudget(project);
  const margin = project.projectedMarginPercentage;
  const reasons = hasBudget ? project.healthReasons : [];
  return (
    <div className="@container min-w-0 space-y-4">
      <GroupedSurface variant="desktopPanel">
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-section font-bold">Ringkasan proyek</h2>
            <Condition project={project} />
          </div>
          <p className="text-row font-semibold wrap-anywhere">{project.name}</p>
          <p className="text-support text-on-surface-variant">{project.clientName}</p>
          <ProjectPortfolioAmount amount={project.totalContractValue} compact={false} size="lg" />
        </div>
        <div className="divide-y divide-outline-variant/30 border-y border-outline-variant/30">
          <FactRow
            label="Project Manager"
            value={project.projectManagerId ? project.pmName : "Belum ditugaskan"}
            layout="stacked"
          />
          <FactRow label="Lokasi" value={project.location || "Belum diisi"} layout="stacked" />
          <FactRow label="Mulai" value={dateCopy(project.startDate)} />
          <FactRow label="Target selesai" value={dateCopy(project.endDate)} />
        </div>
        <div className="grid gap-2 p-4 @xl:grid-cols-2">
          <ButtonLink
            href={`/projects/${project.id}?tab=overview`}
            variant="primary"
            size="compact"
            fullWidth
          >
            Buka proyek
          </ButtonLink>
          {canEdit && projectIsOperational(project) ? (
            <Button variant="secondary" size="compact" fullWidth onClick={() => onEdit(project)}>
              Ubah proyek
            </Button>
          ) : null}
        </div>
      </GroupedSurface>
      <section className="space-y-2">
        <h3 className="px-1 text-row font-bold">Budget dan margin</h3>
        <GroupedSurface variant="desktopPanel">
          {hasBudget ? (
            <>
              <div className="divide-y divide-outline-variant/30">
                <FactRow label="Status budget" value={formatBusinessLabel(project.budgetStatus)} />
                <FactRow
                  label="Budget internal"
                  value={<ProjectPortfolioAmount amount={project.internalBudget} compact={false} />}
                />
                <FactRow
                  label="Terpakai"
                  value={<ProjectPortfolioAmount amount={project.actualCost} compact={false} />}
                />
                {typeof project.paidCost === "number" ? (
                  <FactRow
                    label="Sudah dibayar"
                    value={<ProjectPortfolioAmount amount={project.paidCost} compact={false} />}
                  />
                ) : null}
                {typeof project.pendingCost === "number" ? (
                  <FactRow
                    label="Menunggu tinjauan"
                    value={<ProjectPortfolioAmount amount={project.pendingCost} compact={false} />}
                  />
                ) : null}
                <FactRow
                  label="Sisa budget"
                  value={
                    <ProjectPortfolioAmount amount={project.remainingBudget} compact={false} />
                  }
                />
                <FactRow
                  label="Penggunaan budget"
                  value={
                    project.internalBudget > 0
                      ? `${project.usedPercentage.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`
                      : "Belum dapat dihitung"
                  }
                />
                {typeof project.projectedMarginAmount === "number" ? (
                  <FactRow
                    label="Proyeksi margin"
                    value={
                      <ProjectPortfolioAmount
                        amount={project.projectedMarginAmount}
                        compact={false}
                      />
                    }
                  />
                ) : null}
                {typeof margin === "number" && project.totalContractValue > 0 ? (
                  <FactRow
                    label="Margin / target"
                    value={`${margin.toLocaleString("id-ID", { maximumFractionDigits: 1 })}% / ${typeof project.targetGrossPercentage === "number" ? `${project.targetGrossPercentage.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%` : "Belum tersedia"}`}
                  />
                ) : null}
              </div>
              {reasons.length ? (
                <div className="space-y-2 border-t border-outline-variant/30 p-4">
                  {reasons.map((reason) => (
                    <p key={reason} className="flex items-start gap-2 text-support text-warning">
                      <AppIcon name="info" className="icon-sm shrink-0" />
                      {projectHealthReasonLabel(reason)}
                    </p>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="space-y-2 p-4">
              <p className="flex items-center gap-2 text-support font-semibold">
                <AppIcon name="info" className="icon-sm" />
                Budget belum disiapkan
              </p>
              <p className="text-support text-on-surface-variant">
                Pemakaian, sisa budget dan proyeksi margin belum dapat dinilai. Nilai proyek tetap
                ditampilkan.
              </p>
            </div>
          )}
          <div className="border-t border-outline-variant/30 p-4">
            <ButtonLink
              href={`/projects/${project.id}?tab=overview#project-budget`}
              variant="secondary"
              size="compact"
              fullWidth
            >
              {hasBudget ? "Tinjau budget" : "Buka setup budget"}
            </ButtonLink>
          </div>
        </GroupedSurface>
      </section>
    </div>
  );
}

export function ProjectComparisonTable({
  projects,
  selectedProjectId,
  sort,
  canEdit,
  onSelect,
  onSort,
  onEdit,
  footer,
  emptyTitle = "Belum ada proyek",
  emptyDescription = "Proyek yang dapat Anda akses akan tampil di sini.",
}: {
  readonly projects: readonly ProjectItem[];
  readonly selectedProjectId: string | null;
  readonly sort: ProjectComparisonSort;
  readonly canEdit: boolean;
  readonly onSelect: (id: string | null) => void;
  readonly onSort: (sort: ProjectComparisonSort) => void;
  readonly onEdit: (project: ProjectItem) => void;
  readonly footer?: React.ReactNode;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
}): React.JSX.Element {
  const aside = useWorkspaceViewportAtLeast(1280);
  const explicit = projects.find((p) => p.id === selectedProjectId);
  const context = explicit;
  const { listRef, detailRef } = useListDetailFocus({
    active: useWorkspacePresentation() === "desktop",
    narrow: !aside,
    selectionKey: context?.id ?? null,
  });
  return (
    <div
      className={`grid min-w-0 items-start gap-4 ${context ? "xl:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}
    >
      <div ref={listRef} className={`min-w-0 ${explicit ? "hidden xl:block" : ""}`}>
        <DesktopTable
          ariaLabel="Perbandingan budget proyek"
          columns={projectComparisonColumns}
          layout="fixed"
          rows={projects}
          rowKey={(p) => p.id}
          selectedRowKey={aside ? (context?.id ?? null) : null}
          onRowSelectionChange={(project) => onSelect(project?.id ?? null)}
          sortDescriptor={sort}
          onSortChange={onSort}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          footer={footer}
        />
      </div>
      {context ? (
        <section
          ref={detailRef}
          aria-label="Konteks proyek"
          className={`min-w-0 space-y-3 ${explicit ? "" : "hidden xl:block"}`}
        >
          {explicit ? (
            <Button
              variant="secondary"
              size="mini"
              className="xl:hidden"
              onClick={() => onSelect(null)}
            >
              <AppIcon name="arrow_back" className="icon-xs" />
              Kembali ke daftar
            </Button>
          ) : null}
          <ProjectContext project={context} canEdit={canEdit} onEdit={onEdit} />
        </section>
      ) : null}
    </div>
  );
}
