import { expect, test } from "bun:test";
import {
  procurementWarehouseInputSchema,
  procurementWarehouseIdentitySchema,
  procurementWarehousePermission,
  billProposalPayloadSchema,
  warehouseOperationInputSchema,
} from "./procurement-warehouse";
const id = "10000000-0000-4000-8000-000000000001",
  other = "20000000-0000-4000-8000-000000000002";
const transfer = {
  action: "WAREHOUSE_TRANSFER",
  transferNumber: "TF-QA",
  fromLocationId: id,
  toLocationId: other,
  transferredAt: "2026-10-10",
  note: "Kebutuhan lokasi kedua",
  items: [{ materialId: id, quantity: 2 }],
};
test("warehouse contracts reject same location, duplicate materials, oversized batches and imprecise quantities", () => {
  expect(procurementWarehouseInputSchema.safeParse(transfer).success).toBe(true);
  for (const input of [
    { ...transfer, toLocationId: id },
    { ...transfer, items: [transfer.items[0], transfer.items[0]] },
    { ...transfer, items: [{ materialId: id, quantity: 1.001 }] },
    { ...transfer, items: [{ materialId: id, quantity: Infinity }] },
  ])
    expect(procurementWarehouseInputSchema.safeParse(input).success).toBe(false);
  const items = Array.from({ length: 21 }, (_, i) => ({
    materialId: `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    quantity: 1,
  }));
  expect(procurementWarehouseInputSchema.safeParse({ ...transfer, items }).success).toBe(false);
});
test("invoice review matches the whole amount including explicit discount and refuses missing material links or dates", () => {
  const payload = {
    vendorId: id,
    projectId: id,
    projectBudgetCategoryId: id,
    billNumber: "INV-QA",
    amount: 110,
    dueDate: "2026-10-20",
    invoice: {
      urls: [],
      lines: [
        { name: "Panel", quantity: 1, unit: "lembar", amount: 100 },
        { name: "Pajak", quantity: 1, unit: "ls", amount: 20 },
        { name: "Diskon", quantity: 1, unit: "ls", amount: -10 },
      ],
    },
  };
  expect(billProposalPayloadSchema.safeParse(payload).success).toBe(true);
  for (const patch of [
    { amount: 111 },
    { amount: 110.01 },
    { dueDate: "2026-02-31" },
    { amount: 110.001 },
    { projectRapItemId: id },
    { amount: NaN },
  ])
    expect(billProposalPayloadSchema.safeParse({ ...payload, ...patch }).success).toBe(false);
});
test("count approval has no model-controlled emergency bypass and confirmation accepts only stored identity", () => {
  expect(
    procurementWarehouseInputSchema.safeParse({ action: "STOCK_COUNT_APPROVE", stockCountId: id })
      .success,
  ).toBe(true);
  expect(
    procurementWarehouseInputSchema.safeParse({
      action: "STOCK_COUNT_APPROVE",
      stockCountId: id,
      emergencyOverride: true,
    }).success,
  ).toBe(false);
  expect(
    procurementWarehouseInputSchema.safeParse({
      action: "STOCK_COUNT_REJECT",
      stockCountId: id,
      reason: "short",
    }).success,
  ).toBe(false);
  expect(
    procurementWarehouseIdentitySchema.safeParse({
      conversationId: id,
      toolCallId: "proof",
      amount: 100,
    }).success,
  ).toBe(false);
  expect(procurementWarehousePermission("STOCK_COUNT_SUBMIT")).toBe("create:stock_count");
  expect(procurementWarehousePermission("STOCK_COUNT_APPROVE")).toBe("approve:stock_count");
});

test("receipt cancellation requires a human reason and offers no model self-approval bypass; old count operations remain accepted", () => {
  expect(
    warehouseOperationInputSchema.safeParse({
      action: "RECEIPT_REVERSAL_REQUEST",
      goodsReceiptId: id,
      reason: "Barang salah diterima",
    }).success,
  ).toBe(true);
  expect(
    warehouseOperationInputSchema.safeParse({
      action: "RECEIPT_REVERSAL_APPROVE",
      goodsReceiptId: id,
    }).success,
  ).toBe(true);
  expect(
    warehouseOperationInputSchema.safeParse({
      action: "RECEIPT_REVERSAL_APPROVE",
      goodsReceiptId: id,
      emergencyOverride: true,
    }).success,
  ).toBe(false);
  expect(
    warehouseOperationInputSchema.safeParse({
      action: "RECEIPT_REVERSAL_REJECT",
      goodsReceiptId: id,
      reason: "salah",
    }).success,
  ).toBe(false);
  for (const action of ["STOCK_COUNT_SUBMIT", "STOCK_COUNT_APPROVE"])
    expect(warehouseOperationInputSchema.safeParse({ action, stockCountId: id }).success).toBe(
      true,
    );
  expect(
    warehouseOperationInputSchema.safeParse({
      action: "STOCK_COUNT_REJECT",
      stockCountId: id,
      reason: "Hasil hitung tidak valid",
    }).success,
  ).toBe(true);
  expect(procurementWarehousePermission("RECEIPT_REVERSAL_REQUEST")).toBe(
    "request:goods_receipt_reversal",
  );
});
