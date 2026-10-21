"use client";

import React from "react";
import { RapDesktopWorkspace } from "./rap-desktop-workspace";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";

import { AppIcon, Badge, SegmentedTabs, Button, MoneyValue } from "@/components/ui";
import { NativePanel } from "../shared/rap-rab-primitives";
import { formatShortIdr as formatShortRp } from "@atria/core/utils/money";
import { countMaterialsNeedingPurchase } from "./rap-desktop-model";
import { sumPackageCost } from "../../utils/rap-setup-utils";
import type {
  RapView,
  RabEstimateView,
  ProjectCategoryPlanItemView,
  RapOverviewFilter,
} from "../shared/rap-rab-manager";

function InternalPlanMobile({
  rap,
  plannedCost,
  tukangPlanItems,
  subconPlanItems,
  packageItemCount,
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
  const totalPlan = plannedCost + sumPackageCost(tukangPlanItems) + sumPackageCost(subconPlanItems);
  const neededMaterials = countMaterialsNeedingPurchase(rap.items);
  return (
    <>
      <section className="rounded-owner bg-primary p-5 text-on-primary shadow-inverse max-[430px]:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-eyebrow font-bold tracking-[0.16em] text-white/55 uppercase">
              Total rencana internal
            </p>
            <MoneyValue
              amount={totalPlan}
              variant="compactWithFull"
              fractionDigits={Number.isInteger(totalPlan) ? 0 : 2}
              tone="inverse"
              size="2xl"
              className="mt-1"
            />
          </div>
          <Badge status="APPROVED">Terkunci</Badge>
        </div>
        <div className="mt-4 flex justify-between gap-2 border-t border-white/12 pt-4 text-meta text-white/70">
          <span>{rap.items.length} material</span>
          <span>{packageItemCount} paket</span>
          <span className="text-right">
            {neededMaterials > 0 ? `${neededMaterials} material perlu dibeli` : "Material siap"}
          </span>
        </div>
        {canEditRap && rabEstimate?.status === "APPROVED" && (
          <Button
            type="button"
            onClick={() => setInternalRevisionOpen(true)}
            className="mt-4 min-h-12 w-full rounded-full bg-white/10 text-xs font-bold text-white ring-1 ring-white/15"
            variant="secondary"
          >
            Buat Revisi RAP
          </Button>
        )}
      </section>
      <SegmentedTabs
        value={rapOverviewFilter}
        onChange={setRapOverviewFilter}
        ariaLabel="Detail RAP"
        options={(["MATERIAL", "TUKANG", "SUBCON"] as RapOverviewFilter[]).map((filter) => ({
          value: filter,
          label: filter === "MATERIAL" ? "Material" : filter === "TUKANG" ? "Tukang" : "Subcon",
          icon: (
            <AppIcon
              name={
                filter === "MATERIAL"
                  ? "inventory_2"
                  : filter === "TUKANG"
                    ? "engineering"
                    : "domain"
              }
              className="icon-sm"
            />
          ),
        }))}
      />
      <NativePanel
        eyebrow="Rincian operasional"
        title={
          rapOverviewFilter === "MATERIAL"
            ? "Material"
            : rapOverviewFilter === "TUKANG"
              ? "Paket Tukang"
              : "Paket Subcon"
        }
      >
        <div className="divide-y divide-outline-variant/25 overflow-hidden rounded-inset bg-surface-container-low">
          {rapOverviewFilter === "MATERIAL"
            ? rap.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRapDetailItemId(item.id)}
                  className="flex min-h-16 w-full items-center gap-3 p-3 text-left outline-none focus-visible:bg-white/65 active:bg-white/65"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{item.name}</span>
                    <span className="block text-meta text-on-surface-variant">
                      {item.area} - {item.totalQuantity} {item.unit}
                    </span>
                  </span>
                  <span className="financial-amount max-w-[38%] shrink-0 text-right font-mono text-meta font-bold wrap-anywhere wrap-break-word">
                    {formatShortRp(Number(item.estimatedTotalCost))}
                  </span>
                </button>
              ))
            : (rapOverviewFilter === "TUKANG" ? tukangPlanItems : subconPlanItems).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPackageDetailItemId(item.id)}
                  className="flex min-h-16 w-full items-center gap-3 p-3 text-left outline-none focus-visible:bg-white/65 active:bg-white/65"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{item.name}</span>
                    <span className="block text-meta text-on-surface-variant">
                      {item.area}
                      {item.vendorName ? ` - ${item.vendorName}` : ""}
                    </span>
                  </span>
                  <span className="max-w-[38%] shrink-0 text-right">
                    <span className="financial-amount block font-mono text-meta font-bold wrap-anywhere wrap-break-word">
                      {formatShortRp(Number(item.estimatedTotalCost))}
                    </span>
                    <span className="block text-eyebrow font-bold text-primary">
                      {item.status === "ACTIVE" ? "Siap" : formatBusinessLabel(item.status)}
                    </span>
                  </span>
                </button>
              ))}
        </div>
      </NativePanel>
    </>
  );
}

export function InternalPlanOverview(
  props: React.ComponentProps<typeof InternalPlanMobile>,
): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  return (
    <>
      <div hidden={desktop} inert={desktop} className="space-y-4">
        <InternalPlanMobile {...props} />
      </div>
      <div hidden={!desktop} inert={!desktop}>
        <RapDesktopWorkspace
          rap={props.rap}
          plannedCost={props.plannedCost}
          tukangPlanItems={props.tukangPlanItems}
          subconPlanItems={props.subconPlanItems}
          canEditRap={props.canEditRap}
          onMaterialOpen={props.setRapDetailItemId}
          onPackageOpen={props.setPackageDetailItemId}
          overviewFilter={props.rapOverviewFilter}
          onOverviewFilterChange={props.setRapOverviewFilter}
          canRevise={props.rabEstimate?.status === "APPROVED"}
          onRevise={(): void => props.setInternalRevisionOpen(true)}
        />
      </div>
    </>
  );
}
