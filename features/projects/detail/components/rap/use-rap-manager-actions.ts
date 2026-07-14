"use client";

import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  addProjectRapItem,
  createProjectRap,
  deleteProjectRapItem,
  updateProjectRapItem,
} from "@/app/actions/project/rap-rab";
import {
  createProjectCategoryPlanItem,
  deleteProjectCategoryPlanItem,
  markProjectCategoryPlanItemActive,
  updateProjectCategoryPlanItem,
} from "@/app/actions/project/category-plan";
import {
  advanceProjectRapSetup,
  finalizeProjectInternalPlan,
  markProjectCategoryPlanItemDraft,
  setProjectRapScopeSkipped,
} from "@/app/actions/project/rap-setup";
import {
  createCategoryPlanRevision,
  createRapRevision,
} from "@/app/actions/project/revision-change-order";
import {
  copyPricingTemplateToCategoryPlan,
  copyPricingTemplateToRap,
} from "@/app/actions/project/workflow-governance";
import {
  buildCategoryPlanPayload,
  buildRapItemPayload,
  getCategoryPlanTemplateOverride,
  getRapTemplateOverride,
} from "./rap-manager-action-payloads";
import type {
  UseRapManagerActionsProps,
  UseRapManagerActionsResult,
} from "./rap-manager-action-types";
import { useRapActionFeedback } from "./use-rap-action-feedback";

export function useRapManagerActions({
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
}: UseRapManagerActionsProps): UseRapManagerActionsResult {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { error, success, resetMessages, showError, showSuccess } =
    useRapActionFeedback();

  function handleCreateRap(): void {
    resetMessages();
    startTransition(async () => {
      const res = await createProjectRap({
        projectId,
        notes: "Draft RAP material internal.",
      });
      if (!res.success) {
        showError(res.error.message);
        return;
      }
      showSuccess("RAP draft berhasil dibuat.");
      router.refresh();
    });
  }

  function handleSubmitCategoryPlanItem(event: FormEvent): void {
    event.preventDefault();
    resetMessages();

    const payload = buildCategoryPlanPayload({ projectId, categoryPlanForm });

    startTransition(async () => {
      const { selectedTemplate, overrideCost } =
        getCategoryPlanTemplateOverride({
          categoryPlanForm,
          pricingTemplates,
        });
      const res = editingCategoryPlanItemId
        ? await updateProjectCategoryPlanItem({
            ...payload,
            projectCategoryPlanItemId: editingCategoryPlanItemId,
          })
        : selectedTemplate
          ? await copyPricingTemplateToCategoryPlan({
              projectId,
              projectBudgetCategoryId: categoryPlanForm.projectBudgetCategoryId,
              itemPriceLibraryId: selectedTemplate.id,
              area: categoryPlanForm.area,
              quantity: Number(categoryPlanForm.quantity),
              overrideUnitCost: overrideCost,
              overrideReason:
                overrideCost !== undefined
                  ? categoryPlanForm.internalNote
                  : undefined,
            })
          : await createProjectCategoryPlanItem(payload);
      if (!res.success) {
        showError(res.error.message);
        return;
      }
      showSuccess(
        editingCategoryPlanItemId
          ? "Package berhasil diperbarui."
          : "Package berhasil dibuat.",
      );
      closeCategoryPlanForm();
      router.refresh();
    });
  }

  function handleMarkCategoryPlanActive(
    projectCategoryPlanItemId: string,
  ): void {
    resetMessages();
    startTransition(async () => {
      const res = await markProjectCategoryPlanItemActive(
        projectCategoryPlanItemId,
      );
      if (!res.success) {
        showError(res.error.message);
        return;
      }
      showSuccess("Package sudah aktif.");
      router.refresh();
    });
  }

  function handleDeleteCategoryPlanItem(
    projectCategoryPlanItemId: string,
  ): void {
    resetMessages();
    startTransition(async () => {
      const res = await deleteProjectCategoryPlanItem(
        projectCategoryPlanItemId,
      );
      if (!res.success) {
        showError(res.error.message);
        return;
      }
      showSuccess("Package draft berhasil dihapus.");
      router.refresh();
    });
  }

  function handleSubmitRapItem(event: FormEvent): void {
    event.preventDefault();
    resetMessages();
    if (!rap) {
      showError("Buat RAP draft terlebih dahulu.");
      return;
    }

    startTransition(async () => {
      const payload = buildRapItemPayload({ rap, rapForm });
      const { selectedTemplate, overrideCost } = getRapTemplateOverride({
        rapForm,
        pricingTemplates,
      });
      const res = editingRapItemId
        ? await updateProjectRapItem({
            ...payload,
            projectRapItemId: editingRapItemId,
          })
        : selectedTemplate
          ? await copyPricingTemplateToRap({
              projectRapId: rap.id,
              itemPriceLibraryId: selectedTemplate.id,
              area: rapForm.area,
              requiredQuantity: Number(rapForm.requiredQuantity),
              bufferQuantity: Number(rapForm.bufferQuantity) || 0,
              source: rapForm.source,
              overrideUnitCost: overrideCost,
              overrideReason:
                overrideCost !== undefined ? rapForm.internalNote : undefined,
            })
          : await addProjectRapItem(payload);
      if (!res.success) {
        showError(res.error.message);
        return;
      }
      showSuccess(
        editingRapItemId
          ? "Item RAP berhasil diperbarui."
          : "Item material RAP berhasil ditambahkan.",
      );
      closeRapForm();
      router.refresh();
    });
  }

  function handleDeleteRapItem(projectRapItemId: string): void {
    resetMessages();
    startTransition(async () => {
      const res = await deleteProjectRapItem(projectRapItemId);
      if (!res.success) {
        showError(res.error.message);
        return;
      }
      showSuccess("Item RAP berhasil dihapus.");
      router.refresh();
    });
  }

  function handleAdvanceRapSetup(
    targetStage: "TUKANG" | "SUBCON" | "REVIEW",
  ): void {
    if (!rap) return;
    resetMessages();
    startTransition(async () => {
      const result = await advanceProjectRapSetup({
        projectRapId: rap.id,
        targetStage,
      });
      if (!result.success) {
        showError(result.error.message);
        return;
      }
      setActiveRapStage(targetStage);
      showSuccess(
        `Tahap ${targetStage === "TUKANG" ? "Tukang" : targetStage === "SUBCON" ? "Subcon" : "Review"} dibuka.`,
      );
      router.refresh();
    });
  }

  function handleScopeSkip(
    categoryCode: "TUKANG" | "SUBCON",
    skipped: boolean,
  ): void {
    if (!rap) return;
    resetMessages();
    startTransition(async () => {
      const result = await setProjectRapScopeSkipped({
        projectRapId: rap.id,
        categoryCode,
        skipped,
      });
      if (!result.success) {
        showError(result.error.message);
        return;
      }
      showSuccess(
        `${categoryCode === "TUKANG" ? "Tukang" : "Subcon"} ${skipped ? "ditandai tidak digunakan" : "dibuka kembali"}.`,
      );
      router.refresh();
    });
  }

  function handleReopenPackage(itemId: string): void {
    resetMessages();
    startTransition(async () => {
      const result = await markProjectCategoryPlanItemDraft({
        projectCategoryPlanItemId: itemId,
      });
      if (!result.success) {
        showError(result.error.message);
        return;
      }
      setPackageDetailItemId(null);
      showSuccess("Package dibuka kembali sebagai Draft.");
      router.refresh();
    });
  }

  function handleFinalizeInternalPlan(): void {
    if (!rap) return;
    resetMessages();
    startTransition(async () => {
      const result = await finalizeProjectInternalPlan({
        projectRapId: rap.id,
      });
      if (!result.success) {
        showError(result.error.message);
        return;
      }
      showSuccess("Internal plan selesai dan baseline material dikunci.");
      router.refresh();
    });
  }

  function handleCreateInternalPlanRevision(): void {
    if (!rap) return;
    resetMessages();
    startTransition(async () => {
      if (reviseMaterial) {
        const materialResult = await createRapRevision({
          projectRapId: rap.id,
          reason: internalRevisionReason,
        });
        if (!materialResult.success) {
          showError(materialResult.error.message);
          return;
        }
      }
      for (const itemId of revisionPackageIds) {
        const packageResult = await createCategoryPlanRevision({
          projectCategoryPlanItemId: itemId,
          reason: internalRevisionReason,
        });
        if (!packageResult.success) {
          showError(packageResult.error.message);
          return;
        }
      }
      setInternalRevisionOpen(false);
      setInternalRevisionReason("");
      setReviseMaterial(false);
      setRevisionPackageIds([]);
      showSuccess(
        "Draft revisi internal plan berhasil dibuat untuk scope terpilih.",
      );
      router.refresh();
    });
  }

  return {
    isPending,
    error,
    success,
    handleCreateRap,
    handleSubmitCategoryPlanItem,
    handleMarkCategoryPlanActive,
    handleDeleteCategoryPlanItem,
    handleSubmitRapItem,
    handleDeleteRapItem,
    handleAdvanceRapSetup,
    handleScopeSkip,
    handleReopenPackage,
    handleFinalizeInternalPlan,
    handleCreateInternalPlanRevision,
  };
}
