"use client";

import Link from "next/link";
import React from "react";

import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import {
  AppIcon,
  GroupedSurface,
  InlineStateRow,
  MainSection,
  MoneyValue,
  SummaryFact,
  SummarySurface,
} from "@/components/ui";
import { formatMaterialQuantity } from "@/features/materials/utils/material-ui-utils";
type NeedsTabProps = {
  readonly data: MaterialOperationsDashboard;
};

export function MaterialNeedsTab({ data }: NeedsTabProps): React.JSX.Element {
  const shortages = data.shortages.filter((row) => row.needToBuy > 0);
  const anchors = Array.from(new Map(shortages.map((row) => [row.projectRapId, row])).values());
  const totalEstimate = shortages.reduce((sum, row) => sum + row.estimatedTotalCost, 0);

  if (shortages.length === 0) {
    return (
      <GroupedSurface>
        <InlineStateRow
          icon="check_circle"
          title="Semua kebutuhan RAP terpenuhi"
          description="Stok tersedia saat ini cukup untuk menutup kebutuhan material project aktif."
          tone="positive"
        />
      </GroupedSurface>
    );
  }

  return (
    <div className="space-y-sm">
      <SummarySurface
        ariaLabel="Posisi kebutuhan material"
        eyebrow="Kebutuhan"
        icon="shopping_cart_checkout"
        status="Perlu dibeli"
        statusTone="warning"
      >
        <div className="flex items-end justify-between gap-4 px-3.5 pt-3.5 pb-2">
          <div className="min-w-0">
            <p className="font-mono text-[36px] leading-none font-black text-on-surface tabular-nums max-[430px]:text-[32px]">
              {shortages.length}
            </p>
            <p className="text-meta font-semibold text-on-surface-variant">
              material belum tertutup
            </p>
          </div>
          <div className="min-w-0 shrink-0 text-right">
            <p className="text-eyebrow font-semibold text-on-surface-variant/60">
              Estimasi pengadaan
            </p>
            <MoneyValue
              amount={totalEstimate}
              variant="compact"
              size="lg"
              align="right"
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-2">
          <SummaryFact label="Project terdampak" value={String(anchors.length)} />
          <SummaryFact label="Item perlu dibeli" value={String(shortages.length)} tone="warning" />
        </div>
      </SummarySurface>

      <MainSection title="Per project" count={anchors.length} countLabel="Project">
        <div className="space-y-3">
          {anchors.map((anchor) => {
            const rows = shortages.filter((row) => row.projectRapId === anchor.projectRapId);
            const projectEstimate = rows.reduce((sum, row) => sum + row.estimatedTotalCost, 0);
            const project = data.projects.find((item) =>
              item.rapItems.some((rapItem) =>
                rows.some((row) => row.projectRapItemId === rapItem.id),
              ),
            );
            return (
              <GroupedSurface key={anchor.projectRapId}>
                <div className="flex items-start justify-between gap-3 px-3.5 py-3.5">
                  <div className="grid min-w-0 flex-1 gap-1">
                    <p className="line-clamp-2 text-[14px] leading-[1.12] font-bold text-on-surface">
                      {project?.name ?? "Project material"}
                    </p>
                    <p className="text-[10px] leading-[1.3] text-on-surface-variant">
                      {rows.length} material belum tertutup · estimasi pengadaan
                    </p>
                  </div>
                  <MoneyValue amount={projectEstimate} variant="compact" align="right" size="sm" />
                </div>

                <div className="divide-y divide-black/5.5 border-t border-black/5.5 px-3">
                  {rows.map((row) => (
                    <div
                      key={row.projectRapItemId}
                      className="flex min-h-19 items-center gap-3 px-0.5 py-3"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-warning/9 text-warning ring-1 ring-warning/6">
                        <AppIcon name="shopping_cart_checkout" className="text-[17px]" />
                      </span>
                      <div className="grid min-w-0 flex-1 gap-1">
                        <p className="truncate text-row font-bold text-on-surface">
                          {row.materialName}
                        </p>
                        <p className="truncate text-[10px] leading-[1.3] text-on-surface-variant">
                          {row.area} · tersedia {formatMaterialQuantity(row.availableStock)} dari{" "}
                          {formatMaterialQuantity(row.totalQuantity)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-[12px] leading-4 font-black text-warning tabular-nums">
                          Kurang {formatMaterialQuantity(row.needToBuy)}
                        </p>
                        <MoneyValue
                          amount={row.estimatedTotalCost}
                          variant="compact"
                          align="right"
                          size="xs"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {project && data.roleName !== "PURCHASING" ? (
                  <div className="border-t border-black/5.5 px-3.5 py-2.5">
                    <Link
                      href={`/projects/${project.id}?tab=rap`}
                      className="flex min-h-12 w-full items-center justify-center gap-1 rounded-full bg-accent/8 px-5 text-support font-bold text-accent outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-accent/[0.14]"
                    >
                      Buka RAP project
                      <AppIcon name="chevron_right" className="icon-sm" />
                    </Link>
                  </div>
                ) : null}
              </GroupedSurface>
            );
          })}
        </div>
      </MainSection>
    </div>
  );
}
