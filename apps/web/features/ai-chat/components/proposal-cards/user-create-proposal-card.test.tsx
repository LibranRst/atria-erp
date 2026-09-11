import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {} }),
}));

import { readAnyProposal } from "../../utils/proposal-reader";
import { UserCreateProposalCard, type CreateUserProposalData } from "./user-create-proposal-card";

const proposal: CreateUserProposalData = {
  kind: "CREATE_USER",
  name: "Budi Santoso",
  email: "budi@dekoria.com",
  roleId: "33333333-3333-3333-3333-333333333333",
  roleName: "PROJECT_MANAGER",
  roleDisplayName: "Project Manager",
  roleDescription: "Penanggung jawab teknis dan jadwal proyek lapangan.",
  dataScope: "ASSIGNED",
  scopeEffect: "Hanya proyek yang ditugaskan",
  temporaryPassword: "Dekoria-2026-Xk9mQz",
  reason: "Penambahan staf baru sebagai Project Manager",
  settingsHref: "/settings?tab=organization",
};

function render(overrides: Partial<CreateUserProposalData> = {}, alreadyConfirmed = false): string {
  return renderToStaticMarkup(
    <UserCreateProposalCard
      proposal={{ ...proposal, ...overrides }}
      toolCallId="call-user-1"
      conversationId="11111111-1111-1111-1111-111111111111"
      alreadyConfirmed={alreadyConfirmed}
    />,
  );
}

describe("Kartu usulan pembuatan pengguna baru", () => {
  test("menampilkan nama, email, dan inisial avatar pengguna", () => {
    const html = render();
    expect(html).toContain("Budi Santoso");
    expect(html).toContain("budi@dekoria.com");
    expect(html).toContain("BS"); // Inisial
  });

  test("menampilkan peran yang dipasang dan cakupan proyeknya", () => {
    const html = render();
    expect(html).toContain("Project Manager");
    expect(html).toContain("Hanya proyek yang ditugaskan");
    expect(html).toContain("Penanggung jawab teknis");
  });

  test("menampilkan password sementara, tombol salin password, dan tombol salin kredensial", () => {
    const html = render();
    expect(html).toContain("Dekoria-2026-Xk9mQz");
    expect(html).toContain("Salin Password");
    expect(html).toContain("Salin Kredensial");
    expect(html).toContain("Pengguna wajib memperbarui kata sandi");
  });

  test("menampilkan status selesai jika sudah dikonfirmasi", () => {
    const html = render({}, true);
    expect(html).toContain("Selesai");
    expect(html).toContain("telah berhasil dibuat");
    expect(html).toContain("Buka Pengaturan User");
  });

  test("dapat dibaca oleh readAnyProposal", () => {
    const parsed = readAnyProposal({ proposal });
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("CREATE_USER");
    if (parsed?.kind === "CREATE_USER") {
      expect(parsed.name).toBe("Budi Santoso");
      expect(parsed.email).toBe("budi@dekoria.com");
      expect(parsed.temporaryPassword).toBe("Dekoria-2026-Xk9mQz");
    }
  });
});
