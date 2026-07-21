import type {
  VendorListBill,
  VendorListPayment,
} from "@/features/expenses/components/vendor-bill-list-types";

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

export function getBillPaymentSummary(bill: VendorListBill): {
  readonly pendingPaymentAmount: number;
  readonly completedPaymentAmount: number;
  readonly totalScheduledOrPaid: number;
  readonly isFullyScheduledOrPaid: boolean;
  readonly hasPending: boolean;
} {
  const pendingPaymentAmount =
    bill.payments
      ?.filter((payment) => payment.status === "PENDING" || payment.status === "PROCESSING")
      .reduce((sum, payment) => sum + Number(payment.amountPaid), 0) || 0;

  const completedPaymentAmount =
    bill.payments
      ?.filter((payment) => payment.status === "COMPLETED")
      .reduce((sum, payment) => sum + Number(payment.amountPaid), 0) || 0;

  const totalScheduledOrPaid = pendingPaymentAmount + completedPaymentAmount;

  return {
    pendingPaymentAmount,
    completedPaymentAmount,
    totalScheduledOrPaid,
    isFullyScheduledOrPaid: totalScheduledOrPaid >= Number(bill.amount),
    hasPending: pendingPaymentAmount > 0,
  };
}

export function getVendorBillStatus(
  billStatus: string,
): "UNPAID" | "PAID" | "PARTIALLY_PAID" | "VOID" {
  if (billStatus === "PAID") return "PAID";
  if (billStatus === "VOID") return "VOID";
  if (billStatus === "PARTIALLY_PAID") return "PARTIALLY_PAID";
  return "UNPAID";
}

export function getVendorPaymentBadge(payment: VendorListPayment): {
  readonly status: "PAID" | "PENDING" | "REJECTED" | "APPROVED";
  readonly label: string;
} {
  if (payment.status === "COMPLETED") {
    return { status: "PAID", label: "Lunas" };
  }
  if (payment.approvalStatus === "PENDING") {
    return { status: "PENDING", label: "Menunggu" };
  }
  if (payment.approvalStatus === "REJECTED") {
    return { status: "REJECTED", label: "Ditolak" };
  }
  return { status: "APPROVED", label: "Disetujui" };
}

export function getVendorPaymentPresentation(payment: VendorListPayment): {
  readonly status: "PAID" | "PENDING" | "REJECTED" | "APPROVED";
  readonly label: string;
  readonly canDisburse: boolean;
} {
  if (payment.status === "COMPLETED")
    return { status: "PAID", label: "Selesai Cair", canDisburse: false };
  if (payment.status === "FAILED")
    return { status: "REJECTED", label: "Gagal Cair", canDisburse: false };
  if (payment.status === "PROCESSING")
    return { status: "PENDING", label: "Sedang Diproses", canDisburse: false };
  if (payment.status !== "PENDING")
    return { status: "REJECTED", label: "Status Tidak Valid", canDisburse: false };
  if (payment.approvalStatus === "PENDING")
    return { status: "PENDING", label: "Menunggu Owner", canDisburse: false };
  if (payment.approvalStatus === "REJECTED")
    return { status: "REJECTED", label: "Ditolak Owner", canDisburse: false };
  return { status: "APPROVED", label: "Siap Cair", canDisburse: true };
}
