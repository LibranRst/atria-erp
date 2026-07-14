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
  return {
    projectId: bill.projectId,
    receiptNote: note
      ? `Tagihan ${bill.name} · ${note}`
      : `Penerimaan untuk tagihan ${bill.name}`,
    item: {
      materialId: bill.materialId ?? "",
      projectRapItemId: bill.materialId ? bill.projectRapItemId ?? "" : "",
      quantity: 1,
      unitCost: bill.amount,
      note,
    },
  };
}
