"use client";

import React from "react";

import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import { MoneyValue } from "@/components/ui/feedback/page-primitives";
import {
  DashboardDetailSection,
  DashboardRowGroup,
  DashboardSummarySurface,
} from "@/features/finance-dashboard/components/shared/dashboard-primitives";
import { DashboardTabEmpty } from "@/features/finance-dashboard/components/shared/dashboard-row-primitives";
import { SummaryFact } from "@/features/finance-dashboard/components/shared/dashboard-summary-fact";
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
  const near = data.dashboardDetails.cashDueGroups.find(
    (group) => group.bucket === "NEXT_7_DAYS",
  );
  const urgentTotal =
    (overdue?.totalOutstanding ?? 0) +
    (today?.totalOutstanding ?? 0) +
    (near?.totalOutstanding ?? 0);
  const coverage = urgentTotal > 0 ? data.summary.cashAvailable / urgentTotal : null;
  const groupsWithItems = data.dashboardDetails.cashDueGroups.filter((group) => group.count > 0);
  return (
    <div className="space-y-lg max-[430px]:space-y-5">
      <DashboardSummarySurface
        ariaLabel="Urgensi jatuh tempo"
        eyebrow="Jadwal kas terdekat"
        icon="event_upcoming"
        status={
          (overdue?.count ?? 0) > 0 ? `${overdue?.count ?? 0} terlambat` : "Tidak ada keterlambatan"
        }
        statusTone={(overdue?.count ?? 0) > 0 ? "critical" : "positive"}
      >
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold text-on-surface-variant/60">
              Outstanding 7 hari
            </p>
            <MoneyValue
              amount={urgentTotal}
              variant="compactWithFull"
              size="lg"
              tone={urgentTotal > data.summary.cashAvailable ? "danger" : "default"}
              className="mt-1"
            />
          </div>
          <div className="shrink-0 rounded-2xl bg-surface-container-low/70 px-3 py-2 text-right">
            <p className="text-[8px] font-semibold text-on-surface-variant/60">Cakupan kas</p>
            <p
              className={`mt-1 font-mono text-sm font-black ${coverage !== null && coverage < 1 ? "text-error" : "text-success"}`}
            >
              {coverage === null ? "Aman" : `${coverage.toFixed(1)}×`}
            </p>
          </div>
        </div>
        <div className="mt-3.5 grid grid-cols-3 divide-x divide-black/5.5 rounded-[18px] bg-surface-container-low/65 px-3 py-2.5">
          <SummaryFact
            label="Terlambat"
            value={String(overdue?.count ?? 0)}
            tone={(overdue?.count ?? 0) > 0 ? "danger" : "default"}
          />
          <div className="pl-3">
            <SummaryFact
              label="Hari ini"
              value={String(today?.count ?? 0)}
              tone={(today?.count ?? 0) > 0 ? "warning" : "default"}
            />
          </div>
          <div className="pl-3">
            <SummaryFact
              label="7 hari"
              value={String(near?.count ?? 0)}
              tone={(near?.count ?? 0) > 0 ? "warning" : "positive"}
            />
          </div>
        </div>
      </DashboardSummarySurface>
      {groupsWithItems.length === 0 ? (
        <DashboardDetailSection title="Jadwal pembayaran">
          <DashboardTabEmpty>Tidak ada tagihan atau invoice terbuka.</DashboardTabEmpty>
        </DashboardDetailSection>
      ) : (
        groupsWithItems.map((group) => (
          <DashboardDetailSection
            key={group.bucket}
            title={group.label}
            href={group.bucket === "LATER" ? "/expenses?view=vendor-bills" : undefined}
            actionLabel="Lihat semua"
          >
            <div className="mx-3 mt-3 flex items-center justify-between rounded-[15px] bg-surface-container-low/65 px-3 py-2 text-[10px] font-semibold text-on-surface-variant">
              <span>{group.count} dokumen</span>
              <MoneyValue
                amount={group.totalOutstanding}
                variant="compactWithFull"
                size="sm"
                align="right"
                tone={group.bucket === "OVERDUE" ? "danger" : "default"}
              />
            </div>
            <DashboardRowGroup connected>
              {group.items.map((item) => (
                <CashDueRow
                  key={`${item.type}-${item.id}`}
                  item={item}
                  referenceDate={referenceDate}
                />
              ))}
            </DashboardRowGroup>
          </DashboardDetailSection>
        ))
      )}
    </div>
  );
}
