import type { FinanceDashboardCashDueGroup } from "./dashboard-contracts";

export type DashboardCashSummary = {
  readonly outstandingAmount: number;
  readonly payablesAmount: number;
  readonly cashCoverageRatio: number | null;
  readonly overdueCount: number;
  readonly todayCount: number;
  readonly nextSevenDaysCount: number;
};

/** Document exposure includes incoming and outgoing cash; coverage only funds obligations. */
export function getDashboardCashSummary(
  groups: readonly Pick<FinanceDashboardCashDueGroup, "bucket" | "totalOutstanding" | "count">[],
  cashAvailable: number,
  payablesDueSoon: number,
): DashboardCashSummary {
  const overdue = groups.find((group) => group.bucket === "OVERDUE");
  const today = groups.find((group) => group.bucket === "TODAY");
  const near = groups.find((group) => group.bucket === "NEXT_7_DAYS");
  return {
    outstandingAmount:
      (overdue?.totalOutstanding ?? 0) +
      (today?.totalOutstanding ?? 0) +
      (near?.totalOutstanding ?? 0),
    payablesAmount: payablesDueSoon,
    cashCoverageRatio: payablesDueSoon > 0 ? cashAvailable / payablesDueSoon : null,
    overdueCount: overdue?.count ?? 0,
    todayCount: today?.count ?? 0,
    nextSevenDaysCount: near?.count ?? 0,
  };
}
