import { describe, expect, test } from "bun:test";
import type { ExpenseCostItem } from "@/features/expenses/types/expense-list-types";
import {
  fieldClaimCategoryLabel,
  fieldClaimDesktopAction,
  filterFieldClaimsDesktop,
} from "./field-claims-desktop";

function claim(overrides: Partial<ExpenseCostItem> = {}): ExpenseCostItem {
  return {
    id: "cost-a",
    amount: "1250000.25",
    description: "Panel kabinet dapur",
    receiptImageUrl: null,
    status: "SUBMITTED",
    budgetOverrun: false,
    createdAt: new Date("2026-01-10T03:00:00Z"),
    project: { id: "project-a", name: "Rumah Cipete" },
    budgetCategory: { id: "budget-a", expenseCategory: { code: "MATERIAL", name: "Material" } },
    budgetItem: null,
    requestedBy: { name: "Budi Santoso" },
    ...overrides,
  };
}
const noFilters = { query: "", project: "all", category: "all", date: "all" };

describe("desktop field claim filtering", () => {
  test("combines authorized project, category and search facts without truncating the source", () => {
    const costs = Array.from({ length: 31 }, (_, index) => claim({ id: `cost-${index}` }));
    costs.push(claim({ id: "other-project", project: { id: "project-b", name: "Cipete lain" } }));
    const filtered = filterFieldClaimsDesktop(
      costs,
      { ...noFilters, project: "project-a", category: "MATERIAL", query: " BUDI " },
      new Date("2026-01-14T00:00:00Z"),
    );
    expect(filtered).toHaveLength(31);
    expect(filtered.some((cost) => cost.id === "other-project")).toBe(false);
    expect(costs).toHaveLength(32);
  });
  test("uses supplied canonical categories and readable legacy fallback without inventing a category", () => {
    const legacy = claim({
      budgetCategory: null,
      budgetItem: {
        id: "item",
        name: "Transportasi",
        allocatedAmount: "100",
        actualSpent: "25",
        costCategory: { name: "LAIN_LAIN" },
      },
    });
    expect(fieldClaimCategoryLabel(legacy)).toBe("Lain-lain");
    expect(fieldClaimCategoryLabel(claim({ budgetCategory: null }))).toBe("Belum ditentukan");
    expect(
      filterFieldClaimsDesktop([legacy], { ...noFilters, query: "lain-lain" }, new Date()),
    ).toEqual([legacy]);
  });
  test("calendar month filters use Jakarta boundaries and cross the year correctly", () => {
    const before = claim({ id: "december", createdAt: new Date("2025-12-31T16:59:59Z") });
    const after = claim({ id: "january", createdAt: new Date("2025-12-31T17:00:00Z") });
    const november = claim({ id: "november", createdAt: new Date("2025-11-20T12:00:00Z") });
    const now = new Date("2025-12-31T17:00:00Z");
    expect(
      filterFieldClaimsDesktop(
        [before, after, november],
        { ...noFilters, date: "this-month" },
        now,
      ).map((cost) => cost.id),
    ).toEqual(["january"]);
    expect(
      filterFieldClaimsDesktop(
        [before, after, november],
        { ...noFilters, date: "last-month" },
        now,
      ).map((cost) => cost.id),
    ).toEqual(["december"]);
  });
  test("missing date does not become a result in a bounded calendar filter", () => {
    expect(
      filterFieldClaimsDesktop(
        [claim({ createdAt: new Date("invalid") })],
        { ...noFilters, date: "this-month" },
        new Date(),
      ),
    ).toEqual([]);
  });
  test("a refreshed calendar reclassifies the same collection after a Jakarta month rollover", () => {
    const december = claim({ id: "december", createdAt: new Date("2025-12-31T16:59:59Z") });
    const january = claim({ id: "january", createdAt: new Date("2025-12-31T17:00:00Z") });
    const costs = [december, january];
    const filters = { ...noFilters, date: "this-month" };
    expect(
      filterFieldClaimsDesktop(costs, filters, new Date("2025-12-31T16:59:59Z")).map(
        (cost) => cost.id,
      ),
    ).toEqual(["december"]);
    expect(
      filterFieldClaimsDesktop(costs, filters, new Date("2025-12-31T17:00:01Z")).map(
        (cost) => cost.id,
      ),
    ).toEqual(["january"]);
  });
});

describe("desktop field claim actions", () => {
  test("permissions and workflow state both gate explicit verification and payment", () => {
    expect(fieldClaimDesktopAction("SUBMITTED", { verify: true, pay: false })).toBe("verify");
    expect(fieldClaimDesktopAction("APPROVED", { verify: false, pay: true })).toBe("pay");
    expect(fieldClaimDesktopAction("SUBMITTED", { verify: false, pay: true })).toBeNull();
    expect(fieldClaimDesktopAction("APPROVED", { verify: true, pay: false })).toBeNull();
    for (const status of ["VERIFIED", "REJECTED", "PAID"] as const)
      expect(fieldClaimDesktopAction(status, { verify: true, pay: true })).toBeNull();
  });
});
