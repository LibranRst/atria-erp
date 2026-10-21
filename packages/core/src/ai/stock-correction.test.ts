import { describe, expect, test } from "bun:test";
import {
  stockCorrectionInputSchema,
  procurementWarehousePermission,
} from "./procurement-warehouse";
const id = "11111111-1111-4111-8111-111111111111";
const input = {
  action: "STOCK_CORRECT",
  inventoryLocationId: id,
  reason: "Koreksi salah pencatatan",
  items: [{ materialId: id, direction: "DECREASE", quantity: 1.25 }],
};
describe("stock correction contract", () => {
  test("explicit delta, reason and actual references; no privileged or balance fields", () => {
    expect(stockCorrectionInputSchema.parse(input).projectId).toBeNull();
    expect(procurementWarehousePermission("STOCK_CORRECT")).toBe("adjust:stock");
    for (const patch of [
      { userId: id },
      { averageCost: 2 },
      { emergencyOverride: true },
      { currentStock: 30 },
      { reservedStock: 0 },
    ])
      expect(stockCorrectionInputSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });
  test("rejects zero, excessive precision, duplicate materials and oversized batch", () => {
    for (const quantity of [0, -1, 0.001, Infinity, 10_000_000_000])
      expect(
        stockCorrectionInputSchema.safeParse({ ...input, items: [{ ...input.items[0], quantity }] })
          .success,
      ).toBe(false);
    expect(stockCorrectionInputSchema.safeParse({ ...input, reason: "" }).success).toBe(false);
    expect(
      stockCorrectionInputSchema.safeParse({ ...input, items: [...input.items, ...input.items] })
        .success,
    ).toBe(false);
    expect(
      stockCorrectionInputSchema.safeParse({
        ...input,
        items: Array.from({ length: 51 }, () => ({
          ...input.items[0],
          materialId: crypto.randomUUID(),
        })),
      }).success,
    ).toBe(false);
  });
});
