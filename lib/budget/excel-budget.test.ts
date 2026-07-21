import { describe, expect, test } from "bun:test";

import {
  calculateInternalBudget,
  calculateTargetGross,
  calculateUsedPercentage,
  DEFAULT_EXPENSE_CATEGORIES,
  EXCEL_BUDGET_CAP_RATIO,
  getBudgetCategoryStatus,
} from "@/lib/budget/excel-budget";

describe("Project Budget default helpers", () => {
  test("uses Dekoria Project Budget workbook defaults", () => {
    expect(EXCEL_BUDGET_CAP_RATIO).toBe(0.9);
    expect(DEFAULT_EXPENSE_CATEGORIES.map((category) => category.code)).toEqual([
      "TUKANG",
      "MATERIAL",
      "OPERASIONAL",
      "LAIN_LAIN",
      "SUBCON",
    ]);
    expect(
      DEFAULT_EXPENSE_CATEGORIES.find((category) => category.code === "TUKANG")?.defaultRatio,
    ).toBe(0.18);
    expect(
      DEFAULT_EXPENSE_CATEGORIES.find((category) => category.code === "MATERIAL")?.defaultRatio,
    ).toBe(0.35);
    expect(
      DEFAULT_EXPENSE_CATEGORIES.find((category) => category.code === "OPERASIONAL")?.defaultRatio,
    ).toBe(0.01);
    expect(
      DEFAULT_EXPENSE_CATEGORIES.find((category) => category.code === "LAIN_LAIN")?.defaultRatio,
    ).toBe(0.005);
    expect(
      DEFAULT_EXPENSE_CATEGORIES.find((category) => category.code === "SUBCON")?.defaultRatio,
    ).toBe(0);
  });

  test("calculates internal budget and target gross from contract value", () => {
    const internalBudget = calculateInternalBudget(800_000_000);
    const gross = calculateTargetGross(800_000_000, internalBudget);

    expect(internalBudget).toBe(720_000_000);
    expect(gross.amount).toBe(80_000_000);
    expect(gross.percentage).toBe(10);
  });

  test("calculates category usage thresholds", () => {
    expect(calculateUsedPercentage(45, 100)).toBe(45);
    expect(getBudgetCategoryStatus(74.99)).toBe("SAFE");
    expect(getBudgetCategoryStatus(75)).toBe("WATCH");
    expect(getBudgetCategoryStatus(95)).toBe("CRITICAL");
    expect(getBudgetCategoryStatus(100.01)).toBe("OVER_BUDGET");
  });
});
