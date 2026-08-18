import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Rekening yang sudah diarsipkan tidak boleh lagi menerima pergerakan kas.
 *
 * Penjagaannya bukan sebuah `if`, melainkan filter pada kueri pencarian
 * rekening: `isActive` harus ikut dipersyaratkan, sehingga rekening terarsip
 * gagal ditemukan dan transaksi berhenti sebelum saldo tersentuh. Bentuk itu
 * mudah hilang tanpa terasa — menghapus satu baris filter tidak membuat satu
 * test pun merah, dan tidak ada test yang menutupinya sebelum ini.
 *
 * Di-anchor ke `import.meta.dir` mengikuti test arsitektur lain di folder ini.
 */
const APP_ROOT = path.resolve(import.meta.dir, "..", "..");

function readSource(relative: string): string | null {
  try {
    return readFileSync(path.join(APP_ROOT, relative), "utf8");
  } catch {
    return null;
  }
}

describe("cash movement guards", () => {
  test("bank account lookups for movements require an active account", () => {
    const source = readSource("app/actions/finance/bank-account-movements.ts");
    expect(source).not.toBeNull();

    // Setiap pencarian rekening di modul ini harus berpasangan dengan filter aktif.
    const lookups = source!.match(/tx\.query\.bankAccount\.findFirst|from\(bankAccount\)/g) ?? [];
    const activeFilters = source!.match(/eq\(\s*bankAccount\.isActive\s*,\s*true\s*\)/g) ?? [];

    expect(lookups.length).toBeGreaterThan(0);
    expect(activeFilters.length).toBeGreaterThanOrEqual(lookups.length);
  });

  test("every movement entry point in the module filters on isActive", () => {
    const source = readSource("app/actions/finance/bank-account-movements.ts")!;
    const exportedActions = source.match(/export async function (\w+)/g) ?? [];
    const activeFilters = source.match(/eq\(\s*bankAccount\.isActive\s*,\s*true\s*\)/g) ?? [];

    // Mutasi manual dan transfer antar rekening: keduanya harus terjaga.
    expect(exportedActions.length).toBeGreaterThanOrEqual(1);
    expect(activeFilters.length).toBeGreaterThanOrEqual(exportedActions.length);
  });
});
