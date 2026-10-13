import { expect, test } from "bun:test";
import {
  warehouseIntakeInputSchema,
  procurementWarehousePermission,
} from "./procurement-warehouse";
const id = "10000000-0000-4000-8000-000000000001";
const receipt = {
  action: "PROJECT_RECEIPT",
  projectId: id,
  inventoryLocationId: id,
  receiptNumber: "GR-2026-001",
  receivedAt: "2026-10-11",
  note: "Sumber surat jalan vendor",
  items: [{ materialId: id, quantity: 1.25, unitCost: 125000 }],
};
test("intake requires explicit date/reference/location and rejects guessed precision, duplicates or unknown fields", () => {
  expect(warehouseIntakeInputSchema.safeParse(receipt).success).toBe(true);
  for (const patch of [
    { receivedAt: "2026-02-31" },
    { inventoryLocationId: undefined },
    { receiptNumber: undefined },
    { items: [receipt.items[0], receipt.items[0]] },
    { items: [{ ...receipt.items[0], quantity: 1.001 }] },
    { items: [{ ...receipt.items[0], unitCost: 10.001 }] },
    { items: [{ ...receipt.items[0], quantity: Infinity }] },
    { emergencyOverride: true },
  ])
    expect(warehouseIntakeInputSchema.safeParse({ ...receipt, ...patch }).success).toBe(false);
});
test("receipt batch accepts exactly100 unique materials and rejects101 without truncation", () => {
  const items = Array.from({ length: 101 }, (_, i) => ({
    materialId: `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    quantity: 1,
    unitCost: 10,
  }));
  expect(
    warehouseIntakeInputSchema.safeParse({ ...receipt, items: items.slice(0, 100) }).success,
  ).toBe(true);
  expect(warehouseIntakeInputSchema.safeParse({ ...receipt, items }).success).toBe(false);
});
test("project receipts accept one material in distinct RAP lines but reject duplicate links", () => {
  const first = { ...receipt.items[0], projectRapItemId: id },
    second = { ...first, projectRapItemId: "20000000-0000-4000-8000-000000000002" };
  expect(warehouseIntakeInputSchema.safeParse({ ...receipt, items: [first, second] }).success).toBe(
    true,
  );
  expect(warehouseIntakeInputSchema.safeParse({ ...receipt, items: [first, first] }).success).toBe(
    false,
  );
});
test("company stock-in cannot carry project/bill/RAP links and zero cost must be explicit", () => {
  const input = {
    action: "WAREHOUSE_STOCK_IN",
    inventoryLocationId: id,
    referenceNumber: "SJ-001",
    receivedAt: "2026-10-11",
    note: "Barang masuk hibah gudang",
    items: [{ materialId: id, quantity: 1, unitCost: 0 }],
  };
  expect(warehouseIntakeInputSchema.safeParse(input).success).toBe(true);
  for (const patch of [
    { projectId: id },
    { items: [{ ...input.items[0], projectRapItemId: id }] },
    { items: [{ materialId: id, quantity: 1 }] },
  ])
    expect(warehouseIntakeInputSchema.safeParse({ ...input, ...patch }).success).toBe(false);
});
test("opening requires actual inventory identities, positive measured costs and human reasons without emergency override", () => {
  const request = {
    action: "OPENING_REQUEST",
    batchNumber: "SA-001",
    referenceNumber: "OPNAME-001",
    cutoverDate: "2026-10-11",
    note: "Hasil penghitungan stok awal",
    items: [{ materialInventoryId: id, quantity: 3, unitCost: 100 }],
  };
  expect(warehouseIntakeInputSchema.safeParse(request).success).toBe(true);
  expect(
    warehouseIntakeInputSchema.safeParse({
      ...request,
      items: [{ ...request.items[0], unitCost: 0 }],
    }).success,
  ).toBe(false);
  expect(
    warehouseIntakeInputSchema.safeParse({
      ...request,
      items: [request.items[0], request.items[0]],
    }).success,
  ).toBe(false);
  for (const action of ["OPENING_APPROVE", "OPENING_REJECT", "OPENING_REVERSE"]) {
    expect(
      warehouseIntakeInputSchema.safeParse({
        action,
        batchId: id,
        reason: "Diverifikasi dengan opname awal",
      }).success,
    ).toBe(true);
    expect(
      warehouseIntakeInputSchema.safeParse({ action, batchId: id, reason: "short" }).success,
    ).toBe(false);
    expect(
      warehouseIntakeInputSchema.safeParse({
        action,
        batchId: id,
        reason: "Diverifikasi dengan opname awal",
        emergencyOverride: true,
      }).success,
    ).toBe(false);
  }
  expect(procurementWarehousePermission("PROJECT_RECEIPT")).toBe("create:stock_movement");
  expect(procurementWarehousePermission("OPENING_APPROVE")).toBe("approve:opening_inventory");
  expect(procurementWarehousePermission("OPENING_REVERSE")).toBe("reverse:opening_inventory");
});
