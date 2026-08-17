import { describe, expect, test } from "bun:test";

import {
  checkVendorPaymentApprovalGate,
  checkVendorPaymentState,
  exceedsVendorBillOutstanding,
  vendorPaymentRequiresOwnerApproval,
} from "./vendor-payment-rules";

const rp = (rupiah: number): bigint => BigInt(rupiah) * BigInt(100);

describe("exceedsVendorBillOutstanding", () => {
  // Bagian C "Vendor over-schedule": pending + baru tidak boleh melewati tagihan.
  test("stops a second schedule that overshoots the bill", () => {
    expect(
      exceedsVendorBillOutstanding({
        billAmountCents: rp(3_000_000),
        committedCents: rp(2_000_000),
        amountCents: rp(1_000_001),
      }),
    ).toBe(true);
  });

  test("allows a schedule that lands exactly on the remainder", () => {
    expect(
      exceedsVendorBillOutstanding({
        billAmountCents: rp(3_000_000),
        committedCents: rp(2_000_000),
        amountCents: rp(1_000_000),
      }),
    ).toBe(false);
  });

  test("allows the first full-value schedule", () => {
    expect(
      exceedsVendorBillOutstanding({
        billAmountCents: rp(3_000_000),
        committedCents: BigInt(0),
        amountCents: rp(3_000_000),
      }),
    ).toBe(false);
  });

  test("rejects any further payment once the bill is fully committed", () => {
    expect(
      exceedsVendorBillOutstanding({
        billAmountCents: rp(3_000_000),
        committedCents: rp(3_000_000),
        amountCents: BigInt(1),
      }),
    ).toBe(true);
  });
});

describe("vendorPaymentRequiresOwnerApproval", () => {
  const HEALTHY = { categoryAllocatedCents: rp(3_060_000), categoryActualCents: rp(3_000_000) };

  test("requires approval exactly at the Rp5.000.000 threshold", () => {
    expect(vendorPaymentRequiresOwnerApproval({ ...HEALTHY, amountCents: rp(5_000_000) })).toBe(
      true,
    );
  });

  test("lets a payment one rupiah below the threshold through", () => {
    expect(vendorPaymentRequiresOwnerApproval({ ...HEALTHY, amountCents: rp(4_999_999) })).toBe(
      false,
    );
  });

  test("requires approval on an overrun category regardless of amount", () => {
    // Skenario B8: Subcon Rp3.000.000 dari alokasi Rp3.060.000 tidak perlu
    // persetujuan; begitu kategori terlampaui, nominal kecil pun perlu.
    expect(
      vendorPaymentRequiresOwnerApproval({
        amountCents: rp(100_000),
        categoryAllocatedCents: rp(612_000),
        categoryActualCents: rp(700_000),
      }),
    ).toBe(true);
  });

  test("treats a category sitting exactly on its allocation as not overrun", () => {
    expect(
      vendorPaymentRequiresOwnerApproval({
        amountCents: rp(100_000),
        categoryAllocatedCents: rp(612_000),
        categoryActualCents: rp(612_000),
      }),
    ).toBe(false);
  });
});

describe("checkVendorPaymentApprovalGate", () => {
  test("lets a low-risk payment through without any approval record", () => {
    expect(
      checkVendorPaymentApprovalGate({ requiresApproval: false, approvalStatus: null }),
    ).toEqual({ allowed: true });
  });

  // Bagian C "Early vendor pay".
  test("blocks a high-risk payment that has no approval record at all", () => {
    expect(
      checkVendorPaymentApprovalGate({ requiresApproval: true, approvalStatus: null }),
    ).toEqual({ allowed: false, reason: "APPROVAL_RECORD_MISSING" });
  });

  test("blocks a high-risk payment whose approval is still pending", () => {
    expect(
      checkVendorPaymentApprovalGate({ requiresApproval: true, approvalStatus: "PENDING" }),
    ).toEqual({ allowed: false, reason: "APPROVAL_REQUIRED_BUT_PENDING" });
  });

  test("blocks a high-risk payment whose approval was rejected", () => {
    expect(
      checkVendorPaymentApprovalGate({ requiresApproval: true, approvalStatus: "REJECTED" }),
    ).toEqual({ allowed: false, reason: "APPROVAL_REQUIRED_BUT_PENDING" });
  });

  test("releases a high-risk payment once Owner approved it", () => {
    expect(
      checkVendorPaymentApprovalGate({ requiresApproval: true, approvalStatus: "APPROVED" }),
    ).toEqual({ allowed: true });
  });
});

describe("checkVendorPaymentState", () => {
  test("allows a pending payment", () => {
    expect(checkVendorPaymentState("PENDING")).toEqual({ payable: true });
  });

  test("refuses to pay the same payment twice", () => {
    expect(checkVendorPaymentState("COMPLETED")).toEqual({
      payable: false,
      reason: "PAYMENT_ALREADY_COMPLETED",
    });
  });

  // Bagian C "Rejected payment": penolakan Owner menyimpan status FAILED.
  test("refuses to pay a payment Owner already rejected", () => {
    expect(checkVendorPaymentState("FAILED")).toEqual({
      payable: false,
      reason: "PAYMENT_NOT_PENDING",
    });
  });
});
