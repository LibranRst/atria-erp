"use client";

import React from "react";

import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import { MoneyValue } from "@/components/ui/page-primitives";
import { BankAccountsControl } from "@/features/finance-dashboard/components/bank-accounts-control";
import { BudgetSplitIndicator } from "@/features/finance-dashboard/components/dashboard-budget-indicators";
import {
  DashboardDetailSection,
  DashboardRowGroup,
  DashboardSummarySurface,
  OverviewPreviewSection,
} from "@/features/finance-dashboard/components/dashboard-primitives";
import {
  OverviewCashRows,
  OverviewPreviewEmpty,
  OverviewPriorityList,
} from "@/features/finance-dashboard/components/dashboard-cards";
import {
  CashDueRow,
  CategoryUsageRow,
  DashboardTabEmpty,
  MaterialIssueRow,
  ProjectRiskRow,
} from "@/features/finance-dashboard/components/dashboard-rows";
import { shortMoney } from "@/features/finance-dashboard/lib/dashboard-formatters";

export { ApprovalsTab } from "@/features/finance-dashboard/components/dashboard-approvals-tab";

function SummaryFact({ label, value, tone = "default" }: { readonly label: string; readonly value: string; readonly tone?: "default" | "danger" | "warning" | "positive" }): React.JSX.Element {
  const toneClass = tone === "danger" ? "text-error" : tone === "warning" ? "text-warning" : tone === "positive" ? "text-success" : "text-on-surface";
  return (
    <div className="min-w-0">
      <p className="truncate text-[9px] font-bold uppercase tracking-wide text-on-surface-variant/55">{label}</p>
      <p className={`mt-1 truncate font-mono text-sm font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

export function DashboardOverviewTab({ data, financialPosition }: { readonly data: FinanceDashboardOverview; readonly financialPosition: React.ReactNode }): React.JSX.Element {
  const nextDue = data.dashboardDetails.cashDueGroups.flatMap((group) => group.items).slice(0, 3);
  const materialAttention = data.dashboardDetails.materials.filter((item) => item.severity !== "INFO").slice(0, 3);
  return (
    <div className="space-y-lg max-[430px]:space-y-5">
      {financialPosition}
      <OverviewPreviewSection title={data.role === "OWNER" ? "Perlu keputusan" : "Prioritas finance"} href={data.role === "OWNER" ? "/ledger?tab=approvals" : "/ledger?tab=cash"}>
        {data.actions.length === 0 ? <OverviewPreviewEmpty>Tidak ada tindakan mendesak. Kondisi utama sudah terkendali.</OverviewPreviewEmpty> : <OverviewPriorityList actions={data.actions} />}
      </OverviewPreviewSection>
      <OverviewPreviewSection title="Budget berisiko" href="/ledger?tab=budget">
        {data.riskyProjects.length === 0 ? <OverviewPreviewEmpty>Semua project aktif masih dalam batas budget.</OverviewPreviewEmpty> : (
          <DashboardRowGroup>{data.riskyProjects.slice(0, 3).map((project) => <ProjectRiskRow key={project.projectId} project={project} compact />)}</DashboardRowGroup>
        )}
      </OverviewPreviewSection>
      <OverviewPreviewSection title="Jatuh tempo terdekat" href="/ledger?tab=cash">
        {nextDue.length === 0 ? <OverviewPreviewEmpty>Tidak ada tagihan atau invoice terbuka.</OverviewPreviewEmpty> : (
          <DashboardRowGroup connected>{nextDue.map((item) => <CashDueRow key={`${item.type}-${item.id}`} item={item} referenceDate={new Date(data.generatedAt)} compact />)}</DashboardRowGroup>
        )}
      </OverviewPreviewSection>
      <OverviewPreviewSection title="Perhatian material" href="/ledger?tab=materials">
        {materialAttention.length === 0 ? <OverviewPreviewEmpty>Tidak ada masalah material aktif.</OverviewPreviewEmpty> : (
          <DashboardRowGroup>{materialAttention.map((item) => <MaterialIssueRow key={item.id} item={item} compact />)}</DashboardRowGroup>
        )}
      </OverviewPreviewSection>
      <OverviewPreviewSection title="Perubahan kas terbaru" href="/ledger?tab=accounts">
        {data.recentTransactions.length === 0 ? <OverviewPreviewEmpty>Belum ada transaksi kas.</OverviewPreviewEmpty> : <OverviewCashRows transactions={data.recentTransactions.slice(0, 3)} />}
      </OverviewPreviewSection>
    </div>
  );
}

export function BudgetRiskTab({ data }: { readonly data: FinanceDashboardOverview }): React.JSX.Element {
  const criticalCategories = data.categories.filter((category) => category.status === "CRITICAL" || category.status === "OVER_BUDGET");
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
        <div className="grid grid-cols-2 divide-x divide-black/[0.055] rounded-[20px] bg-surface-container-low/65 px-3.5 py-3">
          <div className="min-w-0 pr-3">
            <p className="text-[9px] font-semibold text-on-surface-variant/60">Internal budget</p>
            <MoneyValue amount={data.summary.internalBudget} variant="compactWithFull" size="lg" className="mt-1" />
          </div>
          <div className="min-w-0 pl-3 text-right">
            <p className="text-[9px] font-semibold text-on-surface-variant/60">Aktual terpakai</p>
            <MoneyValue amount={data.summary.actualCost} variant="compactWithFull" size="lg" align="right" tone={budgetDanger ? "danger" : "default"} className="mt-1" />
          </div>
        </div>
        <BudgetSplitIndicator value={data.summary.usedPercentage} danger={budgetDanger} />
        <div className="mt-3 grid grid-cols-2 gap-4 border-t border-black/[0.055] pt-3">
          <SummaryFact label="Sisa" value={shortMoney(data.summary.remainingBudget)} tone={budgetDanger ? "danger" : "positive"} />
          <div className="border-l border-black/[0.055] pl-4">
            <SummaryFact label="Margin proyeksi" value={`${data.summary.projectedMarginPercentage.toFixed(1)}%`} tone={data.summary.projectedMarginPercentage < 0 ? "danger" : "default"} />
          </div>
        </div>
      </DashboardSummarySurface>

      <DashboardDetailSection title="Project berisiko" href="/projects?filter=WARNING" actionLabel="Buka project">
        {data.dashboardDetails.budgetRisks.length === 0 ? <DashboardTabEmpty>Semua project aktif masih dalam batas budget.</DashboardTabEmpty> : (
          <DashboardRowGroup>{data.dashboardDetails.budgetRisks.map((project) => <ProjectRiskRow key={project.projectId} project={project} />)}</DashboardRowGroup>
        )}
      </DashboardDetailSection>

      <DashboardDetailSection title="Kesehatan kategori" href="/projects" actionLabel="Lihat project">
        {data.categories.length === 0 ? <DashboardTabEmpty>Budget kategori project aktif belum tersedia.</DashboardTabEmpty> : (
          <>
            <div className="border-b border-outline-variant/35 px-4 py-2.5 text-[10px] font-semibold text-on-surface-variant">
              {criticalCategories.length > 0 ? `${criticalCategories.length} kategori perlu perhatian di seluruh project.` : "Semua kategori masih terkendali."}
            </div>
            <DashboardRowGroup>{data.categories.map((category) => <CategoryUsageRow key={category.code} category={category} />)}</DashboardRowGroup>
          </>
        )}
      </DashboardDetailSection>
    </div>
  );
}

export function AccountsTab({ data }: { readonly data: FinanceDashboardOverview }): React.JSX.Element {
  return <BankAccountsControl accounts={data.bankAccounts} role={data.role} variant="tab" payablesDueSoon={data.summary.payablesDueSoon} />;
}

export function CashDueTab({ data, referenceDate }: { readonly data: FinanceDashboardOverview; readonly referenceDate: Date }): React.JSX.Element {
  const overdue = data.dashboardDetails.cashDueGroups.find((group) => group.bucket === "OVERDUE");
  const today = data.dashboardDetails.cashDueGroups.find((group) => group.bucket === "TODAY");
  const near = data.dashboardDetails.cashDueGroups.find((group) => group.bucket === "NEXT_7_DAYS");
  const urgentTotal = (overdue?.totalOutstanding ?? 0) + (today?.totalOutstanding ?? 0) + (near?.totalOutstanding ?? 0);
  const coverage = urgentTotal > 0 ? data.summary.cashAvailable / urgentTotal : null;
  const groupsWithItems = data.dashboardDetails.cashDueGroups.filter((group) => group.count > 0);
  return (
    <div className="space-y-lg max-[430px]:space-y-5">
      <DashboardSummarySurface
        ariaLabel="Urgensi jatuh tempo"
        eyebrow="Jadwal kas terdekat"
        icon="event_upcoming"
        status={(overdue?.count ?? 0) > 0 ? `${overdue?.count ?? 0} terlambat` : "Tidak ada keterlambatan"}
        statusTone={(overdue?.count ?? 0) > 0 ? "critical" : "positive"}
      >
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold text-on-surface-variant/60">Outstanding 7 hari</p>
            <MoneyValue amount={urgentTotal} variant="compactWithFull" size="lg" tone={urgentTotal > data.summary.cashAvailable ? "danger" : "default"} className="mt-1" />
          </div>
          <div className="shrink-0 rounded-[16px] bg-surface-container-low/70 px-3 py-2 text-right">
            <p className="text-[8px] font-semibold text-on-surface-variant/60">Cakupan kas</p>
            <p className={`mt-1 font-mono text-sm font-black ${coverage !== null && coverage < 1 ? "text-error" : "text-success"}`}>{coverage === null ? "Aman" : `${coverage.toFixed(1)}×`}</p>
          </div>
        </div>
        <div className="mt-3.5 grid grid-cols-3 divide-x divide-black/[0.055] rounded-[18px] bg-surface-container-low/65 px-3 py-2.5">
          <SummaryFact label="Terlambat" value={String(overdue?.count ?? 0)} tone={(overdue?.count ?? 0) > 0 ? "danger" : "default"} />
          <div className="pl-3"><SummaryFact label="Hari ini" value={String(today?.count ?? 0)} tone={(today?.count ?? 0) > 0 ? "warning" : "default"} /></div>
          <div className="pl-3"><SummaryFact label="7 hari" value={String(near?.count ?? 0)} tone={(near?.count ?? 0) > 0 ? "warning" : "positive"} /></div>
        </div>
      </DashboardSummarySurface>
      {groupsWithItems.length === 0 ? (
        <DashboardDetailSection title="Jadwal pembayaran"><DashboardTabEmpty>Tidak ada tagihan atau invoice terbuka.</DashboardTabEmpty></DashboardDetailSection>
      ) : groupsWithItems.map((group) => (
        <DashboardDetailSection key={group.bucket} title={group.label} href={group.bucket === "LATER" ? "/expenses?view=vendor-bills" : undefined} actionLabel="Lihat semua">
          <div className="mx-3 mt-3 flex items-center justify-between rounded-[15px] bg-surface-container-low/65 px-3 py-2 text-[10px] font-semibold text-on-surface-variant">
            <span>{group.count} dokumen</span>
            <MoneyValue amount={group.totalOutstanding} variant="compactWithFull" size="sm" align="right" tone={group.bucket === "OVERDUE" ? "danger" : "default"} />
          </div>
          <DashboardRowGroup connected>{group.items.map((item) => <CashDueRow key={`${item.type}-${item.id}`} item={item} referenceDate={referenceDate} />)}</DashboardRowGroup>
        </DashboardDetailSection>
      ))}
    </div>
  );
}

export function MaterialsTab({ data }: { readonly data: FinanceDashboardOverview }): React.JSX.Element {
  const shortages = data.dashboardDetails.materials.filter((item) => item.type === "RAP_SHORTAGE" || item.type === "LOW_STOCK");
  const reviews = data.dashboardDetails.materials.filter((item) => item.type === "REVERSAL_REQUEST");
  const activity = data.dashboardDetails.materials.filter((item) => item.type === "WASTE" || item.type === "ADJUSTMENT");
  return (
    <div className="space-y-lg max-[430px]:space-y-5">
      <DashboardSummarySurface
        ariaLabel="Posisi stok material"
        eyebrow="Posisi stok"
        icon="inventory_2"
        status={data.stockIssues.materialShortageCount > 0 || data.stockIssues.lowStockCount > 0 ? "Perlu perhatian" : "Terkendali"}
        statusTone={data.stockIssues.materialShortageCount > 0 || data.stockIssues.lowStockCount > 0 ? "warning" : "positive"}
      >
        <div className="grid grid-cols-2 divide-x divide-black/[0.055] rounded-[20px] bg-surface-container-low/65 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold text-on-surface-variant/60">Stok tersedia</p>
            <MoneyValue amount={data.stockIssues.reusableStockValue} variant="compactWithFull" size="lg" className="mt-1" />
          </div>
          <div className="min-w-0 pl-3 text-right">
            <p className="text-[9px] font-semibold text-on-surface-variant/60">Total nilai stok</p>
            <MoneyValue amount={data.stockIssues.totalStockValue} variant="compactWithFull" size="lg" align="right" className="mt-1" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/[0.055] pt-3 text-[10px] font-semibold">
          <span className={data.stockIssues.materialShortageCount > 0 ? "text-warning" : "text-success"}>{data.stockIssues.materialShortageCount > 0 ? `${data.stockIssues.materialShortageCount} kebutuhan RAP belum terpenuhi` : "Kebutuhan RAP terpenuhi"}</span>
          <span className={`shrink-0 rounded-full px-2.5 py-1 font-mono ${data.stockIssues.lowStockCount > 0 ? "bg-warning/[0.09] text-warning" : "bg-success/[0.08] text-success"}`}>{data.stockIssues.lowStockCount} stok rendah</span>
        </div>
      </DashboardSummarySurface>
      <DashboardDetailSection title="Risiko pemenuhan" href="/materials?tab=needs" actionLabel="Buka kebutuhan">
        {shortages.length === 0 ? <DashboardTabEmpty>Tidak ada kekurangan RAP atau stok rendah aktif.</DashboardTabEmpty> : <DashboardRowGroup>{shortages.map((item) => <MaterialIssueRow key={item.id} item={item} />)}</DashboardRowGroup>}
      </DashboardDetailSection>
      {reviews.length > 0 ? (
        <DashboardDetailSection title="Perlu keputusan" href="/materials?tab=overview" actionLabel="Tinjau">
          <DashboardRowGroup>{reviews.map((item) => <MaterialIssueRow key={item.id} item={item} />)}</DashboardRowGroup>
        </DashboardDetailSection>
      ) : null}
      <DashboardDetailSection title="Waste dan penyesuaian" href="/materials?tab=activity" actionLabel="Buka aktivitas">
        {activity.length === 0 ? <DashboardTabEmpty>Tidak ada waste atau penyesuaian terbaru.</DashboardTabEmpty> : <DashboardRowGroup>{activity.map((item) => <MaterialIssueRow key={item.id} item={item} />)}</DashboardRowGroup>}
      </DashboardDetailSection>
    </div>
  );
}
