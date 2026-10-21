"use client";

import type { Dispatch, SetStateAction } from "react";
import { usePermissions } from "@/components/auth/permissions-provider";
import type {
  RapView,
  ChangeOrderHistoryView,
  RabEstimateView,
  RabRevisionHistoryView,
  ProjectCategoryPlanItemView,
  RabItemView,
  RabBundleView,
  ManualQuotationLine,
} from "../types/rap-rab-types";
import type { RabBundleForm, RabChangeOrderForm } from "../types/rab-drawer-types";
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
    canCreateRab,
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

  function updateIntent<T>(setter: Dispatch<SetStateAction<T>>, value: SetStateAction<T>): void {
    if (!actions.isPending) setter(value);
  }

  return {
    isPending: actions.isPending,
    error: actions.error,
    success: actions.success,
    ...forms,
    setRabDraftEdits: (value: SetStateAction<Record<string, RabItemView>>): void =>
      updateIntent(forms.setRabDraftEdits, value),
    setSelectedRapQuotationIds: (value: SetStateAction<string[]>): void =>
      updateIntent(forms.setSelectedRapQuotationIds, value),
    setSelectedCategoryQuotationIds: (value: SetStateAction<string[]>): void =>
      updateIntent(forms.setSelectedCategoryQuotationIds, value),
    setSelectedBaselineManualItemIds: (value: SetStateAction<string[]>): void =>
      updateIntent(forms.setSelectedBaselineManualItemIds, value),
    setManualQuotationLine: (value: SetStateAction<ManualQuotationLine>): void =>
      updateIntent(forms.setManualQuotationLine, value),
    setChangeOrderForm: (value: SetStateAction<RabChangeOrderForm>): void =>
      updateIntent(forms.setChangeOrderForm, value),
    setBundleForm: (value: SetStateAction<RabBundleForm>): void =>
      updateIntent(forms.setBundleForm, value),
    setVoidReason: (value: string): void => {
      if (!actions.isPending) forms.setVoidReason(value);
    },
    handleRabEditChange: (item: RabItemView, updates: Partial<RabItemView>): void => {
      if (!actions.isPending) forms.handleRabEditChange(item, updates);
    },
    toggleBundleItem: (id: string): void => {
      if (!actions.isPending) forms.toggleBundleItem(id);
    },
    discardSourceSelection: (): void => {
      if (!actions.isPending) forms.discardSourceSelection();
    },
    discardManualLine: (): void => {
      if (!actions.isPending) forms.discardManualLine();
    },
    setSourcePickerOpen: (open: boolean): void => {
      if (actions.isPending) return;
      if (open) actions.resetMessages();
      forms.setSourcePickerOpen(open);
    },
    setManualLineOpen: (open: boolean): void => {
      if (actions.isPending) return;
      if (open) actions.resetMessages();
      forms.setManualLineOpen(open);
    },
    setRabItemEditorId: (id: string | null): void => {
      if (actions.isPending) return;
      if (id !== null) actions.resetMessages();
      forms.setRabItemEditorId(id);
    },
    closeRabItemEditor: (): void => {
      if (!actions.isPending) forms.closeRabItemEditor();
    },
    openCreateBundle: (): void => {
      if (actions.isPending) return;
      actions.resetMessages();
      forms.openCreateBundle();
    },
    openEditBundle: (bundle: RabBundleView): void => {
      if (actions.isPending) return;
      actions.resetMessages();
      forms.openEditBundle(bundle);
    },
    setBundleEditorOpen: (open: boolean): void => {
      if (actions.isPending) return;
      if (open) actions.resetMessages();
      forms.setBundleEditorOpen(open);
    },
    setChangeOrderOpen: (open: boolean): void => {
      if (actions.isPending) return;
      if (open) actions.resetMessages();
      forms.setChangeOrderOpen(open);
    },
    setVoidRevisionOpen: (open: boolean): void => {
      if (actions.isPending) return;
      if (open) actions.resetMessages();
      forms.setVoidRevisionOpen(open);
    },
    canCreateRab,
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
