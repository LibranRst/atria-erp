import { describe, expect, test } from "bun:test";

import { resolveEffectiveProjectHealth } from "./effective-health";

describe("effective project health", () => {
  test("keeps a genuinely healthy project healthy", () => {
    expect(
      resolveEffectiveProjectHealth({
        storedHealth: "HEALTHY",
        remainingBudget: 250_000_000,
        usedPercentage: 45,
        categoryStatuses: ["SAFE", "SAFE"],
        projectedMarginPercentage: 18,
        targetMarginPercentage: 10,
      }),
    ).toEqual({ effectiveHealth: "HEALTHY", healthReasons: [] });
  });

  test("never shows healthy when canonical budget is overrun", () => {
    const result = resolveEffectiveProjectHealth({
      storedHealth: "HEALTHY",
      remainingBudget: -1,
      usedPercentage: 101,
      categoryStatuses: ["OVER_BUDGET"],
      projectedMarginPercentage: -2,
      targetMarginPercentage: 10,
    });

    expect(result.effectiveHealth).toBe("CRITICAL");
    expect(result.healthReasons).toEqual([
      "BUDGET_OVERRUN",
      "CATEGORY_CRITICAL",
      "NEGATIVE_MARGIN",
    ]);
  });

  test("preserves a more severe stored health signal", () => {
    expect(
      resolveEffectiveProjectHealth({
        storedHealth: "CRITICAL",
        remainingBudget: 100,
        usedPercentage: 10,
      }).effectiveHealth,
    ).toBe("CRITICAL");
  });

  test("returns warning for budget watch or margin below target", () => {
    const result = resolveEffectiveProjectHealth({
      storedHealth: "HEALTHY",
      remainingBudget: 100,
      usedPercentage: 80,
      categoryStatuses: ["WATCH"],
      projectedMarginPercentage: 8,
      targetMarginPercentage: 10,
    });

    expect(result.effectiveHealth).toBe("WARNING");
    expect(result.healthReasons).toEqual([
      "BUDGET_WATCH",
      "CATEGORY_WATCH",
      "MARGIN_BELOW_TARGET",
    ]);
  });
});
