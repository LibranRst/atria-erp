import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {} }),
}));

import { readAnyProposal } from "../../utils/proposal-reader";
import {
  UserBatchCreateProposalCard,
  type CreateUserBatchProposalData,
} from "./user-batch-create-proposal-card";

const proposal: CreateUserBatchProposalData = {
  kind: "CREATE_USER_BATCH",
  count: 2,
  users: [
    {
      name: "Budi Santoso",
      email: "budi@dekoria.com",
      roleId: "33333333-3333-3333-3333-333333333333",
      roleName: "PROJECT_MANAGER",
      roleDisplayName: "Project Manager",
      dataScope: "ASSIGNED",
      scopeEffect: "Hanya proyek yang ditugaskan",
      temporaryPassword: "Dekoria-2026-Xk9mQz",
    },
    {
      name: "Siti Rahma",
      email: "siti@dekoria.com",
      roleId: "44444444-4444-4444-4444-444444444444",
      roleName: "PURCHASING",
      roleDisplayName: "Purchasing",
      dataScope: "NONE",
      scopeEffect: "Hanya modul material & gudang",
      temporaryPassword: "Dekoria-2026-Ab12Cd",
    },
  ],
  reason: "Penambahan tim operasional dan purchasing",
  settingsHref: "/settings?tab=organization",
};

function render(
  overrides: Partial<CreateUserBatchProposalData> = {},
  alreadyConfirmed = false,
): string {
  return renderToStaticMarkup(
    <UserBatchCreateProposalCard
      proposal={{ ...proposal, ...overrides }}
      toolCallId="call-batch-1"
      conversationId="11111111-1111-1111-1111-111111111111"
      alreadyConfirmed={alreadyConfirmed}
    />,
  );
}

describe("Kartu usulan pembuatan pengguna batch (UserBatchCreateProposalCard)", () => {
  test("menampilkan seluruh kandidat dalam batch beserta email dan peran", () => {
    const html = render();
    expect(html).toContain("Budi Santoso");
    expect(html).toContain("budi@dekoria.com");
    expect(html).toContain("Project Manager");
    expect(html).toContain("Siti Rahma");
    expect(html).toContain("siti@dekoria.com");
    expect(html).toContain("Purchasing");
    expect(html).toContain("2 Calon Anggota Tim");
  });

  test("menampilkan tombol Salin Semua Kredensial dan kata sandi masing-masing", () => {
    const html = render();
    expect(html).toContain("Salin Semua Kredensial");
    expect(html).toContain("Dekoria-2026-Xk9mQz");
    expect(html).toContain("Dekoria-2026-Ab12Cd");
    expect(html).toContain("Buat Semua Pengguna (2 Akun)");
  });

  test("menampilkan status selesai jika sudah dikonfirmasi", () => {
    const html = render({}, true);
    expect(html).toContain("Selesai");
    expect(html).toContain("Sebanyak 2 akun pengguna telah berhasil dibuat");
  });

  test("dapat dibaca oleh readAnyProposal", () => {
    const parsed = readAnyProposal({ proposal });
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("CREATE_USER_BATCH");
    if (parsed?.kind === "CREATE_USER_BATCH") {
      expect(parsed.count).toBe(2);
      expect(parsed.users.length).toBe(2);
      expect(parsed.users[0]?.name).toBe("Budi Santoso");
    }
  });
});
