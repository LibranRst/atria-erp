"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  addRabManualItem,
  approveRabEstimate,
  createRabBundle,
  deleteRabBundle,
  generateRabFromSelectedSources,
  updateRabBundle,
  updateRabEstimateItem,
} from "@/app/actions/project/rap-rab";
import {
  confirmChangeOrderClient,
  createProjectChangeOrder,
  refreshRabLinkedSources,
  voidRabRevision,
} from "@/app/actions/project/revision-change-order";
import { formatIdr as formatRp } from "@/lib/utils/money";
import type { ManualQuotationLine, RabEstimateView, RabItemView } from "../shared/rap-rab-types";
import type { RabBundleForm, RabChangeOrderForm } from "./rab-drawer-types";
import {
  buildBundleCommonPayload,
  buildChangeOrderPayload,
  buildClientConfirmationPayload,
  buildGenerateRabPayload,
  buildManualRabItemPayload,
  buildRabItemUpdatePayload,
} from "./rab-manager-action-payloads";
import { emptyManualQuotationLine } from "./rab-manager-utils";

interface UseRabManagerActionsProps {
  readonly projectId: string;
  readonly rabEstimate: RabEstimateView | null;
  readonly baselineApprovedRabId: string | null;
  readonly selectedRapQuotationIds: readonly string[];
  readonly selectedCategoryQuotationIds: readonly string[];
  readonly manualQuotationLine: ManualQuotationLine;
  readonly setManualQuotationLine: (line: ManualQuotationLine) => void;
  readonly rabDraftEdits: Record<string, RabItemView>;
  readonly setRabDraftEdits: (
    update: (current: Record<string, RabItemView>) => Record<string, RabItemView>,
  ) => void;
  readonly changeOrderForm: RabChangeOrderForm;
  readonly editingBundleId: string | null;
  readonly bundleForm: RabBundleForm;
  readonly setBundleEditorOpen: (open: boolean) => void;
  readonly setSourcePickerOpen: (open: boolean) => void;
  readonly setManualLineOpen: (open: boolean) => void;
  readonly setRabItemEditorId: (id: string | null) => void;
  readonly setChangeOrderOpen: (open: boolean) => void;
  readonly voidReason: string;
  readonly setVoidReason: (reason: string) => void;
  readonly setVoidRevisionOpen: (open: boolean) => void;
}

interface UseRabManagerActionsResult {
  readonly isPending: boolean;
  readonly error: string | null;
  readonly success: string | null;
  readonly handleGenerateRab: () => void;
  readonly handleSaveRabItem: (item: RabItemView) => void;
  readonly handleAddManualRabItem: () => void;
  readonly handleApproveRab: () => void;
  readonly handleRefreshRabSources: () => void;
  readonly handleSaveBundle: () => void;
  readonly handleDeleteBundle: (bundleId: string) => void;
  readonly handleApproveChangeOrder: () => void;
  readonly handleVoidRabRevision: () => void;
}

export function useRabManagerActions({
  projectId,
  rabEstimate,
  baselineApprovedRabId,
  selectedRapQuotationIds,
  selectedCategoryQuotationIds,
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
}: UseRabManagerActionsProps): UseRabManagerActionsResult {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (success) {
      toast.success(success);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  function resetMessages(): void {
    setError(null);
    setSuccess(null);
  }

  function showError(message: string): void {
    setError(message);
    toast.error(message);
  }

  function showSuccess(message: string): void {
    setSuccess(message);
    toast.success(message);
  }

  function handleGenerateRab(): void {
    resetMessages();

    startTransition(async () => {
      const res = await generateRabFromSelectedSources(
        buildGenerateRabPayload({
          projectId,
          selectedRapQuotationIds,
          selectedCategoryQuotationIds,
          manualQuotationLine,
        }),
      );
      if (!res.success) {
        showError(res.error.message);
        return;
      }
      showSuccess("Draft quotation client berhasil dibuat dari sumber terpilih.");
      setSourcePickerOpen(false);
      setManualQuotationLine(emptyManualQuotationLine);
      router.refresh();
    });
  }

  function handleSaveRabItem(item: RabItemView): void {
    const draft = rabDraftEdits[item.id];
    if (!draft) {
      const message = "Tidak ada perubahan yang perlu disimpan.";
      toast.info(message);
      return;
    }
    resetMessages();
    startTransition(async () => {
      const res = await updateRabEstimateItem({
        rabEstimateItemId: item.id,
        ...buildRabItemUpdatePayload(draft),
      });
      if (!res.success) {
        toast.error(res.error.message);
        return;
      }
      setRabDraftEdits((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      toast.success(`Tersimpan · Total item ${formatRp(Number(res.data.lineTotal))}`);
      setRabItemEditorId(null);
      router.refresh();
    });
  }

  function handleAddManualRabItem(): void {
    if (!rabEstimate) return;
    resetMessages();
    startTransition(async () => {
      const result = await addRabManualItem(
        buildManualRabItemPayload({ rabEstimate, manualQuotationLine }),
      );
      if (!result.success) {
        showError(result.error.message);
        return;
      }
      showSuccess(`Manual quotation line ditambahkan · ${formatRp(Number(result.data.lineTotal))}`);
      setManualQuotationLine(emptyManualQuotationLine);
      setManualLineOpen(false);
      router.refresh();
    });
  }

  function handleApproveRab(): void {
    if (!rabEstimate) return;
    if (Object.keys(rabDraftEdits).length > 0) {
      showError(
        "Masih ada perubahan quotation line yang belum disimpan. Simpan semua line sebelum approval.",
      );
      return;
    }
    resetMessages();
    startTransition(async () => {
      const res = await approveRabEstimate(rabEstimate.id);
      if (!res.success) {
        showError(res.error.message);
        return;
      }
      showSuccess("RAB client berhasil disetujui.");
      router.refresh();
    });
  }

  function handleRefreshRabSources(): void {
    if (!rabEstimate) return;
    resetMessages();
    startTransition(async () => {
      const result = await refreshRabLinkedSources({
        rabEstimateId: rabEstimate.id,
      });
      if (!result.success) {
        showError(result.error.message);
        return;
      }
      showSuccess(
        `${result.data.refreshedCount} linked source berhasil diperbarui; label client dan bundle tetap dipertahankan.`,
      );
      router.refresh();
    });
  }

  function handleSaveBundle(): void {
    if (!rabEstimate) return;
    resetMessages();
    startTransition(async () => {
      const common = buildBundleCommonPayload(bundleForm);
      const result = editingBundleId
        ? await updateRabBundle({ bundleId: editingBundleId, ...common })
        : await createRabBundle({
            rabEstimateId: rabEstimate.id,
            itemIds: bundleForm.itemIds,
            ...common,
          });
      if (!result.success) {
        showError(result.error.message);
        return;
      }
      setBundleEditorOpen(false);
      showSuccess(
        editingBundleId
          ? "Paket quotation diperbarui."
          : "Quotation lines berhasil dijadikan satu paket client.",
      );
      router.refresh();
    });
  }

  function handleDeleteBundle(bundleId: string): void {
    resetMessages();
    startTransition(async () => {
      const result = await deleteRabBundle({ bundleId });
      if (!result.success) {
        showError(result.error.message);
        return;
      }
      showSuccess("Paket dibongkar; member kembali menjadi standalone quotation lines.");
      router.refresh();
    });
  }

  function handleApproveChangeOrder(): void {
    if (!rabEstimate || !baselineApprovedRabId) return;
    resetMessages();
    startTransition(async () => {
      const created = await createProjectChangeOrder(
        buildChangeOrderPayload({
          baselineApprovedRabId,
          rabEstimate,
          changeOrderForm,
        }),
      );
      if (!created.success) {
        showError(created.error.message);
        return;
      }
      const confirmed = await confirmChangeOrderClient(
        buildClientConfirmationPayload({
          changeOrderId: created.data.id,
          changeOrderForm,
        }),
      );
      if (!confirmed.success) {
        showError(confirmed.error.message);
        return;
      }
      showSuccess(
        "Change Order sudah dikonfirmasi klien dan menunggu approval Owner/Finance lain.",
      );
      setChangeOrderOpen(false);
      router.refresh();
    });
  }

  function handleVoidRabRevision(): void {
    if (!rabEstimate) return;
    resetMessages();
    startTransition(async () => {
      const result = await voidRabRevision({
        rabEstimateId: rabEstimate.id,
        reason: voidReason,
      });
      if (!result.success) {
        showError(result.error.message);
        return;
      }
      setVoidReason("");
      setVoidRevisionOpen(false);
      showSuccess(`Revisi R${rabEstimate.revision} dibatalkan. RAB approved tetap aktif.`);
      router.refresh();
    });
  }

  return {
    isPending,
    error,
    success,
    handleGenerateRab,
    handleSaveRabItem,
    handleAddManualRabItem,
    handleApproveRab,
    handleRefreshRabSources,
    handleSaveBundle,
    handleDeleteBundle,
    handleApproveChangeOrder,
    handleVoidRabRevision,
  };
}
