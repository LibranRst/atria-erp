"use client";

import React from "react";

import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import {
  BudgetSplitIndicator,
  DetailSection,
  MoneyValue,
  RowGroup,
  SummaryFact,
  SummarySurface,
} from "@/components/ui";
import { DashboardTabEmpty } from "@/features/finance-dashboard/components/shared/dashboard-row-primitives";
import { CategoryUsageRow } from "@/features/finance-dashboard/components/rows/category-rows";
import { ProjectRiskRow } from "@/features/finance-dashboard/components/rows/project-rows";

export function BudgetRiskTab({
  data,
}: {
  readonly data: FinanceDashboardOverview;
}): React.JSX.Element {
  const criticalCategories = data.categories.filter(
    (category) => category.status === "CRITICAL" || category.status === "OVER_BUDGET",
  );
  const budgetDanger = data.summary.remainingBudget < 0 || data.summary.usedPercentage >= 100;
  return (
    <div className="space-y-sm">
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

      <DetailSection
        title="Project berisiko"
        href="/projects?filter=WARNING"
        actionLabel="Buka project"
      >
        {data.dashboardDetails.budgetRisks.length === 0 ? (
          <DashboardTabEmpty>Semua project aktif masih dalam batas budget.</DashboardTabEmpty>
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
            <RowGroup>
              {data.categories.map((category) => (
                <CategoryUsageRow key={category.code} category={category} />
              ))}
            </RowGroup>
          </>
        )}
      </DetailSection>
    </div>
  );
}
