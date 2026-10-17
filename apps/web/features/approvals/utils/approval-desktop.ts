import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import { approvalIsCritical } from "@atria/core/finance/approval-summary";

export type ApprovalFilter = "ALL" | "FIELD" | "VENDOR" | "STOCK" | "CRITICAL";
export type ApprovalPriorityFilter = "ALL" | "CRITICAL" | "WARNING" | "NORMAL";

export function approvalTypeLabel(item: ApprovalDetail): string {
  return item.type === "project_cost"
    ? "Biaya lapangan"
    : item.type === "vendor_payment"
      ? "Pembayaran vendor"
      : "Saldo awal stok";
}

export function approvalPriorityLabel(item: ApprovalDetail): string {
  return approvalIsCritical(item)
    ? "Kritis"
    : item.priority === "WARNING"
      ? "Perlu perhatian"
      : "Normal";
}

export function filterDesktopApprovals(
  items: readonly ApprovalDetail[],
  filters: {
    readonly query: string;
    readonly type: ApprovalFilter;
    readonly project: string;
    readonly priority: ApprovalPriorityFilter;
  },
): readonly ApprovalDetail[] {
  const query = filters.query.trim().toLocaleLowerCase("id-ID");
  return items.filter((item): boolean => {
    if (filters.project && item.projectName !== filters.project) return false;
    if (filters.type === "FIELD" && item.type !== "project_cost") return false;
    if (filters.type === "VENDOR" && item.type !== "vendor_payment") return false;
    if (filters.type === "STOCK" && item.type !== "inventory_opening") return false;
    const critical = approvalIsCritical(item);
    if (filters.type === "CRITICAL" && !critical) return false;
    if (filters.priority === "CRITICAL" && !critical) return false;
    if (filters.priority === "WARNING" && (critical || item.priority !== "WARNING")) return false;
    if (filters.priority === "NORMAL" && (critical || item.priority !== "NORMAL")) return false;
    return (
      !query ||
      [
        item.description,
        item.projectName,
        item.requestedBy,
        item.budgetItemName,
        approvalTypeLabel(item),
      ].some((value) => value.toLocaleLowerCase("id-ID").includes(query))
    );
  });
}

export function approvalQueueDate(value: Date): string {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}
