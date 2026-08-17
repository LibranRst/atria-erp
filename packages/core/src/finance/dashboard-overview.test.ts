import { describe, expect, test } from "bun:test";
import {
  buildFinanceDashboardCore,
  calculateOutstanding,
  dashboardDueDayOffset,
  limitDashboardTabDetails,
  resolveDashboardDueBucket,
  type FinanceDashboardCoreInput,
} from "./dashboard-overview";

const now = new Date("2026-06-22T00:00:00.000Z");

function input(role: "OWNER" | "FINANCE_ADMIN"): FinanceDashboardCoreInput {
  return {
    role,
    cashAvailable: 500,
    now,
    pendingApprovals: 2,
    materialShortageCount: 4,
    lowStockCount: 1,
    receivables: [
      { amount: 100, paidAmount: 40, status: "PARTIALLY_PAID", dueDate: new Date("2026-06-01") },
    ],
    payables: [
      { amount: 80, paidAmount: 20, status: "PARTIALLY_PAID", dueDate: new Date("2026-06-02") },
    ],
    projects: [
      {
        projectId: "project-active",
        projectName: "Active Project",
        financialHealth: "CRITICAL",
        contractValue: 1_000,
        internalBudget: 900,
        targetGrossAmount: 100,
        categories: [
          {
            code: "MATERIAL",
            name: "Material",
            allocatedAmount: 500,
            pendingAmount: 20,
            actualAmount: 550,
            paidAmount: 300,
            sortOrder: 1,
          },
        ],
      },
    ],
  };
}

describe("finance dashboard overview", () => {
  test("calculates outstanding after partial payments and ignores void documents", () => {
    expect(
      calculateOutstanding({ amount: 100, paidAmount: 40, status: "PARTIALLY_PAID", dueDate: now }),
    ).toBe(60);
    expect(calculateOutstanding({ amount: 100, paidAmount: 0, status: "VOID", dueDate: now })).toBe(
      0,
    );
  });

  test("aggregates only projects supplied by the active-project query", () => {
    const result = buildFinanceDashboardCore(input("OWNER"));
    expect(result.summary.projectValue).toBe(1_000);
    expect(result.summary.internalBudget).toBe(900);
    expect(result.summary.receivablesOutstanding).toBe(60);
    expect(result.summary.payablesOutstanding).toBe(60);
    expect(result.summary.payablesDueSoon).toBe(60);
    expect(result.categories[0]?.status).toBe("OVER_BUDGET");
    expect(result.riskyProjects[0]?.effectiveHealth).toBe("CRITICAL");
    expect(result.riskyProjects[0]?.healthReasons).toContain("CATEGORY_CRITICAL");
  });

  test("ranks derived critical health above a stored warning", () => {
    const base = input("OWNER");
    const result = buildFinanceDashboardCore({
      ...base,
      projects: [
        {
          ...base.projects[0]!,
          projectId: "stored-warning",
          projectName: "Stored warning",
          financialHealth: "WARNING",
          categories: [
            {
              code: "MATERIAL",
              name: "Material",
              allocatedAmount: 500,
              pendingAmount: 0,
              actualAmount: 300,
              paidAmount: 0,
              sortOrder: 1,
            },
          ],
        },
        {
          ...base.projects[0]!,
          projectId: "derived-critical",
          projectName: "Derived critical",
          financialHealth: "HEALTHY",
        },
      ],
    });

    expect(result.riskyProjects[0]?.projectId).toBe("derived-critical");
    expect(result.riskyProjects[0]?.effectiveHealth).toBe("CRITICAL");
  });

  test("uses role-specific ordering and limits actions to three", () => {
    const owner = buildFinanceDashboardCore(input("OWNER"));
    const finance = buildFinanceDashboardCore(input("FINANCE_ADMIN"));
    expect(owner.actions).toHaveLength(3);
    expect(owner.actions[0]?.id).toBe("approvals");
    expect(finance.actions).toHaveLength(3);
    expect(finance.actions[0]?.id).toBe("overdue-payables");
    expect(finance.actions[1]?.id).toBe("overdue-receivables");
  });

  test("builds dashboard tab counts and keeps overview as the default tab", () => {
    const owner = buildFinanceDashboardCore(input("OWNER"));
    const finance = buildFinanceDashboardCore(input("FINANCE_ADMIN"));

    expect(owner.dashboardTabs.counts.approvals).toBe(2);
    expect(owner.dashboardTabs.counts.budget).toBe(1);
    expect(owner.dashboardTabs.counts.cash).toBe(2);
    expect(owner.dashboardTabs.counts.materials).toBe(5);
    expect(owner.dashboardTabs.defaultTab).toBe("overview");

    expect(finance.dashboardTabs.counts.approvals).toBe(0);
    expect(finance.dashboardTabs.defaultTab).toBe("overview");
  });

  test("limits dashboard tab details to the dashboard detail limit", () => {
    expect(limitDashboardTabDetails([1, 2, 3, 4, 5, 6])).toEqual([1, 2, 3, 4, 5]);
  });

  test("groups due dates by Asia/Jakarta calendar boundaries", () => {
    const reference = new Date("2026-07-15T16:30:00.000Z"); // 23:30 Jakarta
    const laterSameJakartaDay = new Date("2026-07-15T16:59:00.000Z");
    const nextJakartaDay = new Date("2026-07-15T17:01:00.000Z");
    expect(dashboardDueDayOffset(laterSameJakartaDay, reference)).toBe(0);
    expect(resolveDashboardDueBucket(laterSameJakartaDay, reference)).toBe("TODAY");
    expect(dashboardDueDayOffset(nextJakartaDay, reference)).toBe(1);
    expect(resolveDashboardDueBucket(nextJakartaDay, reference)).toBe("NEXT_7_DAYS");
  });

  test("does not count documents due today as overdue actions", () => {
    const reference = new Date("2026-07-15T10:00:00.000Z"); // 17:00 Jakarta
    const base = input("FINANCE_ADMIN");
    const result = buildFinanceDashboardCore({
      ...base,
      now: reference,
      receivables: [],
      payables: [
        {
          amount: 100,
          paidAmount: 0,
          status: "PENDING",
          dueDate: new Date("2026-07-14T17:00:00.000Z"), // 15 Jul Jakarta
        },
        {
          amount: 200,
          paidAmount: 0,
          status: "PENDING",
          dueDate: new Date("2026-07-13T17:00:00.000Z"), // 14 Jul Jakarta
        },
      ],
    });

    expect(result.actions.find((action) => action.id === "overdue-payables")?.title).toBe(
      "1 tagihan vendor terlambat",
    );
    expect(result.dashboardTabs.counts.cash).toBe(2);
  });

  test("treats paid and void documents as zero near-term obligations", () => {
    const base = input("FINANCE_ADMIN");
    const result = buildFinanceDashboardCore({
      ...base,
      payables: [
        { amount: 200, paidAmount: 200, status: "PAID", dueDate: now },
        { amount: 300, paidAmount: 0, status: "VOID", dueDate: now },
      ],
    });
    expect(result.summary.payablesOutstanding).toBe(0);
    expect(result.summary.payablesDueSoon).toBe(0);
  });
});
