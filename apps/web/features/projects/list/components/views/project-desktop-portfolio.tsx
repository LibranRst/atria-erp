"use client";

/* THESIS: compare project commitment, budget consumption and remaining room
 * before choosing a project to inspect or update.
 * OWN-WORLD: inherited Atria Operate; Manrope, cool canvas, white grouped
 * owners, native HeroUI table, ink capsules and restrained terracotta.
 * STORY: scan the active portfolio, narrow the complete scoped list, inspect
 * exact project/budget context, then use existing project and form owners.
 * FIRST VIEWPORT: compact title/create, one four-fact band, peer views and
 * inline controls, six-column comparison with independent18rem wide detail.
 * FORM: the user's specified continuation of accepted desktop grammar;
 * narrow list/detail with Back, no hidden selection or new bulk workflows.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
import React from "react";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { summarizeProjectPortfolio } from "@atria/core/project/project-list";
import {
  AppIcon,
  Button,
  DesktopTablePagination,
  FilterSelect,
  GroupedSurface,
  PageHeader,
  SearchInput,
  SegmentedTabs,
  StatusBadge,
  desktopTablePage,
} from "@/components/ui";
import type { ProjectItem } from "../../types/project-list-types";
import { useProjectPortfolioQuery } from "../../hooks/use-project-portfolio-query";
import {
  filterProjectPortfolio,
  matchesPortfolioView,
  projectHasBudget,
  type PortfolioView,
} from "../../utils/project-desktop-portfolio";
import {
  ProjectComparisonTable,
  ProjectPortfolioAmount,
  projectComparisonColumns,
} from "./project-comparison-table";

function rowKey(project: ProjectItem): string {
  return project.id;
}
const views: readonly { value: PortfolioView; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "active", label: "Aktif" },
  { value: "setup", label: "Persiapan" },
  { value: "attention", label: "Perlu perhatian" },
  { value: "closed", label: "Ditutup" },
];
export function ProjectDesktopPortfolio({
  projects,
  canCreate,
  canEdit,
  selectedProjectId,
  onSelect,
  onEdit,
  onCreate,
}: {
  readonly projects: readonly ProjectItem[];
  readonly canCreate: boolean;
  readonly canEdit: boolean;
  readonly selectedProjectId: string | null;
  readonly onSelect: (id: string | null) => void;
  readonly onEdit: (project: ProjectItem) => void;
  readonly onCreate: () => void;
}): React.JSX.Element {
  const { input, update } = useProjectPortfolioQuery();
  const summary = React.useMemo(() => summarizeProjectPortfolio(projects), [projects]);
  const activeBudgets = projects.filter(
    (project) => project.status === "ACTIVE" && projectHasBudget(project),
  );
  const unconfiguredActive = projects.filter(
    (project) => project.status === "ACTIVE" && !projectHasBudget(project),
  ).length;
  const paidKnown =
    activeBudgets.length > 0 &&
    activeBudgets.every((project) => typeof project.paidCost === "number");
  const totalPaid = paidKnown
    ? activeBudgets.reduce((total, project) => total + (project.paidCost ?? 0), 0)
    : null;
  const clients = React.useMemo(
    () =>
      [
        ...new Map(
          projects.map((project) => [
            project.clientId,
            { value: project.clientId, label: project.clientName },
          ]),
        ).values(),
      ].sort((a, b) => a.label.localeCompare(b.label, "id-ID")),
    [projects],
  );
  const managers = React.useMemo(
    () =>
      [
        ...new Map(
          projects.flatMap((project) =>
            project.projectManagerId
              ? [
                  [
                    project.projectManagerId,
                    { value: project.projectManagerId, label: project.pmName },
                  ] as const,
                ]
              : [],
          ),
        ).values(),
      ].sort((a, b) => a.label.localeCompare(b.label, "id-ID")),
    [projects],
  );
  const filtered = React.useMemo(() => filterProjectPortfolio(projects, input), [projects, input]);
  const sort = projectComparisonColumns.some((column) => column.key === input.sort)
    ? input.sort
    : "project";
  const table = desktopTablePage(
    filtered,
    projectComparisonColumns,
    rowKey,
    { column: sort, direction: input.direction },
    input.page,
    input.pageSize,
  );
  const hasFilters = Boolean(
    input.search.trim() ||
    input.client !== "ALL" ||
    input.pm !== "ALL" ||
    input.status !== "ALL" ||
    input.health !== "ALL",
  );
  return (
    <div className="min-w-0 space-y-4">
      <PageHeader
        title="Proyek"
        subtitle="Bandingkan nilai, pemakaian budget, dan kondisi pekerjaan."
        action={
          canCreate ? (
            <Button variant="primary" size="compact" onClick={onCreate}>
              <AppIcon name="add" className="icon-sm" />
              Tambah proyek
            </Button>
          ) : undefined
        }
      />
      <GroupedSurface variant="desktopPanel">
        <dl className="grid grid-cols-4 divide-x divide-outline-variant/30 p-4">
          {[
            { label: "Nilai proyek aktif", amount: summary.activeContractValue },
            { label: "Budget internal", amount: summary.activeInternalBudget },
            { label: "Terpakai", amount: summary.activeActualCost },
            { label: "Sisa budget", amount: summary.activeRemainingBudget },
          ].map((metric) => (
            <div key={metric.label} className="min-w-0 px-4 first:pl-0 last:pr-0">
              <dt className="text-support text-on-surface-variant">{metric.label}</dt>
              <dd className="mt-2">
                <ProjectPortfolioAmount amount={metric.amount} size="lg" />
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-outline-variant/30 px-4 py-3 text-support text-on-surface-variant">
          <p>
            {summary.activeCount} proyek aktif · {activeBudgets.length} berbudget
            {unconfiguredActive ? ` · ${unconfiguredActive} belum berbudget` : ""}
          </p>
          {totalPaid !== null ? (
            <div className="flex items-baseline gap-2">
              <span>Sudah dibayar</span>
              <ProjectPortfolioAmount amount={totalPaid} />
            </div>
          ) : null}
          <p className="w-full text-meta">Ringkasan proyek aktif; filter hanya mengubah daftar.</p>
        </div>
      </GroupedSurface>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          value={input.view}
          onChange={(view) => update({ view })}
          ariaLabel="Tampilan portfolio proyek"
          density="compact"
          scrollable
          options={views.map((view) => ({
            ...view,
            count: projects.filter((project) => matchesPortfolioView(project, view.value)).length,
            countLabel: `${projects.filter((project) => matchesPortfolioView(project, view.value)).length} proyek ${view.label.toLocaleLowerCase("id-ID")}`,
          }))}
        />
        <StatusBadge
          label={`${projects.filter((project) => matchesPortfolioView(project, "attention")).length} perlu perhatian`}
          tone={
            projects.some((project) => matchesPortfolioView(project, "attention"))
              ? "warning"
              : "neutral"
          }
        />
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <SearchInput
          ariaLabel="Cari portfolio proyek"
          placeholder="Cari proyek, klien, PM, atau lokasi…"
          value={input.search}
          onChange={(search) => update({ search })}
          showClear={false}
          className="min-w-60 flex-1"
        />
        <FilterSelect
          label="Klien proyek"
          value={input.client}
          onChange={(client) => update({ client })}
          presentation="menu"
          searchable={clients.length > 8}
          options={[{ value: "ALL", label: "Semua klien" }, ...clients]}
        />
        <FilterSelect
          label="Project Manager"
          value={input.pm}
          onChange={(pm) => update({ pm })}
          presentation="menu"
          searchable={managers.length > 8}
          options={[
            { value: "ALL", label: "Semua PM" },
            { value: "UNASSIGNED", label: "Belum ditugaskan" },
            ...managers,
          ]}
        />
        <FilterSelect
          label="Status proyek"
          value={input.status}
          onChange={(status) => {
            if (
              status === "ALL" ||
              status === "ACTIVE" ||
              status === "DRAFT" ||
              status === "ON_HOLD" ||
              status === "COMPLETED" ||
              status === "CANCELLED"
            )
              update({ status });
          }}
          presentation="menu"
          options={[
            { value: "ALL", label: "Semua status" },
            ...["ACTIVE", "DRAFT", "ON_HOLD", "COMPLETED", "CANCELLED"].map((value) => ({
              value,
              label: formatBusinessLabel(value),
            })),
          ]}
        />
        <FilterSelect
          label="Kondisi budget proyek"
          value={input.health}
          onChange={(health) => {
            if (
              health === "ALL" ||
              health === "HEALTHY" ||
              health === "WARNING" ||
              health === "CRITICAL" ||
              health === "MISSING"
            )
              update({ health });
          }}
          presentation="menu"
          options={[
            { value: "ALL", label: "Semua kondisi" },
            { value: "HEALTHY", label: "Terkendali" },
            { value: "WARNING", label: "Perhatian" },
            { value: "CRITICAL", label: "Kritis" },
            { value: "MISSING", label: "Belum berbudget" },
          ]}
        />
        {hasFilters ? (
          <Button
            variant="secondary"
            size="mini"
            onClick={() =>
              update({ search: "", client: "ALL", pm: "ALL", status: "ALL", health: "ALL" })
            }
          >
            Reset filter
          </Button>
        ) : null}
      </div>
      <ProjectComparisonTable
        projects={table.rows}
        selectedProjectId={selectedProjectId}
        onSelect={onSelect}
        sort={{ column: sort, direction: input.direction }}
        onSort={(sort) => update({ sort: String(sort.column), direction: sort.direction })}
        canEdit={canEdit}
        onEdit={onEdit}
        emptyTitle={projects.length ? "Tidak ada proyek yang sesuai" : "Belum ada proyek"}
        emptyDescription={
          projects.length
            ? "Sesuaikan tampilan, pencarian, atau filter untuk melihat proyek."
            : canCreate
              ? "Tambahkan proyek untuk memulai setup budget dan pekerjaan."
              : "Proyek yang dapat Anda akses akan tampil di sini."
        }
        footer={
          <DesktopTablePagination
            {...table}
            pageSize={input.pageSize}
            onPageChange={(page) => update({ page })}
            onPageSizeChange={(pageSize) =>
              update({ pageSize: pageSize === 25 || pageSize === 50 ? pageSize : 10 })
            }
            ariaLabel="Halaman portfolio proyek"
          />
        }
      />
    </div>
  );
}
