import { describe, expect, test } from "bun:test";

import {
  AI_PROPOSAL_FORBIDDEN_PERMISSIONS,
  describeForbiddenProposal,
  describePermissionEffect,
  findForbiddenProposalPermissions,
} from "./ai-role-proposal";
import { getAllCatalogPermissionKeys } from "./permission-catalog";

describe("Pagar usulan peran lewat asisten", () => {
  test("menolak izin yang bisa memperluas jalurnya sendiri", () => {
    expect(findForbiddenProposalPermissions(["manage:roles"]).length).toBe(1);
    expect(findForbiddenProposalPermissions(["manage:users"]).length).toBe(1);
  });

  test("menolak izin yang memindahkan uang keluar", () => {
    const found = findForbiddenProposalPermissions(["pay:cost", "pay:vendor_bill", "view:cost"]);

    expect(found.map((entry) => entry.key)).toEqual(["pay:cost", "pay:vendor_bill"]);
  });

  test("menolak jalan pintas pemisahan tugas", () => {
    expect(findForbiddenProposalPermissions(["override:self_approval"]).length).toBe(1);
  });

  test("membiarkan izin biasa lewat", () => {
    expect(findForbiddenProposalPermissions(["view:cost", "verify:cost", "view:budget"])).toEqual(
      [],
    );
  });

  test("setiap kunci terlarang benar-benar ada di katalog", () => {
    // Kunci terlarang yang salah ketik adalah pagar yang tidak menjaga apa pun.
    const known = new Set<string>(getAllCatalogPermissionKeys());
    for (const key of Object.keys(AI_PROPOSAL_FORBIDDEN_PERMISSIONS)) {
      expect(known.has(key)).toBe(true);
    }
  });

  test("menyusun penolakan yang menyebut kemampuannya, bukan kunci mentah", () => {
    const message = describeForbiddenProposal(findForbiddenProposalPermissions(["pay:cost"]));

    expect(message).toContain("mencairkan pengeluaran lapangan");
    expect(message).not.toContain("pay:cost");
    expect(message).toContain("Pengaturan");
  });

  test("menerjemahkan izin menjadi kalimat akibat", () => {
    expect(describePermissionEffect("verify:cost", "grant")).toBe(
      "Bisa memverifikasi pengeluaran lapangan",
    );
    // Izin kritis memakai kata yang lebih tegas saat dicabut.
    expect(describePermissionEffect("approve:cost", "revoke")).toBe(
      "Berhenti bisa menyetujui pengeluaran lapangan",
    );
    expect(describePermissionEffect("view:ledger", "revoke")).toBe(
      "Tidak lagi melihat catatan buku kas",
    );
  });
});
