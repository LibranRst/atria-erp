"use client";

import { useRouter } from "next/navigation";
import React from "react";

import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import { Badge } from "@/components/ui";
import { MoneyValue, PageHeader } from "@/components/ui/page-primitives";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { BudgetSplitIndicator } from "@/features/finance-dashboard/components/dashboard-budget-indicators";
import type { DashboardPageTab } from "@/features/finance-dashboard/lib/dashboard-types";
import { resolveDashboardDataStatus } from "@/features/finance-dashboard/lib/dashboard-data-status";
import type { ApprovalDetail } from "@/lib/finance/approval-types";
import { updateBrowserUrl, useUrlSearchParam } from "@/lib/utils/use-url-search-param";
import {
  AccountsTab,
  ApprovalsTab,
  BudgetRiskTab,
  CashDueTab,
  DashboardOverviewTab,
  MaterialsTab,
} from "./dashboard-tabs";

function parseDashboardTab(value: string | null, role: FinanceDashboardOverview["role"]): DashboardPageTab {
  if (value === "approvals" && role === "OWNER") return "approvals";
  if (value === "budget" || value === "cash" || value === "accounts" || value === "materials") return value;
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
    { value: "overview", label: "Ringkasan", icon: <span className="material-symbols-outlined text-[15px]">space_dashboard</span> },
  ];
  if (data.role === "OWNER") {
    options.push({
      value: "approvals",
      label: "Persetujuan",
      count: approvalCount > 0 ? approvalCount : undefined,
      icon: <span className="material-symbols-outlined text-[15px]">approval</span>,
    });
  }
  options.push(
    {
      value: "budget",
      label: "Budget",
      count: data.dashboardTabs.counts.budget > 0 ? data.dashboardTabs.counts.budget : undefined,
      icon: <span className="material-symbols-outlined text-[15px]">monitoring</span>,
    },
    {
      value: "cash",
      label: "Jatuh Tempo",
      count: data.dashboardTabs.counts.cash > 0 ? data.dashboardTabs.counts.cash : undefined,
      icon: <span className="material-symbols-outlined text-[15px]">event_busy</span>,
    },
    { value: "accounts", label: "Rekening", icon: <span className="material-symbols-outlined text-[15px]">account_balance</span> },
    {
      value: "materials",
      label: "Material",
      count: data.dashboardTabs.counts.materials > 0 ? data.dashboardTabs.counts.materials : undefined,
      icon: <span className="material-symbols-outlined text-[15px]">inventory_2</span>,
    },
  );

  return <SegmentedTabs value={activeTab} options={options} onChange={onChange} ariaLabel="Tab Dashboard" scrollable density="compact" />;
}

function PositionMetric({ label, amount, danger = false }: { readonly label: string; readonly amount: number; readonly danger?: boolean }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/52">{label}</p>
      <MoneyValue
        amount={amount}
        variant="compactWithFull"
        tone={danger ? "danger" : "inverse"}
        size="sm"
        className="mt-1"
      />
    </div>
  );
}

export function FinancialPosition({ summary }: { readonly summary: FinanceDashboardOverview["summary"] }): React.JSX.Element {
  const budgetDanger = summary.remainingBudget < 0 || summary.usedPercentage >= 100;
  return (
    <section className="relative isolate overflow-hidden rounded-[30px] bg-[#151719] px-5 py-5 text-on-primary shadow-[0_2px_4px_rgba(17,17,17,0.12),0_20px_48px_rgba(17,17,17,0.16)] ring-1 ring-white/[0.08] max-[430px]:rounded-[26px] max-[430px]:px-4 max-[430px]:py-4" aria-label="Posisi finansial">
      <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/20" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/52">Kas tersedia</p>
        <MoneyValue amount={summary.cashAvailable} variant="fullDynamic" tone="inverse" size="hero" className="mt-1.5" />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.08] pt-4 max-[430px]:mt-4 max-[430px]:gap-2.5 max-[430px]:pt-3">
        <PositionMetric label="Piutang" amount={summary.receivablesOutstanding} />
        <PositionMetric label="Hutang" amount={summary.payablesOutstanding} />
        <PositionMetric label="≤ 7 hari" amount={summary.payablesDueSoon} danger={summary.payablesDueSoon > summary.cashAvailable} />
      </div>

      <div className="mt-4 rounded-[22px] bg-white/[0.075] p-3.5 ring-1 ring-white/[0.06] backdrop-blur-md max-[430px]:mt-3 max-[430px]:rounded-[20px] max-[430px]:p-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wide text-white/50">Budget aktif terpakai</p>
            <p className={`mt-1 font-mono text-lg font-black max-[430px]:text-[16px] ${budgetDanger ? "text-[#ff9f96]" : "text-white"}`}>
              {summary.usedPercentage.toFixed(1)}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold uppercase tracking-wide text-white/50">Sisa budget</p>
            <MoneyValue amount={summary.remainingBudget} variant="compactWithFull" tone={budgetDanger ? "danger" : "inverse"} align="right" size="sm" className="mt-1" />
          </div>
        </div>
        <BudgetSplitIndicator value={summary.usedPercentage} inverse danger={budgetDanger} />
        <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-semibold text-white/58">
          <span>Project aktif</span>
          <span>Margin proyeksi {summary.projectedMarginPercentage.toFixed(1)}%</span>
        </div>
      </div>
    </section>
  );
}

function DataStatus({ data, refreshing, onRefresh }: { readonly data: FinanceDashboardOverview; readonly refreshing: boolean; readonly onRefresh: () => void }): React.JSX.Element | null {
  const [currentTime, setCurrentTime] = React.useState<Date | null>(null);
  React.useEffect(() => {
    const update = (): void => setCurrentTime(new Date());
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, []);
  const status = resolveDashboardDataStatus({
    generatedAt: data.generatedAt,
    currentTime: currentTime ?? new Date(data.generatedAt),
    partial: data.dataQuality.partial,
    unavailableSources: data.dataQuality.unavailableSources,
    refreshing,
  });

  if (!status) return null;

  return (
    <div className="flex h-8 items-center gap-2 px-1 text-warning" role="status" aria-live="polite" aria-label={status.accessibleLabel}>
      <span className="material-symbols-outlined text-[15px]" aria-hidden="true">{status.icon}</span>
      <p className="min-w-0 flex-1 truncate text-[10px] font-bold">{status.label}</p>
      <button
        type="button"
        disabled={refreshing}
        onClick={onRefresh}
        aria-label="Perbarui data Dashboard"
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-warning outline-none after:absolute after:-inset-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-warning/30 disabled:opacity-45"
      >
        <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
          {refreshing ? "sync" : "refresh"}
        </span>
      </button>
    </div>
  );
}

export function FinanceDashboard({ data, userName }: { readonly data: FinanceDashboardOverview; readonly userName: string }): React.JSX.Element {
  const tabParam = useUrlSearchParam("tab");
  const router = useRouter();
  const [refreshing, startRefresh] = React.useTransition();
  const [referenceDate] = React.useState(() => new Date());
  const [approvals, setApprovals] = React.useState<readonly ApprovalDetail[]>(data.dashboardDetails.approvals);
  const [approvalCount, setApprovalCount] = React.useState(data.dashboardTabs.counts.approvals);
  const activeTab = parseDashboardTab(tabParam, data.role);
  const today = referenceDate.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

  function changeTab(value: DashboardPageTab): void {
    updateBrowserUrl(value === "overview" ? "/ledger" : `/ledger?tab=${value}`, "replace");
  }

  function refresh(): void {
    startRefresh(() => router.refresh());
  }

  const tabContent = activeTab === "overview"
    ? <DashboardOverviewTab data={data} financialPosition={<FinancialPosition summary={data.summary} />} />
    : activeTab === "approvals" && data.role === "OWNER"
      ? <ApprovalsTab approvals={approvals} approvalCount={approvalCount} setApprovals={setApprovals} setApprovalCount={setApprovalCount} />
      : activeTab === "budget"
        ? <BudgetRiskTab data={data} />
        : activeTab === "cash"
          ? <CashDueTab data={data} referenceDate={referenceDate} />
          : activeTab === "accounts"
            ? <AccountsTab data={data} />
            : <MaterialsTab data={data} />;

  return (
    <div className="dashboard-density space-y-lg pb-8 max-[430px]:-mx-1 max-[430px]:space-y-5 max-[430px]:pb-6">
      <PageHeader title={`Halo, ${userName.split(" ")[0]}`} subtitle={today} action={<Badge status="PRIMARY">{data.role === "OWNER" ? "OWNER" : "FINANCE"}</Badge>} />
      <DashboardTabsNav activeTab={activeTab} approvalCount={approvalCount} data={data} onChange={changeTab} />
      {activeTab === "overview" ? <DataStatus data={data} refreshing={refreshing} onRefresh={refresh} /> : null}
      <div>{tabContent}</div>
    </div>
  );
}
