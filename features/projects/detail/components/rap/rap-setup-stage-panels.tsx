"use client";

import React from "react";

import { Badge } from "@/components/ui/badge";
import { MetricGrid } from "@/components/ui/page-primitives";
import { formatShortIdr as formatShortRp } from "@/lib/utils/money";
import type {
  ProjectCategoryPlanItemView,
  RapSetupStage,
  RapView,
} from "../shared/rap-rab-manager";
import {
  MiniMetric,
  MiniMoneyMetric,
  NativePanel,
} from "../shared/rap-rab-primitives";
import { PackageSetupContent } from "./rap-package-setup-content";
import { isPackageScopeReady, sumPackageCost } from "./rap-setup-utils";

export function MaterialRapStagePanel({
  rap,
  plannedCost,
  needToBuy,
  isPending,
  canEditRap,
  openAddRapForm,
  setRapDetailItemId,
  handleAdvanceRapSetup,
}: {
  readonly rap: RapView;
  readonly plannedCost: number;
  readonly needToBuy: number;
  readonly isPending: boolean;
  readonly canEditRap: boolean;
  readonly openAddRapForm: () => void;
  readonly setRapDetailItemId: (id: string | null) => void;
  readonly handleAdvanceRapSetup: (stage: "TUKANG") => void;
}): React.JSX.Element {
  return (
    <NativePanel
      eyebrow="Tahap 1"
      title="Material RAP"
      action={
        <Badge status={rap.items.length > 0 ? "PRIMARY" : "DRAFT"}>
          {rap.items.length} item
        </Badge>
      }
    >
      <MetricGrid>
        <MiniMoneyMetric label="Estimasi" value={plannedCost} />
        <MiniMetric
          label="Perlu Dibeli"
          value={needToBuy.toLocaleString("id-ID")}
          danger={needToBuy > 0}
        />
      </MetricGrid>
      <div className="mt-sm space-y-2">
        {rap.items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setRapDetailItemId(item.id)}
            className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-surface-container-low p-3 text-left"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
              <span className="material-symbols-outlined text-[19px]">
                inventory_2
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate leading-5 text-sm font-bold">
                {item.name}
              </span>
              <span className="block truncate leading-4 text-[10px] text-on-surface-variant">
                {item.area} - {item.totalQuantity} {item.unit}
              </span>
            </span>
            <span className="max-w-[38%] shrink-0 text-right">
              <span className="financial-amount block break-words font-mono leading-5 text-[10px] font-bold [overflow-wrap:anywhere]">
                {formatShortRp(Number(item.estimatedTotalCost))}
              </span>
              <span
                className={`block text-[9px] leading-4 font-bold ${
                  item.needToBuy > 0 ? "text-warning" : "text-primary"
                }`}
              >
                {item.needToBuy > 0 ? `Beli ${item.needToBuy}` : "Ready"}
              </span>
            </span>
          </button>
        ))}
      </div>
      {rap.items.length === 0 && (
        <div className="mt-sm rounded-2xl bg-surface-container-low p-md text-center text-xs text-on-surface-variant">
          Belum ada material. Tambahkan item pertama untuk memulai baseline.
        </div>
      )}
      {canEditRap && (
        <button
          type="button"
          onClick={openAddRapForm}
          className="mt-sm min-h-12 w-full rounded-full bg-primary text-xs font-bold text-on-primary"
        >
          Tambah Material
        </button>
      )}
      <button
        type="button"
        onClick={() => handleAdvanceRapSetup("TUKANG")}
        disabled={
          isPending || rap.items.length === 0 || rap.setupStage !== "MATERIAL"
        }
        className="mt-2 min-h-12 w-full rounded-full bg-on-surface text-xs font-bold text-surface disabled:opacity-35"
      >
        {rap.setupStage === "MATERIAL"
          ? "Lanjut ke Tukang"
          : "Tahap Tukang Sudah Terbuka"}
      </button>
    </NativePanel>
  );
}

export function PackageSetupStagePanel({
  rap,
  stage,
  title,
  items,
  skipped,
  isPending,
  canEditCategoryPlan,
  openAddCategoryPlanForm,
  setPackageDetailItemId,
  handleScopeSkip,
  handleAdvanceRapSetup,
}: {
  readonly rap: RapView;
  readonly stage: "TUKANG" | "SUBCON";
  readonly title: string;
  readonly items: readonly ProjectCategoryPlanItemView[];
  readonly skipped: boolean;
  readonly isPending: boolean;
  readonly canEditCategoryPlan: boolean;
  readonly openAddCategoryPlanForm: (category: "TUKANG" | "SUBCON") => void;
  readonly setPackageDetailItemId: (id: string | null) => void;
  readonly handleScopeSkip: (
    categoryCode: "TUKANG" | "SUBCON",
    skipped: boolean,
  ) => void;
  readonly handleAdvanceRapSetup: (stage: "SUBCON" | "REVIEW") => void;
}): React.JSX.Element {
  const nextStage = stage === "TUKANG" ? "SUBCON" : "REVIEW";
  const currentSetupStage = rap.setupStage === stage;

  return (
    <NativePanel
      eyebrow={stage === "TUKANG" ? "Tahap 2" : "Tahap 3"}
      title={title}
      action={
        <Badge
          status={
            skipped
              ? "DRAFT"
              : items.some((item) => item.status === "DRAFT")
                ? "WARNING"
                : "PRIMARY"
          }
        >
          {skipped ? "Tidak Digunakan" : `${items.length} paket`}
        </Badge>
      }
    >
      <PackageSetupContent
        items={items}
        code={stage}
        skipped={skipped}
        canEdit={canEditCategoryPlan}
        isPending={isPending}
        onAdd={() => openAddCategoryPlanForm(stage)}
        onOpen={setPackageDetailItemId}
        onSkip={(nextSkipped) => handleScopeSkip(stage, nextSkipped)}
      />
      <button
        type="button"
        onClick={() => handleAdvanceRapSetup(nextStage)}
        disabled={
          isPending ||
          !currentSetupStage ||
          (!skipped &&
            (items.length === 0 ||
              items.some((item) => item.status === "DRAFT")))
        }
        className="mt-sm min-h-12 w-full rounded-full bg-on-surface text-xs font-bold text-surface disabled:opacity-35"
      >
        {currentSetupStage
          ? stage === "TUKANG"
            ? "Lanjut ke Subcon"
            : "Lanjut ke Review"
          : stage === "TUKANG"
            ? "Tahap Subcon Sudah Terbuka"
            : "Review Sudah Terbuka"}
      </button>
    </NativePanel>
  );
}

export function ReviewInternalPlanPanel({
  rap,
  plannedCost,
  tukangPlanItems,
  subconPlanItems,
  isPending,
  canFinalizeRap,
  setActiveRapStage,
  handleFinalizeInternalPlan,
}: {
  readonly rap: RapView;
  readonly plannedCost: number;
  readonly tukangPlanItems: readonly ProjectCategoryPlanItemView[];
  readonly subconPlanItems: readonly ProjectCategoryPlanItemView[];
  readonly isPending: boolean;
  readonly canFinalizeRap: boolean;
  readonly setActiveRapStage: (stage: RapSetupStage) => void;
  readonly handleFinalizeInternalPlan: () => void;
}): React.JSX.Element {
  return (
    <NativePanel
      eyebrow="Tahap 4"
      title="Review Internal Plan"
      action={<Badge status="WARNING">Belum Final</Badge>}
    >
      <MetricGrid>
        <MiniMoneyMetric label="Material" value={plannedCost} />
        {rap.tukangScopeSkipped ? (
          <MiniMetric label="Tukang" value="Tidak digunakan" />
        ) : (
          <MiniMoneyMetric
            label="Tukang"
            value={sumPackageCost(tukangPlanItems)}
          />
        )}
        {rap.subconScopeSkipped ? (
          <MiniMetric label="Subcon" value="Tidak digunakan" />
        ) : (
          <MiniMoneyMetric
            label="Subcon"
            value={sumPackageCost(subconPlanItems)}
          />
        )}
        <MiniMoneyMetric
          label="Total Plan"
          value={
            plannedCost +
            sumPackageCost(tukangPlanItems) +
            sumPackageCost(subconPlanItems)
          }
        />
      </MetricGrid>
      <div className="mt-sm space-y-2">
        {[
          {
            stage: "MATERIAL" as const,
            label: "Material",
            ready: rap.items.length > 0,
          },
          {
            stage: "TUKANG" as const,
            label: "Tukang",
            ready: isPackageScopeReady({
              skipped: rap.tukangScopeSkipped,
              items: tukangPlanItems,
            }),
          },
          {
            stage: "SUBCON" as const,
            label: "Subcon",
            ready: isPackageScopeReady({
              skipped: rap.subconScopeSkipped,
              items: subconPlanItems,
            }),
          },
        ].map((row) => (
          <button
            key={row.stage}
            type="button"
            onClick={() => setActiveRapStage(row.stage)}
            className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-surface-container-low px-3 text-left"
          >
            <span
              className={`material-symbols-outlined ${
                row.ready ? "text-primary" : "text-warning"
              }`}
            >
              {row.ready ? "check_circle" : "warning"}
            </span>
            <span className="flex-1 text-xs font-bold">{row.label}</span>
            <span className="text-[10px] text-on-surface-variant">Edit</span>
          </button>
        ))}
      </div>
      {!canFinalizeRap && (
        <p className="mt-sm rounded-2xl bg-primary/5 p-3 text-[10px] leading-4 text-primary">
          Menunggu Owner/Finance untuk finalisasi. Progress tetap dapat dilihat
          semua role.
        </p>
      )}
      <button
        type="button"
        onClick={handleFinalizeInternalPlan}
        disabled={isPending || !canFinalizeRap}
        className="mt-sm min-h-12 w-full rounded-full bg-primary text-xs font-bold text-on-primary disabled:opacity-35"
      >
        Finalisasi Internal Plan
      </button>
    </NativePanel>
  );
}
