import type { ApprovalDetail } from "@/lib/finance/approval-types";

export type ApprovalGroup = {
  readonly label: string;
  readonly items: readonly ApprovalDetail[];
};

export function approvalIsCritical(item: ApprovalDetail): boolean {
  const nextSpent = item.actualSpent + item.amount;
  const utilization = item.allocatedAmount > 0 ? (nextSpent / item.allocatedAmount) * 100 : 0;
  return item.priority === "CRITICAL" || item.budgetOverrun || utilization >= 100;
}

export function groupApprovals(
  items: readonly ApprovalDetail[],
  now: Date = new Date(),
): readonly ApprovalGroup[] {
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const today: ApprovalDetail[] = [];
  const yesterday: ApprovalDetail[] = [];
  const earlier: ApprovalDetail[] = [];

  for (const item of items) {
    const date = new Date(item.createdAt);
    if (date >= startToday) today.push(item);
    else if (date >= startYesterday) yesterday.push(item);
    else earlier.push(item);
  }

  return [
    { label: "Hari ini", items: today },
    { label: "Kemarin", items: yesterday },
    { label: "Lebih lama", items: earlier },
  ].filter((group) => group.items.length > 0);
}
