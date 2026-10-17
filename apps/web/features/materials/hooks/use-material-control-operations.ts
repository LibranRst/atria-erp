"use client";

import { useMemo, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "@/lib/navigation/workspace-navigation";
import { toast } from "sonner";

import {
  reserveMaterialForProject,
  returnMaterialFromProject,
  useMaterialForProject as recordMaterialUse,
  wasteMaterialForProject,
} from "@/app/actions/material/inventory";
import {
  getMaterialMovementPage,
  type MaterialMovementView,
  type MaterialOperationsDashboard,
  type ReceiptView,
  type CountView,
} from "@/app/actions/material/operations-dashboard";
import { createInventoryLocation } from "@/app/actions/material/warehouse";
import { createStockTransfer } from "@/app/actions/material/warehouse-transfer";
import {
  approveStockCount,
  rejectStockCount,
  saveStockCount,
  submitStockCount,
} from "@/app/actions/material/warehouse-stock-count";
import {
  approveGoodsReceiptReversal,
  rejectGoodsReceiptReversal,
  requestGoodsReceiptReversal,
} from "@/app/actions/material/warehouse-receipt-reversal";
import { emergencyAdjustStock } from "@/app/actions/material/warehouse-adjustment";
import type { MaterialOperationDecision } from "@/features/materials/components/tabs/material-dashboard-tabs";
import type { OperationSuccess } from "@/components/ui";
import {
  createSimpleItem,
  type SimpleItem,
  type WarehouseAction,
} from "@/features/materials/utils/material-ui-utils";

type SelectedRap = MaterialOperationsDashboard["projects"][number]["rapItems"][number] | undefined;

type UseMaterialControlOperationsInput = {
  readonly data: MaterialOperationsDashboard;
  readonly action: WarehouseAction | null;
  readonly documentToken: string;
  readonly onMutationComplete?: () => void;
};

export function useMaterialControlOperations({
  data,
  action,
  documentToken,
  onMutationComplete,
}: UseMaterialControlOperationsInput): {
  readonly pending: boolean;
  readonly detailMaterialId: string | null;
  readonly receiptDetail: ReceiptView | null;
  readonly projectId: string;
  readonly rapItemId: string;
  readonly locationId: string;
  readonly quantity: string;
  readonly note: string;
  readonly fromLocationId: string;
  readonly toLocationId: string;
  readonly documentNumber: string;
  readonly items: readonly SimpleItem[];
  readonly counted: Record<string, string>;
  readonly stockCountId: string | null;
  readonly success: OperationSuccess | null;
  readonly decision: MaterialOperationDecision | null;
  readonly decisionReason: string;
  readonly emergencyOverride: boolean;
  readonly message: string | null;
  readonly movements: readonly MaterialMovementView[];
  readonly movementsHasMore: boolean;
  readonly newLocationName: string;
  readonly adjustDirection: "INCREASE" | "DECREASE";
  readonly setDetailMaterialId: (value: string | null) => void;
  readonly setReceiptDetail: (value: ReceiptView | null) => void;
  readonly setProjectId: (value: string) => void;
  readonly setRapItemId: (value: string) => void;
  readonly setLocationId: (value: string) => void;
  readonly setQuantity: (value: string) => void;
  readonly setNote: (value: string) => void;
  readonly setFromLocationId: (value: string) => void;
  readonly setToLocationId: (value: string) => void;
  readonly setDocumentNumber: (value: string) => void;
  readonly setItems: (value: readonly SimpleItem[]) => void;
  readonly setCounted: Dispatch<SetStateAction<Record<string, string>>>;
  readonly setDecision: (value: MaterialOperationDecision | null) => void;
  readonly setDecisionReason: (value: string) => void;
  readonly setEmergencyOverride: (value: boolean) => void;
  readonly setNewLocationName: (value: string) => void;
  readonly setAdjustDirection: (value: "INCREASE" | "DECREASE") => void;
  readonly setSuccess: (value: OperationSuccess | null) => void;
  readonly closeAction: () => void;
  readonly handleQuickOperation: (actionId: string) => void;
  readonly runProjectOperation: (selectedRap: SelectedRap) => void;
  readonly runTransfer: () => void;
  readonly addLocation: () => void;
  readonly initializeCount: (nextLocation: string) => void;
  readonly loadCountDraft: (draftId: string, desktopDraft?: CountView) => void;
  readonly runCount: (mode: "SAVE" | "SUBMIT") => void;
  readonly runAdjust: () => void;
  readonly decide: () => void;
  readonly loadMore: () => void;
} {
  const router = useRouter();
  const [detailMaterialId, setDetailMaterialId] = useState<string | null>(null);
  const [receiptDetail, setReceiptDetail] = useState<ReceiptView | null>(null);
  const [projectId, setProjectId] = useState("");
  const [rapItemId, setRapItemId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [customDocumentNumber, setCustomDocumentNumber] = useState<string | null>(null);
  const documentNumber =
    customDocumentNumber ??
    (action ? `${action}/${new Date().getFullYear()}/${documentToken}` : "");
  function setDocumentNumber(value: string): void {
    setCustomDocumentNumber(value);
  }
  const [items, setItems] = useState<readonly SimpleItem[]>([createSimpleItem()]);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [stockCountId, setStockCountId] = useState<string | null>(null);
  const [success, setSuccess] = useState<OperationSuccess | null>(null);
  const [decision, setDecision] = useState<MaterialOperationDecision | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [emergencyOverride, setEmergencyOverride] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [additionalMovements, setAdditionalMovements] = useState<readonly MaterialMovementView[]>(
    [],
  );
  const movements = useMemo(() => {
    const serverIds = new Set(data.movements.map((movement) => movement.id));
    return [
      ...data.movements,
      ...additionalMovements.filter((movement) => !serverIds.has(movement.id)),
    ];
  }, [additionalMovements, data.movements]);
  const [movementsHasMore, setMovementsHasMore] = useState(data.movementsHasMore);
  const [pending, startTransition] = useTransition();
  const [newLocationName, setNewLocationName] = useState("");
  const [adjustDirection, setAdjustDirection] = useState<"INCREASE" | "DECREASE">("INCREASE");

  function resetForm(): void {
    setMessage(null);
    setProjectId("");
    setRapItemId("");
    setLocationId("");
    setQuantity("");
    setNote("");
    setFromLocationId("");
    setToLocationId("");
    setCustomDocumentNumber(null);
    setItems([createSimpleItem()]);
    setCounted({});
    setStockCountId(null);
    setNewLocationName("");
    setEmergencyOverride(false);
    setDecisionReason("");
  }

  const [prevAction, setPrevAction] = useState(action);
  if (action !== prevAction) {
    setPrevAction(action);
    setMessage(null);
    setProjectId("");
    setRapItemId("");
    setLocationId("");
    setQuantity("");
    setNote("");
    setFromLocationId("");
    setToLocationId("");
    setCustomDocumentNumber(null);
    setItems([createSimpleItem()]);
    setCounted({});
    setStockCountId(null);
    setNewLocationName("");
    setEmergencyOverride(false);
    setDecisionReason("");
  }

  function updateActionInUrl(actionId: string | null): void {
    const params = new URLSearchParams(window.location.search);
    if (actionId === null) {
      params.delete("action");
    } else {
      params.set("action", actionId);
    }
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    router.replace(nextUrl);
  }

  function closeAction(): void {
    resetForm();
    updateActionInUrl(null);
  }

  function handleQuickOperation(actionId: string): void {
    resetForm();
    setDocumentNumber(`${actionId}/${new Date().getFullYear()}/${documentToken}`);
    setSuccess(null);
    updateActionInUrl(actionId);
  }

  function finish(text: string, nextSuccess: OperationSuccess): void {
    onMutationComplete?.();
    setMessage(text);
    setSuccess(nextSuccess);
    toast.success(text);
    resetForm();
    closeAction();
    router.refresh();
  }

  function runProjectOperation(selectedRap: SelectedRap): void {
    const materialId = selectedRap?.materialId;
    if (!action || !selectedRap || !materialId) return;

    startTransition(async () => {
      const input = {
        projectId,
        projectRapItemId: selectedRap.id,
        materialId,
        inventoryLocationId: locationId,
        quantity: Number(quantity),
        note,
      };
      const result =
        action === "RESERVE"
          ? await reserveMaterialForProject(input)
          : action === "USE"
            ? await recordMaterialUse(input)
            : action === "RETURN"
              ? await returnMaterialFromProject(input)
              : await wasteMaterialForProject(input);
      if (!result.success) {
        setMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      const label =
        action === "RESERVE"
          ? "Reservasi"
          : action === "USE"
            ? "Pemakaian"
            : action === "RETURN"
              ? "Pengembalian"
              : "Material terbuang";
      finish(`${label} material berhasil dicatat.`, {
        title: `${label} berhasil dicatat`,
        description: "Pergerakan stok dan audit trail telah dibuat dalam satu transaksi.",
        facts: [
          {
            label: "Project",
            value: data.projects.find((row) => row.id === projectId)?.name ?? "Project",
          },
          { label: "Jumlah", value: Number(quantity).toLocaleString("id-ID") },
          { label: "Status", value: "Sudah diposting" },
        ],
      });
    });
  }

  function runTransfer(): void {
    startTransition(async () => {
      const result = await createStockTransfer({
        transferNumber: documentNumber,
        fromLocationId,
        toLocationId,
        transferredAt: new Date(),
        note,
        items: items.map((item) => ({
          materialId: item.materialId,
          quantity: Number(item.quantity),
        })),
      });
      if (!result.success) {
        setMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      finish("Transfer stok berhasil diposting.", {
        title: "Transfer stok berhasil",
        description: "Pergerakan keluar dan masuk telah diposting pada lokasi yang dipilih.",
        facts: [
          { label: "Nomor", value: documentNumber },
          { label: "Material", value: `${items.length} item` },
          { label: "Status", value: "Sudah diposting" },
        ],
      });
    });
  }

  function addLocation(): void {
    startTransition(async () => {
      const result = await createInventoryLocation({
        name: newLocationName,
        description: "Lokasi operasional dibuat dari halaman Material & Stok.",
      });
      if (!result.success) {
        setMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      const successMsg = "Lokasi inventori dibuat dan stok awal material disiapkan.";
      onMutationComplete?.();
      setMessage(successMsg);
      setNewLocationName("");
      toast.success(successMsg);
      closeAction();
      router.refresh();
    });
  }

  function initializeCount(nextLocation: string): void {
    setStockCountId(null);
    setLocationId(nextLocation);
    setCounted(
      Object.fromEntries(
        data.inventory
          .filter((row) => row.locationId === nextLocation)
          .map((row) => [row.materialId, String(row.currentStock)]),
      ),
    );
  }

  function loadCountDraft(draftId: string, desktopDraft?: CountView): void {
    const draft =
      desktopDraft?.id === draftId && desktopDraft.canEdit
        ? desktopDraft
        : data.counts.find((row) => row.id === draftId && row.canEdit);
    if (!draft) return;
    setStockCountId(draft.id);
    setDocumentNumber(draft.countNumber);
    setLocationId(draft.locationId);
    setNote(draft.note ?? "");
    setCounted(
      Object.fromEntries(
        draft.items.map((item) => [item.materialId, String(item.countedQuantity)]),
      ),
    );
  }

  function runCount(mode: "SAVE" | "SUBMIT"): void {
    const countItems = Object.entries(counted).map(([materialId, countedQuantity]) => ({
      materialId,
      countedQuantity: Number(countedQuantity),
    }));
    startTransition(async () => {
      const saved = await saveStockCount({
        stockCountId: stockCountId ?? undefined,
        countNumber: documentNumber,
        inventoryLocationId: locationId,
        countedAt: new Date(),
        note,
        items: countItems,
      });
      if (!saved.success) {
        setMessage(saved.error.message);
        toast.error(saved.error.message);
        return;
      }
      if (mode === "SUBMIT") onMutationComplete?.();
      setStockCountId(saved.data.id);
      if (mode === "SAVE") {
        finish("Draft stock opname tersimpan.", {
          title: "Draft opname tersimpan",
          description: "Jumlah fisik dapat dilanjutkan lagi sebelum dikirim untuk persetujuan.",
          facts: [
            { label: "Nomor", value: documentNumber },
            { label: "Material", value: `${countItems.length} item` },
            { label: "Status", value: "Draft" },
          ],
        });
        return;
      }
      const submitted = await submitStockCount({ stockCountId: saved.data.id });
      if (!submitted.success) {
        setMessage(submitted.error.message);
        toast.error(submitted.error.message);
        return;
      }
      finish("Stock opname dikirim untuk persetujuan.", {
        title: "Stock opname sudah dikirim",
        description:
          "Stok belum berubah. Owner atau Finance Admin akan memeriksa hasil perhitungan sebelum posting.",
        facts: [
          { label: "Nomor", value: documentNumber },
          { label: "Material", value: `${countItems.length} item` },
          { label: "Status", value: "Menunggu persetujuan" },
        ],
      });
    });
  }

  function runAdjust(): void {
    const item = items[0];
    if (!item) return;
    startTransition(async () => {
      const result = await emergencyAdjustStock({
        materialId: item.materialId,
        inventoryLocationId: locationId,
        direction: adjustDirection,
        quantity: Number(item.quantity),
        note,
      });
      if (!result.success) {
        setMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      finish("Penyesuaian darurat berhasil diposting.", {
        title: "Penyesuaian stok berhasil",
        description: "Stok fisik dan audit trail telah diperbarui.",
        facts: [
          { label: "Arah", value: adjustDirection === "INCREASE" ? "Tambah stok" : "Kurangi stok" },
          { label: "Jumlah", value: Number(item.quantity).toLocaleString("id-ID") },
          { label: "Status", value: "Sudah diposting" },
        ],
      });
    });
  }

  function decide(): void {
    if (!decision) return;
    startTransition(async () => {
      const result =
        decision.type === "COUNT_APPROVE"
          ? await approveStockCount({
              stockCountId: decision.id,
              emergencyOverride,
              reason: emergencyOverride ? decisionReason : undefined,
            })
          : decision.type === "COUNT_REJECT"
            ? await rejectStockCount({
                stockCountId: decision.id,
                reason: decisionReason,
              })
            : decision.type === "RECEIPT_REQUEST"
              ? await requestGoodsReceiptReversal({
                  goodsReceiptId: decision.id,
                  reason: decisionReason,
                })
              : decision.type === "RECEIPT_APPROVE"
                ? await approveGoodsReceiptReversal({
                    goodsReceiptId: decision.id,
                    emergencyOverride,
                    reason: emergencyOverride ? decisionReason : undefined,
                  })
                : await rejectGoodsReceiptReversal({
                    goodsReceiptId: decision.id,
                    reason: decisionReason,
                  });
      if (!result.success) {
        setMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      onMutationComplete?.();
      setDecision(null);
      setReceiptDetail(null);
      const decisionMsg = "Status stock operation berhasil diperbarui.";
      setMessage(decisionMsg);
      toast.success(decisionMsg);
      router.refresh();
    });
  }

  function loadMore(): void {
    if (!movementsHasMore) return;
    const cursor = movements.at(-1)?.createdAt;
    const cursorId = movements.at(-1)?.id;
    if (!cursor || !cursorId) return;
    startTransition(async () => {
      const result = await getMaterialMovementPage({
        cursor: { createdAt: cursor, id: cursorId },
        limit: 30,
      });
      if (!result.success) {
        setMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      setMovementsHasMore(result.data.hasMore);
      const loadedMessage =
        result.data.items.length === 0
          ? "Semua aktivitas sebelumnya sudah dimuat."
          : `${result.data.items.length} aktivitas sebelumnya dimuat.`;
      setMessage(loadedMessage);
      if (result.data.items.length === 0) toast.info(loadedMessage);
      else toast.success(loadedMessage);
      setAdditionalMovements((current) => {
        const knownIds = new Set([
          ...data.movements.map((movement) => movement.id),
          ...current.map((movement) => movement.id),
        ]);
        return [...current, ...result.data.items.filter((movement) => !knownIds.has(movement.id))];
      });
    });
  }

  return {
    pending,
    detailMaterialId,
    receiptDetail,
    projectId,
    rapItemId,
    locationId,
    quantity,
    note,
    fromLocationId,
    toLocationId,
    documentNumber,
    items,
    counted,
    stockCountId,
    success,
    decision,
    decisionReason,
    emergencyOverride,
    message,
    movements,
    movementsHasMore,
    newLocationName,
    adjustDirection,
    setDetailMaterialId,
    setReceiptDetail,
    setProjectId,
    setRapItemId,
    setLocationId,
    setQuantity,
    setNote,
    setFromLocationId,
    setToLocationId,
    setDocumentNumber,
    setItems,
    setCounted,
    setDecision,
    setDecisionReason,
    setEmergencyOverride,
    setNewLocationName,
    setAdjustDirection,
    setSuccess,
    closeAction,
    handleQuickOperation,
    runProjectOperation,
    runTransfer,
    addLocation,
    initializeCount,
    loadCountDraft,
    runCount,
    runAdjust,
    decide,
    loadMore,
  };
}
