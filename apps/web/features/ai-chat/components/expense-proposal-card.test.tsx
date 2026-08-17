import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ExpenseProposalCard } from "./expense-proposal-card";
import type { ExpenseProposal } from "../utils/expense-proposal";

const money = (amount: number) => ({ amount, formatted: `Rp ${amount.toLocaleString("id-ID")}` });

const proposal: ExpenseProposal = {
  projectId: "77777777-7777-7777-7777-777777777772",
  projectName: "Sudirman Suites - Penthouse Fit-Out",
  projectBudgetCategoryId: "88888888-8888-8888-8888-888888888881",
  categoryCode: "MATERIAL",
  categoryName: "Material",
  description: "Pembelian cat tembok 5 kaleng",
  quantity: 5,
  unitPrice: money(150000),
  amount: money(750000),
  remainingBeforeSubmit: money(343000000),
  exceedsRemaining: false,
};

function render(overrides: Partial<React.ComponentProps<typeof ExpenseProposalCard>> = {}): string {
  return renderToStaticMarkup(
    <ExpenseProposalCard
      proposal={proposal}
      toolCallId="call_abc123"
      conversationId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
      alreadyConfirmed={false}
      {...overrides}
    />,
  );
}

describe("kartu usulan pengeluaran", () => {
  test("menawarkan konfirmasi untuk usulan yang belum dieksekusi", () => {
    const html = render();

    expect(html).toContain("Konfirmasi dan ajukan");
    expect(html).toContain("Belum dikirim");
    expect(html).toContain("Asisten tidak mengirim apa pun sampai Anda menekan tombol ini");
  });

  test("tidak menawarkan konfirmasi lagi untuk usulan yang sudah dieksekusi", () => {
    // Ini penjaga utama terhadap dokumen ganda: riwayat yang dimuat ulang harus
    // merender kartu lama dalam keadaan terkirim, bukan sebagai tombol aktif.
    const html = render({ alreadyConfirmed: true });

    expect(html).not.toContain("Konfirmasi dan ajukan");
    expect(html).toContain("Terkirim");
    expect(html).toContain("menunggu verifikasi");
  });

  test("memperingatkan ketika nominal melewati sisa budget kategori", () => {
    const html = render({
      proposal: { ...proposal, exceedsRemaining: true },
    });

    expect(html).toContain("melewati sisa budget kategori");
    expect(html).toContain("persetujuan Owner");
  });

  test("menyembunyikan peringatan sisa budget setelah usulan terkirim", () => {
    const html = render({
      proposal: { ...proposal, exceedsRemaining: true },
      alreadyConfirmed: true,
    });

    expect(html).not.toContain("melewati sisa budget kategori");
  });

  test("menampilkan rincian yang akan tercatat", () => {
    const html = render();

    expect(html).toContain("Sudirman Suites - Penthouse Fit-Out");
    expect(html).toContain("Material");
    expect(html).toContain("Pembelian cat tembok 5 kaleng");
  });
});
