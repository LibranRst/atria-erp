import { describe, expect, test } from "bun:test";

import {
  getApprovalBudgetImpact,
  getBudgetGeometry,
  getUsageBlockFill,
  RISK_LIMIT_THRESHOLD,
  RISK_WARNING_THRESHOLD,
} from "@/features/finance-dashboard/utils/budget-indicator-utils";

describe("contextual budget indicators", () => {
  test("clamps geometry while preserving overflow", () => {
    expect(RISK_WARNING_THRESHOLD).toBe(80);
    expect(RISK_LIMIT_THRESHOLD).toBe(100);
    expect(getBudgetGeometry(-20)).toEqual({
      clampedPercentage: 0,
      overflowPercentage: 0,
      remainingPercentage: 100,
    });
    expect(getBudgetGeometry(124)).toEqual({
      clampedPercentage: 100,
      overflowPercentage: 24,
      remainingPercentage: 0,
    });
  });

  test("fills each category block without overstating partial usage", () => {
    expect(getUsageBlockFill(10, 0)).toBe(50);
    expect(getUsageBlockFill(10, 1)).toBe(0);
    expect(getUsageBlockFill(33, 0)).toBe(100);
    expect(getUsageBlockFill(33, 1)).toBe(65);
  });

  test("calculates safe, warning, and over-budget approval impact", () => {
    expect(getApprovalBudgetImpact(100, 40, 20)).toEqual({
      beforePercentage: 40,
      afterPercentage: 60,
      overflowPercentage: 0,
    });
    expect(getApprovalBudgetImpact(100, 70, 15).afterPercentage).toBe(85);
    expect(getApprovalBudgetImpact(100, 90, 34)).toEqual({
      beforePercentage: 90,
      afterPercentage: 124,
      overflowPercentage: 24,
    });
  });
});
