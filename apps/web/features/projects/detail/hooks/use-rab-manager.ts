"use client";

import { usePermissions } from "@/components/auth/permissions-provider";
import type {
  RapView,
  ChangeOrderHistoryView,
  RabEstimateView,
  RabRevisionHistoryView,
  ProjectCategoryPlanItemView,
} from "../types/rap-rab-types";
import { getRabManagerDerivedValues } from "../utils/rab-manager-utils";
import { useRabManagerActions } from "./use-rab-manager-actions";
import { useRabManagerForms } from "./use-rab-manager-forms";

export { emptyManualQuotationLine } from "../utils/rab-manager-utils";

interface UseRabManagerProps {
  readonly projectId: string;
  readonly rap: RapView | null;
  readonly rabEstimate: RabEstimateView | null;
  readonly userRole: string;
  readonly categoryPlanItems: ProjectCategoryPlanItemView[];
  readonly baselineApprovedRabId: string | null;
  readonly changeOrders: readonly ChangeOrderHistoryView[];
  readonly revisionHistory: readonly RabRevisionHistoryView[];
}

export function useRabManager({
  projectId,
  rap,
  rabEstimate,
  categoryPlanItems,
  baselineApprovedRabId,
  revisionHistory,
}: UseRabManagerProps) {
  const permissions = usePermissions();
  const forms = useRabManagerForms({ rap, rabEstimate, categoryPlanItems });
  const {
    rabDraftEdits,
    setRabDraftEdits,
    selectedRapQuotationIds,
    selectedCategoryQuotationIds,
    selectedBaselineManualItemIds,
    manualQuotationLine,
    setManualQuotationLine,
    changeOrderForm,
    editingBundleId,
    bundleForm,
    setBundleEditorOpen,
    setSourcePickerOpen,
    setManualLineOpen,
    setRabItemEditorId,
    setChangeOrderOpen,
    voidReason,
    setVoidReason,
    setVoidRevisionOpen,
  } = forms;
  const actions = useRabManagerActions({
    projectId,
    rabEstimate,
    baselineApprovedRabId,
    selectedRapQuotationIds,
    selectedCategoryQuotationIds,
    selectedBaselineManualItemIds,
    manualQuotationLine,
    setManualQuotationLine,
    rabDraftEdits,
    setRabDraftEdits,
    changeOrderForm,
    editingBundleId,
    bundleForm,
    setBundleEditorOpen,
    setSourcePickerOpen,
    setManualLineOpen,
    setRabItemEditorId,
    setChangeOrderOpen,
    voidReason,
    setVoidReason,
    setVoidRevisionOpen,
  });

  const {
    canApproveRab,
    canManageRab,
    visibleRabValue,
    approvedBaseline,
    isRevisionDraft,
    selectedQuotationSourceCount,
    sortedRabItems,
  } = getRabManagerDerivedValues({
    permissions,
    rabEstimate,
    revisionHistory,
    selectedRapQuotationIds,
    selectedCategoryQuotationIds,
    selectedBaselineManualItemIds,
    manualQuotationLine,
  });

  return {
    isPending: actions.isPending,
    error: actions.error,
    success: actions.success,
    ...forms,
    canApproveRab,
    canManageRab,
    visibleRabValue,
    approvedBaseline,
    isRevisionDraft,
    selectedQuotationSourceCount,
    sortedRabItems,
    handleGenerateRab: actions.handleGenerateRab,
    handleSaveRabItem: actions.handleSaveRabItem,
    handleAddManualRabItem: actions.handleAddManualRabItem,
    handleApproveRab: actions.handleApproveRab,
    handleRefreshRabSources: actions.handleRefreshRabSources,
    handleSaveBundle: actions.handleSaveBundle,
    handleDeleteBundle: actions.handleDeleteBundle,
    handleApproveChangeOrder: actions.handleApproveChangeOrder,
    handleVoidRabRevision: actions.handleVoidRabRevision,
  };
}
