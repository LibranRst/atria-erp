import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { buildRoleEditorHref } from "@atria/core/auth/role-deep-link";
import { RoleReviewResult } from "./role-review-result";

const ROLE_ID = "00000000-0000-0000-0000-000000000003";

const output = {
  roleId: ROLE_ID,
  roleName: "PROJECT_MANAGER",
  reason: "Agar PM dapat memverifikasi pengeluaran timnya sendiri.",
  href: buildRoleEditorHref({ roleId: ROLE_ID, grant: ["verify:cost"], revoke: ["view:ledger"] }),
  grant: [{ key: "verify:cost", label: "Memverifikasi pengeluaran lapangan" }],
  revoke: [{ key: "view:ledger", label: "Melihat catatan buku kas" }],
  affectedUsers: 2,
  criticalGaps: [
    { permission: "Melihat catatan buku kas", consequence: "tidak ada yang bisa membaca buku kas" },
  ],
  blockedGrants: ["Mencairkan pengeluaran lapangan"],
};

describe("Kartu serah-terima peran", () => {
  test("menawarkan jalan ke penyunting, bukan tombol terapkan", () => {
    const html = renderToStaticMarkup(<RoleReviewResult output={output} />);

    // href muncul ter-escape di HTML, jadi diperiksa per bagian.
    expect(html).toContain("admin=roles");
    expect(html).toContain(`role=${ROLE_ID}`);
    expect(html).toContain("grant=verify%3Acost");
    expect(html).toContain("revoke=view%3Aledger");
    expect(html).toContain("Buka di Peran &amp; akses");
    // Kartu ini sengaja tidak punya konfirmasi: menerapkan izin dalam satu
    // ketukan adalah persis yang dihindari rancangannya.
    expect(html).not.toContain("Konfirmasi");
    expect(html).not.toContain("Terapkan");
  });

  test("menyebut usulan, dampak kritis, dan batas anti-eskalasi", () => {
    const html = renderToStaticMarkup(<RoleReviewResult output={output} />);

    expect(html).toContain("Memverifikasi pengeluaran lapangan");
    expect(html).toContain("Melihat catatan buku kas");
    expect(html).toContain("tidak ada yang bisa membaca buku kas");
    expect(html).toContain("Mencairkan pengeluaran lapangan");
    expect(html).toContain("2 pemegang aktif");
  });

  test("menandai kartu perlu ditinjau ketika ada risiko", () => {
    const safe = renderToStaticMarkup(
      <RoleReviewResult output={{ ...output, criticalGaps: [], blockedGrants: [] }} />,
    );

    expect(renderToStaticMarkup(<RoleReviewResult output={output} />)).toContain("Perlu ditinjau");
    expect(safe).toContain("Belum diterapkan");
  });

  test("jatuh ke jejak tool ketika bentuk keluarannya usang", () => {
    expect(RoleReviewResult({ output: { roleName: "PROJECT_MANAGER" } })).toBeNull();
  });
});
