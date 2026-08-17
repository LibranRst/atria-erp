import { describe, expect, test } from "bun:test";

import {
  buildGoodsReceiptBillPrefill,
  type GoodsReceiptVendorBillOption,
} from "@/features/materials/utils/goods-receipt-prefill";

const bill: GoodsReceiptVendorBillOption = {
  id: "bill-1",
  projectId: "project-1",
  projectName: "Project Menteng",
  vendorName: "PT Material Baik",
  name: "BILL-2026-001",
  amount: 2_500_000,
  status: "UNPAID",
  notes: "Multipleks kitchen",
  materialId: "material-1",
  projectRapItemId: "rap-item-1",
};

describe("goods receipt vendor bill prefill", () => {
  test("refreshes project, material, RAP, price, and notes as one bill context (fallback when RAP quantity is missing)", () => {
    expect(buildGoodsReceiptBillPrefill(bill)).toEqual({
      projectId: "project-1",
      receiptNote: "Tagihan BILL-2026-001 · Multipleks kitchen",
      item: {
        materialId: "material-1",
        projectRapItemId: "rap-item-1",
        quantity: 1,
        unitCost: 2_500_000,
        note: "Multipleks kitchen",
      },
    });
  });

  test("uses outstanding RAP quantity and outstanding bill value", () => {
    expect(
      buildGoodsReceiptBillPrefill({
        ...bill,
        rapItemQuantity: 20,
        rapItemUnitCost: 125_000,
        receivedQuantity: 5,
        receivedAmount: 625_000,
        remainingQuantity: 15,
        remainingAmount: 1_875_000,
      }),
    ).toEqual({
      projectId: "project-1",
      receiptNote: "Tagihan BILL-2026-001 · Multipleks kitchen",
      item: {
        materialId: "material-1",
        projectRapItemId: "rap-item-1",
        quantity: 15,
        unitCost: 125_000,
        note: "Multipleks kitchen",
      },
    });
  });

  test("uses the RAP unit cost context when no bill value remains", () => {
    expect(
      buildGoodsReceiptBillPrefill({
        ...bill,
        amount: 0,
        rapItemQuantity: 4,
        rapItemUnitCost: 125_000,
        remainingQuantity: 4,
        remainingAmount: 0,
      }).item,
    ).toEqual({
      materialId: "material-1",
      projectRapItemId: "rap-item-1",
      quantity: 4,
      unitCost: 0,
      note: "Multipleks kitchen",
    });
  });

  test("keeps amount useful but drops an unsafe RAP link when material is absent", () => {
    expect(
      buildGoodsReceiptBillPrefill({
        ...bill,
        notes: null,
        materialId: null,
      }),
    ).toEqual({
      projectId: "project-1",
      receiptNote: "Penerimaan untuk tagihan BILL-2026-001",
      item: {
        materialId: "",
        projectRapItemId: "",
        quantity: 1,
        unitCost: 2_500_000,
        note: "",
      },
    });
  });
});
