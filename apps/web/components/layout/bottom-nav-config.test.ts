import { describe, expect, test } from "bun:test";

import { ROLE_PERMISSIONS } from "@atria/core/auth/permissions";

import { buildFabActions } from "./bottom-nav-config";

/**
 * Aksi cepat sekarang menerima daftar izin efektif. Test tetap menyebut peran
 * bawaan dan menurunkan izinnya dari matriks seed, supaya batas yang diuji di
 * sini tetap batas yang sama seperti sebelumnya.
 */
function actions(roleName: string, pathname: string) {
  return buildFabActions({
    permissions: ROLE_PERMISSIONS[roleName] ?? [],
    pathname,
    isProjectDetail: /^\/projects\/[^/]+/.test(pathname),
    isCurrentProjectLocked: false,
    withQuery: (key, value = "true", targetPath = pathname) => `${targetPath}?${key}=${value}`,
  });
}

describe("contextual FAB actions", () => {
  test("keeps Projects focused on adding a project for Owner", () => {
    expect(actions("OWNER", "/projects").map((item) => item.label)).toEqual(["Project Baru"]);
  });

  test("tidak menawarkan Finance pintu pengajuan biaya yang ditolak server", () => {
    /*
     * Sebelum aksi cepat mengikuti izin, Finance Admin melihat "Expense
     * Lapangan" di sini — padahal `submitFieldRequest` menuntut `create:cost`
     * yang tidak dipegangnya, sehingga tombol itu selalu berakhir FORBIDDEN.
     * Yang berubah adalah tombolnya menyusul aturan server, bukan aturannya.
     */
    expect(actions("FINANCE_ADMIN", "/expenses").map((item) => item.label)).toEqual([
      "Tagihan Vendor",
    ]);
  });

  test("does not expose stock mutations to Project Manager", () => {
    expect(actions("PROJECT_MANAGER", "/materials").map((item) => item.label)).toEqual([
      "Expense Lapangan",
    ]);
  });

  test("shows operational stock actions to Purchasing without Owner-only adjustment", () => {
    const labels = actions("PURCHASING", "/materials").map((item) => item.label);
    expect(labels).toContain("Lokasi Baru");
    expect(labels).toContain("Terima Barang");
    expect(labels).toContain("Stock Opname");
    expect(labels).not.toContain("Penyesuaian Darurat");
  });

  test("does not expose project creation to Project Manager", () => {
    expect(actions("PROJECT_MANAGER", "/projects").map((item) => item.label)).toEqual([
      "Expense Lapangan",
    ]);
  });

  test("keeps Purchasing on the vendor-bill workflow from Projects", () => {
    expect(actions("PURCHASING", "/projects").map((item) => item.label)).toEqual([
      "Tagihan Vendor",
    ]);
  });
});
