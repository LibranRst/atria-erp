/**
 * Pemeriksaan invarian buku besar, stok, dan budget.
 *
 * Hanya membaca — tidak ada satu pun mutasi — jadi aman dijalankan terhadap
 * database produksi. Inilah bentuk yang dimaksud "invariant test jalan tiap
 * malam": jadwalkan perintah ini, dan biarkan exit code yang bicara.
 *
 *   bun run db:check-invariants
 *
 * Keluar dengan kode 1 bila ada invarian yang dilanggar, sehingga cron atau CI
 * mana pun bisa memicu peringatan tanpa perlu membaca keluarannya.
 */
import { runAllInvariants, type InvariantResult } from "@/lib/finance/ledger-invariants";
import { pool } from "@/db";

const PASS = "[32m✓[0m";
const FAIL = "[31m✗[0m";
const DIM = "[2m";
const RESET = "[0m";

function reportOne(result: InvariantResult): void {
  const mark = result.violations.length === 0 ? PASS : FAIL;
  console.log(`${mark} ${result.id}  ${result.title}`);
  console.log(`${DIM}     ${result.checked} baris diperiksa${RESET}`);

  if (result.violations.length === 0) return;

  console.log(`     Akibat: ${result.consequence}`);
  console.log(`     ${result.violations.length} pelanggaran:`);
  for (const violation of result.violations.slice(0, 10)) {
    console.log(`       • ${violation.subject}`);
    console.log(`         diharapkan ${violation.expected}, ternyata ${violation.actual}`);
    if (violation.detail) console.log(`${DIM}         ${violation.detail}${RESET}`);
  }
  const rest = result.violations.length - 10;
  if (rest > 0) console.log(`${DIM}       … ${rest} lainnya${RESET}`);
}

async function main(): Promise<void> {
  const target = process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ":***@") ?? "(tidak diset)";
  console.log(`Memeriksa invarian terhadap ${target}\n`);

  const results = await runAllInvariants();
  for (const result of results) {
    reportOne(result);
    console.log("");
  }

  const failed = results.filter((result) => result.violations.length > 0);
  const totalChecked = results.reduce((sum, result) => sum + result.checked, 0);

  if (failed.length > 0) {
    console.log(
      `${FAIL} ${failed.length} dari ${results.length} invarian dilanggar (${totalChecked} baris diperiksa).`,
    );
    process.exitCode = 1;
    return;
  }

  if (totalChecked === 0) {
    console.log(
      `${FAIL} Keenam invarian lulus tetapi nol baris diperiksa — database ini kosong, jadi belum membuktikan apa pun.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`${PASS} Keenam invarian terpenuhi (${totalChecked} baris diperiksa).`);
}

await main();
await pool.end();
