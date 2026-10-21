import { expect, test } from "bun:test";

import { describeIntegration } from "@backend/lib/testing/integration-db";
import { runAllInvariants, type InvariantResult } from "./ledger-invariants";

/**
 * Menjalankan keenam invarian terhadap database yang ditunjuk
 * `ATRIA_TEST_DATABASE_URL`.
 *
 * Berbeda dari suite bergerbang lain di repo ini, berkas ini **tidak menulis
 * apa pun** — ia hanya membaca lalu menjumlahkan. Karena itu ia juga aman
 * dijalankan terhadap database produksi lewat `bun run db:check-invariants`,
 * dan itulah bentuk yang dimaksud "dijalankan tiap malam".
 *
 * Kalau gagal, pesannya menyebut nomor invarian, akibat nyatanya, dan sampai
 * lima baris pelanggar — bukan sekadar "expected true, got false".
 */

function describeFailure(result: InvariantResult): string {
  const shown = result.violations.slice(0, 5);
  const rest = result.violations.length - shown.length;

  const lines = [
    `${result.id} gagal — ${result.title}`,
    `Akibat: ${result.consequence}`,
    `${result.violations.length} pelanggaran dari ${result.checked} baris diperiksa:`,
    ...shown.map(
      (v) =>
        `  • ${v.subject}\n      diharapkan ${v.expected}, ternyata ${v.actual}` +
        (v.detail ? `\n      ${v.detail}` : ""),
    ),
  ];

  if (rest > 0) lines.push(`  … ${rest} pelanggaran lain tidak ditampilkan`);
  return lines.join("\n");
}

describeIntegration("invarian buku besar, stok, dan budget", () => {
  test("keenam invarian terpenuhi di database test", async () => {
    const results = await runAllInvariants();

    expect(results).toHaveLength(6);

    const failed = results.filter((result) => result.violations.length > 0);
    if (failed.length > 0) {
      throw new Error(failed.map(describeFailure).join("\n\n"));
    }

    // Sebuah invarian yang tidak memeriksa apa pun akan lulus tanpa arti.
    // Baris ini membuat database kosong terbaca sebagai "belum membuktikan
    // apa-apa", bukan sebagai "sehat".
    const totalChecked = results.reduce((sum, result) => sum + result.checked, 0);
    expect(totalChecked).toBeGreaterThan(0);
  });
});
