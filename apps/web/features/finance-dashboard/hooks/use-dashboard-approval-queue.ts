"use client";

import { useMemo, useOptimistic } from "react";
import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import {
  approvalIsCritical,
  approvalIsWaitingLong,
  type ApprovalQueueSummary,
} from "@atria/core/finance/approval-summary";

export type DashboardApprovalQueue = {
  readonly approvals: readonly ApprovalDetail[];
  readonly summary: ApprovalQueueSummary;
};

type RecordedDecision = { readonly approvalId: string; readonly decidedAt: Date };

export function removeRecordedApproval(
  current: DashboardApprovalQueue,
  decision: RecordedDecision,
): DashboardApprovalQueue {
  const item = current.approvals.find((approval) => approval.id === decision.approvalId);
  if (!item) return current;
  return {
    approvals: current.approvals.filter((approval) => approval.id !== item.id),
    summary: {
      totalCount: Math.max(0, current.summary.totalCount - 1),
      criticalCount: Math.max(0, current.summary.criticalCount - Number(approvalIsCritical(item))),
      waitingLongCount: Math.max(
        0,
        current.summary.waitingLongCount - Number(approvalIsWaitingLong(item, decision.decidedAt)),
      ),
      totalAmount: Math.max(0, current.summary.totalAmount - item.amount),
    },
  };
}

export function useDashboardApprovalQueue(
  approvals: readonly ApprovalDetail[],
  summary: ApprovalQueueSummary,
): readonly [DashboardApprovalQueue, (decision: RecordedDecision) => void] {
  const snapshot = useMemo(() => ({ approvals, summary }), [approvals, summary]);
  return useOptimistic(snapshot, removeRecordedApproval);
}
