"use client";

import type {
  MaterialOption,
  PricingTemplateOption,
  RapView,
  ProjectPlanBudgetCategory,
  ProjectCategoryPlanItemView,
} from "../types/rap-rab-types";
import { getRapManagerDerivedValues, getRapPermissions } from "../utils/rap-manager-utils";
import { useRapManagerActions } from "./use-rap-manager-actions";
import { useRapManagerForms } from "./use-rap-manager-forms";

export { emptyCategoryPlanForm, emptyRapForm } from "../utils/rap-manager-utils";

interface UseRapManagerProps {
  readonly projectId: string;
  readonly rap: RapView | null;
  readonly materials: MaterialOption[];
  readonly userRole: string;
  readonly budgetCategories: ProjectPlanBudgetCategory[];
  readonly categoryPlanItems: ProjectCategoryPlanItemView[];
  readonly pricingTemplates: PricingTemplateOption[];
}

export function useRapManager({
  projectId,
  rap,
  materials,
  userRole,
  budgetCategories,
  categoryPlanItems,
  pricingTemplates,
}: UseRapManagerProps) {
  const forms = useRapManagerForms({
    rap,
    materials,
    budgetCategories,
    pricingTemplates,
  });
  const {
    rapForm,
    categoryPlanForm,
    editingRapItemId,
    editingCategoryPlanItemId,
    setActiveRapStage,
    setPackageDetailItemId,
    internalRevisionReason,
    setInternalRevisionOpen,
    setInternalRevisionReason,
    reviseMaterial,
    setReviseMaterial,
    revisionPackageIds,
    setRevisionPackageIds,
    closeRapForm,
    closeCategoryPlanForm,
  } = forms;
  const actions = useRapManagerActions({
    projectId,
    rap,
    pricingTemplates,
    rapForm,
    categoryPlanForm,
    editingRapItemId,
    editingCategoryPlanItemId,
    setActiveRapStage,
    setPackageDetailItemId,
    internalRevisionReason,
    setInternalRevisionOpen,
    setInternalRevisionReason,
    reviseMaterial,
    setReviseMaterial,
    revisionPackageIds,
    setRevisionPackageIds,
    closeRapForm,
    closeCategoryPlanForm,
  });

  const { canEditRap, canEditCategoryPlan, canFinalizeRap } = getRapPermissions(userRole);
  const {
    plannedCost,
    needToBuy,
    tukangPlanItems,
    subconPlanItems,
    selectedMaterial,
    formTotalQty,
    formNeedToBuy,
    formEstimatedTotal,
    categoryFormEstimatedTotal,
    packageItemCount,
  } = getRapManagerDerivedValues({
    rap,
    materials,
    categoryPlanItems,
    rapForm,
    categoryPlanForm,
  });

  return {
    isPending: actions.isPending,
    error: actions.error,
    success: actions.success,
    ...forms,
    canEditRap,
    canEditCategoryPlan,
    canFinalizeRap,
    plannedCost,
    needToBuy,
    tukangPlanItems,
    subconPlanItems,
    selectedMaterial,
    formTotalQty,
    formNeedToBuy,
    formEstimatedTotal,
    categoryFormEstimatedTotal,
    packageItemCount,
    handleCreateRap: actions.handleCreateRap,
    handleSubmitCategoryPlanItem: actions.handleSubmitCategoryPlanItem,
    handleMarkCategoryPlanActive: actions.handleMarkCategoryPlanActive,
    handleDeleteCategoryPlanItem: actions.handleDeleteCategoryPlanItem,
    handleSubmitRapItem: actions.handleSubmitRapItem,
    handleDeleteRapItem: actions.handleDeleteRapItem,
    handleAdvanceRapSetup: actions.handleAdvanceRapSetup,
    handleScopeSkip: actions.handleScopeSkip,
    handleReopenPackage: actions.handleReopenPackage,
    handleFinalizeInternalPlan: actions.handleFinalizeInternalPlan,
    handleCreateInternalPlanRevision: actions.handleCreateInternalPlanRevision,
  };
}
