"use client";

import React from "react";

import { Badge } from "@/components/ui/badge";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
  NativePanel,
} from "../shared/rap-rab-primitives";
import {
  formatIdr as formatRp,
  formatShortIdr as formatShortRp,
} from "@/lib/utils/money";
import type {
  RapView,
  RabEstimateView,
  ProjectCategoryPlanItemView,
  RapOverviewFilter,
} from "../shared/rap-rab-manager";

export function InternalPlanOverview({
  rap,
  plannedCost,
  tukangPlanItems,
  subconPlanItems,
  packageItemCount,
  needToBuy,
  canEditRap,
  rabEstimate,
  setInternalRevisionOpen,
  rapOverviewFilter,
  setRapOverviewFilter,
  setRapDetailItemId,
  setPackageDetailItemId,
}: {
  readonly rap: RapView;
  readonly plannedCost: number;
  readonly tukangPlanItems: readonly ProjectCategoryPlanItemView[];
  readonly subconPlanItems: readonly ProjectCategoryPlanItemView[];
  readonly packageItemCount: number;
  readonly needToBuy: number;
  readonly canEditRap: boolean;
  readonly rabEstimate: RabEstimateView | null;
  readonly setInternalRevisionOpen: (open: boolean) => void;
  readonly rapOverviewFilter: RapOverviewFilter;
  readonly setRapOverviewFilter: (filter: RapOverviewFilter) => void;
  readonly setRapDetailItemId: (id: string | null) => void;
  readonly setPackageDetailItemId: (id: string | null) => void;
}): React.JSX.Element {
  return (
    <>
      <NativePanel
        eyebrow="Rencana Internal"
        title={`Revisi RAP ${rap.revision}`}
        action={<Badge status="APPROVED">Terkunci</Badge>}
      >
        <div className="rounded-[28px] bg-primary p-md text-on-primary">
          <p className="text-[10px] font-bold uppercase text-white/65">
            Total Rencana Internal
          </p>
          <p className="mt-1 font-mono text-[22px] font-bold">
            {formatRp(
              plannedCost +
                tukangPlanItems.reduce(
                  (sum, item) => sum + Number(item.estimatedTotalCost),
                  0,
                ) +
                subconPlanItems.reduce(
                  (sum, item) => sum + Number(item.estimatedTotalCost),
                  0,
                ),
            )}
          </p>
          <div className="mt-3 flex justify-between text-[10px] text-white/70">
            <span>{rap.items.length} material</span>
            <span>{packageItemCount} paket</span>
            <span>
              {needToBuy > 0 ? `${needToBuy} perlu dibeli` : "Material siap"}
            </span>
          </div>
        </div>
        {canEditRap && rabEstimate?.status === "APPROVED" && (
          <button
            type="button"
            onClick={() => setInternalRevisionOpen(true)}
            className="mt-sm min-h-11 w-full rounded-full bg-primary/10 text-xs font-bold text-primary"
          >
            Buat Revisi RAP
          </button>
        )}
      </NativePanel>
      <SegmentedTabs
        value={rapOverviewFilter}
        onChange={setRapOverviewFilter}
        ariaLabel="Detail RAP"
        options={(["MATERIAL", "TUKANG", "SUBCON"] as RapOverviewFilter[]).map(
          (filter) => ({
            value: filter,
            label:
              filter === "MATERIAL"
                ? "Material"
                : filter === "TUKANG"
                  ? "Tukang"
                  : "Subcon",
            icon: (
              <span className="material-symbols-outlined text-[16px]">
                {filter === "MATERIAL"
                  ? "inventory_2"
                  : filter === "TUKANG"
                    ? "engineering"
                    : "domain"}
              </span>
            ),
          }),
        )}
      />
      <NativePanel
        eyebrow="Rincian Operasional"
        title={
          rapOverviewFilter === "MATERIAL"
            ? "Material"
            : rapOverviewFilter === "TUKANG"
              ? "Paket Tukang"
              : "Paket Subcon"
        }
      >
        <div className="space-y-2">
          {rapOverviewFilter === "MATERIAL"
            ? rap.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRapDetailItemId(item.id)}
                  className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-surface-container-low p-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {item.name}
                    </span>
                    <span className="block text-[10px] text-on-surface-variant">
                      {item.area} - {item.totalQuantity} {item.unit}
                    </span>
                  </span>
                  <span className="financial-amount max-w-[38%] shrink-0 break-words text-right font-mono text-[10px] font-bold leading-3 [overflow-wrap:anywhere]">
                    {formatShortRp(Number(item.estimatedTotalCost))}
                  </span>
                </button>
              ))
            : (rapOverviewFilter === "TUKANG"
                ? tukangPlanItems
                : subconPlanItems
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPackageDetailItemId(item.id)}
                  className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-surface-container-low p-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {item.name}
                    </span>
                    <span className="block text-[10px] text-on-surface-variant">
                      {item.area}
                      {item.vendorName ? ` - ${item.vendorName}` : ""}
                    </span>
                  </span>
                  <span className="max-w-[38%] shrink-0 text-right">
                    <span className="financial-amount block break-words font-mono text-[10px] font-bold leading-3 [overflow-wrap:anywhere]">
                      {formatShortRp(Number(item.estimatedTotalCost))}
                    </span>
                    <span className="block text-[9px] font-bold text-primary">
                      {item.status === "ACTIVE" ? "Siap" : item.status}
                    </span>
                  </span>
                </button>
              ))}
        </div>
      </NativePanel>
    </>
  );
}
