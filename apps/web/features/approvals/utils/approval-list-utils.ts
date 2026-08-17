import type { ApprovalDetail } from "@/lib/finance/approval-types";
export { approvalIsCritical } from "@/lib/finance/approval-summary";

export type ApprovalGroup = {
  readonly label: string;
  readonly items: readonly ApprovalDetail[];
};

export type PaginatedApprovalGroup = ApprovalGroup & {
  readonly totalCount: number;
};

export type ApprovalQueuePage = {
  readonly groups: readonly PaginatedApprovalGroup[];
  readonly visibleCount: number;
  readonly remainingCount: number;
  readonly nextPageCount: number;
};

export const APPROVAL_PAGE_SIZE = 20;

export function approvalRejectionPlaceholder(item: ApprovalDetail): string {
  if (item.type === "inventory_opening") {
    return "Contoh: jumlah fisik tidak sesuai catatan gudang";
  }
  if (item.type === "vendor_payment") {
    return "Contoh: nominal tagihan tidak sesuai kontrak atau PO";
  }
  return "Contoh: nominal belum sesuai dengan progres pekerjaan";
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

export function paginateApprovalGroups(
  items: readonly ApprovalDetail[],
  olderVisibleLimit: number,
  now: Date,
  pageSize: number = APPROVAL_PAGE_SIZE,
): ApprovalQueuePage {
  const safeOlderVisibleLimit = Math.max(0, Math.floor(olderVisibleLimit));
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const allGroups = groupApprovals(items, now);
  let remainingOlderSlots = safeOlderVisibleLimit;
  const groups: PaginatedApprovalGroup[] = [];

  for (const group of allGroups) {
    const visibleItems =
      group.label === "Hari ini"
        ? group.items
        : group.items.slice(0, Math.max(0, remainingOlderSlots));
    if (group.label !== "Hari ini") {
      remainingOlderSlots = Math.max(0, remainingOlderSlots - visibleItems.length);
    }
    if (visibleItems.length === 0) continue;
    groups.push({
      label: group.label,
      items: visibleItems,
      totalCount: group.items.length,
    });
  }

  const todayCount = allGroups.find((group) => group.label === "Hari ini")?.items.length ?? 0;
  const olderCount = items.length - todayCount;
  const visibleOlderCount = Math.min(safeOlderVisibleLimit, olderCount);
  const visibleCount = todayCount + visibleOlderCount;
  const remainingCount = Math.max(0, olderCount - visibleOlderCount);

  return {
    groups,
    visibleCount,
    remainingCount,
    nextPageCount: Math.min(safePageSize, remainingCount),
  };
}
