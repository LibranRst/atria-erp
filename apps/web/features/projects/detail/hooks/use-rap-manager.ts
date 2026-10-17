"use client";

import { usePermissions } from "@/components/auth/permissions-provider";
import type {
  MaterialOption,
  PricingTemplateOption,
  RapView,
  RapItemView,
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
  budgetCategories,
  categoryPlanItems,
  pricingTemplates,
}: UseRapManagerProps) {
  const permissions = usePermissions();
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

  const { canCreateRap, canEditRap, canEditCategoryPlan, canFinalizeRap } =
    getRapPermissions(permissions);
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
    openAddRapForm: (): void => {
      actions.resetMessages();
      forms.openAddRapForm();
    },
    openEditRapForm: (item: RapItemView): void => {
      actions.resetMessages();
      forms.openEditRapForm(item);
    },
    openAddCategoryPlanForm: (category: "TUKANG" | "SUBCON"): void => {
      actions.resetMessages();
      forms.openAddCategoryPlanForm(category);
    },
    openEditCategoryPlanForm: (item: ProjectCategoryPlanItemView): void => {
      actions.resetMessages();
      forms.openEditCategoryPlanForm(item);
    },
    canCreateRap,
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
