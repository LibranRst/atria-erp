import type {
  VendorListBill,
  VendorListPayment,
} from "@/features/expenses/types/vendor-bill-list-types";

export { formatShortIdr as formatCompactRp } from "@atria/core/utils/money";

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
  if (payment.approvalStatus === "REJECTED")
    return { status: "REJECTED", label: "Ditolak Owner", canDisburse: false };
  if (payment.status === "FAILED")
    return { status: "REJECTED", label: "Gagal Cair", canDisburse: false };
  if (payment.status === "PROCESSING")
    return { status: "PENDING", label: "Sedang Diproses", canDisburse: false };
  if (payment.status !== "PENDING")
    return { status: "REJECTED", label: "Status Tidak Valid", canDisburse: false };
  if (payment.approvalStatus === "PENDING")
    return { status: "PENDING", label: "Menunggu Owner", canDisburse: false };
  return { status: "APPROVED", label: "Siap Cair", canDisburse: true };
}
