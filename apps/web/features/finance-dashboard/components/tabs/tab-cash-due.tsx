"use client";

import React from "react";
import { getDashboardCashSummary } from "@atria/core/finance/dashboard-cash-summary";

import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import { DetailSection, MoneyValue, RowGroup, SummaryFact, SummarySurface } from "@/components/ui";
import { DashboardTabEmpty } from "@/features/finance-dashboard/components/shared/dashboard-row-primitives";
import { CashDueRow } from "@/features/finance-dashboard/components/rows/cash-due-rows";

export function CashDueTab({
  data,
  referenceDate,
}: {
  readonly data: FinanceDashboardOverview;
  readonly referenceDate: Date;
}): React.JSX.Element {
  const overdue = data.dashboardDetails.cashDueGroups.find((group) => group.bucket === "OVERDUE");
  const today = data.dashboardDetails.cashDueGroups.find((group) => group.bucket === "TODAY");
  const near = data.dashboardDetails.cashDueGroups.find((group) => group.bucket === "NEXT_7_DAYS");
  const { outstandingAmount: urgentTotal, cashCoverageRatio: coverage } = getDashboardCashSummary(
    data.dashboardDetails.cashDueGroups,
    data.summary.cashAvailable,
    data.summary.payablesDueSoon,
  );
  const groupsWithItems = data.dashboardDetails.cashDueGroups.filter((group) => group.count > 0);
  return (
    <div className="space-y-sm">
      <SummarySurface
        ariaLabel="Urgensi jatuh tempo"
        eyebrow="Jadwal kas terdekat"
        icon="event_upcoming"
        status={
          (overdue?.count ?? 0) > 0 ? `${overdue?.count ?? 0} terlambat` : "Tidak ada keterlambatan"
        }
        statusTone={(overdue?.count ?? 0) > 0 ? "critical" : "positive"}
      >
        <div className="flex items-end justify-between gap-4 px-3.5 pt-3 pb-1">
          <div className="min-w-0 flex-1">
            <p className="text-eyebrow font-semibold text-on-surface-variant/60">
              Outstanding 7 hari
            </p>
            <MoneyValue
              amount={urgentTotal}
              variant="fullDynamic"
              size="lg"
              tone={
                data.summary.payablesDueSoon > data.summary.cashAvailable ? "danger" : "default"
              }
              className="mt-1"
            />
          </div>
          <div className="shrink-0 text-right">
            <p className="text-eyebrow font-semibold text-on-surface-variant/60">Cakupan kas</p>
            <p
              className={`financial-amount mt-1 text-sm font-extrabold ${coverage !== null && coverage < 1 ? "text-error" : "text-on-surface"}`}
            >
              {coverage === null
                ? "Tidak ada hutang"
                : `${coverage.toLocaleString("id-ID", { maximumFractionDigits: 1 })}×`}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 px-2 pt-2 pb-2">
          <SummaryFact
            label="Terlambat"
            value={String(overdue?.count ?? 0)}
            tone={(overdue?.count ?? 0) > 0 ? "danger" : "default"}
          />
          <SummaryFact
            label="Hari ini"
            value={String(today?.count ?? 0)}
            tone={(today?.count ?? 0) > 0 ? "warning" : "default"}
          />
          <SummaryFact
            label="7 hari"
            value={String(near?.count ?? 0)}
            tone={(near?.count ?? 0) > 0 ? "warning" : "positive"}
          />
        </div>
        <p className="px-3.5 pb-2 text-meta text-on-surface-variant">
          Outstanding mencakup hutang dan piutang; cakupan kas membandingkan kas dengan hutang jatuh
          tempo.
        </p>
      </SummarySurface>
      {groupsWithItems.length === 0 ? (
        <DetailSection title="Jadwal pembayaran">
          <DashboardTabEmpty>Tidak ada tagihan atau invoice terbuka.</DashboardTabEmpty>
        </DetailSection>
      ) : (
        groupsWithItems.map((group) => (
          <DetailSection
            key={group.bucket}
            title={group.label}
            href={group.bucket === "LATER" ? "/expenses?view=vendor-bills" : undefined}
            actionLabel="Lihat semua"
          >
            <div className="mx-3 mt-3 flex items-center justify-between rounded-inset bg-surface-container-low px-3 py-2 text-meta font-semibold text-on-surface-variant">
              <span>{group.count} dokumen</span>
              <MoneyValue
                amount={group.totalOutstanding}
                variant="compact"
                size="sm"
                align="right"
                tone={group.bucket === "OVERDUE" ? "danger" : "default"}
              />
            </div>
            <RowGroup connected>
              {group.items.map((item) => (
                <CashDueRow
                  key={`${item.type}-${item.id}`}
                  item={item}
                  referenceDate={referenceDate}
                />
              ))}
            </RowGroup>
          </DetailSection>
        ))
      )}
    </div>
  );
}
