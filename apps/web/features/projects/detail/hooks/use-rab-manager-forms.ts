"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

import type {
  ManualQuotationLine,
  ProjectCategoryPlanItemView,
  RabBundleView,
  RabEstimateView,
  RabItemView,
  RapView,
} from "../types/rap-rab-types";
import type { RabBundleForm, RabChangeOrderForm } from "../types/rab-drawer-types";
import {
  buildBundleFormFromBundle,
  createEmptyRabChangeOrderForm,
  emptyManualQuotationLine,
  emptyRabBundleForm,
  getInitialSelectedCategoryQuotationIds,
  getInitialSelectedRapQuotationIds,
  toggleBundleItemInForm,
} from "../utils/rab-manager-utils";

interface UseRabManagerFormsProps {
  readonly rap: RapView | null;
  readonly rabEstimate: RabEstimateView | null;
  readonly categoryPlanItems: readonly ProjectCategoryPlanItemView[];
}

interface UseRabManagerFormsResult {
  readonly rabDraftEdits: Record<string, RabItemView>;
  readonly setRabDraftEdits: Dispatch<SetStateAction<Record<string, RabItemView>>>;
  readonly selectedRapQuotationIds: string[];
  readonly setSelectedRapQuotationIds: Dispatch<SetStateAction<string[]>>;
  readonly selectedCategoryQuotationIds: string[];
  readonly setSelectedCategoryQuotationIds: Dispatch<SetStateAction<string[]>>;
  readonly manualQuotationLine: ManualQuotationLine;
  readonly setManualQuotationLine: Dispatch<SetStateAction<ManualQuotationLine>>;
  readonly changeOrderForm: RabChangeOrderForm;
  readonly setChangeOrderForm: Dispatch<SetStateAction<RabChangeOrderForm>>;
  readonly bundleEditorOpen: boolean;
  readonly setBundleEditorOpen: (open: boolean) => void;
  readonly editingBundleId: string | null;
  readonly setEditingBundleId: (id: string | null) => void;
  readonly bundleForm: RabBundleForm;
  readonly setBundleForm: Dispatch<SetStateAction<RabBundleForm>>;
  readonly historyDetailId: string | null;
  readonly setHistoryDetailId: (id: string | null) => void;
  readonly sourcePickerOpen: boolean;
  readonly setSourcePickerOpen: (open: boolean) => void;
  readonly manualLineOpen: boolean;
  readonly setManualLineOpen: (open: boolean) => void;
  readonly rabItemEditorId: string | null;
  readonly setRabItemEditorId: (id: string | null) => void;
  readonly changeOrderOpen: boolean;
  readonly setChangeOrderOpen: (open: boolean) => void;
  readonly voidRevisionOpen: boolean;
  readonly setVoidRevisionOpen: (open: boolean) => void;
  readonly voidReason: string;
  readonly setVoidReason: (reason: string) => void;
  readonly handleRabEditChange: (item: RabItemView, updates: Partial<RabItemView>) => void;
  readonly closeRabItemEditor: () => void;
  readonly openCreateBundle: () => void;
  readonly openEditBundle: (bundle: RabBundleView) => void;
  readonly toggleBundleItem: (id: string) => void;
}

export function useRabManagerForms({
  rap,
  rabEstimate,
  categoryPlanItems,
}: UseRabManagerFormsProps): UseRabManagerFormsResult {
  const [rabDraftEdits, setRabDraftEdits] = useState<Record<string, RabItemView>>({});
  const [selectedRapQuotationIds, setSelectedRapQuotationIds] = useState<string[]>(() =>
    getInitialSelectedRapQuotationIds(rap),
  );
  const [selectedCategoryQuotationIds, setSelectedCategoryQuotationIds] = useState<string[]>(() =>
    getInitialSelectedCategoryQuotationIds(categoryPlanItems),
  );
  const [manualQuotationLine, setManualQuotationLine] =
    useState<ManualQuotationLine>(emptyManualQuotationLine);
  const [changeOrderForm, setChangeOrderForm] = useState(createEmptyRabChangeOrderForm);
  const [bundleEditorOpen, setBundleEditorOpen] = useState(false);
  const [editingBundleId, setEditingBundleId] = useState<string | null>(null);
  const [bundleForm, setBundleForm] = useState(emptyRabBundleForm);
  const [historyDetailId, setHistoryDetailId] = useState<string | null>(null);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [manualLineOpen, setManualLineOpen] = useState(false);
  const [rabItemEditorId, setRabItemEditorId] = useState<string | null>(null);
  const [changeOrderOpen, setChangeOrderOpen] = useState(false);
  const [voidRevisionOpen, setVoidRevisionOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  function handleRabEditChange(item: RabItemView, updates: Partial<RabItemView>): void {
    setRabDraftEdits((current) => ({
      ...current,
      [item.id]: {
        ...(current[item.id] ?? item),
        ...updates,
      },
    }));
  }

  function closeRabItemEditor(): void {
    if (rabItemEditorId) {
      setRabDraftEdits((current) => {
        const next = { ...current };
        delete next[rabItemEditorId];
        return next;
      });
    }
    setRabItemEditorId(null);
  }

  function openCreateBundle(): void {
    setEditingBundleId(null);
    setBundleForm(emptyRabBundleForm);
    setBundleEditorOpen(true);
  }

  function openEditBundle(bundle: RabBundleView): void {
    setEditingBundleId(bundle.id);
    setBundleForm(buildBundleFormFromBundle(bundle));
    setBundleEditorOpen(true);
  }

  function toggleBundleItem(id: string): void {
    setBundleForm((current) => toggleBundleItemInForm({ current, itemId: id, rabEstimate }));
  }

  return {
    rabDraftEdits,
    setRabDraftEdits,
    selectedRapQuotationIds,
    setSelectedRapQuotationIds,
    selectedCategoryQuotationIds,
    setSelectedCategoryQuotationIds,
    manualQuotationLine,
    setManualQuotationLine,
    changeOrderForm,
    setChangeOrderForm,
    bundleEditorOpen,
    setBundleEditorOpen,
    editingBundleId,
    setEditingBundleId,
    bundleForm,
    setBundleForm,
    historyDetailId,
    setHistoryDetailId,
    sourcePickerOpen,
    setSourcePickerOpen,
    manualLineOpen,
    setManualLineOpen,
    rabItemEditorId,
    setRabItemEditorId,
    changeOrderOpen,
    setChangeOrderOpen,
    voidRevisionOpen,
    setVoidRevisionOpen,
    voidReason,
    setVoidReason,
    handleRabEditChange,
    closeRabItemEditor,
    openCreateBundle,
    openEditBundle,
    toggleBundleItem,
  };
}
