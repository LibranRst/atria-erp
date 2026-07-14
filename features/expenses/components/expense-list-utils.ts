import type { ExpenseCostItem } from "@/features/expenses/components/expense-list-types";

export function formatCompactRp(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absValue >= 1_000_000_000) {
    return `${sign}Rp ${(absValue / 1_000_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 2,
    })} M`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}Rp ${(absValue / 1_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} jt`;
  }
  return `${sign}Rp ${absValue.toLocaleString("id-ID")}`;
}
export function fieldClaimStatusLabel(status: ExpenseCostItem["status"]): string {
  if (status === "SUBMITTED") return "Butuh Verifikasi";
  if (status === "VERIFIED") return "Butuh Approval";
  if (status === "APPROVED") return "Siap Cair";
  if (status === "PAID") return "Lunas";
  if (status === "REJECTED") return "Ditolak";
  return status;
}
