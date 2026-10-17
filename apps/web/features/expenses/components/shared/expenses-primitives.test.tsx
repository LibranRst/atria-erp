import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import ExpensesLoading from "@/app/expenses/loading";
import { GroupedSurface, SectionHeader, SummarySurface } from "@/components/ui";
import { FieldClaimRow } from "@/features/expenses/components/lists/field-claim-rows";
import { VendorPaymentCard } from "@/features/expenses/components/lists/vendor-bill-cards";
import { VendorBillCard } from "@/features/expenses/components/lists/vendor-bill-cards";

import { ActivityDetailProvider } from "@/features/activity-detail/components/activity-detail-provider";
import {
  VendorBillScheduleContextCard,
  VendorPaymentDisburseContextCard,
} from "@/features/expenses/components/sheets/vendor-payment-sheets";

const vendorCardsPath = new URL("../lists/vendor-bill-cards.tsx", import.meta.url);
const fieldClaimRowsPath = new URL("../lists/field-claim-rows.tsx", import.meta.url);
const vendorPaymentSheetsPath = new URL("../sheets/vendor-payment-sheets.tsx", import.meta.url);

describe("Expenses Dashboard visual language", () => {
  test("renders a contextual financial summary without changing its values", () => {
    const html = renderToStaticMarkup(
      <SummarySurface
        ariaLabel="Posisi pengeluaran lapangan"
        eyebrow="Pengeluaran lapangan"
        icon="receipt_long"
        status="13 perlu aksi"
        statusTone="warning"
      >
        <span>Rp 15.800.000</span>
      </SummarySurface>,
    );

    expect(html).toContain("Posisi pengeluaran lapangan");
    expect(html).toContain("13 perlu aksi");
    expect(html).toContain("Rp 15.800.000");
  });

  test("keeps list sections inside one inset-grouped surface", () => {
    const html = renderToStaticMarkup(
      <>
        <SectionHeader title="Pengeluaran aktif" count={14} countLabel="Pengajuan" />
        <GroupedSurface>
          <div>Baris pengeluaran</div>
        </GroupedSurface>
      </>,
    );

    expect(html).toContain("Pengeluaran aktif");
    expect(html).toContain('aria-label="14 pengajuan"');
    expect(html).toContain(">Pengajuan</span>");
    expect(html).toContain("inline-grid h-5 min-w-5");
    expect(html).toContain("min-h-8");
    expect(html).toContain("rounded-owner");
  });

  test("uses a route-specific loading skeleton with grouped rows", () => {
    const html = renderToStaticMarkup(<ExpensesLoading />);

    expect(html).toContain("Memuat Kas dan Tagihan");
    expect(html).toContain("Data pengeluaran dan tagihan sedang disiapkan");
    expect(html).not.toContain("spinner");
  });

  test("keeps vendor bill identity, amount, due date, and progress in one operational row", () => {
    const html = renderToStaticMarkup(
      <ActivityDetailProvider>
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
        />
      </ActivityDetailProvider>,
    );

    expect(html).toContain("PT Kayu Rapi");
    expect(html).toContain("Jatuh tempo");
    expect(html).toContain("Sudah dijadwalkan");
    expect(html).toContain("text-eyebrow");
  });

  test("uses the same hierarchy for buyer plans and field expenses", () => {
    const paymentHtml = renderToStaticMarkup(
      <ActivityDetailProvider>
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
        />
      </ActivityDetailProvider>,
    );
    const expenseHtml = renderToStaticMarkup(
      <ActivityDetailProvider>
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
        />
      </ActivityDetailProvider>,
    );

    expect(paymentHtml).toContain("Siap Cair");
    expect(paymentHtml).toContain("BCA Operasional");
    expect(expenseHtml).toContain("Pembelian perlengkapan instalasi");
    expect(expenseHtml).toContain("Diajukan Budi");
    expect(expenseHtml).toContain("leading-5");
  });

  test("passes row actions and passive pending states into the activity-detail footer", async () => {
    const vendorSource = await Bun.file(vendorCardsPath).text();
    const fieldSource = await Bun.file(fieldClaimRowsPath).text();

    expect(vendorSource).toContain('"Jadwalkan Bayar"');
    expect(vendorSource).toContain('label: "Cairkan"');
    expect(vendorSource).toContain('label: "Menunggu pencairan"');
    expect(fieldSource).toContain('label: "Verifikasi"');
    expect(fieldSource).toContain('label: "Cairkan"');
    expect(fieldSource).toContain('label: "Menunggu verifikasi"');
    expect(fieldSource).toContain('label: "Menunggu persetujuan"');
    expect(fieldSource).toContain('label: "Menunggu pencairan"');
    expect(`${vendorSource}\n${fieldSource}`).toContain("openActivityDetail({ kind:");
    expect(`${vendorSource}\n${fieldSource}`).toContain("activityDetailOptions");
  });

  test("renders structured context card for vendor bill payment scheduling with calm luxury layout", () => {
    const mockBill = {
      id: "bill-1",
      vendorId: "v-1",
      projectId: "proj-1",
      projectBudgetItemId: "item-1",
      projectBudgetCategoryId: "cat-1",
      billNumber: "INV-2026-001",
      amount: "25000000",
      status: "PARTIALLY_PAID",
      dueDate: new Date("2026-03-20"),
      notes: null,
      vendor: { id: "v-1", name: "PT Surya Abadi" },
      project: { id: "proj-1", name: "Villa Ubud" },
      budgetItem: {
        id: "item-1",
        name: "Material Kayu",
        allocatedAmount: "50000000",
        actualSpent: "25000000",
      },
      payments: [],
    };

    const html = renderToStaticMarkup(
      <VendorBillScheduleContextCard
        bill={mockBill}
        remaining={15000000}
        totalScheduledOrPaid={10000000}
      />,
    );

    expect(html).toContain("PT Surya Abadi");
    expect(html).toContain("Tagihan INV-2026-001");
    expect(html).toContain("Villa Ubud");
    expect(html).toContain("Sisa Tagihan");
    expect(html).toContain("Total Tagihan");
    expect(html).toContain("Sebagian");
    expect(html).toContain("rounded-owner");
    expect(html).toContain("bg-surface-container-low");
    expect(html).toContain("Sudah terjadwal Rp 10.000.000");
    expect(html).toContain("Budget Material Kayu");
  });

  test("renders structured context card for vendor payment disbursement", () => {
    const mockPayment = {
      id: "pay-1",
      vendorBillId: "bill-1",
      bankAccountId: "acc-1",
      amountPaid: "10000000",
      status: "APPROVED",
      paymentDate: new Date("2026-03-10"),
      referenceNumber: "TRX-001",
      bankAccount: { id: "acc-1", name: "BCA Operasional", bankName: "BCA", balance: "100000000" },
      vendorBill: {
        billNumber: "INV-2026-001",
        vendor: { name: "PT Surya Abadi" },
        project: { name: "Villa Ubud" },
      },
    };

    const html = renderToStaticMarkup(
      <VendorPaymentDisburseContextCard payment={mockPayment} amount={10000000} />,
    );

    expect(html).toContain("Pencairan Tagihan");
    expect(html).toContain("PT Surya Abadi");
    expect(html).toContain("Tagihan INV-2026-001");
    expect(html).toContain("Villa Ubud");
    expect(html).toContain("Siap Cair");
    expect(html).toContain("Nominal Pencairan");
    expect(html).toContain("BCA Operasional");
    expect(html).toContain("rounded-owner");
  });

  test("ensures vendor payment sheets use structured context cards instead of raw text line", async () => {
    const sheetsSource = await Bun.file(vendorPaymentSheetsPath).text();

    expect(sheetsSource).toContain("<VendorBillScheduleContextCard");
    expect(sheetsSource).toContain("<VendorPaymentDisburseContextCard");
    expect(sheetsSource).not.toContain("<FieldContextLine");
  });

  test("renders structured budget impact card for expense line editor", async () => {
    const { ExpenseLineBudgetContextCard } = await import("../forms/expense-line-context-cards");
    const html = renderToStaticMarkup(
      <ExpenseLineBudgetContextCard
        categoryName="Material"
        amount={1500000}
        remaining={2000000}
        usedPercentage={45}
      />,
    );

    expect(html).toContain("Dampak Anggaran Kategori");
    expect(html).toContain("Kategori Material");
    expect(html).toContain("Pagu Aman");
    expect(html).toContain("Subtotal Item Ini");
    expect(html).toContain("Sisa Pagu Setelahnya");
    expect(html).toContain("45% pagu terpakai");
    expect(html).toContain("rounded-owner");
  });

  test("renders structured stock checking card for expense line editor", async () => {
    const { ExpenseLineStockContextCard } = await import("../forms/expense-line-context-cards");
    const html = renderToStaticMarkup(
      <ExpenseLineStockContextCard
        materialName="Cat Dinding Dulux 20L"
        unit="Pail"
        availableStock={10}
        requiredQuantity={4}
        stockHandling="STOCK_IN"
      />,
    );

    expect(html).toContain("Pengecekan Stok Gudang");
    expect(html).toContain("Cat Dinding Dulux 20L");
    expect(html).toContain("Stok Cukup");
    expect(html).toContain("Stok Tersedia");
    expect(html).toContain("Kebutuhan Item");
    expect(html).toContain("Stok Masuk Gudang");
    expect(html).toContain("rounded-owner");
  });

  test("ensures expense line editor uses structured context cards instead of raw text line", async () => {
    const lineEditorPath = new URL("../forms/expense-line-editor.tsx", import.meta.url);
    const lineEditorSource = await Bun.file(lineEditorPath).text();

    expect(lineEditorSource).toContain("<ExpenseLineBudgetContextCard");
    expect(lineEditorSource).toContain("<ExpenseLineStockContextCard");
    expect(lineEditorSource).not.toContain("<FieldContextLine");
  });
});
