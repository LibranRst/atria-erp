"use client";

import React from "react";
import { NativePanel } from "./rap-rab-primitives";
import { RapSetupPanel } from "../rap/rap-setup-panel";
import { InternalPlanOverview } from "../rap/internal-plan-overview";
import { RabClientPanel } from "../rab/rab-client-panel";
import { useRapManager } from "../rap/use-rap-manager";
import { useRabManager } from "../rab/use-rab-manager";
import { RapRabWorkflowDrawers } from "./rap-rab-workflow-drawers";
import type {
  MaterialOption,
  PricingTemplateOption,
  RapItemView,
  RapView,
  RabItemView,
  RabBundleView,
  ChangeOrderHistoryView,
  RabEstimateView,
  RabRevisionHistoryView,
  ProjectPlanBudgetCategory,
  VendorOption,
  ProjectCategoryPlanItemView,
  RapFormState,
  CategoryPlanFormState,
  ManualQuotationLine,
  RapSetupStage,
  RapOverviewFilter,
} from "./rap-rab-types"; // shared sibling

export type {
  MaterialOption,
  PricingTemplateOption,
  RapItemView,
  RapView,
  RabItemView,
  RabBundleView,
  ChangeOrderHistoryView,
  RabEstimateView,
  RabRevisionHistoryView,
  ProjectPlanBudgetCategory,
  VendorOption,
  ProjectCategoryPlanItemView,
  RapFormState,
  CategoryPlanFormState,
  ManualQuotationLine,
  RapSetupStage,
  RapOverviewFilter,
};

interface RapRabManagerProps {
  readonly projectId: string;
  readonly rap: RapView | null;
  readonly rabEstimate: RabEstimateView | null;
  readonly materials: MaterialOption[];
  readonly userRole: string;
  readonly budgetCategories: ProjectPlanBudgetCategory[];
  readonly categoryPlanItems: ProjectCategoryPlanItemView[];
  readonly vendors: VendorOption[];
  readonly pricingTemplates: PricingTemplateOption[];
  readonly baselineApprovedRabId: string | null;
  readonly changeOrders: readonly ChangeOrderHistoryView[];
  readonly revisionHistory: readonly RabRevisionHistoryView[];
  readonly staleSourceLabels: readonly string[];
  readonly mode?: "all" | "rap" | "rab";
}

export function RapRabManager({
  projectId,
  rap,
  rabEstimate,
  materials,
  userRole,
  budgetCategories,
  categoryPlanItems,
  vendors,
  pricingTemplates,
  baselineApprovedRabId,
  changeOrders,
  revisionHistory,
  staleSourceLabels,
  mode = "all",
}: RapRabManagerProps): React.JSX.Element {
  const rapManager = useRapManager({
    projectId,
    rap,
    materials,
    userRole,
    budgetCategories,
    categoryPlanItems,
    pricingTemplates,
  });

  const rabManager = useRabManager({
    projectId,
    rap,
    rabEstimate,
    userRole,
    categoryPlanItems,
    baselineApprovedRabId,
    changeOrders,
    revisionHistory,
  });

  const combinedError = rapManager.error ?? rabManager.error;
  const combinedSuccess = rapManager.success ?? rabManager.success;

  const showRapPlanning = mode === "all" || mode === "rap";
  const showRab = mode === "all" || mode === "rab";

  return (
    <div className="space-y-lg max-[430px]:space-y-5">
      {(combinedError || combinedSuccess) && (
        <div
          className={`rounded-2xl border p-md text-xs font-semibold ${combinedError ? "border-error/30 bg-error-container/20 text-error" : "border-primary/30 bg-surface-container-low text-primary"}`}
        >
          {combinedError ?? combinedSuccess}
        </div>
      )}

      {showRapPlanning && (
        <div className="space-y-lg max-[430px]:space-y-5">
          {!rap ? (
            <NativePanel eyebrow="Rencana Internal" title="Mulai dari Material">
              <div className="py-lg text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-[28px]">architecture</span>
                </div>
                <h3 className="mt-4 text-base font-bold">Susun kebutuhan material proyek</h3>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-on-surface-variant">
                  Material menjadi baseline biaya internal. Tukang dan Subcon disusun setelahnya.
                </p>
                {rapManager.canEditRap && (
                  <button
                    type="button"
                    onClick={rapManager.handleCreateRap}
                    disabled={rapManager.isPending}
                    className="mt-5 min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-on-primary disabled:opacity-40"
                  >
                    Mulai Susun RAP
                  </button>
                )}
              </div>
            </NativePanel>
          ) : rap.status === "DRAFT" ? (
            <RapSetupPanel
              rap={rap}
              activeRapStage={rapManager.activeRapStage}
              setActiveRapStage={rapManager.setActiveRapStage}
              plannedCost={rapManager.plannedCost}
              needToBuy={rapManager.needToBuy}
              isPending={rapManager.isPending}
              canEditRap={rapManager.canEditRap}
              openAddRapForm={rapManager.openAddRapForm}
              setRapDetailItemId={rapManager.setRapDetailItemId}
              handleAdvanceRapSetup={rapManager.handleAdvanceRapSetup}
              tukangPlanItems={rapManager.tukangPlanItems}
              subconPlanItems={rapManager.subconPlanItems}
              canEditCategoryPlan={rapManager.canEditCategoryPlan}
              openAddCategoryPlanForm={rapManager.openAddCategoryPlanForm}
              setPackageDetailItemId={rapManager.setPackageDetailItemId}
              handleScopeSkip={rapManager.handleScopeSkip}
              canFinalizeRap={rapManager.canFinalizeRap}
              handleFinalizeInternalPlan={rapManager.handleFinalizeInternalPlan}
            />
          ) : (
            <InternalPlanOverview
              rap={rap}
              plannedCost={rapManager.plannedCost}
              tukangPlanItems={rapManager.tukangPlanItems}
              subconPlanItems={rapManager.subconPlanItems}
              packageItemCount={rapManager.packageItemCount}
              needToBuy={rapManager.needToBuy}
              canEditRap={rapManager.canEditRap}
              rabEstimate={rabEstimate}
              setInternalRevisionOpen={rapManager.setInternalRevisionOpen}
              rapOverviewFilter={rapManager.rapOverviewFilter}
              setRapOverviewFilter={rapManager.setRapOverviewFilter}
              setRapDetailItemId={rapManager.setRapDetailItemId}
              setPackageDetailItemId={rapManager.setPackageDetailItemId}
            />
          )}
        </div>
      )}

      {showRab && (
        <div className="space-y-sm">
          <RabClientPanel
            rabEstimate={rabEstimate}
            isRevisionDraft={rabManager.isRevisionDraft}
            approvedBaseline={rabManager.approvedBaseline}
            visibleRabValue={rabManager.visibleRabValue}
            staleSourceLabels={staleSourceLabels}
            isPending={rabManager.isPending}
            handleRefreshRabSources={rabManager.handleRefreshRabSources}
            canManageRab={rabManager.canManageRab}
            rap={rap}
            setSourcePickerOpen={rabManager.setSourcePickerOpen}
            setManualLineOpen={rabManager.setManualLineOpen}
            openEditBundle={rabManager.openEditBundle}
            setRabItemEditorId={rabManager.setRabItemEditorId}
            sortedRabItems={rabManager.sortedRabItems}
            openCreateBundle={rabManager.openCreateBundle}
            setChangeOrderOpen={rabManager.setChangeOrderOpen}
            setVoidRevisionOpen={rabManager.setVoidRevisionOpen}
            handleApproveRab={rabManager.handleApproveRab}
            revisionHistory={revisionHistory}
            changeOrders={changeOrders}
            setHistoryDetailId={rabManager.setHistoryDetailId}
          />
        </div>
      )}

      <RapRabWorkflowDrawers
        rap={rap}
        rabEstimate={rabEstimate}
        materials={materials}
        budgetCategories={budgetCategories}
        categoryPlanItems={categoryPlanItems}
        vendors={vendors}
        pricingTemplates={pricingTemplates}
        changeOrders={changeOrders}
        rapManager={rapManager}
        rabManager={rabManager}
      />
    </div>
  );
}
