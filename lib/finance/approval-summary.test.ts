import { describe, expect, test } from "bun:test";

import type { FinanceApprovalDetail } from "@/lib/finance/approval-types";
import { summarizeApprovals } from "@/lib/finance/approval-summary";

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
    priority: "NORMAL",
    priorityReason: "Perlu keputusan Owner",
    ...overrides,
  };
}

describe("approval queue summary", () => {
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
