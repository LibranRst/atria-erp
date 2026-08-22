import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
    back: () => {},
  }),
}));

import { CreateProjectProposalCard } from "./proposal-cards/create-project-proposal-card";
import { SetupBudgetProposalCard } from "./proposal-cards/setup-budget-proposal-card";
import { VendorPaymentProposalCard } from "./proposal-cards/vendor-payment-proposal-card";
import { ClientPaymentProposalCard } from "./proposal-cards/client-payment-proposal-card";
import { GoodsReceiptProposalCard } from "./proposal-cards/goods-receipt-proposal-card";
import { ExpenseReviewProposalCard } from "./proposal-cards/expense-review-proposal-card";
import { DisburseExpenseProposalCard } from "./proposal-cards/disburse-expense-proposal-card";
import { readAnyProposal } from "../utils/proposal-reader";

const money = (amount: number) => ({ amount, formatted: `Rp ${amount.toLocaleString("id-ID")}` });

describe("proposal cards rendering suite", () => {
  test("CreateProjectProposalCard renders details and confirm button", () => {
    const html = renderToStaticMarkup(
      <CreateProjectProposalCard
        proposal={{
          kind: "CREATE_PROJECT",
          name: "Menteng Modern Living",
          clientId: "66666666-6666-6666-6666-666666666661",
          clientName: "Bpk. Hendra",
          projectManagerId: "22222222-2222-2222-2222-222222222222",
          projectManagerName: "PM Budi",
          totalContractValue: money(500_000_000),
          startDate: "2026-09-01",
          endDate: "2026-12-01",
          location: "Menteng, Jakarta Pusat",
          notes: "Interior residential",
        }}
        toolCallId="call_p1"
        conversationId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        alreadyConfirmed={false}
      />,
    );

    expect(html).toContain("Menteng Modern Living");
    expect(html).toContain("Bpk. Hendra");
    expect(html).toContain("Buat Proyek Ini");
    expect(html).toContain("Rp 500.000.000");
  });

  test("SetupBudgetProposalCard renders category distributions", () => {
    const html = renderToStaticMarkup(
      <SetupBudgetProposalCard
        proposal={{
          kind: "SETUP_BUDGET",
          projectId: "77777777-7777-7777-7777-777777777772",
          projectName: "Sudirman Suites",
          alreadyHasBudget: false,
          contractValue: money(1_000_000_000),
          budgetCapRatio: 0.85,
          budgetCapPercentageLabel: "85%",
          internalBudget: money(850_000_000),
          targetGrossAmount: money(150_000_000),
          targetGrossPercentage: 15,
          categories: [
            {
              expenseCategoryId: "88888888-8888-8888-8888-888888888881",
              categoryCode: "MATERIAL",
              categoryName: "Material",
              ratioPercentage: 0.45,
              ratioPercentageLabel: "45%",
              allocated: money(382_500_000),
              sortOrder: 1,
            },
          ],
        }}
        toolCallId="call_b1"
        conversationId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        alreadyConfirmed={false}
      />,
    );

    expect(html).toContain("Sudirman Suites");
    expect(html).toContain("Terapkan Alokasi Budget");
    expect(html).toContain("Target Margin (15%)");
    expect(html).toContain("Material");
    expect(html).toContain("Rp 382.500.000");
  });

  test("VendorPaymentProposalCard renders bank balance diff", () => {
    const html = renderToStaticMarkup(
      <VendorPaymentProposalCard
        proposal={{
          kind: "PAY_VENDOR_BILL",
          vendorPaymentId: "55555555-5555-5555-5555-555555555551",
          vendorBillId: "99999999-9999-9999-9999-999999999991",
          billNumber: "INV-2026-001",
          vendorName: "PT Kayu Jati Perkasa",
          projectName: "Sudirman Suites",
          amountPaid: money(25_000_000),
          bankAccountId: "44444444-4444-4444-4444-444444444441",
          bankAccountName: "BCA Operasional",
          bankBalanceBefore: money(100_000_000),
          bankBalanceAfter: money(75_000_000),
          insufficientFunds: false,
          referenceNumber: "TRF-VEND-1122",
          billTotalAmount: money(25_000_000),
          budgetCategoryRemaining: money(80_000_000),
        }}
        toolCallId="call_pay1"
        conversationId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        alreadyConfirmed={false}
      />,
    );

    expect(html).toContain("PT Kayu Jati Perkasa");
    expect(html).toContain("Bayar Tagihan Vendor");
    expect(html).toContain("Rp 100.000.000");
    expect(html).toContain("Rp 75.000.000");
  });

  test("ClientPaymentProposalCard renders receivable and bank inflow diff", () => {
    const html = renderToStaticMarkup(
      <ClientPaymentProposalCard
        proposal={{
          kind: "RECORD_CLIENT_PAYMENT",
          clientInvoiceId: "33333333-3333-3333-3333-333333333331",
          invoiceNumber: "INV-CL-001",
          projectName: "Sudirman Suites",
          clientName: "Bpk. Rahmat",
          amountPaid: money(50_000_000),
          paymentDate: "2026-08-19",
          bankAccountId: "44444444-4444-4444-4444-444444444441",
          bankAccountName: "BCA Penerimaan",
          bankBalanceBefore: money(200_000_000),
          bankBalanceAfter: money(250_000_000),
          invoiceOutstandingBefore: money(50_000_000),
          invoiceOutstandingAfter: money(0),
          willBePaid: true,
          referenceNumber: "DEP-BCA-99",
        }}
        toolCallId="call_rec1"
        conversationId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        alreadyConfirmed={false}
      />,
    );

    expect(html).toContain("Bpk. Rahmat");
    expect(html).toContain("Catat Penerimaan Dana");
    expect(html).toContain("Rp 200.000.000");
    expect(html).toContain("Rp 250.000.000");
    expect(html).toContain("Sisa Piutang");
  });

  test("GoodsReceiptProposalCard renders stock on-hand diff", () => {
    const html = renderToStaticMarkup(
      <GoodsReceiptProposalCard
        proposal={{
          kind: "POST_GOODS_RECEIPT",
          projectId: "77777777-7777-7777-7777-777777777772",
          projectName: "Sudirman Suites",
          materialId: "11111111-2222-3333-4444-555555555555",
          materialName: "Cat Tembok Putih 20L",
          materialCode: "CAT-WHT-20",
          unit: "pail",
          quantity: 15,
          unitCost: money(650_000),
          totalValue: money(9_750_000),
          inventoryLocationId: "99999999-9999-9999-9999-999999999991",
          locationName: "Gudang Utama",
          stockOnHandBefore: 5,
          stockOnHandAfter: 20,
          averageCostBefore: money(650_000),
          averageCostAfter: money(650_000),
          receiptNumber: "GR-2026-001",
          receivedAt: "2026-08-19",
          vendorBillId: null,
          projectRapItemId: null,
          rapItemName: null,
          note: "Surat Jalan SJ-8812",
        }}
        toolCallId="call_gr1"
        conversationId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        alreadyConfirmed={false}
      />,
    );

    expect(html).toContain("Cat Tembok Putih 20L");
    expect(html).toContain("5 pail");
    expect(html).toContain("20 pail");
    expect(html).toContain("Catat Penerimaan Barang");
  });

  test("ExpenseReviewProposalCard renders approval decision", () => {
    const html = renderToStaticMarkup(
      <ExpenseReviewProposalCard
        proposal={{
          kind: "EXPENSE_REVIEW",
          expenseId: "77777777-7777-7777-7777-777777777772",
          action: "APPROVE",
          actionLabel: "Setujui Pengajuan",
          description: "Beli paku & kawat ikat",
          amount: money(350_000),
          projectName: "Sudirman Suites",
          requesterName: "PM Budi",
          notes: "Disetujui sesuai RAB",
        }}
        toolCallId="call_rev1"
        conversationId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        alreadyConfirmed={false}
      />,
    );

    expect(html).toContain("Beli paku");
    expect(html).toContain("Setujui Pengajuan");
    expect(html).toContain("PM Budi");
  });

  test("ExpenseReviewProposalCard renders verification decision", () => {
    const html = renderToStaticMarkup(
      <ExpenseReviewProposalCard
        proposal={{
          kind: "EXPENSE_REVIEW",
          expenseId: "77777777-7777-7777-7777-777777777772",
          action: "VERIFY",
          actionLabel: "Verifikasi Pengajuan",
          description: "Pekerjaan waterproofing balkon",
          amount: money(6_200_000),
          projectName: "Sudirman Suites",
          requesterName: "Siti Aminah",
          notes: "Kuitansi & foto progres valid",
        }}
        toolCallId="call_ver1"
        conversationId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        alreadyConfirmed={false}
      />,
    );

    expect(html).toContain("Pekerjaan waterproofing balkon");
    expect(html).toContain("Verifikasi Pengeluaran Lapangan");
    expect(html).toContain("Verifikasi Pengajuan");
    expect(html).toContain("Siti Aminah");
  });

  test("DisburseExpenseProposalCard renders bank balance diff and disburse button", () => {
    const html = renderToStaticMarkup(
      <DisburseExpenseProposalCard
        proposal={{
          kind: "DISBURSE_EXPENSE",
          expenseId: "77777777-7777-7777-7777-777777777772",
          description: "Pengadaan rompi K3 dan helm safety",
          projectName: "Sudirman Suites",
          requesterName: "Siti Aminah",
          amount: money(3_200_000),
          bankAccountId: "44444444-4444-4444-4444-444444444441",
          bankAccountName: "BCA Operasional",
          bankBalanceBefore: money(50_000_000),
          bankBalanceAfter: money(46_800_000),
          insufficientFunds: false,
          referenceNumber: "TRF-PM-9901",
        }}
        toolCallId="call_disb1"
        conversationId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        alreadyConfirmed={false}
      />,
    );

    expect(html).toContain("Pencairan Dana Biaya Lapangan");
    expect(html).toContain("Pengadaan rompi K3 dan helm safety");
    expect(html).toContain("BCA Operasional");
    expect(html).toContain("Cairkan Dana Lapangan");
    expect(html).toContain("Rp 50.000.000");
    expect(html).toContain("Rp 46.800.000");
  });

  test("readAnyProposal identifies proposal kinds correctly", () => {
    const projProposal = {
      proposal: {
        kind: "CREATE_PROJECT",
        name: "Proyek Baru",
        totalContractValue: money(100_000_000),
      },
    };
    expect(readAnyProposal(projProposal)?.kind).toBe("CREATE_PROJECT");

    const budProposal = {
      proposal: {
        kind: "SETUP_BUDGET",
        categories: [],
        internalBudget: money(85_000_000),
      },
    };
    expect(readAnyProposal(budProposal)?.kind).toBe("SETUP_BUDGET");
  });
});
