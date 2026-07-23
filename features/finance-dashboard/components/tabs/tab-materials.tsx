"use client";

import React from "react";

import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import { MoneyValue } from "@/components/ui/feedback/page-primitives";
import { StatusBadge } from "@/components/ui/badge/badge";
import {
  DashboardDetailSection,
  DashboardRowGroup,
  DashboardSummarySurface,
} from "@/features/finance-dashboard/components/shared/dashboard-primitives";
import { DashboardTabEmpty } from "@/features/finance-dashboard/components/shared/dashboard-row-primitives";
import { MaterialIssueRow } from "@/features/finance-dashboard/components/rows/material-rows";

export function MaterialsTab({
  data,
}: {
  readonly data: FinanceDashboardOverview;
}): React.JSX.Element {
  const shortages = data.dashboardDetails.materials.filter(
    (item) => item.type === "RAP_SHORTAGE" || item.type === "LOW_STOCK",
  );
  const reviews = data.dashboardDetails.materials.filter(
    (item) => item.type === "REVERSAL_REQUEST",
  );
  const activity = data.dashboardDetails.materials.filter(
    (item) => item.type === "WASTE" || item.type === "ADJUSTMENT",
  );
  return (
    <div className="space-y-lg max-[430px]:space-y-5">
      <DashboardSummarySurface
        ariaLabel="Posisi stok material"
        eyebrow="Posisi stok"
        icon="inventory_2"
        status={
          data.stockIssues.materialShortageCount > 0 || data.stockIssues.lowStockCount > 0
            ? "Perlu perhatian"
            : "Terkendali"
        }
        statusTone={
          data.stockIssues.materialShortageCount > 0 || data.stockIssues.lowStockCount > 0
            ? "warning"
            : "positive"
        }
      >
        <div className="grid grid-cols-2 divide-x divide-black/5.5 rounded-[20px] bg-surface-container-low/65 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold text-on-surface-variant/60">Stok tersedia</p>
            <MoneyValue
              amount={data.stockIssues.reusableStockValue}
              variant="compactWithFull"
              size="lg"
              className="mt-1"
            />
          </div>
          <div className="min-w-0 pl-3 text-right">
            <p className="text-[9px] font-semibold text-on-surface-variant/60">Total nilai stok</p>
            <MoneyValue
              amount={data.stockIssues.totalStockValue}
              variant="compactWithFull"
              size="lg"
              align="right"
              className="mt-1"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/5.5 pt-3 text-[10px] font-semibold">
          <span
            className={data.stockIssues.materialShortageCount > 0 ? "text-warning" : "text-success"}
          >
            {data.stockIssues.materialShortageCount > 0
              ? `${data.stockIssues.materialShortageCount} kebutuhan RAP belum terpenuhi`
              : "Kebutuhan RAP terpenuhi"}
          </span>
          <StatusBadge
            tone={data.stockIssues.lowStockCount > 0 ? "warning" : "healthy"}
            label={`${data.stockIssues.lowStockCount} stok rendah`}
          />
        </div>
      </DashboardSummarySurface>
      <DashboardDetailSection
        title="Risiko pemenuhan"
        href="/materials?tab=needs"
        actionLabel="Buka kebutuhan"
      >
        {shortages.length === 0 ? (
          <DashboardTabEmpty>Tidak ada kekurangan RAP atau stok rendah aktif.</DashboardTabEmpty>
        ) : (
          <DashboardRowGroup>
            {shortages.map((item) => (
              <MaterialIssueRow key={item.id} item={item} />
            ))}
          </DashboardRowGroup>
        )}
      </DashboardDetailSection>
      {reviews.length > 0 ? (
        <DashboardDetailSection
          title="Perlu keputusan"
          href="/materials?tab=overview"
          actionLabel="Tinjau"
        >
          <DashboardRowGroup>
            {reviews.map((item) => (
              <MaterialIssueRow key={item.id} item={item} />
            ))}
          </DashboardRowGroup>
        </DashboardDetailSection>
      ) : null}
      <DashboardDetailSection
        title="Waste dan penyesuaian"
        href="/materials?tab=activity"
        actionLabel="Buka aktivitas"
      >
        {activity.length === 0 ? (
          <DashboardTabEmpty>Tidak ada waste atau penyesuaian terbaru.</DashboardTabEmpty>
        ) : (
          <DashboardRowGroup>
            {activity.map((item) => (
              <MaterialIssueRow key={item.id} item={item} />
            ))}
          </DashboardRowGroup>
        )}
      </DashboardDetailSection>
    </div>
  );
}
