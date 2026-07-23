"use client";

import React from "react";

import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import { MoneyValue } from "@/components/ui/feedback/page-primitives";
import { BudgetSplitIndicator } from "@/features/finance-dashboard/components/cards/budget-split-indicator";
import {
  DashboardDetailSection,
  DashboardRowGroup,
  DashboardSummarySurface,
} from "@/features/finance-dashboard/components/shared/dashboard-primitives";
import { DashboardTabEmpty } from "@/features/finance-dashboard/components/shared/dashboard-row-primitives";
import { SummaryFact } from "@/features/finance-dashboard/components/shared/dashboard-summary-fact";
import { CategoryUsageRow } from "@/features/finance-dashboard/components/rows/category-rows";
import { ProjectRiskRow } from "@/features/finance-dashboard/components/rows/project-rows";
import { shortMoney } from "@/features/finance-dashboard/utils/dashboard-formatters";

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
    <div className="space-y-lg max-[430px]:space-y-5">
      <DashboardSummarySurface
        ariaLabel="Posisi budget portfolio"
        eyebrow="Portfolio budget"
        icon="account_balance_wallet"
        status={budgetDanger ? "Perlu tindakan" : "Terkendali"}
        statusTone={budgetDanger ? "critical" : "positive"}
      >
        <div className="grid grid-cols-2 divide-x divide-black/5.5 rounded-[20px] bg-surface-container-low/65 px-3.5 py-3">
          <div className="min-w-0 pr-3">
            <p className="text-[9px] font-semibold text-on-surface-variant/60">Internal budget</p>
            <MoneyValue
              amount={data.summary.internalBudget}
              variant="compactWithFull"
              size="lg"
              className="mt-1"
            />
          </div>
          <div className="min-w-0 pl-3 text-right">
            <p className="text-[9px] font-semibold text-on-surface-variant/60">Aktual terpakai</p>
            <MoneyValue
              amount={data.summary.actualCost}
              variant="compactWithFull"
              size="lg"
              align="right"
              tone={budgetDanger ? "danger" : "default"}
              className="mt-1"
            />
          </div>
        </div>
        <BudgetSplitIndicator value={data.summary.usedPercentage} danger={budgetDanger} />
        <div className="mt-3 grid grid-cols-2 gap-4 border-t border-black/5.5 pt-3">
          <SummaryFact
            label="Sisa"
            value={shortMoney(data.summary.remainingBudget)}
            tone={budgetDanger ? "danger" : "positive"}
          />
          <div className="border-l border-black/5.5 pl-4">
            <SummaryFact
              label="Margin proyeksi"
              value={`${data.summary.projectedMarginPercentage.toFixed(1)}%`}
              tone={data.summary.projectedMarginPercentage < 0 ? "danger" : "default"}
            />
          </div>
        </div>
      </DashboardSummarySurface>

      <DashboardDetailSection
        title="Project berisiko"
        href="/projects?filter=WARNING"
        actionLabel="Buka project"
      >
        {data.dashboardDetails.budgetRisks.length === 0 ? (
          <DashboardTabEmpty>Semua project aktif masih dalam batas budget.</DashboardTabEmpty>
        ) : (
          <DashboardRowGroup>
            {data.dashboardDetails.budgetRisks.map((project) => (
              <ProjectRiskRow key={project.projectId} project={project} />
            ))}
          </DashboardRowGroup>
        )}
      </DashboardDetailSection>

      <DashboardDetailSection
        title="Kesehatan kategori"
        href="/projects"
        actionLabel="Lihat project"
      >
        {data.categories.length === 0 ? (
          <DashboardTabEmpty>Budget kategori project aktif belum tersedia.</DashboardTabEmpty>
        ) : (
          <>
            <div className="border-b border-outline-variant/35 px-4 py-2.5 text-[10px] font-semibold text-on-surface-variant">
              {criticalCategories.length > 0
                ? `${criticalCategories.length} kategori perlu perhatian di seluruh project.`
                : "Semua kategori masih terkendali."}
            </div>
            <DashboardRowGroup>
              {data.categories.map((category) => (
                <CategoryUsageRow key={category.code} category={category} />
              ))}
            </DashboardRowGroup>
          </>
        )}
      </DashboardDetailSection>
    </div>
  );
}
