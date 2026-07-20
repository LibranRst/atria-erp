import { describe, expect, test } from "bun:test";
import type { VendorListPayment } from "./vendor-bill-list-types";
import { getVendorPaymentPresentation } from "./vendor-bill-list-utils";

function payment(status: string, approvalStatus?: string): VendorListPayment {
  return {
    id: "payment-1",
    vendorBillId: "bill-1",
    bankAccountId: "bank-1",
    amountPaid: "100000.00",
    status,
    paymentDate: new Date("2026-07-18T00:00:00.000Z"),
    referenceNumber: null,
    approvalStatus,
  };
}

describe("vendor payment presentation", () => {
  test("only an approved pending payment can be disbursed", () => {
    expect(getVendorPaymentPresentation(payment("PENDING", "APPROVED"))).toMatchObject({ label: "Siap Cair", canDisburse: true });
    expect(getVendorPaymentPresentation(payment("PROCESSING", "APPROVED")).canDisburse).toBe(false);
    expect(getVendorPaymentPresentation(payment("FAILED", "APPROVED"))).toMatchObject({ label: "Gagal Cair", canDisburse: false });
    expect(getVendorPaymentPresentation(payment("COMPLETED", "APPROVED"))).toMatchObject({ label: "Selesai Cair", canDisburse: false });
  });
});
