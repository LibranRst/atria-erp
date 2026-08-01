"use client";

import React from "react";

import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import { DetailSection, MoneyValue, RowGroup, StatusBadge, SummarySurface } from "@/components/ui";
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
    <div className="space-y-sm">
      <SummarySurface
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
        <div className="grid grid-cols-2 px-3.5 pt-3 pb-1">
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
        <div className="px-2 pt-2 pb-2">
          <div className="flex items-center justify-between rounded-xl bg-surface-container-lowest p-2 text-[10px] font-semibold">
            <span
              className={
                data.stockIssues.materialShortageCount > 0 ? "text-warning" : "text-success"
              }
            >
              {data.stockIssues.materialShortageCount > 0
                ? `${data.stockIssues.materialShortageCount} kebutuhan RAP belum terpenuhi`
                : "Kebutuhan RAP terpenuhi"}
            </span>
            <StatusBadge
              tone={data.stockIssues.lowStockCount > 0 ? "warning" : "healthy"}
              label={`${data.stockIssues.lowStockCount} stok rendah`}
              marker={false}
            />
          </div>
        </div>
      </SummarySurface>
      <DetailSection
        title="Risiko pemenuhan"
        href="/materials?tab=needs"
        actionLabel="Buka kebutuhan"
      >
        {shortages.length === 0 ? (
          <DashboardTabEmpty>Tidak ada kekurangan RAP atau stok rendah aktif.</DashboardTabEmpty>
        ) : (
          <RowGroup>
            {shortages.map((item) => (
              <MaterialIssueRow key={item.id} item={item} compact />
            ))}
          </RowGroup>
        )}
      </DetailSection>
      {reviews.length > 0 ? (
        <DetailSection title="Perlu keputusan" href="/materials?tab=overview" actionLabel="Tinjau">
          <RowGroup>
            {reviews.map((item) => (
              <MaterialIssueRow key={item.id} item={item} compact />
            ))}
          </RowGroup>
        </DetailSection>
      ) : null}
      <DetailSection
        title="Waste dan penyesuaian"
        href="/materials?tab=activity"
        actionLabel="Buka aktivitas"
      >
        {activity.length === 0 ? (
          <DashboardTabEmpty>Tidak ada waste atau penyesuaian terbaru.</DashboardTabEmpty>
        ) : (
          <RowGroup>
            {activity.map((item) => (
              <MaterialIssueRow key={item.id} item={item} compact />
            ))}
          </RowGroup>
        )}
      </DetailSection>
    </div>
  );
}
