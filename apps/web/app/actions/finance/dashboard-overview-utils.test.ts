import { describe, expect, test } from "bun:test";
import { isLowStockThresholdBreached } from "./dashboard-overview-utils";

describe("isLowStockThresholdBreached", () => {
  test("does not warn when tracking has no minimum threshold", () => {
    expect(isLowStockThresholdBreached(0, 0)).toBe(false);
  });

  test("warns at or below a configured minimum", () => {
    expect(isLowStockThresholdBreached(10, 10)).toBe(true);
    expect(isLowStockThresholdBreached(4, 10)).toBe(true);
    expect(isLowStockThresholdBreached(11, 10)).toBe(false);
  });
});
