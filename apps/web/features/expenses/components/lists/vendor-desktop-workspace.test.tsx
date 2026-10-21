import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VendorDesktopWorkspace } from "./vendor-desktop-workspace";
import { VendorDesktopBillDetail, VendorDesktopPaymentDetail } from "./vendor-desktop-detail";
import type { VendorListBill, VendorListPayment } from "../../types/vendor-bill-list-types";

function renderWorkspace(
  canCreateVendorBill: boolean,
  vendorBills: readonly VendorListBill[] = [],
  vendorPayments: readonly VendorListPayment[] = [],
  subTab: "BILLS" | "PAYMENTS" = "BILLS",
  selection: { readonly billId?: string; readonly paymentId?: string } = {},
): string {
  return renderToStaticMarkup(
    <VendorDesktopWorkspace
      vendorBills={vendorBills}
      vendorPayments={vendorPayments}
      subTab={subTab}
      onSubTabChange={() => undefined}
      selectedBillId={selection.billId ?? null}
      selectedPaymentId={selection.paymentId ?? null}
      onSelectBill={() => undefined}
      onSelectPayment={() => undefined}
      canPay={false}
      canCreateVendorBill={canCreateVendorBill}
      onAddBill={() => undefined}
      onSchedule={() => undefined}
      onDisburse={() => undefined}
    />,
  );
}

describe("vendor desktop creation entry", () => {
  test("a creator can start a vendor bill even when the collection is empty", () => {
    const markup = renderWorkspace(true);
    expect(markup).toContain("Tambah tagihan");
    expect(markup).toContain("Belum ada tagihan vendor");
  });

  test("read-only access retains table and search but omits the creation action", () => {
    const markup = renderWorkspace(false);
    expect(markup).not.toContain("Tambah tagihan");
    expect(markup).toContain("Cari tagihan dan pembayaran vendor");
    expect(markup).toContain("Tagihan vendor");
  });

  test("empty bill and payment views do not reserve a blank detail column", () => {
    for (const tab of ["BILLS", "PAYMENTS"] as const) {
      const markup = renderWorkspace(false, [], [], tab);
      expect(markup).not.toContain("xl:grid-cols-[minmax(0,1fr)_18rem]");
      expect(markup).not.toContain("Rincian tagihan");
      expect(markup).not.toContain("Rincian pembayaran vendor");
    }
  });
});

describe("vendor desktop exact rupiah context", () => {
  const completed: VendorListPayment = {
    id: "payment-completed",
    vendorBillId: "bill-cents",
    bankAccountId: "bank-1",
    amountPaid: "10000000.50",
    status: "COMPLETED",
    paymentDate: new Date("2026-10-14T00:00:00Z"),
    referenceNumber: null,
  };
  const pending: VendorListPayment = {
    ...completed,
    id: "payment-pending",
    amountPaid: "10000000.25",
    status: "PENDING",
    approvalStatus: "APPROVED",
  };
  const bill: VendorListBill = {
    id: "bill-cents",
    vendorId: "vendor-1",
    projectId: "project-1",
    projectBudgetItemId: null,
    projectBudgetCategoryId: "category-1",
    billNumber: "INV-CENTS",
    amount: "41250001.25",
    status: "UNPAID",
    dueDate: new Date("2026-10-14T00:00:00Z"),
    notes: null,
    payments: [completed, pending],
  };

  test("only explicit visible selections get a detail column", () => {
    const unselectedBillMarkup = renderWorkspace(false, [bill]);
    expect(unselectedBillMarkup).not.toContain("xl:grid-cols-[minmax(0,1fr)_18rem]");
    expect(unselectedBillMarkup).not.toContain("Rincian tagihan INV-CENTS");
    const billMarkup = renderWorkspace(false, [bill], [], "BILLS", { billId: bill.id });
    expect(billMarkup).toContain("xl:grid-cols-[minmax(0,1fr)_18rem]");
    expect(billMarkup).toContain("Rincian tagihan INV-CENTS");
    const closedBillMarkup = renderWorkspace(false, [{ ...bill, status: "PAID" }], [], "BILLS", {
      billId: bill.id,
    });
    expect(closedBillMarkup).not.toContain("xl:grid-cols-[minmax(0,1fr)_18rem]");
    expect(closedBillMarkup).not.toContain("Rincian tagihan INV-CENTS");
    expect(closedBillMarkup).toContain("Tidak ada tagihan yang sesuai");
    const unselectedPaymentMarkup = renderWorkspace(false, [], [pending], "PAYMENTS");
    expect(unselectedPaymentMarkup).not.toContain("xl:grid-cols-[minmax(0,1fr)_18rem]");
    expect(unselectedPaymentMarkup).not.toContain("Rincian pembayaran vendor");
    const paymentMarkup = renderWorkspace(false, [], [pending], "PAYMENTS", {
      paymentId: pending.id,
    });
    expect(paymentMarkup).toContain("xl:grid-cols-[minmax(0,1fr)_18rem]");
    expect(paymentMarkup).toContain("Rincian pembayaran vendor");
    const completedMarkup = renderWorkspace(false, [], [completed], "PAYMENTS", {
      paymentId: completed.id,
    });
    expect(completedMarkup).not.toContain("xl:grid-cols-[minmax(0,1fr)_18rem]");
    expect(completedMarkup).not.toContain("Rincian pembayaran vendor");
  });

  test("bill, uncommitted amount and payment history retain cents", () => {
    const markup = renderToStaticMarkup(
      <VendorDesktopBillDetail
        bill={bill}
        canPay={false}
        onSchedule={() => undefined}
        onBack={() => undefined}
      />,
    );
    expect(markup).toContain("41.250.001,25");
    expect(markup).toContain("21.250.000,50");
    expect(markup).toContain("10.000.000,50");
    expect(markup).toContain("10.000.000,25");
  });

  test("payment detail retains cents without exposing absent bank metadata", () => {
    const markup = renderToStaticMarkup(
      <VendorDesktopPaymentDetail
        payment={pending}
        canPay={false}
        onDisburse={() => undefined}
        onBack={() => undefined}
      />,
    );
    expect(markup).toContain("10.000.000,25");
    expect(markup).not.toContain("bank-1");
    expect(markup).not.toContain("Cairkan pembayaran");
  });
});
