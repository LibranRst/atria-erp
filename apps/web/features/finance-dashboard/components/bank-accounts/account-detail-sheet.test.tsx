import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("@/components/ui/overlay/semantic-sheets", () => ({
  DetailSheet: ({
    open,
    title,
    action,
    children,
  }: {
    open: boolean;
    title: string;
    action?: React.ReactNode;
    children?: React.ReactNode;
  }) => {
    if (!open) return null;
    return (
      <div data-testid="detail-sheet">
        <h2 data-testid="sheet-title">{title}</h2>
        {action ? <div data-testid="sheet-action">{action}</div> : null}
        <div data-testid="sheet-content">{children}</div>
      </div>
    );
  },
  FormSheet: () => null,
}));

import { AccountDetailSheet } from "./account-detail-sheet";
import { AccountTransactionRows } from "./account-transaction-rows";
import type {
  BankAccount,
  CashTransaction,
} from "@/features/finance-dashboard/types/bank-account-types";

const mockAccount: BankAccount = {
  id: "acc-1",
  name: "BCA Operasional",
  bankName: "BCA",
  accountNumber: "8820192831",
  holderName: "PT Dekoria Kreasi Pratama",
  balance: 154000000,
  cardColorFrom: "#0A3981",
  cardColorTo: "#1F509A",
  cardTextColor: "light",
  isActive: true,
  recentTransactions: [
    {
      id: "tx-1",
      bankAccountId: "acc-1",
      type: "INFLOW",
      amount: 50000000,
      category: "owner_capital",
      description: "Setoran Modal Awal",
      createdAt: new Date("2026-09-15T10:00:00.000Z"),
      reconciled: true,
    },
    {
      id: "tx-2",
      bankAccountId: "acc-1",
      type: "OUTFLOW",
      amount: 12500000,
      category: "bank_fee",
      description: "Biaya Administrasi & Operasional",
      createdAt: new Date("2026-09-18T14:30:00.000Z"),
      reconciled: false,
    },
  ],
};

const mockArchivedAccount: BankAccount = {
  ...mockAccount,
  id: "acc-2",
  name: "Mandiri Cadangan",
  bankName: "Bank Mandiri",
  isActive: false,
  recentTransactions: [],
};

describe("AccountDetailSheet", () => {
  test("a view-only grant cannot expose enabled cash mutation controls", () => {
    const markup = renderToStaticMarkup(
      <AccountDetailSheet
        open
        account={mockAccount}
        canArchive={false}
        canTransfer={false}
        canMove={false}
        canEdit={false}
        pending={false}
        onClose={() => undefined}
        onDebit={() => undefined}
        onCredit={() => undefined}
        onTransfer={() => undefined}
        onEdit={() => undefined}
        onToggleActive={() => undefined}
      />,
    );
    expect(markup).toContain("Akses baca rekening");
    expect(markup.match(/<button[^>]*disabled=""/g)?.length).toBe(3);
    expect(markup).not.toContain("Edit rekening");
    expect(markup).not.toContain("Arsipkan rekening");
  });
  test("renders hero card, saldo, metadata block, operational buttons, and aktivitas terbaru when open", () => {
    const markup = renderToStaticMarkup(
      <AccountDetailSheet
        open={true}
        account={mockAccount}
        canArchive={true}
        canMove={true}
        canTransfer={true}
        canEdit={true}
        pending={false}
        onClose={() => undefined}
        onDebit={() => undefined}
        onCredit={() => undefined}
        onTransfer={() => undefined}
        onEdit={() => undefined}
        onToggleActive={() => undefined}
      />,
    );

    // Sheet header title
    expect(markup).toContain("Detail Rekening");

    // Header edit button
    expect(markup).toContain("Edit rekening");

    // Hero surface uses card gradient, no top highlight strip or glare inset
    expect(markup).not.toContain("linear-gradient(90deg");
    expect(markup).not.toContain("rounded-owner p-5 shadow-surface");
    expect(markup).toContain("rounded-owner p-5 ring-1 text-white ring-white/16");
    expect(markup).toContain("linear-gradient(135deg, #0A3981, #1F509A)");

    // Bank and account identity with rounded-icon tile
    expect(markup).toContain("rounded-icon");
    expect(markup).toContain("bg-white/16 text-white");
    expect(markup).toContain("BCA Operasional");
    expect(markup).toContain("BCA");
    expect(markup).toContain("Aktif");

    // Saldo Hero
    expect(markup).toContain("Saldo kas tersedia");
    expect(markup).toContain("154.000.000");

    // Inset metadata block
    expect(markup).toContain("Nomor rekening");
    expect(markup).toContain("8820192831");
    expect(markup).toContain("Salin");
    expect(markup).toContain("Atas nama");
    expect(markup).toContain("PT Dekoria Kreasi Pratama");

    // Operational action buttons (3 columns)
    expect(markup).toContain("Kas Masuk");
    expect(markup).toContain("Kas Keluar");
    expect(markup).toContain("Transfer");

    // Aktivitas terbaru section with Kas & Tagihan link
    expect(markup).toContain("Aktivitas terbaru");
    expect(markup).toContain("Kas &amp; Tagihan");
    expect(markup).toContain("/expenses");

    // Transactions list
    expect(markup).toContain("Setoran Modal Awal");
    expect(markup).toContain("Biaya Administrasi &amp; Operasional");

    // Bottom archive action
    expect(markup).toContain("Arsipkan rekening");
  });

  test("handles archived account by showing inactive badge, warning, disabled actions, and reactivate button", () => {
    const markup = renderToStaticMarkup(
      <AccountDetailSheet
        open={true}
        account={mockArchivedAccount}
        canArchive={true}
        canMove={true}
        canTransfer={false}
        canEdit={true}
        pending={false}
        onClose={() => undefined}
        onDebit={() => undefined}
        onCredit={() => undefined}
        onTransfer={() => undefined}
        onEdit={() => undefined}
        onToggleActive={() => undefined}
      />,
    );

    expect(markup).toContain("opacity-60 grayscale");
    expect(markup).toContain("Diarsipkan");
    expect(markup).toContain("Rekening diarsipkan");
    expect(markup).toContain(
      "Aktifkan kembali rekening di bawah untuk mencatat kas masuk, kas keluar, atau transfer.",
    );
    expect(markup).toContain("Aktifkan kembali");
  });

  test("renders dark text variant and negative balance with proper contrast", () => {
    const darkAccount: BankAccount = {
      ...mockAccount,
      id: "acc-dark",
      cardColorFrom: "#F5D7A1",
      cardColorTo: "#E5C287",
      cardTextColor: "dark",
      balance: -1500000,
    };

    const markup = renderToStaticMarkup(
      <AccountDetailSheet
        open={true}
        account={darkAccount}
        canArchive={true}
        canMove={true}
        canTransfer={true}
        canEdit={true}
        pending={false}
        onClose={() => undefined}
        onDebit={() => undefined}
        onCredit={() => undefined}
        onTransfer={() => undefined}
        onEdit={() => undefined}
        onToggleActive={() => undefined}
      />,
    );

    expect(markup).not.toContain("rounded-owner p-5 shadow-surface");
    expect(markup).toContain("rounded-owner p-5 ring-1 text-on-surface ring-ring-subtle");
    expect(markup).toContain("linear-gradient(135deg, #F5D7A1, #E5C287)");
    expect(markup).toContain("bg-black/6 text-on-surface");
    expect(markup).toContain("bg-black/5 ring-1 ring-black/6");
    expect(markup).toContain("shadow-control ring-1 ring-ring-control");
    expect(markup).toContain("text-error");
  });

  test("shows transfer unavailable warning when account is active but canTransfer is false", () => {
    const markup = renderToStaticMarkup(
      <AccountDetailSheet
        open={true}
        account={mockAccount}
        canArchive={true}
        canMove={true}
        canTransfer={false}
        canEdit={true}
        pending={false}
        onClose={() => undefined}
        onDebit={() => undefined}
        onCredit={() => undefined}
        onTransfer={() => undefined}
        onEdit={() => undefined}
        onToggleActive={() => undefined}
      />,
    );

    expect(markup).toContain("Transfer belum tersedia");
    expect(markup).toContain(
      "Transfer membutuhkan setidaknya satu rekening aktif lain sebagai tujuan.",
    );
  });

  test("omits edit button when canEdit is false", () => {
    const markup = renderToStaticMarkup(
      <AccountDetailSheet
        open={true}
        account={mockAccount}
        canArchive={true}
        canMove={true}
        canTransfer={true}
        canEdit={false}
        pending={false}
        onClose={() => undefined}
        onDebit={() => undefined}
        onCredit={() => undefined}
        onTransfer={() => undefined}
        onEdit={() => undefined}
        onToggleActive={() => undefined}
      />,
    );

    expect(markup).not.toContain("Edit rekening");
  });

  test("renders empty when closed", () => {
    const markup = renderToStaticMarkup(
      <AccountDetailSheet
        open={false}
        account={mockAccount}
        canArchive={true}
        canMove={true}
        canTransfer={true}
        canEdit={true}
        pending={false}
        onClose={() => undefined}
        onDebit={() => undefined}
        onCredit={() => undefined}
        onTransfer={() => undefined}
        onEdit={() => undefined}
        onToggleActive={() => undefined}
      />,
    );

    // DetailSheet portals or closes when open is false
    expect(markup).not.toContain("Saldo kas tersedia");
  });

  test("disables operational buttons, edit button, and archive button when pending is true", () => {
    const markup = renderToStaticMarkup(
      <AccountDetailSheet
        open={true}
        account={mockAccount}
        canArchive={true}
        canMove={true}
        canTransfer={true}
        canEdit={true}
        pending={true}
        onClose={() => undefined}
        onDebit={() => undefined}
        onCredit={() => undefined}
        onTransfer={() => undefined}
        onEdit={() => undefined}
        onToggleActive={() => undefined}
      />,
    );

    // Operational buttons should be disabled
    expect(markup).toContain("Kas Masuk");
    expect(markup).toContain("Kas Keluar");
    expect(markup).toContain("Transfer");

    // Check that buttons have disabled attribute in the markup
    // When pending=true, buttons render with disabled=""
    const buttonMatches = markup.match(/<button[^>]*disabled=""[^>]*>/g) ?? [];
    // At least Kas Masuk, Kas Keluar, Transfer, Edit, and Archive should be disabled (5 buttons)
    expect(buttonMatches.length).toBeGreaterThanOrEqual(5);
  });
});

describe("AccountTransactionRows", () => {
  test("renders calm empty state when no transactions exist", () => {
    const emptyRowsMarkup = renderToStaticMarkup(<AccountTransactionRows transactions={[]} />);

    expect(emptyRowsMarkup).toContain("Belum ada mutasi");
    expect(emptyRowsMarkup).toContain(
      "Mutasi kas masuk, keluar, atau transfer akan tercatat di sini.",
    );
  });

  test("renders transaction rows with amount and category when transactions exist", () => {
    const txs: CashTransaction[] = [
      {
        id: "tx-1",
        bankAccountId: "acc-1",
        type: "INFLOW",
        amount: 2500000,
        category: "owner_capital",
        description: "Tambahan Kas",
        createdAt: new Date("2026-09-10T12:00:00.000Z"),
        reconciled: true,
      },
    ];

    const markup = renderToStaticMarkup(<AccountTransactionRows transactions={txs} />);

    expect(markup).toContain("Tambahan Kas");
    expect(markup).toContain("2.500.000");
  });

  test("handles invalid date gracefully without throwing or displaying Invalid Date", () => {
    const txsWithInvalidDate: CashTransaction[] = [
      {
        id: "tx-invalid",
        bankAccountId: "acc-1",
        type: "OUTFLOW",
        amount: 500000,
        category: "bank_fee",
        description: "Biaya Transaksi",
        createdAt: new Date(NaN),
        reconciled: false,
      },
    ];

    const markup = renderToStaticMarkup(
      <AccountTransactionRows transactions={txsWithInvalidDate} />,
    );

    expect(markup).toContain("Biaya Transaksi");
    expect(markup).toContain("—");
    expect(markup).not.toContain("Invalid Date");
  });
});
