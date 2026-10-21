"use client";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { RapDesktopWorkspace } from "./rap-desktop-workspace";

import { Badge, SegmentedTabs } from "@/components/ui";
import {
  getRapSetupStageLabel,
  getRapSetupStageNumber,
  isRapSetupStageUnlocked,
  RAP_SETUP_STAGES,
} from "../../utils/rap-setup-utils";
import {
  MaterialRapStagePanel,
  PackageSetupStagePanel,
  ReviewInternalPlanPanel,
} from "./rap-setup-stage-panels";
import type {
  RapView,
  RapItemView,
  RapSetupStage,
  ProjectCategoryPlanItemView,
} from "../shared/rap-rab-manager";

function RapSetupMobile({
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
  readonly handleAdvanceRapSetup: (stage: "TUKANG" | "SUBCON" | "REVIEW") => void;
  readonly tukangPlanItems: readonly ProjectCategoryPlanItemView[];
  readonly subconPlanItems: readonly ProjectCategoryPlanItemView[];
  readonly canEditCategoryPlan: boolean;
  readonly openAddCategoryPlanForm: (category: "TUKANG" | "SUBCON") => void;
  readonly setPackageDetailItemId: (id: string | null) => void;
  readonly handleScopeSkip: (categoryCode: "TUKANG" | "SUBCON", skipped: boolean) => void;
  readonly canFinalizeRap: boolean;
  readonly handleFinalizeInternalPlan: () => void;
}): React.JSX.Element {
  return (
    <>
      <section className="rounded-3xl bg-white p-4 shadow-surface ring-1 ring-ring-subtle">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
              Setup rencana internal
            </p>
            <p className="text-sm font-bold">{getRapSetupStageLabel(activeRapStage)}</p>
          </div>
          <Badge status="DRAFT">Tahap {getRapSetupStageNumber(activeRapStage)} / 4</Badge>
        </div>
        <SegmentedTabs
          value={activeRapStage}
          onChange={setActiveRapStage}
          ariaLabel="Tahap setup RAP"
          className="mt-4"
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

export function RapSetupPanel(
  props: React.ComponentProps<typeof RapSetupMobile> & {
    readonly openEditRapForm?: (item: RapItemView) => void;
    readonly openEditCategoryPlanForm?: (item: ProjectCategoryPlanItemView) => void;
  },
): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  return (
    <>
      <div hidden={desktop} inert={desktop} className="space-y-4">
        <RapSetupMobile {...props} />
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
          setup={{
            activeStage: props.activeRapStage,
            onStageChange: props.setActiveRapStage,
            isPending: props.isPending,
            canEditCategoryPlan: props.canEditCategoryPlan,
            onAddMaterial: props.openAddRapForm,
            onEditMaterial: props.openEditRapForm,
            onEditPackage: props.openEditCategoryPlanForm,
            onAddPackage: props.openAddCategoryPlanForm,
            onAdvance: props.handleAdvanceRapSetup,
            onScopeSkip: props.handleScopeSkip,
            canFinalize: props.canFinalizeRap,
            onFinalize: props.handleFinalizeInternalPlan,
          }}
        />
      </div>
    </>
  );
}
