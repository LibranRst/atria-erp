import type { FormEvent } from "react";

import type {
  CategoryPlanFormState,
  PricingTemplateOption,
  RapFormState,
  RapView,
} from "../shared/rap-rab-types";

export interface UseRapManagerActionsProps {
  readonly projectId: string;
  readonly rap: RapView | null;
  readonly pricingTemplates: readonly PricingTemplateOption[];
  readonly rapForm: RapFormState;
  readonly categoryPlanForm: CategoryPlanFormState;
  readonly editingRapItemId: string | null;
  readonly editingCategoryPlanItemId: string | null;
  readonly setActiveRapStage: (stage: "TUKANG" | "SUBCON" | "REVIEW") => void;
  readonly setPackageDetailItemId: (id: string | null) => void;
  readonly internalRevisionReason: string;
  readonly setInternalRevisionOpen: (open: boolean) => void;
  readonly setInternalRevisionReason: (reason: string) => void;
  readonly reviseMaterial: boolean;
  readonly setReviseMaterial: (revise: boolean) => void;
  readonly revisionPackageIds: readonly string[];
  readonly setRevisionPackageIds: (ids: string[]) => void;
  readonly closeRapForm: () => void;
  readonly closeCategoryPlanForm: () => void;
}

export interface UseRapManagerActionsResult {
  readonly isPending: boolean;
  readonly error: string | null;
  readonly success: string | null;
  readonly handleCreateRap: () => void;
  readonly handleSubmitCategoryPlanItem: (event: FormEvent) => void;
  readonly handleMarkCategoryPlanActive: (
    projectCategoryPlanItemId: string,
  ) => void;
  readonly handleDeleteCategoryPlanItem: (
    projectCategoryPlanItemId: string,
  ) => void;
  readonly handleSubmitRapItem: (event: FormEvent) => void;
  readonly handleDeleteRapItem: (projectRapItemId: string) => void;
  readonly handleAdvanceRapSetup: (
    targetStage: "TUKANG" | "SUBCON" | "REVIEW",
  ) => void;
  readonly handleScopeSkip: (
    categoryCode: "TUKANG" | "SUBCON",
    skipped: boolean,
  ) => void;
  readonly handleReopenPackage: (itemId: string) => void;
  readonly handleFinalizeInternalPlan: () => void;
  readonly handleCreateInternalPlanRevision: () => void;
}
