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
