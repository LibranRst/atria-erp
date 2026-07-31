import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import type { GoodsReceiptVendorBillOption } from "@/features/materials/utils/goods-receipt-prefill";
import { createClientId } from "@/lib/utils/client-id";

export type GoodsReceiptRapOption = {
  readonly id: string;
  readonly materialId: string | null;
  readonly name: string;
  readonly area: string;
  readonly quantity?: number | null;
  readonly unitCost?: number | null;
};

export type GoodsReceiptProjectOption = {
  readonly id: string;
  readonly name: string;
  readonly rapItems?: readonly GoodsReceiptRapOption[];
};

export type GoodsReceiptMaterialOption = {
  readonly id: string;
  readonly name: string;
  readonly unit?: string;
};

export type GoodsReceiptSimpleOption = {
  readonly id: string;
  readonly name: string;
};

export type GoodsReceiptItemDraft = {
  readonly key: string;
  readonly materialId: string;
  readonly projectRapItemId: string;
  readonly quantity: number;
  readonly unitCost: number;
  readonly note: string;
};

export type GoodsReceiptSheetProps = {
  readonly projects: readonly GoodsReceiptProjectOption[];
  readonly locations: readonly GoodsReceiptSimpleOption[];
  readonly materials: readonly GoodsReceiptMaterialOption[];
  readonly inventory: MaterialOperationsDashboard["inventory"];
  readonly vendorBills: readonly GoodsReceiptVendorBillOption[];
  readonly compact?: boolean;
  readonly showTrigger?: boolean;
};

export const goodsReceiptMoney = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function newGoodsReceiptItem(
  overrides: Partial<Omit<GoodsReceiptItemDraft, "key">> = {},
): GoodsReceiptItemDraft {
  return {
    key: createClientId("receipt-item"),
    materialId: "",
    projectRapItemId: "",
    quantity: 1,
    unitCost: 0,
    note: "",
    ...overrides,
  };
}
