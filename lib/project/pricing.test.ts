import { describe, expect, test } from "bun:test";

import { calculateGrossMarginRatio, calculateSuggestedClientPrice } from "@/lib/project/pricing";
import {
  reallocateProjectBudgetSchema,
  upsertPricingTemplateSchema,
} from "@/lib/validations/workflow-governance";

describe("pricing template math", () => {
  test("derives suggested client price from cost and gross margin", () => {
    expect(calculateSuggestedClientPrice(45_000_000, 0.2)).toBe(56_250_000);
    expect(calculateSuggestedClientPrice(250_000, 0.3)).toBeCloseTo(357_142.857, 2);
  });

  test("round-trips gross margin", () => {
    const price = calculateSuggestedClientPrice(41_000_000, 0.2);
    expect(calculateGrossMarginRatio(price, 41_000_000)).toBeCloseTo(0.2, 8);
  });
});

describe("workflow governance validation", () => {
  test("accepts positive unallocated buffer and rejects allocation above 100%", () => {
    const base = {
      projectBudgetId: "30303030-3030-3030-3030-303030303003",
      categories: [
        { projectBudgetCategoryId: "32323232-3232-3232-3232-323232323301", ratioPercentage: 0.35 },
        { projectBudgetCategoryId: "32323232-3232-3232-3232-323232323302", ratioPercentage: 0.18 },
      ],
    };
    expect(reallocateProjectBudgetSchema.safeParse(base).success).toBe(true);
    expect(
      reallocateProjectBudgetSchema.safeParse({
        ...base,
        categories: base.categories.map((category) => ({ ...category, ratioPercentage: 0.6 })),
      }).success,
    ).toBe(false);
  });

  test("requires cost provenance and at least one component", () => {
    const result = upsertPricingTemplateSchema.safeParse({
      expenseCategoryId: "31313131-3131-3131-3131-313131313101",
      itemType: "WORK_PACKAGE",
      itemCategory: "Tukang",
      name: "Installation Crew Package",
      unit: "ls",
      pricingMode: "MARGIN_BASED",
      targetGrossPercentage: 0.2,
      priceSourceType: "COST_BREAKDOWN",
      sourceNote: "Breakdown kru instalasi Juni 2026.",
      effectiveFrom: new Date("2026-06-01"),
      components: [],
    });
    expect(result.success).toBe(false);
  });
});
