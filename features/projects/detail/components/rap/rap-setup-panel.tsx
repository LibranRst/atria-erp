"use client";

import React from "react";

import { Badge } from "@/components/ui/badge";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
  getRapSetupStageLabel,
  getRapSetupStageNumber,
  isRapSetupStageUnlocked,
  RAP_SETUP_STAGES,
} from "./rap-setup-utils";
import {
  MaterialRapStagePanel,
  PackageSetupStagePanel,
  ReviewInternalPlanPanel,
} from "./rap-setup-stage-panels";
import type {
  RapView,
  RapSetupStage,
  ProjectCategoryPlanItemView,
} from "../shared/rap-rab-manager";

export function RapSetupPanel({
  rap,
  activeRapStage,
  setActiveRapStage,
  plannedCost,
  needToBuy,
  isPending,
  canEditRap,
  openAddRapForm,
  setRapDetailItemId,
  handleAdvanceRapSetup,
  tukangPlanItems,
  subconPlanItems,
  canEditCategoryPlan,
  openAddCategoryPlanForm,
  setPackageDetailItemId,
  handleScopeSkip,
  canFinalizeRap,
  handleFinalizeInternalPlan,
}: {
  readonly rap: RapView;
  readonly activeRapStage: RapSetupStage;
  readonly setActiveRapStage: (stage: RapSetupStage) => void;
  readonly plannedCost: number;
  readonly needToBuy: number;
  readonly isPending: boolean;
  readonly canEditRap: boolean;
  readonly openAddRapForm: () => void;
  readonly setRapDetailItemId: (id: string | null) => void;
  readonly handleAdvanceRapSetup: (
    stage: "TUKANG" | "SUBCON" | "REVIEW",
  ) => void;
  readonly tukangPlanItems: readonly ProjectCategoryPlanItemView[];
  readonly subconPlanItems: readonly ProjectCategoryPlanItemView[];
  readonly canEditCategoryPlan: boolean;
  readonly openAddCategoryPlanForm: (category: "TUKANG" | "SUBCON") => void;
  readonly setPackageDetailItemId: (id: string | null) => void;
  readonly handleScopeSkip: (
    categoryCode: "TUKANG" | "SUBCON",
    skipped: boolean,
  ) => void;
  readonly canFinalizeRap: boolean;
  readonly handleFinalizeInternalPlan: () => void;
}): React.JSX.Element {
  return (
    <>
      <section className="rounded-[28px] border border-outline-variant/20 bg-white p-sm shadow-[0_14px_34px_rgba(17,17,17,0.045)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
              Setup Internal Plan
            </p>
            <p className="text-sm font-bold">
              {getRapSetupStageLabel(activeRapStage)}
            </p>
          </div>
          <Badge status="DRAFT">
            Tahap {getRapSetupStageNumber(activeRapStage)} / 4
          </Badge>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-container">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{
              width: `${getRapSetupStageNumber(activeRapStage) * 25}%`,
            }}
          />
        </div>
        <SegmentedTabs
          value={activeRapStage}
          onChange={setActiveRapStage}
          ariaLabel="Tahap setup RAP"
          className="mt-3"
          options={RAP_SETUP_STAGES.map((stage, index) => {
            return {
              value: stage,
              label: String(index + 1),
              disabled: !isRapSetupStageUnlocked({ stageIndex: index, rap }),
            };
          })}
        />
      </section>

      {activeRapStage === "MATERIAL" && (
        <MaterialRapStagePanel
          rap={rap}
          plannedCost={plannedCost}
          needToBuy={needToBuy}
          isPending={isPending}
          canEditRap={canEditRap}
          openAddRapForm={openAddRapForm}
          setRapDetailItemId={setRapDetailItemId}
          handleAdvanceRapSetup={handleAdvanceRapSetup}
        />
      )}

      {activeRapStage === "TUKANG" && (
        <PackageSetupStagePanel
          rap={rap}
          stage="TUKANG"
          title="Paket Tukang"
          items={tukangPlanItems}
          skipped={rap.tukangScopeSkipped}
          isPending={isPending}
          canEditCategoryPlan={canEditCategoryPlan}
          openAddCategoryPlanForm={openAddCategoryPlanForm}
          setPackageDetailItemId={setPackageDetailItemId}
          handleScopeSkip={handleScopeSkip}
          handleAdvanceRapSetup={handleAdvanceRapSetup}
        />
      )}

      {activeRapStage === "SUBCON" && (
        <PackageSetupStagePanel
          rap={rap}
          stage="SUBCON"
          title="Paket Subcon"
          items={subconPlanItems}
          skipped={rap.subconScopeSkipped}
          isPending={isPending}
          canEditCategoryPlan={canEditCategoryPlan}
          openAddCategoryPlanForm={openAddCategoryPlanForm}
          setPackageDetailItemId={setPackageDetailItemId}
          handleScopeSkip={handleScopeSkip}
          handleAdvanceRapSetup={handleAdvanceRapSetup}
        />
      )}

      {activeRapStage === "REVIEW" && (
        <ReviewInternalPlanPanel
          rap={rap}
          plannedCost={plannedCost}
          tukangPlanItems={tukangPlanItems}
          subconPlanItems={subconPlanItems}
          isPending={isPending}
          canFinalizeRap={canFinalizeRap}
          setActiveRapStage={setActiveRapStage}
          handleFinalizeInternalPlan={handleFinalizeInternalPlan}
        />
      )}
    </>
  );
}
