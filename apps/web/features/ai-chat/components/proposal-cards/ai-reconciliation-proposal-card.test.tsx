import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {} }),
}));

import {
  AiReconciliationProposalCard,
  type BankReconciliationProposalData,
} from "./ai-reconciliation-proposal-card";

const mockProposal: BankReconciliationProposalData = {
  kind: "BANK_RECONCILIATION",
  bankAccountId: "00000000-0000-0000-0000-000000000010",
  bankAccountName: "BCA - Operasional",
  accountNumber: "1234567890",
  totalMutations: 2,
  matchedCount: 1,
  unmatchedCount: 1,
  matches: [
    {
      cashTransactionId: "11111111-1111-1111-1111-111111111111",
      cashTransactionDescription: "Beli semen 10 sak",
      cashTransactionDate: "2026-03-01",
      statementRow: {
        transactionDate: "2026-03-01",
        description: "TRF TB JAYA ABADI SEMEN",
        amount: 750000,
        type: "OUTFLOW",
      },
      matchedAmount: { amount: 750000, formatted: "Rp 750.000" },
    },
  ],
  unmatchedMutations: [
    {
      transactionDate: "2026-03-02",
      description: "BIAYA ADM BANK",
      amount: 15000,
      type: "OUTFLOW",
      formattedAmount: { amount: 15000, formatted: "Rp 15.000" },
    },
  ],
  availableBankAccounts: [
    {
      id: "00000000-0000-0000-0000-000000000010",
      name: "Operasional",
      bankName: "BCA",
      accountNumber: "1234567890",
    },
    {
      id: "00000000-0000-0000-0000-000000000020",
      name: "Tabungan Proyek",
      bankName: "Mandiri",
      accountNumber: "9876543210",
    },
  ],
};

function renderCard(
  overrides: Partial<BankReconciliationProposalData> = {},
  alreadyConfirmed = false,
): string {
  return renderToStaticMarkup(
    <AiReconciliationProposalCard
      proposal={{ ...mockProposal, ...overrides }}
      toolCallId="call-reconcile-test-1"
      conversationId="22222222-2222-2222-2222-222222222222"
      alreadyConfirmed={alreadyConfirmed}
    />,
  );
}

describe("AiReconciliationProposalCard unit tests", () => {
  test("menampilkan ringkasan mutasi, jumlah cocok, dan belum tercatat", () => {
    const html = renderCard();
    expect(html).toContain("BCA - Operasional");
    expect(html).toContain("Total Mutasi");
    expect(html).toContain("Cocok 100%");
    expect(html).toContain("Belum Tercatat");
    expect(html).toContain("TRF TB JAYA ABADI SEMEN");
    expect(html).toContain("Beli semen 10 sak");
    expect(html).toContain("Konfirmasi Rekonsiliasi (1 Mutasi)");
  });

  test("menampilkan kontrol rekening dan tombol ubah jika tersedia lebih dari satu akun", () => {
    const html = renderCard();
    expect(html).toContain("Rekening Bank");
    expect(html).toContain("BCA - Operasional");
    expect(html).toContain("No. Rek: 1234567890");
    expect(html).toContain("Ubah");
    expect(html).toContain('aria-label="Ubah Rekening Bank"');
  });

  test("menampilkan status sudah dikonfirmasi jika alreadyConfirmed true", () => {
    const html = renderCard({}, true);
    expect(html).toContain("Rekonsiliasi mutasi bank berhasil dieksekusi");
    expect(html).not.toContain("Ubah Rekening Bank");
  });

  test("menampilkan tab segmented control untuk Cocok dan Belum Tercatat", () => {
    const html = renderCard();
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Pilihan Daftar Mutasi"');
    expect(html).toContain("Cocok");
    expect(html).toContain("Belum Tercatat");
    expect(html).toContain('role="checkbox"');
  });

  test("menampilkan empty state jika tidak ada pasangan transaksi yang cocok", () => {
    const html = renderCard({
      matches: [],
      matchedCount: 0,
      totalMutations: 1,
      unmatchedCount: 1,
    });
    expect(html).toContain("Tidak ada mutasi yang cocok persis");
  });
});
