import { describe, expect, test } from "bun:test";
import type { VendorListBill, VendorListPayment } from "../types/vendor-bill-list-types";
import { getVendorPaymentPresentation } from "./vendor-bill-list-utils";
import {
  canDisburseVendorPayment,
  canScheduleVendorBill,
  filterDesktopVendorBills,
  filterDesktopVendorPayments,
  matchesVendorDate,
  type VendorDesktopFilters,
} from "./vendor-desktop-presentation";

const now = new Date("2026-10-13T18:00:00.000Z"); // 14 October in Jakarta.
const defaults: VendorDesktopFilters = {
  search: "",
  project: "",
  vendor: "",
  status: "ALL",
  date: "ALL",
};
function payment(status = "PENDING", approvalStatus = "APPROVED"): VendorListPayment {
  return {
    id: "payment-1",
    vendorBillId: "bill-1",
    bankAccountId: "bank-1",
    amountPaid: "250.50",
    status,
    approvalStatus,
    paymentDate: new Date("2026-10-14T00:00:00Z"),
    referenceNumber: "REF-12",
    vendorBill: { billNumber: "INV-12", vendor: { name: "Prima" }, project: { name: "Cipete" } },
  };
}
function bill(status = "UNPAID", payments: readonly VendorListPayment[] = []): VendorListBill {
  return {
    id: "bill-1",
    vendorId: "vendor-1",
    projectId: "project-1",
    projectBudgetItemId: null,
    projectBudgetCategoryId: "category-1",
    billNumber: "INV-12",
    amount: "1000.75",
    status,
    dueDate: new Date("2026-10-14T00:00:00Z"),
    notes: "Kitchen fabrication",
    vendor: { name: "Prima" },
    project: { name: "Cipete" },
    payments: [...payments],
  };
}

describe("vendor desktop operation access", () => {
  test("reading a bill never implies scheduling rights; closed or fully committed bills stay protected", () => {
    expect(canScheduleVendorBill(bill(), false)).toBe(false);
    expect(canScheduleVendorBill(bill(), true)).toBe(true);
    expect(canScheduleVendorBill(bill("VOID"), true)).toBe(false);
    expect(canScheduleVendorBill(bill("PAID"), true)).toBe(false);
    const paid = { ...payment("COMPLETED"), amountPaid: "1000.75" };
    expect(canScheduleVendorBill(bill("UNPAID", [paid]), true)).toBe(false);
    expect(
      canScheduleVendorBill(bill("UNPAID", [{ ...payment(), amountPaid: "1000.75" }]), true),
    ).toBe(false);
    expect(
      canScheduleVendorBill(
        bill("UNPAID", [{ ...payment("FAILED"), amountPaid: "1000.75" }]),
        true,
      ),
    ).toBe(true);
  });
  test("payment permission and existing approval/status presentation both guard disbursement", () => {
    expect(canDisburseVendorPayment(payment(), false)).toBe(false);
    expect(canDisburseVendorPayment(payment(), true)).toBe(true);
    for (const row of [
      payment("PENDING", "PENDING"),
      payment("PENDING", "REJECTED"),
      payment("PROCESSING"),
      payment("FAILED"),
      payment("COMPLETED"),
      payment("UNKNOWN"),
    ])
      expect(canDisburseVendorPayment(row, true)).toBe(false);
  });
});

describe("vendor desktop filters", () => {
  test("Owner-rejected failed schedules remain distinct from a failed disbursement", () => {
    const rejected = { ...payment("FAILED", "REJECTED"), id: "rejected" };
    const failed = { ...payment("FAILED", "APPROVED"), id: "failed" };
    expect(getVendorPaymentPresentation(rejected)).toEqual({
      status: "REJECTED",
      label: "Ditolak Owner",
      canDisburse: false,
    });
    expect(getVendorPaymentPresentation(failed)).toEqual({
      status: "REJECTED",
      label: "Gagal Cair",
      canDisburse: false,
    });
    expect(
      filterDesktopVendorPayments([rejected, failed], { ...defaults, status: "REJECTED" }, now).map(
        (row) => row.id,
      ),
    ).toEqual(["rejected"]);
    expect(
      filterDesktopVendorPayments([rejected, failed], { ...defaults, status: "FAILED" }, now).map(
        (row) => row.id,
      ),
    ).toEqual(["failed"]);
    expect(canDisburseVendorPayment(rejected, true)).toBe(false);
    expect(getVendorPaymentPresentation(payment("COMPLETED", "REJECTED")).label).toBe(
      "Selesai Cair",
    );
  });
  test("date boundaries use calendar Jakarta, include today and the full seventh day", () => {
    expect(matchesVendorDate(new Date("2026-10-13T16:59:59Z"), "OVERDUE", now)).toBe(true);
    expect(matchesVendorDate(new Date("2026-10-13T17:00:00Z"), "OVERDUE", now)).toBe(false);
    expect(matchesVendorDate(new Date("2026-10-13T17:00:00Z"), "WEEK", now)).toBe(true);
    expect(matchesVendorDate(new Date("2026-10-21T16:59:59Z"), "WEEK", now)).toBe(true);
    expect(matchesVendorDate(new Date("2026-10-21T17:00:00Z"), "WEEK", now)).toBe(false);
  });
  test("bill search, project, vendor, status and deadline compose without dropping original facts", () => {
    const source = [bill(), bill("PAID"), { ...bill(), id: "other", project: { name: "Menteng" } }];
    expect(
      filterDesktopVendorBills(
        source,
        {
          ...defaults,
          search: " KITChen ",
          project: "Cipete",
          vendor: "Prima",
          status: "ACTIVE",
          date: "WEEK",
        },
        now,
      ).map((row) => row.id),
    ).toEqual(["bill-1"]);
    expect(filterDesktopVendorBills(source, { ...defaults, vendor: "Missing" }, now)).toEqual([]);
    expect(source).toHaveLength(3);
  });
  test("payment statuses distinguish approved pending from waiting, failure and processing", () => {
    const source = [
      payment(),
      { ...payment("PENDING", "PENDING"), id: "waiting" },
      { ...payment("FAILED"), id: "failed" },
      { ...payment("PROCESSING"), id: "processing" },
      { ...payment("COMPLETED"), id: "completed" },
    ];
    expect(
      filterDesktopVendorPayments(source, { ...defaults, status: "READY" }, now).map(
        (row) => row.id,
      ),
    ).toEqual(["payment-1"]);
    expect(
      filterDesktopVendorPayments(source, { ...defaults, status: "WAITING" }, now).map(
        (row) => row.id,
      ),
    ).toEqual(["waiting"]);
    expect(
      filterDesktopVendorPayments(source, { ...defaults, status: "ACTIVE" }, now),
    ).toHaveLength(4);
    expect(
      filterDesktopVendorPayments(
        source,
        { ...defaults, search: "ref-12", project: "Cipete", vendor: "Prima", status: "COMPLETED" },
        now,
      ).map((row) => row.id),
    ).toEqual(["completed"]);
  });
  test("redacted bank metadata remains absent and cannot match search", () => {
    const redacted = payment();
    expect(redacted.bankAccount).toBeUndefined();
    expect(filterDesktopVendorPayments([redacted], { ...defaults, search: "bank-1" }, now)).toEqual(
      [],
    );
    expect(filterDesktopVendorPayments([redacted], defaults, now)[0]?.bankAccount).toBeUndefined();
  });
});
