import { describe, expect, test } from "bun:test";

import { calculateStockImpact, summarizeStockCountVariance } from "./material-ui-utils";

describe("material operational form calculations", () => {
  test("marks stock impact unsafe when the result crosses reserved stock", () => {
    expect(calculateStockImpact({ before: 12, delta: -5, reserved: 8 })).toEqual({
      before: 12,
      delta: -5,
      after: 7,
      reserved: 8,
      safe: false,
    });
    expect(calculateStockImpact({ before: 12, delta: -4, reserved: 8 }).safe).toBe(true);
  });

  test("summarizes positive and negative opname variances", () => {
    expect(summarizeStockCountVariance([
      { systemQuantity: 10, countedQuantity: 12, unitCost: 5_000 },
      { systemQuantity: 8, countedQuantity: 7, unitCost: 20_000 },
      { systemQuantity: 3, countedQuantity: 3, unitCost: 1_000 },
    ])).toEqual({ changedCount: 2, totalQuantity: 1, totalValue: -10_000 });
  });
});
