"use client";

import Link from "next/link";
import React from "react";

import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import { Badge, PanelEmptyState as EmptyState } from "@/components/ui";
import { MoneyValue } from "@/components/ui/page-primitives";
import { Section } from "@/features/materials/components/material-operation-sheets";
import {
  formatMaterialQuantity,
  materialRupiah,
} from "@/features/materials/lib/material-ui-utils";

type NeedsTabProps = {
  readonly data: MaterialOperationsDashboard;
};

export function MaterialNeedsTab({ data }: NeedsTabProps): React.JSX.Element {
  const shortages = data.shortages.filter((row) => row.needToBuy > 0);

  if (shortages.length === 0) {
    return (
      <div className="space-y-sm">
        <EmptyState
          title="Tidak ada shortage"
          description="Semua kebutuhan RAP saat ini memiliki coverage stock."
        />
      </div>
    );
  }

  const groupedShortages = Array.from(
    new Map(shortages.map((row) => [row.projectRapId, row])).values(),
  );

  return (
    <div className="space-y-md">
      {groupedShortages.map((anchor) => {
        const rows = shortages.filter(
          (row) => row.projectRapId === anchor.projectRapId,
        );
        const totalNeedToBuy = rows.reduce((sum, row) => sum + row.needToBuy, 0);
        const totalEstimate = rows.reduce(
          (sum, row) => sum + row.estimatedTotalCost,
          0,
        );
        const project = data.projects.find((item) =>
          item.rapItems.some((rapItem) =>
            rows.some((row) => row.projectRapItemId === rapItem.id),
          ),
        );
        return (
          <Section
            key={anchor.projectRapId}
            title={project?.name ?? "Project material need"}
            contentClassName="space-y-3"
          >
            <div className="rounded-2xl bg-surface-container-low p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-on-surface">
                    {rows.length} material perlu dibeli
                  </p>
                  <p className="mt-0.5 truncate text-[10px] font-semibold text-on-surface-variant">
                    Gap {formatMaterialQuantity(totalNeedToBuy)} item · Estimasi{" "}
                    {materialRupiah.format(totalEstimate)}
                  </p>
                </div>
                <Badge status={rows.length > 2 ? "CRITICAL" : "WARNING"}>
                  {rows.length > 2 ? "Prioritas" : "Watch"}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-semibold text-on-surface-variant">
                <NeedSummaryMetric label="Material" value={String(rows.length)} />
                <NeedSummaryMetric
                  label="Qty gap"
                  value={formatMaterialQuantity(totalNeedToBuy)}
                />
                <NeedSummaryMetric
                  label="Estimasi"
                  amount={totalEstimate}
                />
              </div>
            </div>

            <div className="divide-y divide-outline-variant/35">
              {rows.map((row) => (
                <div
                  key={row.projectRapItemId}
                  className="flex min-h-[68px] items-center gap-3 py-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-light text-warning">
                    <span className="material-symbols-outlined text-[17px]">
                      production_quantity_limits
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">
                          {row.materialName}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-on-surface-variant">
                          {row.area} · Ready {formatMaterialQuantity(row.availableStock)} / Need{" "}
                          {formatMaterialQuantity(row.totalQuantity)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-[11px] font-extrabold text-warning">
                          −{formatMaterialQuantity(row.needToBuy)}
                        </p>
                        <MoneyValue
                          amount={row.estimatedTotalCost}
                          variant="compactWithFull"
                          align="right"
                          size="sm"
                          className="mt-0.5"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {project && (
              <Link
                href={`/projects/${project.id}?tab=rap`}
                className="flex min-h-12 items-center justify-center rounded-full bg-primary/5 px-5 text-xs font-bold text-primary transition hover:bg-primary/10 active:scale-[0.97]"
              >
                Buka RAP Project
              </Link>
            )}
          </Section>
        );
      })}
    </div>
  );
}

function NeedSummaryMetric({
  label,
  value,
  amount,
}: {
  readonly label: string;
  readonly value?: string;
  readonly amount?: number;
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <p className="truncate text-[8px] font-bold uppercase tracking-wide text-on-surface-variant/70">
        {label}
      </p>
      {typeof amount === "number" ? (
        <MoneyValue
          amount={amount}
          variant="compactWithFull"
          size="sm"
          className="mt-0.5"
        />
      ) : (
        <p className="mt-0.5 truncate font-mono text-[11px] font-extrabold text-on-surface">
          {value}
        </p>
      )}
    </div>
  );
}
