import { describe, expect, test } from "bun:test";

import { getOpeningInventoryIneligibleReason } from "./opening-inventory-eligibility";
import { createInventoryOpeningSchema } from "@/lib/validations/material";

const inventoryIdA = "10000000-0000-4000-8000-000000000001";
const inventoryIdB = "10000000-0000-4000-8000-000000000002";

describe("opening inventory eligibility", () => {
  test("blocks inventory that already belongs to a pending opening batch", () => {
    expect(
      getOpeningInventoryIneligibleReason({
        hasPendingOpening: true,
        currentStock: 0,
        reservedStock: 0,
        hasMovement: false,
      }),
    ).toBe(
      "Inventory sudah ada dalam pengajuan saldo awal yang menunggu persetujuan.",
    );
  });

  test("allows untouched zero-balance inventory", () => {
    expect(
      getOpeningInventoryIneligibleReason({
        hasPendingOpening: false,
        currentStock: 0,
        reservedStock: 0,
        hasMovement: false,
      }),
    ).toBeNull();
  });
});

describe("opening inventory multi-item contract", () => {
  const baseInput = {
    cutoverDate: new Date("2026-07-18T00:00:00.000Z"),
    note: "Hasil hitung fisik gudang saat cutover.",
  };

  test("accepts several unique inventory items in one opening batch", () => {
    const result = createInventoryOpeningSchema.safeParse({
      ...baseInput,
      items: [
        { materialInventoryId: inventoryIdA, quantity: 10, unitCost: 250_000 },
        { materialInventoryId: inventoryIdB, quantity: 4, unitCost: 175_000 },
      ],
    });

    expect(result.success).toBe(true);
  });

  test("rejects the same inventory twice in one opening batch", () => {
    const result = createInventoryOpeningSchema.safeParse({
      ...baseInput,
      items: [
        { materialInventoryId: inventoryIdA, quantity: 10, unitCost: 250_000 },
        { materialInventoryId: inventoryIdA, quantity: 4, unitCost: 175_000 },
      ],
    });

    expect(result.success).toBe(false);
  });
});
