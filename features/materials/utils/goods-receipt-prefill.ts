export type GoodsReceiptVendorBillOption = {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly vendorName: string;
  readonly name: string;
  readonly amount: number;
  readonly status: string;
  readonly notes: string | null;
  readonly materialId: string | null;
  readonly projectRapItemId: string | null;
  readonly rapItemQuantity?: number | null;
  readonly rapItemUnitCost?: number | null;
  readonly receivedQuantity?: number;
  readonly receivedAmount?: number;
  readonly remainingQuantity?: number | null;
  readonly remainingAmount?: number;
};

export type GoodsReceiptBillPrefill = {
  readonly projectId: string;
  readonly receiptNote: string;
  readonly item: {
    readonly materialId: string;
    readonly projectRapItemId: string;
    readonly quantity: number;
    readonly unitCost: number;
    readonly note: string;
  };
};

export function buildGoodsReceiptBillPrefill(
  bill: GoodsReceiptVendorBillOption,
): GoodsReceiptBillPrefill {
  const note = bill.notes?.trim() ?? "";
  const quantity =
    bill.remainingQuantity && bill.remainingQuantity > 0
      ? bill.remainingQuantity
      : bill.rapItemQuantity && bill.rapItemQuantity > 0
        ? bill.rapItemQuantity
        : 1;
  const remainingAmount = bill.remainingAmount ?? bill.amount;
  const unitCost = quantity > 0 ? remainingAmount / quantity : (bill.rapItemUnitCost ?? 0);
  return {
    projectId: bill.projectId,
    receiptNote: note ? `Tagihan ${bill.name} · ${note}` : `Penerimaan untuk tagihan ${bill.name}`,
    item: {
      materialId: bill.materialId ?? "",
      projectRapItemId: bill.materialId ? (bill.projectRapItemId ?? "") : "",
      quantity,
      unitCost,
      note,
    },
  };
}
