import type { ExpenseCostItem } from "@/features/expenses/types/expense-list-types";

export { formatShortIdr as formatCompactRp } from "@/lib/utils/money";

export function fieldClaimStatusLabel(status: ExpenseCostItem["status"]): string {
  if (status === "SUBMITTED") return "Butuh Verifikasi";
  if (status === "VERIFIED") return "Butuh Approval";
  if (status === "APPROVED") return "Siap Cair";
  if (status === "PAID") return "Lunas";
  if (status === "REJECTED") return "Ditolak";
  return status;
}
