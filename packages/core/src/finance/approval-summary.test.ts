import { describe, expect, test } from "bun:test";

import type { FinanceApprovalDetail } from "./approval-types";
import { approvalIsCritical, summarizeApprovals } from "./approval-summary";

function approval(
  id: string,
  createdAt: Date,
  overrides: Partial<FinanceApprovalDetail> = {},
): FinanceApprovalDetail {
  return {
    id,
    createdAt,
    dueDate: null,
    notes: null,
    type: "project_cost",
    referenceId: `cost-${id}`,
    amount: 2_000_000,
    description: "Pengajuan lapangan",
    receiptImageUrl: null,
    projectName: "Menteng Villa",
    budgetItemName: "Operasional",
    allocatedAmount: 10_000_000,
    actualSpent: 5_000_000,
    requestedBy: "PM Budi",
    budgetOverrun: false,
    consumesBudgetActual: true,
    priority: "NORMAL",
    priorityReason: "Perlu keputusan Owner",
    ...overrides,
  };
}

describe("approval queue summary", () => {
  test("does not project stock purchases into category actuals", () => {
    const stockPurchase = approval("stock-purchase", new Date("2026-10-15T08:00:00+07:00"), {
      type: "vendor_payment",
      allocatedAmount: 100,
      actualSpent: 90,
      amount: 200,
      consumesBudgetActual: false,
    });

    expect(approvalIsCritical(stockPurchase)).toBe(false);
    expect(summarizeApprovals([stockPurchase], stockPurchase.createdAt).criticalCount).toBe(0);
    expect(approvalIsCritical({ ...stockPurchase, consumesBudgetActual: true })).toBe(true);
  });

  test("keeps the consuming budget limit boundary critical", () => {
    const request = approval("at-limit", new Date("2026-10-15T08:00:00+07:00"), {
      allocatedAmount: 100,
      actualSpent: 90,
      amount: 10,
    });

    expect(approvalIsCritical(request)).toBe(true);
    expect(approvalIsCritical({ ...request, amount: 9.99 })).toBe(false);
  });

  test("preserves explicit risks and current budget limits for non-consuming requests", () => {
    const request = approval("non-consuming", new Date("2026-10-15T08:00:00+07:00"), {
      allocatedAmount: 100,
      actualSpent: 90,
      amount: 200,
      consumesBudgetActual: false,
    });

    expect(approvalIsCritical({ ...request, priority: "CRITICAL" })).toBe(true);
    expect(approvalIsCritical({ ...request, budgetOverrun: true })).toBe(true);
    expect(approvalIsCritical({ ...request, actualSpent: 100 })).toBe(true);
  });

  test("does not infer utilization risk without a positive allocation", () => {
    const request = approval("unknown-allocation", new Date("2026-10-15T08:00:00+07:00"), {
      allocatedAmount: 0,
      actualSpent: 90,
      amount: 200,
    });

    expect(approvalIsCritical(request)).toBe(false);
    expect(approvalIsCritical({ ...request, allocatedAmount: -100 })).toBe(false);
    expect(approvalIsCritical({ ...request, allocatedAmount: Number.NaN })).toBe(false);
    expect(approvalIsCritical({ ...request, priority: "CRITICAL" })).toBe(true);
  });

  test("aggregates the full queue independently from a dashboard preview", () => {
    const now = new Date("2026-07-27T12:00:00+07:00");
    const items = [
      approval("1", new Date("2026-07-27T08:00:00+07:00")),
      approval("2", new Date("2026-07-23T08:00:00+07:00"), {
        amount: 5_000_000,
      }),
      approval("3", new Date("2026-07-20T08:00:00+07:00"), {
        priority: "CRITICAL",
      }),
    ];

    expect(summarizeApprovals(items, now)).toEqual({
      totalCount: 3,
      criticalCount: 2,
      waitingLongCount: 2,
      totalAmount: 9_000_000,
    });
  });
});
