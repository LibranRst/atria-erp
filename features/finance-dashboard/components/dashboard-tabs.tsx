"use client";

import React from "react";

import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import {
  fullMoney,
  shortMoney,
} from "@/features/finance-dashboard/lib/dashboard-formatters";
import {
  DashboardDetailSection,
  DashboardRowGroup,
  DashboardTabShell,
  OverviewPreviewSection,
  type DashboardMetricItem,
} from "@/features/finance-dashboard/components/dashboard-primitives";
import { AiInsightCard } from "@/features/finance-dashboard/components/ai-brief";
export { ApprovalsTab } from "@/features/finance-dashboard/components/dashboard-approvals-tab";
import {
  OverviewCashRows,
  OverviewPreviewEmpty,
  OverviewPriorityList,
} from "@/features/finance-dashboard/components/dashboard-cards";
import { BankAccountsControl } from "@/features/finance-dashboard/components/bank-accounts-control";
import {
  CashDueRow,
  CategoryUsageRow,
  DashboardTabEmpty,
  MaterialIssueRow,
  ProjectRiskRow,
} from "@/features/finance-dashboard/components/dashboard-rows";

export function DashboardOverviewTab({
  data,
  aiInsightOpen,
  setAiInsightOpen,
  financialPulse,
}: {
  readonly data: FinanceDashboardOverview;
  readonly aiInsightOpen: boolean;
  readonly setAiInsightOpen: (value: boolean) => void;
  readonly financialPulse: React.ReactNode;
}): React.JSX.Element {
  const priorityHref =
    data.role === "OWNER" ? "/ledger?tab=approvals" : "/ledger?tab=cash";

  return (
    <div className="space-y-lg">
      {financialPulse}
      <OverviewPreviewSection
        title={data.role === "OWNER" ? "Perlu keputusan" : "Prioritas finance"}
        href={priorityHref}
      >
        {data.actions.length === 0 ? (
          <OverviewPreviewEmpty>
            Tidak ada pekerjaan kritis saat ini.
          </OverviewPreviewEmpty>
        ) : (
          <OverviewPriorityList actions={data.actions} />
        )}
      </OverviewPreviewSection>

      <OverviewPreviewSection
        title="Proyek berisiko"
        href="/ledger?tab=budget"
      >
        {data.riskyProjects.length === 0 ? (
          <OverviewPreviewEmpty>
            Semua proyek aktif berada dalam kondisi aman.
          </OverviewPreviewEmpty>
        ) : (
          <DashboardRowGroup>
            {data.riskyProjects.map((project) => (
              <ProjectRiskRow key={project.projectId} project={project} />
            ))}
          </DashboardRowGroup>
        )}
      </OverviewPreviewSection>

      <AiInsightCard
        data={data}
        open={aiInsightOpen}
        setOpen={setAiInsightOpen}
      />

      <OverviewPreviewSection
        title="Rekening bank"
        href="/ledger?tab=accounts"
        unframed={data.bankAccounts && data.bankAccounts.length > 0}
      >
        {!data.bankAccounts || data.bankAccounts.length === 0 ? (
          <OverviewPreviewEmpty>
            Belum ada rekening bank yang terdaftar.
          </OverviewPreviewEmpty>
        ) : (
          <BankAccountsControl
            accounts={data.bankAccounts}
            role={data.role}
            variant="preview"
          />
        )}
      </OverviewPreviewSection>

      <OverviewPreviewSection
        title="Aktivitas kas terbaru"
        href="/ledger?tab=cash"
      >
        {data.recentTransactions.length === 0 ? (
          <OverviewPreviewEmpty>Belum ada transaksi kas.</OverviewPreviewEmpty>
        ) : (
          <OverviewCashRows transactions={data.recentTransactions} />
        )}
      </OverviewPreviewSection>
    </div>
  );
}

export function BudgetRiskTab({
  data,
}: {
  readonly data: FinanceDashboardOverview;
}): React.JSX.Element {
  const criticalCategories = data.categories.filter(
    (category) =>
      category.status === "CRITICAL" || category.status === "OVER_BUDGET",
  );
  const metrics: readonly DashboardMetricItem[] = [
    {
      label: "Proyek",
      value: String(data.dashboardDetails.budgetRisks.length),
      tone: data.dashboardDetails.budgetRisks.length > 0 ? "danger" : "default",
    },
    {
      label: "Kategori",
      value: String(criticalCategories.length),
      tone: criticalCategories.length > 0 ? "danger" : "default",
    },
    {
      label: "Used",
      value: `${data.summary.usedPercentage.toFixed(0)}%`,
      tone:
        data.summary.usedPercentage >= 100
          ? "danger"
          : data.summary.usedPercentage >= 75
            ? "warning"
            : "positive",
    },
  ];

  return (
    <DashboardTabShell metrics={metrics}>
      <DashboardDetailSection
        title="Proyek berisiko"
        href="/projects?filter=WARNING"
        actionLabel="Lihat semua"
      >
        {data.dashboardDetails.budgetRisks.length === 0 ? (
          <DashboardTabEmpty>
            Semua proyek aktif berada dalam kondisi aman.
          </DashboardTabEmpty>
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
        actionLabel="Lihat semua"
      >
        {data.categories.length === 0 ? (
          <DashboardTabEmpty>
            Budget kategori proyek aktif belum tersedia.
          </DashboardTabEmpty>
        ) : (
          <DashboardRowGroup>
            {data.categories.map((category, index) => (
              <CategoryUsageRow
                key={`${category.code}-${index}`}
                category={category}
              />
            ))}
          </DashboardRowGroup>
        )}
      </DashboardDetailSection>
    </DashboardTabShell>
  );
}

export function AccountsTab({
  data,
}: {
  readonly data: FinanceDashboardOverview;
}): React.JSX.Element {
  return (
    <BankAccountsControl
      accounts={data.bankAccounts}
      role={data.role}
      variant="tab"
    />
  );
}

export function CashDueTab({
  data,
  referenceDate,
}: {
  readonly data: FinanceDashboardOverview;
  readonly referenceDate: Date;
}): React.JSX.Element {
  const overduePayables = data.dashboardDetails.cashDue.filter(
    (item) => item.type === "payable",
  );
  const overdueReceivables = data.dashboardDetails.cashDue.filter(
    (item) => item.type === "receivable",
  );
  const totalPayableOutstanding = overduePayables.reduce(
    (sum, item) => sum + item.outstandingAmount,
    0,
  );
  const totalReceivableOutstanding = overdueReceivables.reduce(
    (sum, item) => sum + item.outstandingAmount,
    0,
  );
  const metrics: readonly DashboardMetricItem[] = [
    {
      label: "Hutang",
      value: shortMoney(totalPayableOutstanding),
      kind: "money",
      amount: totalPayableOutstanding,
      fullValue: fullMoney.format(totalPayableOutstanding),
      tone: totalPayableOutstanding > 0 ? "danger" : "default",
    },
    {
      label: "Piutang",
      value: shortMoney(totalReceivableOutstanding),
      kind: "money",
      amount: totalReceivableOutstanding,
      fullValue: fullMoney.format(totalReceivableOutstanding),
      tone: totalReceivableOutstanding > 0 ? "warning" : "default",
    },
    {
      label: "Transaksi",
      value: String(data.recentTransactions.length),
      tone: data.recentTransactions.length > 0 ? "positive" : "default",
    },
  ];

  return (
    <DashboardTabShell metrics={metrics}>
      <DashboardDetailSection
        title="Hutang vendor overdue"
        href="/expenses?view=vendor-bills"
        actionLabel="Lihat semua"
      >
        {overduePayables.length === 0 ? (
          <DashboardTabEmpty>
            Tidak ada hutang vendor overdue.
          </DashboardTabEmpty>
        ) : (
          <DashboardRowGroup>
            {overduePayables.map((item) => (
              <CashDueRow
                key={`${item.type}-${item.id}`}
                item={item}
                referenceDate={referenceDate}
              />
            ))}
          </DashboardRowGroup>
        )}
      </DashboardDetailSection>
      <DashboardDetailSection
        title="Piutang client overdue"
        href="/projects?filter=ACTIVE"
        actionLabel="Lihat semua"
      >
        {overdueReceivables.length === 0 ? (
          <DashboardTabEmpty>
            Tidak ada piutang client overdue.
          </DashboardTabEmpty>
        ) : (
          <DashboardRowGroup>
            {overdueReceivables.map((item) => (
              <CashDueRow
                key={`${item.type}-${item.id}`}
                item={item}
                referenceDate={referenceDate}
              />
            ))}
          </DashboardRowGroup>
        )}
      </DashboardDetailSection>
      <DashboardDetailSection
        title="Aktivitas kas terbaru"
        href="/ledger?brief=true"
        actionLabel="Analisis"
      >
        {data.recentTransactions.length === 0 ? (
          <DashboardTabEmpty>Belum ada transaksi kas.</DashboardTabEmpty>
        ) : (
          <OverviewCashRows
            transactions={data.recentTransactions}
            rowClassName="flex min-h-[56px] items-center gap-3 px-4 py-3.5"
          />
        )}
      </DashboardDetailSection>
    </DashboardTabShell>
  );
}

export function MaterialsTab({
  data,
}: {
  readonly data: FinanceDashboardOverview;
}): React.JSX.Element {
  const rapShortages = data.dashboardDetails.materials.filter(
    (item) => item.type === "RAP_SHORTAGE",
  );
  const lowStockItems = data.dashboardDetails.materials.filter(
    (item) => item.type === "LOW_STOCK",
  );
  const metrics: readonly DashboardMetricItem[] = [
    {
      label: "RAP",
      value: String(data.stockIssues.materialShortageCount),
      tone: data.stockIssues.materialShortageCount > 0 ? "warning" : "default",
    },
    {
      label: "Low stock",
      value: String(data.stockIssues.lowStockCount),
      tone: data.stockIssues.lowStockCount > 0 ? "warning" : "default",
    },
    {
      label: "Reusable",
      value: shortMoney(data.stockIssues.reusableStockValue),
      kind: "money",
      amount: data.stockIssues.reusableStockValue,
      fullValue: fullMoney.format(data.stockIssues.reusableStockValue),
      tone: data.stockIssues.reusableStockValue > 0 ? "positive" : "default",
    },
  ];

  return (
    <DashboardTabShell metrics={metrics}>
      <DashboardDetailSection
        title="RAP shortage"
        href="/materials?tab=needs"
        actionLabel="Lihat semua"
      >
        {rapShortages.length === 0 ? (
          <DashboardTabEmpty>Tidak ada shortage RAP.</DashboardTabEmpty>
        ) : (
          <DashboardRowGroup>
            {rapShortages.map((item) => (
              <MaterialIssueRow key={item.id} item={item} />
            ))}
          </DashboardRowGroup>
        )}
      </DashboardDetailSection>
      <DashboardDetailSection
        title="Low stock"
        href="/materials?tab=inventory"
        actionLabel="Lihat semua"
      >
        {lowStockItems.length === 0 ? (
          <DashboardTabEmpty>Tidak ada low-stock material.</DashboardTabEmpty>
        ) : (
          <DashboardRowGroup>
            {lowStockItems.map((item) => (
              <MaterialIssueRow key={item.id} item={item} />
            ))}
          </DashboardRowGroup>
        )}
      </DashboardDetailSection>
    </DashboardTabShell>
  );
}
