import type { StatusBadgeTone } from "@/components/ui";
import type {
  VendorListBill,
  VendorListPayment,
} from "@/features/expenses/types/vendor-bill-list-types";
import {
  getBillPaymentSummary,
  getVendorBillStatus,
  getVendorPaymentPresentation,
} from "@/features/expenses/utils/vendor-bill-list-utils";

export type VendorDateFilter = "ALL" | "OVERDUE" | "WEEK" | "MONTH";
export type VendorDesktopFilters = {
  readonly search: string;
  readonly project: string;
  readonly vendor: string;
  readonly status: string;
  readonly date: VendorDateFilter;
};

function jakartaDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));
  const read = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(read("year"), read("month") - 1, read("day"));
}

export function matchesVendorDate(date: Date, filter: VendorDateFilter, now: Date): boolean {
  if (filter === "ALL") return true;
  const day = jakartaDay(date);
  const today = jakartaDay(now);
  if (filter === "OVERDUE") return day < today;
  return day >= today && day <= today + (filter === "WEEK" ? 7 : 30) * 86_400_000;
}

export function vendorBillPresentation(bill: VendorListBill): {
  readonly label: string;
  readonly tone: StatusBadgeTone;
} {
  const status = getVendorBillStatus(bill.status);
  if (status === "PAID") return { label: "Lunas", tone: "completed" };
  if (status === "VOID") return { label: "Dibatalkan", tone: "inactive" };
  if (status === "PARTIALLY_PAID") return { label: "Dibayar sebagian", tone: "pending" };
  return { label: "Belum dibayar", tone: "warning" };
}

export function vendorPaymentTone(payment: VendorListPayment): StatusBadgeTone {
  const presentation = getVendorPaymentPresentation(payment);
  if (presentation.status === "PAID") return "completed";
  if (presentation.status === "REJECTED") return "critical";
  if (presentation.status === "PENDING") return "pending";
  return "healthy";
}

export function canScheduleVendorBill(bill: VendorListBill, canPay: boolean): boolean {
  return (
    canPay &&
    bill.status !== "PAID" &&
    bill.status !== "VOID" &&
    !getBillPaymentSummary(bill).isFullyScheduledOrPaid
  );
}

export function canDisburseVendorPayment(payment: VendorListPayment, canPay: boolean): boolean {
  return canPay && getVendorPaymentPresentation(payment).canDisburse;
}

function matchesText(search: string, values: readonly (string | null | undefined)[]): boolean {
  const normalized = search.trim().toLocaleLowerCase("id-ID");
  return (
    !normalized || values.some((value) => value?.toLocaleLowerCase("id-ID").includes(normalized))
  );
}

export function filterDesktopVendorBills(
  bills: readonly VendorListBill[],
  filters: VendorDesktopFilters,
  now: Date,
): readonly VendorListBill[] {
  return bills.filter((bill) => {
    if (filters.project && bill.project?.name !== filters.project) return false;
    if (filters.vendor && bill.vendor?.name !== filters.vendor) return false;
    if (filters.status === "ACTIVE" && (bill.status === "PAID" || bill.status === "VOID"))
      return false;
    if (filters.status !== "ALL" && filters.status !== "ACTIVE" && bill.status !== filters.status)
      return false;
    return (
      matchesText(filters.search, [
        bill.billNumber,
        bill.vendor?.name,
        bill.project?.name,
        bill.notes,
        bill.budgetItem?.name,
      ]) && matchesVendorDate(bill.dueDate, filters.date, now)
    );
  });
}

export function filterDesktopVendorPayments(
  payments: readonly VendorListPayment[],
  filters: VendorDesktopFilters,
  now: Date,
): readonly VendorListPayment[] {
  return payments.filter((payment) => {
    if (filters.project && payment.vendorBill?.project?.name !== filters.project) return false;
    if (filters.vendor && payment.vendorBill?.vendor?.name !== filters.vendor) return false;
    if (filters.status === "ACTIVE" && payment.status === "COMPLETED") return false;
    if (filters.status === "READY" && !getVendorPaymentPresentation(payment).canDisburse)
      return false;
    if (
      filters.status === "WAITING" &&
      !(payment.status === "PENDING" && payment.approvalStatus === "PENDING")
    )
      return false;
    if (
      filters.status === "REJECTED" &&
      !(payment.status !== "COMPLETED" && payment.approvalStatus === "REJECTED")
    )
      return false;
    if (filters.status === "FAILED" && payment.approvalStatus === "REJECTED") return false;
    if (
      !["ALL", "ACTIVE", "READY", "WAITING", "REJECTED"].includes(filters.status) &&
      payment.status !== filters.status
    )
      return false;
    return (
      matchesText(filters.search, [
        payment.vendorBill?.billNumber,
        payment.vendorBill?.vendor?.name,
        payment.vendorBill?.project?.name,
        payment.bankAccount?.name,
        payment.referenceNumber,
      ]) && matchesVendorDate(payment.paymentDate, filters.date, now)
    );
  });
}

export function formatVendorDate(date: Date): string {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}
