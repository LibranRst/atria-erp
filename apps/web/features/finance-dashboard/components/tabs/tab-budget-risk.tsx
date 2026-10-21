"use client";

import React from "react";
import {
  useWorkspacePresentation,
  useWorkspaceHref,
} from "@/lib/navigation/workspace-presentation";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";

import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import {
  BudgetSplitIndicator,
  DesktopTable,
  DetailSection,
  MoneyValue,
  RowGroup,
  SummaryFact,
  SummarySurface,
  type DesktopTableProps,
} from "@/components/ui";
import { DashboardTabEmpty } from "@/features/finance-dashboard/components/shared/dashboard-row-primitives";
import { CategoryUsageRow } from "@/features/finance-dashboard/components/rows/category-rows";
import { ProjectRiskRow } from "@/features/finance-dashboard/components/rows/project-rows";

export function BudgetRiskTab({
  data,
  showSummary = true,
}: {
  readonly data: FinanceDashboardOverview;
  readonly showSummary?: boolean;
}): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const workspaceHref = useWorkspaceHref();
  type Sort = NonNullable<
    DesktopTableProps<
      FinanceDashboardOverview["dashboardDetails"]["budgetRisks"][number]
    >["sortDescriptor"]
  >;
  // The owning tab preserves sorting when its row/table presentation changes.
  const [projectSort, setProjectSort] = React.useState<Sort>();
  const [categorySort, setCategorySort] = React.useState<Sort>();
  const criticalCategories = data.categories.filter(
    (category) => category.status === "CRITICAL" || category.status === "OVER_BUDGET",
  );
  const budgetDanger = data.summary.remainingBudget < 0 || data.summary.usedPercentage >= 100;
  return (
    <div className="space-y-sm">
      {showSummary ? (
        <SummarySurface
          ariaLabel="Posisi budget portfolio"
          eyebrow="Portfolio budget"
          icon="account_balance_wallet"
          status={budgetDanger ? "Perlu tindakan" : "Terkendali"}
          statusTone={budgetDanger ? "critical" : "positive"}
        >
          <div className="px-3.5 pt-3 pb-1">
            <div className="grid grid-cols-2">
              <div className="min-w-0 pr-3">
                <p className="text-eyebrow font-semibold text-on-surface-variant/60">
                  Internal budget
                </p>
                <MoneyValue
                  amount={data.summary.internalBudget}
                  variant="compact"
                  size="lg"
                  className="mt-1"
                />
              </div>
              <div className="min-w-0 pl-3 text-right">
                <p className="text-eyebrow font-semibold text-on-surface-variant/60">
                  Aktual terpakai
                </p>
                <MoneyValue
                  amount={data.summary.actualCost}
                  variant="compact"
                  size="lg"
                  align="right"
                  tone={budgetDanger ? "danger" : "default"}
                  className="mt-1"
                />
              </div>
            </div>
            <BudgetSplitIndicator
              value={data.summary.usedPercentage}
              danger={budgetDanger}
              tone={budgetDanger ? "critical" : "positive"}
              usedAmount={data.summary.actualCost}
              remainingAmount={data.summary.remainingBudget}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 px-2 pb-2">
            <SummaryFact
              label="Sisa"
              amount={data.summary.remainingBudget}
              tone={budgetDanger ? "danger" : "positive"}
            />
            <SummaryFact
              label="Margin proyeksi"
              value={`${data.summary.projectedMarginPercentage.toFixed(1)}%`}
              tone={data.summary.projectedMarginPercentage < 0 ? "danger" : "default"}
            />
          </div>
        </SummarySurface>
      ) : null}

      <DetailSection
        title="Project berisiko"
        href="/projects?filter=WARNING"
        actionLabel="Buka project"
      >
        {data.dashboardDetails.budgetRisks.length === 0 ? (
          <DashboardTabEmpty>Semua project aktif masih dalam batas budget.</DashboardTabEmpty>
        ) : desktop ? (
          <DesktopTable
            ariaLabel="Perbandingan proyek berisiko"
            rows={data.dashboardDetails.budgetRisks}
            rowKey={(project) => project.projectId}
            rowHref={(project) => workspaceHref(`/projects/${project.projectId}?tab=overview`)}
            sortDescriptor={projectSort}
            onSortChange={setProjectSort}
            columns={[
              {
                key: "project",
                label: "Proyek",
                sortValue: (project) => project.projectName,
                render: (project) => (
                  <div>
                    <p className="font-semibold">{project.projectName}</p>
                    <p className="text-meta text-on-surface-variant">{project.riskReason}</p>
                  </div>
                ),
              },
              {
                key: "budget",
                label: "Budget",
                sortValue: (project) => project.internalBudget,
                align: "end",
                render: (project) => (
                  <MoneyValue amount={project.internalBudget} variant="compact" size="sm" />
                ),
              },
              {
                key: "actual",
                label: "Terpakai",
                sortValue: (project) => project.actualCost,
                align: "end",
                render: (project) => (
                  <MoneyValue amount={project.actualCost} variant="compact" size="sm" />
                ),
              },
              {
                key: "remaining",
                label: "Sisa",
                sortValue: (project) => project.remainingBudget,
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
                key: "margin",
                label: "Margin / target",
                sortValue: (project) => project.projectedMarginPercentage,
                align: "end",
                render: (project) => (
                  <span className="tabular-nums">
                    {project.projectedMarginPercentage.toFixed(1)}% /{" "}
                    {project.targetMarginPercentage.toFixed(1)}%
                  </span>
                ),
              },
            ]}
          />
        ) : (
          <RowGroup>
            {data.dashboardDetails.budgetRisks.map((project) => (
              <ProjectRiskRow key={project.projectId} project={project} />
            ))}
          </RowGroup>
        )}
      </DetailSection>

      <DetailSection title="Kesehatan kategori" href="/projects" actionLabel="Lihat project">
        {data.categories.length === 0 ? (
          <DashboardTabEmpty>Budget kategori project aktif belum tersedia.</DashboardTabEmpty>
        ) : (
          <>
            <div className="border-b border-outline-variant/35 px-4 py-2.5 text-meta font-semibold text-on-surface-variant">
              {criticalCategories.length > 0
                ? `${criticalCategories.length} kategori perlu perhatian di seluruh project.`
                : "Semua kategori masih terkendali."}
            </div>
            {desktop ? (
              <DesktopTable
                ariaLabel="Penggunaan kategori budget"
                rows={data.categories}
                rowKey={(category) => category.code}
                sortDescriptor={categorySort}
                onSortChange={setCategorySort}
                columns={[
                  {
                    key: "category",
                    label: "Kategori",
                    sortValue: (category) => category.name,
                    render: (category) => category.name,
                  },
                  {
                    key: "allocated",
                    label: "Alokasi",
                    sortValue: (category) => category.allocatedAmount,
                    align: "end",
                    render: (category) => (
                      <MoneyValue amount={category.allocatedAmount} variant="compact" size="sm" />
                    ),
                  },
                  {
                    key: "pending",
                    label: "Menunggu review",
                    sortValue: (category) => category.pendingAmount,
                    align: "end",
                    render: (category) => (
                      <MoneyValue amount={category.pendingAmount} variant="compact" size="sm" />
                    ),
                  },
                  {
                    key: "actual",
                    label: "Terpakai",
                    sortValue: (category) => category.actualAmount,
                    align: "end",
                    render: (category) => (
                      <MoneyValue amount={category.actualAmount} variant="compact" size="sm" />
                    ),
                  },
                  {
                    key: "paid",
                    label: "Dibayar",
                    sortValue: (category) => category.paidAmount,
                    align: "end",
                    render: (category) => (
                      <MoneyValue amount={category.paidAmount} variant="compact" size="sm" />
                    ),
                  },
                  {
                    key: "remaining",
                    label: "Sisa",
                    sortValue: (category) => category.remainingAmount,
                    align: "end",
                    render: (category) => (
                      <MoneyValue
                        amount={category.remainingAmount}
                        variant="compact"
                        size="sm"
                        tone={category.remainingAmount < 0 ? "danger" : "default"}
                      />
                    ),
                  },
                  {
                    key: "status",
                    label: "Kondisi",
                    sortValue: (category) => category.usedPercentage,
                    render: (category) => (
                      <span>
                        {formatBusinessLabel(category.status)} ·{" "}
                        {category.usedPercentage.toFixed(1)}%
                      </span>
                    ),
                  },
                ]}
              />
            ) : (
              <RowGroup>
                {data.categories.map((category) => (
                  <CategoryUsageRow key={category.code} category={category} />
                ))}
              </RowGroup>
            )}
          </>
        )}
      </DetailSection>
    </div>
  );
}
