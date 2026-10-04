import { describe, expect, test } from "bun:test";
import { calculateOutstandingProjectReservations } from "@backend/app/actions/material/inventory-utils";
import {
  calculateReceiptReversalValuation,
  calculateTransferDestinationAverage,
} from "@atria/core/material/stock-valuation";
import {
  createStockTransferSchema,
  receiptReversalRequestSchema,
  saveStockCountSchema,
} from "@atria/core/validations/warehouse";

const A = "14141414-1414-1414-1414-141414141401";
const B = "14141414-1414-1414-1414-141414141402";
const M = "13131313-1313-1313-1313-131313131301";

describe("warehouse control", () => {
  test("project reservation consumption never releases another RAP reservation", () => {
    const movements = [
      {
        materialId: "material-1",
        inventoryLocationId: "location-1",
        projectRapItemId: "rap-a",
        movementType: "RESERVE",
        quantity: "10.00",
      },
      {
        materialId: "material-1",
        inventoryLocationId: "location-1",
        projectRapItemId: "rap-b",
        movementType: "RESERVE",
        quantity: "8.00",
      },
      {
        materialId: "material-1",
        inventoryLocationId: "location-1",
        projectRapItemId: "rap-a",
        movementType: "USE",
        quantity: "6.00",
      },
      {
        materialId: "material-1",
        inventoryLocationId: "location-1",
        projectRapItemId: "rap-a",
        movementType: "WASTE",
        quantity: "2.00",
      },
    ] as const;

    expect(calculateOutstandingProjectReservations(movements)).toBe(10);
    expect(
      calculateOutstandingProjectReservations(
        movements.filter((movement) => movement.projectRapItemId === "rap-a"),
      ),
    ).toBe(2);
  });

  test("unreserved usage before a reservation does not consume the later reservation", () => {
    const movements = [
      {
        materialId: "material-1",
        inventoryLocationId: "location-1",
        projectRapItemId: "rap-a",
        movementType: "USE",
        quantity: "5.00",
      },
      {
        materialId: "material-1",
        inventoryLocationId: "location-1",
        projectRapItemId: "rap-a",
        movementType: "RESERVE",
        quantity: "10.00",
      },
    ] as const;

    expect(calculateOutstandingProjectReservations(movements)).toBe(10);
  });
  test("transfer preserves weighted destination value", () => {
    expect(
      calculateTransferDestinationAverage({
        destinationQuantity: 10,
        destinationAverageCost: 100,
        transferQuantity: 5,
        sourceAverageCost: 160,
      }),
    ).toBe(120);
  });
  test("receipt reversal restores remaining moving average", () => {
    expect(
      calculateReceiptReversalValuation({
        currentQuantity: 15,
        currentAverageCost: 120,
        receiptQuantity: 5,
        receiptUnitCost: 160,
      }),
    ).toEqual({ nextQuantity: 10, nextAverageCost: 100 });
  });
  test("receipt reversal rejects insufficient quantity/value", () => {
    expect(() =>
      calculateReceiptReversalValuation({
        currentQuantity: 2,
        currentAverageCost: 100,
        receiptQuantity: 3,
        receiptUnitCost: 100,
      }),
    ).toThrow();
  });
  test("transfer requires distinct locations and unique materials", () => {
    expect(
      createStockTransferSchema.safeParse({
        transferNumber: "TR-1",
        fromLocationId: A,
        toLocationId: A,
        transferredAt: new Date(),
        note: "Transfer kebutuhan showroom",
        items: [{ materialId: M, quantity: 1 }],
      }).success,
    ).toBe(false);
    expect(
      createStockTransferSchema.safeParse({
        transferNumber: "TR-1",
        fromLocationId: A,
        toLocationId: B,
        transferredAt: new Date(),
        note: "Transfer kebutuhan showroom",
        items: [
          { materialId: M, quantity: 1 },
          { materialId: M, quantity: 2 },
        ],
      }).success,
    ).toBe(false);
  });
  test("stock count and reversal reason validate", () => {
    expect(
      saveStockCountSchema.safeParse({
        countNumber: "SC-1",
        inventoryLocationId: A,
        countedAt: new Date(),
        items: [{ materialId: M, countedQuantity: 0 }],
      }).success,
    ).toBe(true);
    expect(
      receiptReversalRequestSchema.safeParse({ goodsReceiptId: M, reason: "short" }).success,
    ).toBe(false);
  });
});
