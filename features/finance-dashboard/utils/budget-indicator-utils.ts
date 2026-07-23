"use client";

import type { DashboardTone } from "@/features/finance-dashboard/types/dashboard-types";

export const RISK_WARNING_THRESHOLD = 80;
export const RISK_LIMIT_THRESHOLD = 100;

export type BudgetGeometry = {
  readonly clampedPercentage: number;
  readonly overflowPercentage: number;
  readonly remainingPercentage: number;
};

export type ApprovalBudgetImpact = {
  readonly beforePercentage: number;
  readonly afterPercentage: number;
  readonly overflowPercentage: number;
};

export function getBudgetGeometry(value: number): BudgetGeometry {
  const normalized = Number.isFinite(value) ? value : 0;
  const clampedPercentage = Math.min(Math.max(normalized, 0), RISK_LIMIT_THRESHOLD);
  return {
    clampedPercentage,
    overflowPercentage: Math.max(0, normalized - RISK_LIMIT_THRESHOLD),
    remainingPercentage: Math.max(0, RISK_LIMIT_THRESHOLD - clampedPercentage),
  };
}

export function getUsageBlockFill(value: number, index: number): number {
  const blockStart = index * 20;
  return Math.min(Math.max((value - blockStart) * 5, 0), 100);
}

export function getApprovalBudgetImpact(
  allocatedAmount: number,
  actualSpent: number,
  requestAmount: number,
): ApprovalBudgetImpact {
  if (allocatedAmount <= 0) {
    return { beforePercentage: 0, afterPercentage: 0, overflowPercentage: 0 };
  }
  const beforePercentage = (actualSpent / allocatedAmount) * 100;
  const afterPercentage = ((actualSpent + requestAmount) / allocatedAmount) * 100;
  return {
    beforePercentage,
    afterPercentage,
    overflowPercentage: Math.max(0, afterPercentage - 100),
  };
}

export function indicatorToneClass(tone: DashboardTone): string {
  if (tone === "critical") return "bg-error";
  if (tone === "warning") return "bg-warning";
  if (tone === "positive") return "bg-primary";
  return "bg-on-surface-variant";
}
