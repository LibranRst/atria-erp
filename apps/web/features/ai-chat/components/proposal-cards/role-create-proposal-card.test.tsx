import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {} }),
}));

import { readAnyProposal } from "../../utils/proposal-reader";
import { RoleCreateProposalCard, type CreateRoleProposalData } from "./role-create-proposal-card";

const proposal: CreateRoleProposalData = {
  kind: "CREATE_ROLE",
  name: "SITE_SUPERVISOR",
  displayName: "Site Supervisor",
  description: "Pengawas lapangan yang mengajukan biaya harian.",
  dataScope: "ASSIGNED",
  scopeEffect: "hanya proyek yang ditugaskan",
  permissions: [
    {
      key: "view:cost",
      label: "Melihat pengeluaran lapangan",
      effect: "Bisa melihat pengeluaran lapangan",
    },
  ],
  editorHref: "/settings?tab=organization&admin=roles&newRole=1",
};

function render(overrides: Partial<CreateRoleProposalData> = {}): string {
  return renderToStaticMarkup(
    <RoleCreateProposalCard
      proposal={{ ...proposal, ...overrides }}
      toolCallId="call-1"
      conversationId="11111111-1111-1111-1111-111111111111"
      alreadyConfirmed={false}
    />,
  );
}

describe("Kartu usulan peran baru", () => {
  test("menyatakan cakupan proyek terang-terangan", () => {
    // Baris yang paling mudah terlewat dan paling luas akibatnya.
    expect(render()).toContain("Cakupan proyek");
    expect(render()).toContain("hanya proyek yang ditugaskan");
    expect(render({ scopeEffect: "seluruh proyek" })).toContain("seluruh proyek");
  });

  test("tidak menjanjikan orangnya langsung bisa memakainya", () => {
    const html = render();

    expect(html).toContain("Belum dipakai siapa pun");
    expect(html).toContain("menugaskan seseorang di Pengaturan");
  });

  test("menyampaikan peran kosong sebagai kabar tenang, bukan alarm", () => {
    /*
     * Dulu kalimat ini lewat `warningMessage` dan keluar berlatar merah —
     * nada yang berlawanan dengan artinya. Peran tanpa pemegang justru berarti
     * belum ada yang terdampak.
     */
    expect(render()).not.toContain("bg-critical-container");
  });

  test("menyatakan izin sebagai akibat, bukan kunci", () => {
    expect(render()).toContain("Bisa melihat pengeluaran lapangan");
  });

  test("menyebutkan peran tanpa izin apa adanya", () => {
    expect(render({ permissions: [] })).toContain("Dibuat tanpa izin");
  });

  test("dikenali pembaca usulan dan menolak bentuk yang tidak lengkap", () => {
    expect(readAnyProposal({ proposal })?.kind).toBe("CREATE_ROLE");
    expect(readAnyProposal({ proposal: { kind: "CREATE_ROLE", name: "X" } })).toBeNull();
  });
});
