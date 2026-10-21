import { z } from "zod";

export const projectBudgetDefaultsSchema = z.object({
  settingId: z.string().min(1),
  settingName: z.string().min(1),
  budgetCapRatio: z.number().positive().max(1),
  categories: z
    .array(
      z.object({
        expenseCategoryId: z.string().min(1),
        code: z.string(),
        name: z.string(),
        ratioPercentage: z.number().min(0).max(1),
        sortOrder: z.number().int(),
      }),
    )
    .min(1),
});
export type ProjectBudgetDefaults = z.infer<typeof projectBudgetDefaultsSchema>;

export function projectBudgetDefaultsMatch(
  reviewed: ProjectBudgetDefaults,
  current: ProjectBudgetDefaults,
): boolean {
  if (
    new Set(reviewed.categories.map((category) => category.expenseCategoryId)).size !==
      reviewed.categories.length ||
    new Set(current.categories.map((category) => category.expenseCategoryId)).size !==
      current.categories.length
  )
    return false;
  return (
    reviewed.settingId === current.settingId &&
    reviewed.budgetCapRatio === current.budgetCapRatio &&
    reviewed.categories.length === current.categories.length &&
    reviewed.categories.every((category) =>
      current.categories.some(
        (other) =>
          other.expenseCategoryId === category.expenseCategoryId &&
          other.ratioPercentage === category.ratioPercentage,
      ),
    )
  );
}
