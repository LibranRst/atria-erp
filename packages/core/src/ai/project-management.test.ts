import { expect, test } from "bun:test";
import {
  projectManagementInputSchema,
  resolveProjectAllocations,
  projectManagementPermissions,
} from "./project-management";
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
test("metadata cannot bypass contract, status, financial health, permissions or date validation", () => {
  for (const patch of [
    { status: "ACTIVE" },
    { totalContractValue: 1 },
    { financialHealth: "HEALTHY" },
    {},
    { startDate: "2026-02-30" },
  ])
    expect(
      projectManagementInputSchema.safeParse({ action: "EDIT_PROJECT", projectId: id, patch })
        .success,
    ).toBe(false);
  expect(
    projectManagementInputSchema.parse({
      action: "EDIT_PROJECT",
      projectId: id,
      patch: { location: null, name: " Proyek A " },
    }).action,
  ).toBe("EDIT_PROJECT");
});
test("partial allocation preserves untouched rows and counts them against the cap", () => {
  const current = [
    { id, allocatedAmount: "30.00", ratioPercentage: "0.300000" },
    { id: other, allocatedAmount: "50.00", ratioPercentage: "0.500000" },
  ];
  expect(
    resolveProjectAllocations("100.00", current, [
      { projectBudgetCategoryId: id, allocatedAmount: 40.01 },
    ]),
  ).toEqual([{ id, allocatedAmount: "40.01", ratioPercentage: "0.400100" }, current[1]]);
  expect(() =>
    resolveProjectAllocations("100.00", current, [
      { projectBudgetCategoryId: id, allocatedAmount: 50.01 },
    ]),
  ).toThrow("seluruh kategori");
  expect(() =>
    resolveProjectAllocations("100.00", current, [
      { projectBudgetCategoryId: "foreign", allocatedAmount: 1 },
    ]),
  ).toThrow("tidak termasuk");
});
test("allocation rejects duplicates/ambiguous values and rounds exact cents once", () => {
  const base = {
    action: "REALLOCATE_BUDGET",
    projectId: id,
    projectBudgetId: id,
    reason: "Kebutuhan finishing terbaru",
  };
  expect(
    projectManagementInputSchema.safeParse({
      ...base,
      categories: [{ projectBudgetCategoryId: id, allocatedAmount: 1, ratioPercentage: 0.1 }],
    }).success,
  ).toBe(false);
  expect(
    projectManagementInputSchema.safeParse({
      ...base,
      categories: [1, 2].map(() => ({ projectBudgetCategoryId: id, allocatedAmount: 1 })),
    }).success,
  ).toBe(false);
  expect(
    resolveProjectAllocations(
      "0.05",
      [{ id, allocatedAmount: "0.00", ratioPercentage: "0.000000" }],
      [{ projectBudgetCategoryId: id, ratioPercentage: 0.5 }],
    )[0].allocatedAmount,
  ).toBe("0.03");
});
test("decisions require their real domain grants and explicit human reasons", () => {
  expect(projectManagementPermissions("APPROVE_BUDGET")).toContain("approve:budget");
  expect(projectManagementPermissions("COMPLETE_PROJECT")).toEqual([
    "view:project",
    "update:budget",
    "view:profitability",
    "close:project",
  ]);
  expect(
    projectManagementInputSchema.safeParse({
      action: "COMPLETE_PROJECT",
      projectId: id,
      closingNote: "",
    }).success,
  ).toBe(false);
});
