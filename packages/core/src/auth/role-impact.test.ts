import { describe, expect, test } from "bun:test";

import { ROLE_PERMISSIONS, type PermissionKey } from "./permissions";
import {
  computeModuleDelta,
  describeCriticalGaps,
  isKnownPermissionKey,
  resolvePermissionChange,
  suggestPermissionKeys,
  summarizePermissionsByModule,
} from "./role-impact";

const financeAdmin = new Set<PermissionKey>(ROLE_PERMISSIONS.FINANCE_ADMIN ?? []);

describe("Dampak perubahan peran", () => {
  test("membuang permintaan yang tidak mengubah apa pun", () => {
    // Memberi izin yang sudah dipegang bukan perubahan, dan melaporkannya
    // sebagai perubahan membuat ringkasan dampak berbohong soal ukurannya.
    const change = resolvePermissionChange(
      financeAdmin,
      // `view:ledger` sudah dipegang; `approve:cost` belum.
      ["view:ledger", "approve:cost"],
      // `pay:cost` dipegang; `manage:roles` tidak, jadi mencabutnya no-op.
      ["pay:cost", "manage:roles"],
    );

    expect(change.added).toEqual(["approve:cost"]);
    expect(change.removed).toEqual(["pay:cost"]);
    expect(change.after.has("approve:cost")).toBe(true);
    expect(change.after.has("pay:cost")).toBe(false);
    expect(change.after.has("view:ledger")).toBe(true);
  });

  test("mencatat modul hanya ketika ia menyeberangi nol", () => {
    const before = new Set<PermissionKey>(["view:cost", "create:cost"]);

    // Menambah izin ketiga di modul yang sudah terbuka tidak memindahkan apa pun.
    const widened = resolvePermissionChange(before, ["pay:cost"], []);
    expect(computeModuleDelta(before, widened.after)).toEqual({ gained: [], lost: [] });

    // Mencabut izin terakhirnya menghilangkan seluruh modul.
    const emptied = resolvePermissionChange(before, [], ["view:cost", "create:cost"]);
    expect(computeModuleDelta(before, emptied.after).lost).toEqual(["Pengeluaran & tagihan"]);

    const opened = resolvePermissionChange(before, ["view:material"], []);
    expect(computeModuleDelta(before, opened.after).gained).toEqual(["Material & stok"]);
  });

  test("memperingatkan hanya izin kritis yang kehilangan pemegang terakhir", () => {
    const gaps = describeCriticalGaps(
      ["pay:cost", "view:ledger", "approve:budget"],
      (permission) => permission === "approve:budget",
    );

    // `view:ledger` bukan izin kritis; `approve:budget` masih ada pemegangnya.
    expect(gaps).toEqual([
      {
        permission: "Mencairkan pengeluaran lapangan",
        consequence: "tidak ada yang bisa mencairkan pengeluaran lapangan",
      },
    ]);
  });

  test("meringkas izin per modul dengan yang hilang ikut disebut", () => {
    const summary = summarizePermissionsByModule(new Set<PermissionKey>(["view:settings"]));
    const settings = summary.find((row) => row.module === "Pengaturan ERP");

    expect(settings?.granted).toEqual(["Melihat Pengaturan ERP"]);
    expect(settings?.missing).toContain("Meninjau data awal onboarding");
  });

  test("menyarankan kunci terdekat ketika namanya meleset", () => {
    expect(isKnownPermissionKey("pay:cost")).toBe(true);
    expect(isKnownPermissionKey("pay:everything")).toBe(false);
    expect(suggestPermissionKeys("approve:budget")).toContain("approve:budget");
    expect(suggestPermissionKeys("bayar tagihan vendor")).toContain("pay:vendor_bill");
    expect(suggestPermissionKeys("")).toEqual([]);
  });
});
