import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {} }),
}));

import { readAnyProposal } from "../../utils/proposal-reader";
import { RoleChangeProposalCard, type RoleChangeProposalData } from "./role-change-proposal-card";

const proposal: RoleChangeProposalData = {
  kind: "ROLE_PERMISSION_CHANGE",
  roleId: "00000000-0000-0000-0000-000000000003",
  roleName: "PROJECT_MANAGER",
  reason: "Agar PM dapat memverifikasi pengeluaran timnya sendiri.",
  affectedUsers: 2,
  affectedNames: ["Budi Santoso", "Siti Aminah"],
  grant: [
    {
      key: "verify:cost",
      label: "Memverifikasi pengeluaran lapangan",
      effect: "Bisa memverifikasi pengeluaran lapangan",
    },
  ],
  revoke: [
    {
      key: "view:ledger",
      label: "Melihat catatan buku kas",
      effect: "Tidak lagi melihat catatan buku kas",
    },
  ],
  modulesGained: [],
  modulesLost: ["Kontrol keuangan"],
  editorHref: "/settings?tab=organization&admin=roles&role=x",
};

function render(overrides: Partial<RoleChangeProposalData> = {}): string {
  return renderToStaticMarkup(
    <RoleChangeProposalCard
      proposal={{ ...proposal, ...overrides }}
      toolCallId="call-1"
      conversationId="11111111-1111-1111-1111-111111111111"
      alreadyConfirmed={false}
    />,
  );
}

describe("Kartu usulan perubahan izin", () => {
  test("menyatakan akibat dalam kalimat, bukan hanya kunci izin", () => {
    const html = render();

    // Ini alasan kartu ini boleh ada: konfirmasi satu ketukan hanya sah kalau
    // yang ditampilkan bisa dinilai tanpa membuka dokumentasi.
    expect(html).toContain("Bisa memverifikasi pengeluaran lapangan");
    expect(html).toContain("Tidak lagi melihat catatan buku kas");
  });

  test("menyebut orang yang akan menanggung akibatnya", () => {
    // Mereka tidak ada di percakapan ini, dan kartu yang menyembunyikan mereka
    // membuat perubahan terasa lebih kecil daripada yang sebenarnya.
    const html = render();

    expect(html).toContain("Budi Santoso");
    expect(html).toContain("Siti Aminah");
    expect(html).toContain("2 orang");
  });

  test("menyebut modul yang menghilang", () => {
    expect(render()).toContain("Kontrol keuangan");
  });

  test("tidak mengeksekusi apa pun sebelum tombol ditekan", () => {
    const html = render();

    expect(html).toContain("Aksi baru dieksekusi setelah Anda menekan tombol konfirmasi di atas.");
    expect(html).toContain("Terapkan Perubahan Izin");
  });

  test("dikenali pembaca usulan dan ditolak ketika bentuknya tidak lengkap", () => {
    expect(readAnyProposal({ proposal })?.kind).toBe("ROLE_PERMISSION_CHANGE");
    expect(
      readAnyProposal({ proposal: { kind: "ROLE_PERMISSION_CHANGE", roleName: "X" } }),
    ).toBeNull();
  });
});
