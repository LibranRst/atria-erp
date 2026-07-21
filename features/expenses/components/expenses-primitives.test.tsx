import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import ExpensesLoading from "@/app/expenses/loading";
import {
  ExpensesGroupSurface,
  ExpensesSectionHeader,
  ExpensesSummarySurface,
} from "@/features/expenses/components/expenses-primitives";
import { FieldClaimRow } from "@/features/expenses/components/field-claim-rows";
import {
  VendorBillCard,
  VendorPaymentCard,
} from "@/features/expenses/components/vendor-bill-cards";

describe("Expenses Dashboard visual language", () => {
  test("renders a contextual financial summary without changing its values", () => {
    const html = renderToStaticMarkup(
      <ExpensesSummarySurface
        ariaLabel="Posisi pengeluaran lapangan"
        eyebrow="Pengeluaran lapangan"
        icon="receipt_long"
        status="13 perlu aksi"
        statusTone="warning"
      >
        <span>Rp 15.800.000</span>
      </ExpensesSummarySurface>,
    );

    expect(html).toContain("Posisi pengeluaran lapangan");
    expect(html).toContain("13 perlu aksi");
    expect(html).toContain("Rp 15.800.000");
  });

  test("keeps list sections inside one inset-grouped surface", () => {
    const html = renderToStaticMarkup(
      <>
        <ExpensesSectionHeader title="Pengeluaran aktif" meta="14 item" />
        <ExpensesGroupSurface>
          <div>Baris pengeluaran</div>
        </ExpensesGroupSurface>
      </>,
    );

    expect(html).toContain("Pengeluaran aktif");
    expect(html).toContain("14 item");
    expect(html).toContain("rounded-[26px]");
  });

  test("uses a route-specific loading skeleton with grouped rows", () => {
    const html = renderToStaticMarkup(<ExpensesLoading />);

    expect(html).toContain("Memuat Kas dan Tagihan");
    expect(html).toContain("Data pengeluaran dan tagihan sedang disiapkan");
    expect(html).not.toContain("spinner");
  });

  test("keeps vendor bill identity, amount, due date, and progress in one operational row", () => {
    const html = renderToStaticMarkup(
      <VendorBillCard
        bill={{
          id: "bill-1",
          vendorId: "vendor-1",
          projectId: "project-1",
          projectBudgetItemId: "budget-1",
          projectBudgetCategoryId: "category-1",
          billNumber: "INV/2026/018",
          amount: "12500000",
          status: "PARTIALLY_PAID",
          dueDate: new Date("2026-07-28T00:00:00.000Z"),
          notes: null,
          vendor: { name: "PT Kayu Rapi" },
          project: { name: "Rumah Kemang" },
          budgetItem: { name: "Material" },
          payments: [
            {
              id: "payment-1",
              vendorBillId: "bill-1",
              bankAccountId: "bank-1",
              amountPaid: "5000000",
              status: "PENDING",
              paymentDate: new Date("2026-07-24T00:00:00.000Z"),
              referenceNumber: null,
            },
          ],
        }}
        isOwnerOrFinance
        onScheduleClick={() => undefined}
      />,
    );

    expect(html).toContain("PT Kayu Rapi");
    expect(html).toContain("Jatuh tempo");
    expect(html).toContain("Sudah dijadwalkan");
    expect(html).toContain("leading-3");
  });

  test("uses the same hierarchy for buyer plans and field expenses", () => {
    const paymentHtml = renderToStaticMarkup(
      <VendorPaymentCard
        payment={{
          id: "payment-2",
          vendorBillId: "bill-2",
          bankAccountId: "bank-1",
          amountPaid: "7500000",
          status: "PENDING",
          paymentDate: new Date("2026-07-25T00:00:00.000Z"),
          referenceNumber: null,
          approvalStatus: "APPROVED",
          bankAccount: { name: "BCA Operasional" },
          vendorBill: {
            billNumber: "INV/2026/019",
            vendor: { name: "CV Cahaya" },
            project: { name: "Villa Ubud" },
          },
        }}
        isOwnerOrFinance
        onDisburseClick={() => undefined}
      />,
    );
    const expenseHtml = renderToStaticMarkup(
      <FieldClaimRow
        cost={{
          id: "cost-1",
          amount: "1850000",
          description: "Pembelian perlengkapan instalasi",
          receiptImageUrl: null,
          status: "SUBMITTED",
          budgetOverrun: false,
          createdAt: new Date("2026-07-18T08:30:00.000Z"),
          project: { id: "project-1", name: "Rumah Kemang" },
          budgetItem: {
            id: "budget-1",
            name: "Operasional",
            allocatedAmount: "10000000",
            actualSpent: "3500000",
            costCategory: { name: "Operasional" },
          },
          requestedBy: { name: "Budi" },
        }}
        isOwnerOrFinance
        pending={false}
        onVerify={() => undefined}
        onDisburse={() => undefined}
        onOpenReceipt={() => undefined}
      />,
    );

    expect(paymentHtml).toContain("Siap Cair");
    expect(paymentHtml).toContain("BCA Operasional");
    expect(expenseHtml).toContain("Pembelian perlengkapan instalasi");
    expect(expenseHtml).toContain("Diajukan Budi");
    expect(expenseHtml).toContain("leading-5");
  });
});
