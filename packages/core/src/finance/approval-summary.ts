import type { ApprovalDetail } from "@/lib/finance/approval-types";
import { dashboardDueDayOffset } from "@/lib/finance/dashboard-overview";

export type ApprovalQueueSummary = {
  readonly totalCount: number;
  readonly criticalCount: number;
  readonly waitingLongCount: number;
  readonly totalAmount: number;
};

export function approvalIsCritical(item: ApprovalDetail): boolean {
  const nextSpent = item.actualSpent + item.amount;
  const utilization = item.allocatedAmount > 0 ? (nextSpent / item.allocatedAmount) * 100 : 0;
  return item.priority === "CRITICAL" || item.budgetOverrun || utilization >= 100;
}

export function approvalIsWaitingLong(item: ApprovalDetail, now: Date): boolean {
  return Math.max(0, -dashboardDueDayOffset(item.createdAt, now)) >= 3;
}

export function summarizeApprovals(
  items: readonly ApprovalDetail[],
  now: Date,
): ApprovalQueueSummary {
  return {
    totalCount: items.length,
    criticalCount: items.filter(approvalIsCritical).length,
    waitingLongCount: items.filter((item) => approvalIsWaitingLong(item, now)).length,
    totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
  };
}
