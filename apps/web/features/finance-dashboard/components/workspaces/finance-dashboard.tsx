"use client";

import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { useCan } from "@/components/auth/permissions-provider";
import React from "react";

import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import {
  AppIcon,
  Badge,
  BudgetSplitIndicator,
  Button,
  GroupedSurface,
  InlineStateRow,
  MoneyValue,
  PageHeader,
  SegmentedTabs,
} from "@/components/ui";
import { useDashboardRefresh } from "@/features/finance-dashboard/hooks/use-dashboard-refresh";
import type { DashboardPageTab } from "@/features/finance-dashboard/types/dashboard-types";
import { resolveDashboardDataStatus } from "@/features/finance-dashboard/utils/dashboard-data-status";
import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import { updateBrowserUrl, useUrlSearchParam } from "@/lib/utils/use-url-search-param";
import type { OwnerOnboardingOverview } from "@atria/core/onboarding/owner-onboarding";
import { ApprovalsTab } from "../tabs/dashboard-approvals-tab";
import { AccountsTab } from "../tabs/tab-accounts";
import { BudgetRiskTab } from "../tabs/tab-budget-risk";
import { CashDueTab } from "../tabs/tab-cash-due";
import { DashboardOverviewTab } from "../tabs/tab-overview";
import { MaterialsTab } from "../tabs/tab-materials";

function parseDashboardTab(value: string | null, canSeeApprovalQueue: boolean): DashboardPageTab {
  if (value === "approvals" && canSeeApprovalQueue) return "approvals";
  if (value === "budget" || value === "cash" || value === "accounts" || value === "materials")
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
  const can = useCan();
  const options: Array<{
    readonly value: DashboardPageTab;
    readonly label: string;
    readonly count?: number;
    readonly icon: React.ReactNode;
  }> = [
    {
      value: "overview",
      label: "Ringkasan",
      icon: <AppIcon name="space_dashboard" className="text-[15px]" />,
    },
  ];
  if (can("view:approval_queue")) {
    options.push({
      value: "approvals",
      label: "Persetujuan",
      count: approvalCount > 0 ? approvalCount : undefined,
      icon: <AppIcon name="approval" className="text-[15px]" />,
    });
  }
  options.push(
    {
      value: "budget",
      label: "Budget",
      count: data.dashboardTabs.counts.budget > 0 ? data.dashboardTabs.counts.budget : undefined,
      icon: <AppIcon name="monitoring" className="text-[15px]" />,
    },
    {
      value: "cash",
      label: "Jatuh Tempo",
      count: data.dashboardTabs.counts.cash > 0 ? data.dashboardTabs.counts.cash : undefined,
      icon: <AppIcon name="event_busy" className="text-[15px]" />,
    },
    {
      value: "accounts",
      label: "Rekening",
      icon: <AppIcon name="account_balance" className="text-[15px]" />,
    },
    {
      value: "materials",
      label: "Material",
      count:
        data.dashboardTabs.counts.materials > 0 ? data.dashboardTabs.counts.materials : undefined,
      icon: <AppIcon name="inventory_2" className="h-3.75 w-3.75" />,
    },
  );

  return (
    <SegmentedTabs
      value={activeTab}
      options={options}
      onChange={onChange}
      ariaLabel="Tab Dashboard"
      scrollable
      density="compact"
    />
  );
}

function PositionMetric({
  label,
  amount,
  danger = false,
}: {
  readonly label: string;
  readonly amount: number;
  readonly danger?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2 rounded-inset bg-white/8 p-3">
      <p className="text-[9px] leading-none font-bold tracking-[0.12em] text-white/52 uppercase">
        {label}
      </p>
      <MoneyValue
        amount={amount}
        variant="compact"
        tone={danger ? "danger" : "inverse"}
        size="sm"
      />
    </div>
  );
}

export function FinancialPosition({
  summary,
}: {
  readonly summary: FinanceDashboardOverview["summary"];
}): React.JSX.Element {
  const budgetDanger = summary.remainingBudget < 0 || summary.usedPercentage >= 100;
  return (
    <section
      className="relative isolate overflow-hidden rounded-owner bg-surface-inverse px-5 py-5 text-on-primary shadow-inverse ring-1 ring-white/8 max-[430px]:px-4 max-[430px]:py-4"
      aria-label="Posisi finansial"
    >
      <span
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/20"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-eyebrow font-bold tracking-[0.18em] text-white/52 uppercase">
          Kas tersedia
        </p>
        <MoneyValue
          amount={summary.cashAvailable}
          variant="fullDynamic"
          tone="inverse"
          size="hero"
          className="mt-1.5"
        />
      </div>

      <div className="mt-4 flex flex-row gap-3">
        <PositionMetric label="Piutang" amount={summary.receivablesOutstanding} />
        <PositionMetric label="Hutang" amount={summary.payablesOutstanding} />
        <PositionMetric
          label="≤ 7 hari"
          amount={summary.payablesDueSoon}
          danger={summary.payablesDueSoon > summary.cashAvailable}
        />
      </div>

      <div className="mt-4 rounded-inset bg-white/8 p-3.5 ring-1 ring-white/6 max-[430px]:mt-3 max-[430px]:p-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-row justify-between">
            <p className="text-[9px] leading-none font-bold tracking-wide text-white/50 uppercase">
              Budget aktif terpakai
            </p>
            <p className="text-[9px] leading-none font-bold tracking-wide text-white/50 uppercase">
              Sisa budget
            </p>
          </div>
          <div className="flex flex-row items-end justify-between">
            <p
              className={`mt-1 font-sans text-lg font-extrabold tracking-[-0.025em] tabular-nums max-[430px]:text-[16px] ${budgetDanger ? "text-critical-on-inverse" : "text-white"}`}
            >
              {summary.usedPercentage.toFixed(1)}%
            </p>
            <MoneyValue
              amount={summary.remainingBudget}
              variant="compact"
              tone={budgetDanger ? "danger" : "inverse"}
              align="right"
              size="sm"
              className="mt-1"
            />
          </div>
        </div>
        <BudgetSplitIndicator
          value={summary.usedPercentage}
          inverse
          danger={budgetDanger}
          usedAmount={summary.actualCost}
          remainingAmount={summary.remainingBudget}
        />
        <div className="mt-3 flex items-center justify-between gap-3 text-meta font-semibold text-white/58">
          <span>Project aktif</span>
          <span>Margin proyeksi {summary.projectedMarginPercentage.toFixed(1)}%</span>
        </div>
      </div>
    </section>
  );
}

function DataStatus({
  data,
  online,
  refreshFailed,
  refreshing,
  onRefresh,
}: {
  readonly data: FinanceDashboardOverview;
  readonly online: boolean;
  readonly refreshFailed: boolean;
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
}): React.JSX.Element | null {
  const status = resolveDashboardDataStatus({
    generatedAt: data.generatedAt,
    partial: data.dataQuality.partial,
    unavailableSources: data.dataQuality.unavailableSources,
    online,
    refreshFailed,
    refreshing,
  });

  if (!status) return null;

  return (
    <div role="status" aria-live="polite" aria-label={status.accessibleLabel}>
      <GroupedSurface>
        <InlineStateRow
          icon={status.icon}
          title={status.title}
          description={status.description}
          tone={status.kind === "OFFLINE" ? "neutral" : "warning"}
          action={
            status.retryable ? (
              <Button
                type="button"
                variant="tertiary"
                size="compact"
                pending={refreshing}
                pendingLabel="Memuat…"
                onClick={onRefresh}
              >
                Coba lagi
              </Button>
            ) : undefined
          }
        />
      </GroupedSurface>
    </div>
  );
}

export function FinanceDashboard({
  data,
  userName,
  onboarding,
}: {
  readonly data: FinanceDashboardOverview;
  readonly userName: string;
  readonly onboarding: OwnerOnboardingOverview | null;
}): React.JSX.Element {
  const can = useCan();
  const tabParam = useUrlSearchParam("tab");
  const { online, refreshFailed, refreshing, refresh } = useDashboardRefresh(data.generatedAt);
  const [referenceDate] = React.useState(() => new Date());
  const [approvals, setApprovals] = React.useState<readonly ApprovalDetail[]>(
    data.dashboardDetails.approvals,
  );
  const [approvalSummary, setApprovalSummary] = React.useState(
    data.dashboardDetails.approvalSummary,
  );
  const activeTab = parseDashboardTab(tabParam, can("view:approval_queue"));
  const today = referenceDate.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  function changeTab(value: DashboardPageTab): void {
    updateBrowserUrl(value === "overview" ? "/ledger" : `/ledger?tab=${value}`, "replace");
  }

  const tabContent =
    activeTab === "overview" ? (
      <DashboardOverviewTab
        data={data}
        financialPosition={<FinancialPosition summary={data.summary} />}
        onboarding={onboarding}
      />
    ) : activeTab === "approvals" && can("view:approval_queue") ? (
      <ApprovalsTab
        approvals={approvals}
        approvalSummary={approvalSummary}
        setApprovals={setApprovals}
        setApprovalSummary={setApprovalSummary}
        canEmergencyOverride={can("override:self_approval")}
      />
    ) : activeTab === "budget" ? (
      <BudgetRiskTab data={data} />
    ) : activeTab === "cash" ? (
      <CashDueTab data={data} referenceDate={referenceDate} />
    ) : activeTab === "accounts" ? (
      <AccountsTab data={data} />
    ) : (
      <MaterialsTab data={data} />
    );

  return (
    <div className="dashboard-density space-y-sm pb-8 max-[430px]:-mx-1 max-[430px]:pb-6">
      <PageHeader
        title={`Halo, ${userName.split(" ")[0]}`}
        subtitle={today}
        action={<Badge status="PRIMARY">{formatBusinessLabel(data.role)}</Badge>}
      />
      <DashboardTabsNav
        activeTab={activeTab}
        approvalCount={approvalSummary.totalCount}
        data={data}
        onChange={changeTab}
      />
      <DataStatus
        data={data}
        online={online}
        refreshFailed={refreshFailed}
        refreshing={refreshing}
        onRefresh={refresh}
      />
      <div>{tabContent}</div>
    </div>
  );
}
