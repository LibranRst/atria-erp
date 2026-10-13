import { expect, test } from "bun:test";
import { configuredBudgetSnapshot } from "./allocation-defaults";

test("active allocation keeps configured ratios/order and excludes disabled or inactive categories", () => {
  const category = {
    expenseCategoryId: "material",
    ratioPercentage: "0.350000",
    sortOrder: 2,
    isEnabled: true,
    expenseCategory: { code: "MATERIAL", name: "Material", isActive: true },
  };
  const snapshot = configuredBudgetSnapshot({
    id: "setting-1",
    name: "Aktif",
    budgetCapRatio: "0.900000",
    categories: [
      category,
      { ...category, expenseCategoryId: "disabled", isEnabled: false },
      {
        ...category,
        expenseCategoryId: "inactive",
        expenseCategory: { ...category.expenseCategory, isActive: false },
      },
      {
        ...category,
        expenseCategoryId: "subcon",
        ratioPercentage: "0.000000",
        sortOrder: 1,
        expenseCategory: { code: "SUBCON", name: "Subcon", isActive: true },
      },
    ],
  });
  expect(snapshot?.budgetCapRatio).toBe(0.9);
  expect(
    snapshot?.categories.map((entry) => [entry.expenseCategoryId, entry.ratioPercentage]),
  ).toEqual([
    ["subcon", 0],
    ["material", 0.35],
  ]);
  expect(snapshot?.settingId).toBe("setting-1");
});
test("missing or incomplete settings require the existing manual fallback, never a policy claim", () => {
  expect(configuredBudgetSnapshot(undefined)).toBeNull();
  expect(
    configuredBudgetSnapshot({ id: "s-1", name: "Aktif", budgetCapRatio: "0.9", categories: [] }),
  ).toBeNull();
});
