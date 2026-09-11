import { describe, expect, test } from "bun:test";

import { calculateRabBudgetDerivation } from "./excel-budget";

describe("calculateRabBudgetDerivation", () => {
  test("100% pure production items: behaves identical to standard 90% budget cap", () => {
    const items = [
      {
        lineTotal: "30000000.00",
        isHidden: false,
        itemNature: "PRODUCTION" as const,
      },
      {
        lineTotal: "20000000.00",
        isHidden: false,
        itemNature: "PRODUCTION" as const,
      },
    ];

    const result = calculateRabBudgetDerivation({
      items,
      budgetCapRatio: 0.9,
    });

    expect(result.approvedValue).toBe(50_000_000);
    expect(result.serviceFeeTotal).toBe(0);
    expect(result.productionScopeTotal).toBe(50_000_000);
    expect(result.internalBudget).toBe(45_000_000);
    expect(result.targetGrossAmount).toBe(5_000_000);
    expect(result.targetGrossPercentage).toBe(10);
    expect(result.productionGrossMarginAmount).toBe(5_000_000);
    expect(result.productionGrossMarginPercentage).toBe(10);
  });

  test("Hybrid Design & Build (Bassura City scenario): 21.9M service fee flows 100% to gross margin", () => {
    const items = [
      // Physical materials / packages (~28.072.222,29)
      {
        lineTotal: "8072222.29",
        isHidden: false,
        itemNature: "PRODUCTION" as const,
      },
      {
        lineTotal: "11111111.11",
        isHidden: false,
        itemNature: "PRODUCTION" as const,
      },
      {
        lineTotal: "8888888.89",
        isHidden: false,
        itemNature: "PRODUCTION" as const,
      },
      // Jasa Desain 3D & Manajemen (~21.927.777,71)
      {
        lineTotal: "21927777.71",
        isHidden: false,
        itemNature: "SERVICE_FEE" as const,
      },
    ];

    const result = calculateRabBudgetDerivation({
      items,
      budgetCapRatio: 0.9,
    });

    expect(result.approvedValue).toBe(50_000_000);
    expect(result.serviceFeeTotal).toBe(21_927_777.71);
    expect(result.productionScopeTotal).toBe(28_072_222.29);
    // Internal budget applies 90% ONLY to production scope!
    expect(result.internalBudget).toBe(25_265_000.06);
    // Target gross margin is 50M - 25.265M = ~24.735M (49.47%)
    expect(result.targetGrossAmount).toBe(24_734_999.94);
    expect(Math.round(result.targetGrossPercentage * 100) / 100).toBe(49.47);
    // Pure production gross margin is 10% of physical scope (~2.807M)
    expect(result.productionGrossMarginAmount).toBe(2_807_222.23);
    expect(Math.round(result.productionGrossMarginPercentage * 100) / 100).toBe(10);
  });

  test("Respects hidden items and bundles", () => {
    const items = [
      {
        lineTotal: "10000000.00",
        isHidden: false,
        itemNature: "PRODUCTION" as const,
      },
      {
        lineTotal: "5000000.00",
        isHidden: true, // Should be ignored
        itemNature: "PRODUCTION" as const,
      },
      {
        lineTotal: "5000000.00",
        bundleId: "bundle-1", // Should be ignored from standalone
        isHidden: false,
        itemNature: "PRODUCTION" as const,
      },
      {
        lineTotal: "15000000.00",
        isHidden: false,
        itemNature: "SERVICE_FEE" as const,
      },
    ];

    const bundles = [
      {
        id: "bundle-1",
        lineTotal: "7000000.00",
        isHidden: false,
      },
    ];

    const result = calculateRabBudgetDerivation({
      items,
      bundles,
      budgetCapRatio: 0.9,
    });

    // Total = 10M standalone production + 7M bundle + 15M service fee = 32M
    expect(result.approvedValue).toBe(32_000_000);
    expect(result.serviceFeeTotal).toBe(15_000_000);
    expect(result.productionScopeTotal).toBe(17_000_000);
    expect(result.internalBudget).toBe(15_300_000); // 17M * 0.9
    expect(result.targetGrossAmount).toBe(16_700_000); // 32M - 15.3M
  });
});
