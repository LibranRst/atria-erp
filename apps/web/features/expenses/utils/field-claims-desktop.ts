import type { ExpenseCostItem } from "@/features/expenses/types/expense-list-types";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { fieldClaimStatusLabel } from "./expense-list-utils";

export function fieldClaimDesktopStatusLabel(status: ExpenseCostItem["status"]): string {
  return status === "VERIFIED" ? "Perlu persetujuan" : fieldClaimStatusLabel(status);
}

export type FieldClaimDateFilter = "all" | "this-month" | "last-month";

export type FieldClaimDesktopFilters = {
  readonly query: string;
  readonly project: string;
  readonly category: string;
  readonly date: string;
};

export function fieldClaimCategoryLabel(cost: ExpenseCostItem): string {
  const category = cost.budgetCategory?.expenseCategory;
  const legacy = cost.budgetItem?.costCategory?.name;
  return category?.name || (legacy ? formatBusinessLabel(legacy) : "Belum ditentukan");
}

export function fieldClaimCategoryKey(cost: ExpenseCostItem): string {
  return cost.budgetCategory?.expenseCategory?.code || fieldClaimCategoryLabel(cost);
}

function jakartaMonth(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).format(value);
}

export function filterFieldClaimsDesktop(
  costs: readonly ExpenseCostItem[],
  filters: FieldClaimDesktopFilters,
  now: Date,
): readonly ExpenseCostItem[] {
  const query = filters.query.trim().toLocaleLowerCase("id-ID");
  const currentMonth = jakartaMonth(now);
  const monthParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(monthParts.find((part) => part.type === "year")?.value);
  const month = Number(monthParts.find((part) => part.type === "month")?.value);
  const previousMonth = jakartaMonth(new Date(Date.UTC(year, month - 2, 15)));
  return costs.filter((cost): boolean => {
    if (filters.project !== "all" && cost.project?.id !== filters.project) return false;
    if (filters.category !== "all" && fieldClaimCategoryKey(cost) !== filters.category)
      return false;
    const created = new Date(cost.createdAt);
    if (filters.date !== "all") {
      if (Number.isNaN(created.getTime())) return false;
      const createdMonth = jakartaMonth(created);
      if (filters.date === "this-month" && createdMonth !== currentMonth) return false;
      if (filters.date === "last-month" && createdMonth !== previousMonth) return false;
    }
    return (
      !query ||
      [cost.description, cost.project?.name, cost.requestedBy?.name, fieldClaimCategoryLabel(cost)]
        .join(" ")
        .toLocaleLowerCase("id-ID")
        .includes(query)
    );
  });
}

export function fieldClaimDesktopAction(
  status: ExpenseCostItem["status"],
  permissions: { readonly verify: boolean; readonly pay: boolean },
): "verify" | "pay" | null {
  if (status === "SUBMITTED" && permissions.verify) return "verify";
  if (status === "APPROVED" && permissions.pay) return "pay";
  return null;
}

export function fieldClaimDisplayDate(value: Date, full = false): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: full ? "long" : "short",
    year: "numeric",
    ...(full ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}
