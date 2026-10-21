"use client";

import React from "react";

import {
  CategoryPlanFormDrawer,
  InternalRevisionDrawer,
  PackageDetailDrawer,
  RapItemDetailDrawer,
  RapMaterialFormDrawer,
} from "../rap/rap-drawers";
import {
  ChangeOrderDetailDrawer,
  ChangeOrderDrawer,
  ManualRabLineDrawer,
  RabBundleDrawer,
  RabItemEditDrawer,
  RabSourcePickerDrawer,
  VoidRevisionDrawer,
} from "../rab/rab-drawers";
import type { useRabManager } from "../../hooks/use-rab-manager";
import type { useRapManager } from "../../hooks/use-rap-manager";
import type {
  ChangeOrderHistoryView,
  MaterialOption,
  PricingTemplateOption,
  ProjectCategoryPlanItemView,
  ProjectPlanBudgetCategory,
  RabEstimateView,
  RapView,
  VendorOption,
} from "../../types/rap-rab-types";

interface RapRabWorkflowDrawersProps {
  readonly rap: RapView | null;
  readonly rabEstimate: RabEstimateView | null;
  readonly materials: readonly MaterialOption[];
  readonly budgetCategories: readonly ProjectPlanBudgetCategory[];
  readonly categoryPlanItems: readonly ProjectCategoryPlanItemView[];
  readonly vendors: readonly VendorOption[];
  readonly pricingTemplates: readonly PricingTemplateOption[];
  readonly changeOrders: readonly ChangeOrderHistoryView[];
  readonly rapManager: ReturnType<typeof useRapManager>;
  readonly rabManager: ReturnType<typeof useRabManager>;
  readonly fallbackFocusRef?: React.RefObject<HTMLElement | null>;
}

export function RapRabWorkflowDrawers({
  rap,
  rabEstimate,
  materials,
  budgetCategories,
  categoryPlanItems,
  vendors,
  pricingTemplates,
  changeOrders,
  rapManager,
  rabManager,
  fallbackFocusRef,
}: RapRabWorkflowDrawersProps): React.JSX.Element {
  return (
    <>
      <RapItemDetailDrawer
        rap={rap}
        rapDetailItemId={rapManager.rapDetailItemId}
        setRapDetailItemId={rapManager.setRapDetailItemId}
        canEditRap={rapManager.canEditRap}
        openEditRapForm={rapManager.openEditRapForm}
        handleDeleteRapItem={rapManager.handleDeleteRapItem}
        pending={rapManager.isPending}
      />

      <PackageDetailDrawer
        categoryPlanItems={categoryPlanItems}
        packageDetailItemId={rapManager.packageDetailItemId}
        setPackageDetailItemId={rapManager.setPackageDetailItemId}
        canEditCategoryPlan={rapManager.canEditCategoryPlan}
        openEditCategoryPlanForm={rapManager.openEditCategoryPlanForm}
        handleMarkCategoryPlanActive={rapManager.handleMarkCategoryPlanActive}
        handleDeleteCategoryPlanItem={rapManager.handleDeleteCategoryPlanItem}
        handleReopenPackage={rapManager.handleReopenPackage}
        pending={rapManager.isPending}
      />

      <InternalRevisionDrawer
        internalRevisionOpen={rapManager.internalRevisionOpen}
        setInternalRevisionOpen={rapManager.setInternalRevisionOpen}
        internalRevisionReason={rapManager.internalRevisionReason}
        setInternalRevisionReason={rapManager.setInternalRevisionReason}
        reviseMaterial={rapManager.reviseMaterial}
        setReviseMaterial={rapManager.setReviseMaterial}
        categoryPlanItems={categoryPlanItems}
        revisionPackageIds={rapManager.revisionPackageIds}
        toggleRevisionPackage={rapManager.toggleRevisionPackage}
        handleCreateInternalPlanRevision={rapManager.handleCreateInternalPlanRevision}
        isPending={rapManager.isPending}
        canReviseMaterial={rapManager.canEditRap}
        canRevisePackages={rapManager.canEditCategoryPlan}
      />

      <RabSourcePickerDrawer
        onDiscard={rabManager.discardSourceSelection}
        sourcePickerOpen={rabManager.sourcePickerOpen}
        setSourcePickerOpen={rabManager.setSourcePickerOpen}
        rap={rap}
        categoryPlanItems={categoryPlanItems}
        selectedRapQuotationIds={rabManager.selectedRapQuotationIds}
        setSelectedRapQuotationIds={rabManager.setSelectedRapQuotationIds}
        selectedCategoryQuotationIds={rabManager.selectedCategoryQuotationIds}
        setSelectedCategoryQuotationIds={rabManager.setSelectedCategoryQuotationIds}
        selectedBaselineManualItemIds={rabManager.selectedBaselineManualItemIds}
        setSelectedBaselineManualItemIds={rabManager.setSelectedBaselineManualItemIds}
        manualQuotationLine={rabManager.manualQuotationLine}
        setManualQuotationLine={rabManager.setManualQuotationLine}
        handleGenerateRab={rabManager.handleGenerateRab}
        isPending={rabManager.isPending}
        selectedQuotationSourceCount={rabManager.selectedQuotationSourceCount}
        rabEstimate={rabEstimate}
        error={rabManager.error}
        fallbackFocusRef={fallbackFocusRef}
      />

      <ManualRabLineDrawer
        onDiscard={rabManager.discardManualLine}
        manualLineOpen={rabManager.manualLineOpen}
        setManualLineOpen={rabManager.setManualLineOpen}
        manualQuotationLine={rabManager.manualQuotationLine}
        setManualQuotationLine={rabManager.setManualQuotationLine}
        handleAddManualRabItem={rabManager.handleAddManualRabItem}
        isPending={rabManager.isPending}
        error={rabManager.error}
        fallbackFocusRef={fallbackFocusRef}
      />

      <RabItemEditDrawer
        rabItemEditorId={rabManager.rabItemEditorId}
        closeRabItemEditor={rabManager.closeRabItemEditor}
        sortedRabItems={rabManager.sortedRabItems}
        rabDraftEdits={rabManager.rabDraftEdits}
        handleRabEditChange={rabManager.handleRabEditChange}
        handleSaveRabItem={rabManager.handleSaveRabItem}
        isPending={rabManager.isPending}
        rabEstimate={rabEstimate}
        canManageRab={rabManager.canManageRab}
        error={rabManager.error}
        fallbackFocusRef={fallbackFocusRef}
      />

      <RabBundleDrawer
        bundleEditorOpen={rabManager.bundleEditorOpen}
        setBundleEditorOpen={rabManager.setBundleEditorOpen}
        editingBundleId={rabManager.editingBundleId}
        bundleForm={rabManager.bundleForm}
        toggleBundleItem={rabManager.toggleBundleItem}
        handleSaveBundle={rabManager.handleSaveBundle}
        handleDeleteBundle={rabManager.handleDeleteBundle}
        isPending={rabManager.isPending}
        rabEstimate={rabEstimate}
        setBundleForm={rabManager.setBundleForm}
        canManageRab={rabManager.canManageRab}
        error={rabManager.error}
        fallbackFocusRef={fallbackFocusRef}
      />

      <ChangeOrderDrawer
        changeOrderOpen={rabManager.changeOrderOpen}
        setChangeOrderOpen={rabManager.setChangeOrderOpen}
        changeOrderForm={rabManager.changeOrderForm}
        setChangeOrderForm={rabManager.setChangeOrderForm}
        handleApproveChangeOrder={rabManager.handleApproveChangeOrder}
        isPending={rabManager.isPending}
        approvedBaseline={rabManager.approvedBaseline}
        visibleRabValue={rabManager.visibleRabValue}
        error={rabManager.error}
        fallbackFocusRef={fallbackFocusRef}
      />

      <VoidRevisionDrawer
        voidRevisionOpen={rabManager.voidRevisionOpen}
        setVoidRevisionOpen={rabManager.setVoidRevisionOpen}
        voidReason={rabManager.voidReason}
        setVoidReason={rabManager.setVoidReason}
        handleVoidRabRevision={rabManager.handleVoidRabRevision}
        isPending={rabManager.isPending}
        error={rabManager.error}
        fallbackFocusRef={fallbackFocusRef}
      />

      <ChangeOrderDetailDrawer
        historyDetailId={rabManager.historyDetailId}
        setHistoryDetailId={rabManager.setHistoryDetailId}
        changeOrders={changeOrders}
      />

      <CategoryPlanFormDrawer
        showCategoryPlanForm={rapManager.showCategoryPlanForm}
        closeCategoryPlanForm={rapManager.closeCategoryPlanForm}
        editingCategoryPlanItemId={rapManager.editingCategoryPlanItemId}
        categoryPlanForm={rapManager.categoryPlanForm}
        setCategoryPlanForm={rapManager.setCategoryPlanForm}
        pricingTemplates={pricingTemplates}
        budgetCategories={budgetCategories}
        vendors={vendors}
        handleCategoryTemplateChange={rapManager.handleCategoryTemplateChange}
        handleSubmitCategoryPlanItem={rapManager.handleSubmitCategoryPlanItem}
        isPending={rapManager.isPending}
        categoryFormEstimatedTotal={rapManager.categoryFormEstimatedTotal}
        error={rapManager.error}
      />

      <RapMaterialFormDrawer
        showRapForm={rapManager.showRapForm}
        closeRapForm={rapManager.closeRapForm}
        editingRapItemId={rapManager.editingRapItemId}
        rap={rap}
        rapForm={rapManager.rapForm}
        setRapForm={rapManager.setRapForm}
        pricingTemplates={pricingTemplates}
        materials={materials}
        handleRapTemplateChange={rapManager.handleRapTemplateChange}
        handleMaterialChange={rapManager.handleMaterialChange}
        handleSubmitRapItem={rapManager.handleSubmitRapItem}
        isPending={rapManager.isPending}
        formTotalQty={rapManager.formTotalQty}
        formNeedToBuy={rapManager.formNeedToBuy}
        formEstimatedTotal={rapManager.formEstimatedTotal}
        error={rapManager.error}
      />
    </>
  );
}
