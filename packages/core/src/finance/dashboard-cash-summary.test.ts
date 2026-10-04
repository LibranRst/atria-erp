import { expect, test } from "bun:test";
import { getDashboardCashSummary } from "./dashboard-cash-summary";

test("large receivables do not reduce cash coverage of vendor obligations", () => {
  const exposure = getDashboardCashSummary(
    [
      { bucket: "OVERDUE", count: 1, totalOutstanding: 180_000_000 },
      { bucket: "TODAY", count: 1, totalOutstanding: 20_000_000 },
      { bucket: "LATER", count: 2, totalOutstanding: 900_000_000 },
    ],
    100_000_000,
    20_000_000,
  );
  expect(exposure.outstandingAmount).toBe(200_000_000);
  expect(exposure.cashCoverageRatio).toBe(5);
  expect(exposure.payablesAmount).toBe(20_000_000);
  const moreReceivables = getDashboardCashSummary(
    [{ bucket: "NEXT_7_DAYS", count: 5, totalOutstanding: 1_000_000_000 }],
    100_000_000,
    20_000_000,
  );
  expect(moreReceivables.cashCoverageRatio).toBe(exposure.cashCoverageRatio);
});

test("no payable obligation has no coverage ratio, even with outstanding invoices", () => {
  expect(
    getDashboardCashSummary([{ bucket: "OVERDUE", count: 1, totalOutstanding: 100_000_000 }], 0, 0),
  ).toEqual({
    outstandingAmount: 100_000_000,
    payablesAmount: 0,
    cashCoverageRatio: null,
    overdueCount: 1,
    todayCount: 0,
    nextSevenDaysCount: 0,
  });
  expect(getDashboardCashSummary([], 20_000_000, 0).outstandingAmount).toBe(0);
});

test("coverage below one exposes insufficient cash without mixing later documents", () => {
  const result = getDashboardCashSummary(
    [
      { bucket: "OVERDUE", count: 2, totalOutstanding: 40_000_000 },
      { bucket: "NEXT_7_DAYS", count: 1, totalOutstanding: 60_000_000 },
      { bucket: "LATER", count: 3, totalOutstanding: 300_000_000 },
    ],
    25_000_000,
    50_000_000,
  );
  expect(result.cashCoverageRatio).toBe(0.5);
  expect(result.outstandingAmount).toBe(100_000_000);
  expect(result.overdueCount).toBe(2);
  expect(result.nextSevenDaysCount).toBe(1);
});
