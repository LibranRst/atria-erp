import type { ApprovalDetail } from "./approval-types";
import { getApprovalBudgetImpact, RISK_LIMIT_THRESHOLD } from "./budget-indicator";
import { dashboardDueDayOffset } from "./dashboard-overview";

export type ApprovalQueueSummary = {
  readonly totalCount: number;
  readonly criticalCount: number;
  readonly waitingLongCount: number;
  readonly totalAmount: number;
};

export function approvalIsCritical(item: ApprovalDetail): boolean {
  const impact = getApprovalBudgetImpact(
    item.allocatedAmount,
    item.actualSpent,
    item.consumesBudgetActual ? item.amount : 0,
  );
  return (
    item.priority === "CRITICAL" ||
    item.budgetOverrun ||
    impact.afterPercentage >= RISK_LIMIT_THRESHOLD
  );
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
