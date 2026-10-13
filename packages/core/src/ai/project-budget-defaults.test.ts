import { expect, test } from "bun:test";
import { projectBudgetDefaultsMatch, projectBudgetDefaultsSchema } from "./project-budget-defaults";

const defaults = projectBudgetDefaultsSchema.parse({
  settingId: "active-1",
  settingName: "Budget perusahaan",
  budgetCapRatio: 0.92,
  categories: [
    {
      expenseCategoryId: "material",
      code: "MATERIAL",
      name: "Material",
      ratioPercentage: 0.43,
      sortOrder: 1,
    },
    {
      expenseCategoryId: "labor",
      code: "TUKANG",
      name: "Tukang",
      ratioPercentage: 0.2,
      sortOrder: 2,
    },
  ],
});
test("reviewed settings preserve actual non-hardcoded ratios and zero allocations", () => {
  expect(defaults.budgetCapRatio).toBe(0.92);
  expect(
    projectBudgetDefaultsMatch(defaults, {
      ...defaults,
      categories: [...defaults.categories].reverse(),
    }),
  ).toBe(true);
  expect(
    projectBudgetDefaultsSchema.safeParse({
      ...defaults,
      categories: [{ ...defaults.categories[0], ratioPercentage: 0 }],
    }).success,
  ).toBe(true);
});
test("changed active settings, cap or category ratios invalidate the reviewed preview", () => {
  expect(projectBudgetDefaultsMatch(defaults, { ...defaults, settingId: "active-2" })).toBe(false);
  expect(projectBudgetDefaultsMatch(defaults, { ...defaults, budgetCapRatio: 0.9 })).toBe(false);
  expect(
    projectBudgetDefaultsMatch(defaults, {
      ...defaults,
      categories: [{ ...defaults.categories[0], ratioPercentage: 0.3 }, defaults.categories[1]],
    }),
  ).toBe(false);
  expect(
    projectBudgetDefaultsMatch(defaults, { ...defaults, categories: [defaults.categories[0]] }),
  ).toBe(false);
  expect(
    projectBudgetDefaultsMatch(
      { ...defaults, categories: [defaults.categories[0], defaults.categories[0]] },
      defaults,
    ),
  ).toBe(false);
});
test("fallback, invalid cap and missing categories cannot become a reviewed ERP snapshot", () => {
  expect(projectBudgetDefaultsSchema.safeParse({ ...defaults, settingId: null }).success).toBe(
    false,
  );
  expect(projectBudgetDefaultsSchema.safeParse({ ...defaults, budgetCapRatio: NaN }).success).toBe(
    false,
  );
  expect(projectBudgetDefaultsSchema.safeParse({ ...defaults, categories: [] }).success).toBe(
    false,
  );
});
