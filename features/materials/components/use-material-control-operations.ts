"use client";

import { useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
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
} from "@/app/actions/material/operations-dashboard";
import {
  approveGoodsReceiptReversal,
  approveStockCount,
  createInventoryLocation,
  createStockTransfer,
  emergencyAdjustStock,
  rejectGoodsReceiptReversal,
  rejectStockCount,
  requestGoodsReceiptReversal,
  saveStockCount,
  submitStockCount,
} from "@/app/actions/material/warehouse";
import type { MaterialOperationDecision } from "@/features/materials/components/material-dashboard-tabs";
import type { MaterialOperationSuccess } from "@/features/materials/components/material-form-patterns";
import {
  createSimpleItem,
  type SimpleItem,
  type WarehouseAction,
} from "@/features/materials/lib/material-ui-utils";
import { updateUrlSearchParam } from "@/lib/utils/use-url-search-param";

type SelectedRap =
  | MaterialOperationsDashboard["projects"][number]["rapItems"][number]
  | undefined;

type UseMaterialControlOperationsInput = {
  readonly data: MaterialOperationsDashboard;
  readonly action: WarehouseAction | null;
  readonly documentToken: string;
};

export function useMaterialControlOperations({
  data,
  action,
  documentToken,
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
  readonly success: MaterialOperationSuccess | null;
  readonly decision: MaterialOperationDecision | null;
  readonly decisionReason: string;
  readonly message: string | null;
  readonly movements: readonly MaterialMovementView[];
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
  readonly setNewLocationName: (value: string) => void;
  readonly setAdjustDirection: (value: "INCREASE" | "DECREASE") => void;
  readonly setSuccess: (value: MaterialOperationSuccess | null) => void;
  readonly closeAction: () => void;
  readonly handleQuickOperation: (actionId: string) => void;
  readonly runProjectOperation: (selectedRap: SelectedRap) => void;
  readonly runTransfer: () => void;
  readonly addLocation: () => void;
  readonly initializeCount: (nextLocation: string) => void;
  readonly loadCountDraft: (draftId: string) => void;
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
  const [documentNumber, setDocumentNumber] = useState(() =>
    action ? `${action}/${new Date().getFullYear()}/${documentToken}` : "",
  );
  const [items, setItems] = useState<readonly SimpleItem[]>([createSimpleItem()]);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [stockCountId, setStockCountId] = useState<string | null>(null);
  const [success, setSuccess] = useState<MaterialOperationSuccess | null>(null);
  const [decision, setDecision] = useState<MaterialOperationDecision | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [movements, setMovements] = useState<readonly MaterialMovementView[]>(
    data.movements,
  );
  const [pending, startTransition] = useTransition();
  const [newLocationName, setNewLocationName] = useState("");
  const [adjustDirection, setAdjustDirection] = useState<"INCREASE" | "DECREASE">(
    "INCREASE",
  );

  function closeAction(): void {
    updateUrlSearchParam("action", null, "push");
  }

  function handleQuickOperation(actionId: string): void {
    setMessage(null);
    setProjectId("");
    setRapItemId("");
    setLocationId("");
    setQuantity("");
    setNote("");
    setFromLocationId("");
    setToLocationId("");
    setDocumentNumber(`${actionId}/${new Date().getFullYear()}/${documentToken}`);
    setItems([createSimpleItem()]);
    setCounted({});
    setStockCountId(null);
    setSuccess(null);
    updateUrlSearchParam("action", actionId, "push");
  }

  function finish(text: string, nextSuccess: MaterialOperationSuccess): void {
    setMessage(text);
    setSuccess(nextSuccess);
    toast.success(text);
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
      const label = action === "RESERVE" ? "Reservasi" : action === "USE" ? "Pemakaian" : action === "RETURN" ? "Pengembalian" : "Material terbuang";
      finish(`${label} material berhasil dicatat.`, {
        title: `${label} berhasil dicatat`,
        description: "Movement stok dan audit trail telah dibuat dalam satu transaksi.",
        facts: [
          { label: "Project", value: data.projects.find((row) => row.id === projectId)?.name ?? "Project" },
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
        description: "Movement keluar dan masuk telah diposting pada lokasi yang dipilih.",
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
        description: "Operational location created from Material & Stock.",
      });
      if (!result.success) {
        setMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      const successMsg = "Inventory location dibuat dan material defaults diinisialisasi.";
      setMessage(successMsg);
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

  function loadCountDraft(draftId: string): void {
    const draft = data.counts.find((row) => row.id === draftId && row.canEdit);
    if (!draft) return;
    setStockCountId(draft.id);
    setDocumentNumber(draft.countNumber);
    setLocationId(draft.locationId);
    setNote(draft.note ?? "");
    setCounted(Object.fromEntries(draft.items.map((item) => [item.materialId, String(item.countedQuantity)])));
  }

  function runCount(mode: "SAVE" | "SUBMIT"): void {
    const countItems = Object.entries(counted).map(
      ([materialId, countedQuantity]) => ({
        materialId,
        countedQuantity: Number(countedQuantity),
      }),
    );
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
        description: "Stok belum berubah. Owner atau Finance Admin akan memeriksa snapshot sebelum posting.",
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
          ? await approveStockCount({ stockCountId: decision.id })
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
      setDecision(null);
      setReceiptDetail(null);
      const decisionMsg = "Status stock operation berhasil diperbarui.";
      setMessage(decisionMsg);
      toast.success(decisionMsg);
      router.refresh();
    });
  }

  function loadMore(): void {
    const cursor = movements.at(-1)?.createdAt;
    if (!cursor) return;
    startTransition(async () => {
      const result = await getMaterialMovementPage({ cursor, limit: 30 });
      if (!result.success) {
        setMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      setMovements((current) => [...current, ...result.data]);
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
    message,
    movements,
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
