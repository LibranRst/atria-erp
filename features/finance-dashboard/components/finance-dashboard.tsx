"use client";

import React from "react";

import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import { Badge } from "@/components/ui";
import {
  MetricGrid,
  MoneyMetricPill,
  MoneyValue,
  NativeSection,
  PageHeader,
} from "@/components/ui/page-primitives";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
  AiBriefGradientBackdrop,
  formatAiInsightDate,
} from "@/features/finance-dashboard/components/ai-brief";
import {
  EmptyRow,
  RiskBriefList,
} from "@/features/finance-dashboard/components/dashboard-cards";
import { shortMoney } from "@/features/finance-dashboard/lib/dashboard-formatters";
import type { DashboardPageTab } from "@/features/finance-dashboard/lib/dashboard-types";
import type { ApprovalDetail } from "@/lib/finance/approval-types";
import {
  updateBrowserUrl,
  useUrlSearchParam,
} from "@/lib/utils/use-url-search-param";
import {
  ApprovalsTab,
  AccountsTab,
  BudgetRiskTab,
  CashDueTab,
  DashboardOverviewTab,
  MaterialsTab,
} from "./dashboard-tabs";

function parseDashboardTab(
  value: string | null,
  role: FinanceDashboardOverview["role"],
): DashboardPageTab {
  if (value === "approvals" && role === "OWNER") return "approvals";
  if (
    value === "budget" ||
    value === "cash" ||
    value === "accounts" ||
    value === "materials"
  )
    return value;
  return "overview";
}

function DashboardTabsNav({
  activeTab,
  approvalCount,
  data,
  onChange,
}: {
  readonly activeTab: DashboardPageTab;
  readonly approvalCount: number;
  readonly data: FinanceDashboardOverview;
  readonly onChange: (value: DashboardPageTab) => void;
}): React.JSX.Element {
  const options: Array<{
    readonly value: DashboardPageTab;
    readonly label: string;
    readonly count?: number;
    readonly icon: React.ReactNode;
  }> = [
    {
      value: "overview",
      label: "Ringkasan",
      icon: (
        <span className="material-symbols-outlined text-[15px]">dashboard</span>
      ),
    },
  ];
  if (data.role === "OWNER") {
    options.push({
      value: "approvals",
      label: "Approval",
      count: approvalCount,
      icon: (
        <span className="material-symbols-outlined text-[15px]">approval</span>
      ),
    });
  }
  options.push(
    {
      value: "budget",
      label: "Budget",
      count: data.dashboardTabs.counts.budget,
      icon: (
        <span className="material-symbols-outlined text-[15px]">
          monitoring
        </span>
      ),
    },
    {
      value: "cash",
      label: "Jatuh Tempo",
      count: data.dashboardTabs.counts.cash,
      icon: (
        <span className="material-symbols-outlined text-[15px]">
          event_busy
        </span>
      ),
    },
    {
      value: "accounts",
      label: "Rekening",
      count: data.dashboardTabs.counts.accounts,
      icon: (
        <span className="material-symbols-outlined text-[15px]">
          account_balance
        </span>
      ),
    },
    {
      value: "materials",
      label: "Material",
      count: data.dashboardTabs.counts.materials,
      icon: (
        <span className="material-symbols-outlined text-[15px]">
          inventory_2
        </span>
      ),
    },
  );

  return (
    <SegmentedTabs
      value={activeTab}
      options={options}
      onChange={onChange}
      ariaLabel="Dashboard tabs"
      scrollable
    />
  );
}

export function FinancialPulse({
  summary,
}: {
  readonly summary: FinanceDashboardOverview["summary"];
}): React.JSX.Element {
  return (
    <section
      className="overflow-hidden rounded-[28px] bg-primary p-md text-on-primary shadow-[0_14px_34px_rgba(17,17,17,0.045)]"
      aria-label="Ringkasan finansial"
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/60">
        Kas tersedia
      </p>
      <MoneyValue
        amount={summary.cashAvailable}
        variant="fullDynamic"
        tone="inverse"
        size="hero"
        className="mt-1"
      />
      <div className="mt-md grid grid-cols-2 gap-2 border-t border-white/10 pt-md">
        <Money
          label="Piutang terbuka"
          value={summary.receivablesOutstanding}
          inverse
        />
        <Money
          label="Hutang terbuka"
          value={summary.payablesOutstanding}
          inverse
        />
      </div>
      <div className="mt-md rounded-2xl bg-white/8 p-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wide text-white/55">
              Budget aktif terpakai
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold">
              {summary.usedPercentage.toFixed(1)}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold uppercase tracking-wide text-white/55">
              Sisa budget
            </p>
            <MoneyValue
              amount={summary.remainingBudget}
              variant="compactWithFull"
              tone={summary.remainingBudget < 0 ? "danger" : "inverse"}
              align="right"
              size="sm"
              className="mt-0.5"
            />
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
          <div
            className={`h-full rounded-full ${summary.remainingBudget < 0 ? "bg-error" : "bg-white"}`}
            style={{
              width: `${Math.min(Math.max(summary.usedPercentage, 0), 100)}%`,
            }}
          />
        </div>
        <div className="mt-3 flex justify-between gap-3 text-[10px] text-white/65">
          <span>Nilai proyek aktif {shortMoney(summary.projectValue)}</span>
          <span>Margin {summary.projectedMarginPercentage.toFixed(1)}%</span>
        </div>
      </div>
    </section>
  );
}

export function FinanceDashboard({
  data,
  userName,
}: {
  readonly data: FinanceDashboardOverview;
  readonly userName: string;
}): React.JSX.Element {
  const tabParam = useUrlSearchParam("tab");
  const [referenceDate] = React.useState(() => new Date());
  const [aiInsightOpen, setAiInsightOpen] = React.useState(false);
  const [approvals, setApprovals] = React.useState<readonly ApprovalDetail[]>(
    data.dashboardDetails.approvals,
  );
  const [approvalCount, setApprovalCount] = React.useState(
    data.dashboardTabs.counts.approvals,
  );
  const activeTab = parseDashboardTab(tabParam, data.role);

  const today = referenceDate.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  function changeTab(value: DashboardPageTab): void {
    const nextUrl = value === "overview" ? "/ledger" : `/ledger?tab=${value}`;
    updateBrowserUrl(nextUrl, "replace");
  }

  return (
    <div className="space-y-lg pb-8">
      <PageHeader
        title={`Halo, ${userName.split(" ")[0]}`}
        subtitle={today}
        action={<Badge status={"PRIMARY"}>{data.role}</Badge>}
      />
      <DashboardTabsNav
        activeTab={activeTab}
        approvalCount={approvalCount}
        data={data}
        onChange={changeTab}
      />
      {activeTab === "overview" && (
        <DashboardOverviewTab
          data={data}
          aiInsightOpen={aiInsightOpen}
          setAiInsightOpen={setAiInsightOpen}
          financialPulse={<FinancialPulse summary={data.summary} />}
        />
      )}
      {activeTab === "approvals" && data.role === "OWNER" && (
        <ApprovalsTab
          approvals={approvals}
          approvalCount={approvalCount}
          setApprovals={setApprovals}
          setApprovalCount={setApprovalCount}
        />
      )}
      {activeTab === "budget" && <BudgetRiskTab data={data} />}
      {activeTab === "cash" && (
        <CashDueTab data={data} referenceDate={referenceDate} />
      )}
      {activeTab === "accounts" && <AccountsTab data={data} />}
      {activeTab === "materials" && <MaterialsTab data={data} />}
    </div>
  );
}

function Money({
  label,
  value,
  inverse = false,
}: {
  readonly label: string;
  readonly value: number;
  readonly inverse?: boolean;
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <p
        className={`text-[9px] font-bold uppercase tracking-wide ${inverse ? "text-white/55" : "text-on-surface-variant"}`}
      >
        {label}
      </p>
      <MoneyValue
        amount={value}
        variant="compactWithFull"
        tone={inverse ? "inverse" : "default"}
        className="mt-1"
      />
    </div>
  );
}

export function FinanceAnalysis({
  data,
}: {
  readonly data: FinanceDashboardOverview;
}): React.JSX.Element {
  return (
    <div className="space-y-lg pb-8">
      <PageHeader
        eyebrow="Analisis finansial"
        title="CFO Brief"
        subtitle="Ringkasan portfolio aktif dan posisi kas perusahaan."
      />
      {data.aiInsight && (
        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#070707] p-6 text-white shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
          <AiBriefGradientBackdrop visible={true} />
          <div className="relative z-10 flex w-full flex-col space-y-5">
            <div className="flex w-full items-center gap-3">
              <span className="material-symbols-outlined shrink-0 text-[18px] text-white/80">
                auto_awesome
              </span>
              <div className="min-w-0">
                <h2 className="text-[10px] font-bold uppercase leading-normal tracking-[0.18em] text-white/45">
                  AI CFO Brief
                </h2>
                <p className="mt-1 flex items-center gap-2 text-[11px] font-semibold leading-normal text-white/65">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  {formatAiInsightDate(data.aiInsight.date)}
                </p>
              </div>
            </div>

            <p className="whitespace-pre-wrap text-[13px] leading-6 tracking-normal text-white/85">
              {data.aiInsight.summary}
            </p>
          </div>
        </section>
      )}
      <NativeSection>
        <MetricGrid minColumnWidth={132}>
          <MoneyMetricPill
            label="Kas"
            amount={data.summary.cashAvailable}
          />
          <MoneyMetricPill
            label="Piutang"
            amount={data.summary.receivablesOutstanding}
          />
          <MoneyMetricPill
            label="Hutang"
            amount={data.summary.payablesOutstanding}
          />
          <MoneyMetricPill
            label="Sisa budget"
            amount={data.summary.remainingBudget}
            tone={data.summary.remainingBudget < 0 ? "danger" : "default"}
          />
        </MetricGrid>
      </NativeSection>
      <NativeSection title="Risiko utama">
        {data.actions.length === 0 ? (
          <EmptyRow>Tidak ada risiko aktif.</EmptyRow>
        ) : (
          <RiskBriefList actions={data.actions} />
        )}
      </NativeSection>
    </div>
  );
}
