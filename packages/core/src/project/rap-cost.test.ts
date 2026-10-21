import { expect, test } from "bun:test";
import {
  availableRapStock,
  calculateRapMaterialCost,
  hasTwoDecimalPrecision,
  sumRapAmounts,
} from "./rap-cost";
test("RAP stored quantities and currency totals use exact scaled arithmetic", (): void => {
  expect(
    calculateRapMaterialCost({
      requiredQuantity: 0.1,
      bufferQuantity: 0.2,
      estimatedUnitCost: 12.35,
    }),
  ).toEqual({
    requiredQuantity: "0.10",
    bufferQuantity: "0.20",
    totalQuantity: "0.30",
    estimatedUnitCost: "12.35",
    estimatedTotalCost: "3.71",
  });
  expect(sumRapAmounts(["0.10", "0.20"])).toBe(0.3);
  expect(availableRapStock([{ currentStock: "0.30", reservedStock: "0.10" }])).toBe(0.2);
});
test("RAP rejects ambiguous precision, nonfinite/negative values and numeric overflow", (): void => {
  expect(hasTwoDecimalPrecision(1.005)).toBe(false);
  for (const requiredQuantity of [0, -1, 0.005, Infinity, 10_000_000_000])
    expect(() =>
      calculateRapMaterialCost({ requiredQuantity, bufferQuantity: 0, estimatedUnitCost: 10 }),
    ).toThrow();
  expect(() =>
    calculateRapMaterialCost({
      requiredQuantity: 9_999_999_999.99,
      bufferQuantity: 1,
      estimatedUnitCost: 1,
    }),
  ).toThrow();
  expect(() =>
    calculateRapMaterialCost({
      requiredQuantity: 100,
      bufferQuantity: 0,
      estimatedUnitCost: 999_999_999_999.99,
    }),
  ).toThrow();
});
