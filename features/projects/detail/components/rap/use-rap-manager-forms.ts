"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

import type {
  CategoryPlanFormState,
  MaterialOption,
  PricingTemplateOption,
  ProjectCategoryPlanItemView,
  ProjectPlanBudgetCategory,
  RapFormState,
  RapItemView,
  RapOverviewFilter,
  RapSetupStage,
  RapView,
} from "../shared/rap-rab-types";
import {
  applyCategoryTemplateToForm,
  applyMaterialToRapForm,
  applyRapTemplateToForm,
  buildCategoryPlanFormFromItem,
  buildNewCategoryPlanForm,
  buildRapFormFromItem,
  emptyCategoryPlanForm,
  emptyRapForm,
  getInitialRapOverviewFilter,
  getInitialRapStage,
} from "./rap-manager-utils";

export function useRapManagerForms({
  rap,
  materials,
  budgetCategories,
  pricingTemplates,
}: {
  readonly rap: RapView | null;
  readonly materials: readonly MaterialOption[];
  readonly budgetCategories: readonly ProjectPlanBudgetCategory[];
  readonly pricingTemplates: readonly PricingTemplateOption[];
}): {
  readonly showRapForm: boolean;
  readonly setShowRapForm: (show: boolean) => void;
  readonly showCategoryPlanForm: boolean;
  readonly setShowCategoryPlanForm: (show: boolean) => void;
  readonly rapForm: RapFormState;
  readonly setRapForm: Dispatch<SetStateAction<RapFormState>>;
  readonly categoryPlanForm: CategoryPlanFormState;
  readonly setCategoryPlanForm: Dispatch<
    SetStateAction<CategoryPlanFormState>
  >;
  readonly editingRapItemId: string | null;
  readonly editingCategoryPlanItemId: string | null;
  readonly activeRapStage: RapSetupStage;
  readonly setActiveRapStage: (stage: RapSetupStage) => void;
  readonly rapOverviewFilter: RapOverviewFilter;
  readonly setRapOverviewFilter: (filter: RapOverviewFilter) => void;
  readonly rapDetailItemId: string | null;
  readonly setRapDetailItemId: (id: string | null) => void;
  readonly packageDetailItemId: string | null;
  readonly setPackageDetailItemId: (id: string | null) => void;
  readonly internalRevisionOpen: boolean;
  readonly setInternalRevisionOpen: (open: boolean) => void;
  readonly internalRevisionReason: string;
  readonly setInternalRevisionReason: (reason: string) => void;
  readonly reviseMaterial: boolean;
  readonly setReviseMaterial: (revise: boolean) => void;
  readonly revisionPackageIds: string[];
  readonly setRevisionPackageIds: Dispatch<SetStateAction<string[]>>;
  readonly handleMaterialChange: (materialId: string) => void;
  readonly handleRapTemplateChange: (templateId: string) => void;
  readonly handleCategoryTemplateChange: (templateId: string) => void;
  readonly openAddRapForm: () => void;
  readonly openEditRapForm: (item: RapItemView) => void;
  readonly closeRapForm: () => void;
  readonly openAddCategoryPlanForm: (categoryCode: "TUKANG" | "SUBCON") => void;
  readonly openEditCategoryPlanForm: (item: ProjectCategoryPlanItemView) => void;
  readonly closeCategoryPlanForm: () => void;
  readonly toggleRevisionPackage: (id: string) => void;
} {
  const [showRapForm, setShowRapForm] = useState(false);
  const [showCategoryPlanForm, setShowCategoryPlanForm] = useState(false);
  const [rapForm, setRapForm] = useState<RapFormState>(emptyRapForm);
  const [categoryPlanForm, setCategoryPlanForm] =
    useState<CategoryPlanFormState>(emptyCategoryPlanForm);
  const [editingRapItemId, setEditingRapItemId] = useState<string | null>(null);
  const [editingCategoryPlanItemId, setEditingCategoryPlanItemId] = useState<
    string | null
  >(null);
  const [activeRapStage, setActiveRapStage] = useState<RapSetupStage>(() =>
    getInitialRapStage(rap),
  );
  const [rapOverviewFilter, setRapOverviewFilter] =
    useState<RapOverviewFilter>(getInitialRapOverviewFilter);
  const [rapDetailItemId, setRapDetailItemId] = useState<string | null>(null);
  const [packageDetailItemId, setPackageDetailItemId] = useState<string | null>(
    null,
  );
  const [internalRevisionOpen, setInternalRevisionOpen] = useState(false);
  const [internalRevisionReason, setInternalRevisionReason] = useState("");
  const [reviseMaterial, setReviseMaterial] = useState(false);
  const [revisionPackageIds, setRevisionPackageIds] = useState<string[]>([]);

  function handleMaterialChange(materialId: string): void {
    setRapForm((current) =>
      applyMaterialToRapForm({ current, materialId, materials }),
    );
  }

  function handleRapTemplateChange(templateId: string): void {
    setRapForm((current) =>
      applyRapTemplateToForm({
        current,
        templateId,
        materials,
        pricingTemplates,
      }),
    );
  }

  function handleCategoryTemplateChange(templateId: string): void {
    setCategoryPlanForm((current) =>
      applyCategoryTemplateToForm({
        current,
        templateId,
        budgetCategories,
        pricingTemplates,
      }),
    );
  }

  function openAddRapForm(): void {
    setEditingRapItemId(null);
    setRapForm(emptyRapForm);
    setShowRapForm(true);
  }

  function openEditRapForm(item: RapItemView): void {
    setEditingRapItemId(item.id);
    setRapForm(buildRapFormFromItem(item));
    setShowRapForm(true);
  }

  function closeRapForm(): void {
    setShowRapForm(false);
    setEditingRapItemId(null);
    setRapForm(emptyRapForm);
  }

  function openAddCategoryPlanForm(categoryCode: "TUKANG" | "SUBCON"): void {
    setEditingCategoryPlanItemId(null);
    setCategoryPlanForm(
      buildNewCategoryPlanForm({ categoryCode, budgetCategories }),
    );
    setShowCategoryPlanForm(true);
  }

  function openEditCategoryPlanForm(item: ProjectCategoryPlanItemView): void {
    setEditingCategoryPlanItemId(item.id);
    setCategoryPlanForm(buildCategoryPlanFormFromItem(item));
    setShowCategoryPlanForm(true);
  }

  function closeCategoryPlanForm(): void {
    setShowCategoryPlanForm(false);
    setEditingCategoryPlanItemId(null);
    setCategoryPlanForm(emptyCategoryPlanForm);
  }

  function toggleRevisionPackage(id: string): void {
    setRevisionPackageIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id],
    );
  }

  return {
    showRapForm,
    setShowRapForm,
    showCategoryPlanForm,
    setShowCategoryPlanForm,
    rapForm,
    setRapForm,
    categoryPlanForm,
    setCategoryPlanForm,
    editingRapItemId,
    editingCategoryPlanItemId,
    activeRapStage,
    setActiveRapStage,
    rapOverviewFilter,
    setRapOverviewFilter,
    rapDetailItemId,
    setRapDetailItemId,
    packageDetailItemId,
    setPackageDetailItemId,
    internalRevisionOpen,
    setInternalRevisionOpen,
    internalRevisionReason,
    setInternalRevisionReason,
    reviseMaterial,
    setReviseMaterial,
    revisionPackageIds,
    setRevisionPackageIds,
    handleMaterialChange,
    handleRapTemplateChange,
    handleCategoryTemplateChange,
    openAddRapForm,
    openEditRapForm,
    closeRapForm,
    openAddCategoryPlanForm,
    openEditCategoryPlanForm,
    closeCategoryPlanForm,
    toggleRevisionPackage,
  };
}
