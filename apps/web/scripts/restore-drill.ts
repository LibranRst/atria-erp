/**
 * Latihan pemulihan database.
 *
 * Backup yang belum pernah diuji restore bukan backup — ia perasaan. Skrip ini
 * mengubah perasaan itu menjadi lulus/gagal.
 *
 *   bun run db:restore-drill mark     # di database asli, sebelum restore
 *   bun run db:restore-drill verify   # di branch hasil restore
 *   bun run db:restore-drill clean    # di database asli, setelah selesai
 *
 * Prosedur lengkapnya ada di `docs/guide/restore-drill.md`.
 *
 * Penanda sengaja memakai tabel sekali pakai `restore_drill_marker`, bukan baris
 * pada tabel bisnis: latihan ini tidak boleh menyentuh buku besar yang
 * append-only, dan tabel yang bisa dibuang membuat pembersihannya sepele.
 *
 * DDL di sini ditulis sebagai SQL langsung karena tabel penanda memang bukan
 * bagian dari schema aplikasi — ia tidak boleh muncul di `db/schema/` maupun di
 * migrasi mana pun.
 */
import { Pool } from "@neondatabase/serverless";
import { pool } from "@/db";
import { runAllInvariants } from "@/lib/finance/ledger-invariants";

/**
 * Penanda ditulis ke database terpisah bila `MARKER_DATABASE_URL` diisi.
 *
 * Branch Neon mencakup seluruh database sekaligus, jadi penanda tidak perlu
 * berada di database yang menyimpan data bisnis: taruh ia di `neondb` yang
 * menganggur, dan `atria_uat_guard` tidak menerima satu pun tulisan selama
 * latihan. Uji perjalanan waktu tetap sah karena keduanya dipulihkan bersama.
 */
function markerPool(): Pool {
  const url = process.env.MARKER_DATABASE_URL;
  return url ? new Pool({ connectionString: url }) : pool;
}

const PASS = "[32m✓[0m";
const FAIL = "[31m✗[0m";
const DIM = "[2m";
const RESET = "[0m";

const MARKER_TABLE = "restore_drill_marker";

function maskedMarkerTarget(): string {
  const url = process.env.MARKER_DATABASE_URL ?? process.env.DATABASE_URL;
  return url?.replace(/:[^:@/]+@/, ":***@") ?? "(tidak diset)";
}

function maskedTarget(): string {
  return process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ":***@") ?? "(DATABASE_URL tidak diset)";
}

async function mark(): Promise<void> {
  const markerDb = markerPool();
  await markerDb.query(
    `CREATE TABLE IF NOT EXISTS ${MARKER_TABLE} (
       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       created_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
  const { rows } = await markerDb.query(
    `INSERT INTO ${MARKER_TABLE} DEFAULT VALUES RETURNING id, created_at`,
  );
  const marker = rows[0];

  if (markerDb !== pool) await markerDb.end();

  console.log(`Penanda ditulis ke ${maskedMarkerTarget()}\n`);
  console.log(`  ID penanda : ${marker.id}`);
  console.log(`  Waktu tulis: ${marker.created_at.toISOString()}`);
  console.log(`\nCatat waktu di atas. Restore harus diarahkan ke titik`);
  console.log(`**sebelum** waktu itu, supaya ketiadaan penanda membuktikan`);
  console.log(`pemulihannya benar-benar mundur — bukan sekadar menyalin keadaan sekarang.`);
  console.log(`\nLangkah berikutnya ada di docs/guide/restore-drill.md.`);
}

async function verify(): Promise<void> {
  console.log(`Memverifikasi branch hasil restore: ${maskedTarget()}\n`);

  const markerDb = markerPool();
  const { rows } = await markerDb.query(
    `SELECT to_regclass('public.${MARKER_TABLE}') IS NOT NULL AS present`,
  );
  const markerPresent = Boolean(rows[0]?.present);

  let failed = false;

  if (markerPresent) {
    const count = await markerDb.query(`SELECT count(*)::int AS n FROM ${MARKER_TABLE}`);
    console.log(`${FAIL} Uji perjalanan waktu`);
    console.log(
      `     Tabel penanda masih ada dengan ${count.rows[0].n} baris. Restore tidak mundur`,
    );
    console.log(`     melewati titik penandaan — kemungkinan besar yang dipulihkan adalah`);
    console.log(`     keadaan sekarang, bukan keadaan lampau.`);
    failed = true;
  } else {
    console.log(`${PASS} Uji perjalanan waktu`);
    console.log(
      `${DIM}     Tabel penanda tidak ada — branch ini benar-benar dari sebelum penandaan.${RESET}`,
    );
  }

  if (markerDb !== pool) await markerDb.end();
  console.log("");

  const results = await runAllInvariants();
  const broken = results.filter((result) => result.violations.length > 0);
  const totalChecked = results.reduce((sum, result) => sum + result.checked, 0);

  if (broken.length > 0) {
    console.log(`${FAIL} Uji keutuhan data`);
    for (const result of broken) {
      console.log(`     ${result.id} dilanggar: ${result.violations.length} pelanggaran`);
      console.log(`       ${result.consequence}`);
    }
    failed = true;
  } else if (totalChecked === 0) {
    console.log(`${FAIL} Uji keutuhan data`);
    console.log(`     Nol baris diperiksa. Branch ini kosong — restore mengembalikan`);
    console.log(`     database yang belum berisi apa pun, jadi belum membuktikan apa pun.`);
    failed = true;
  } else {
    console.log(`${PASS} Uji keutuhan data`);
    console.log(
      `${DIM}     Keenam invarian terpenuhi atas ${totalChecked} baris hasil pemulihan.${RESET}`,
    );
  }

  console.log("");
  if (failed) {
    console.log(`${FAIL} Latihan pemulihan GAGAL. Jangan anggap backup ini bisa diandalkan.`);
    process.exitCode = 1;
    return;
  }
  console.log(`${PASS} Latihan pemulihan LULUS.`);
  console.log(`   Data bisa dikembalikan ke titik waktu tertentu, dan yang kembali utuh.`);
  console.log(`\n   Catat tanggal hari ini di docs/plans/2026-08-27-tenant-foundation.md,`);
  console.log(`   lalu jalankan 'bun run db:restore-drill clean' di database asli.`);
}

async function clean(): Promise<void> {
  const markerDb = markerPool();
  await markerDb.query(`DROP TABLE IF EXISTS ${MARKER_TABLE}`);
  if (markerDb !== pool) await markerDb.end();
  console.log(`${PASS} Tabel penanda dihapus dari ${maskedMarkerTarget()}`);
  console.log(`${DIM}   Branch hasil latihan hapus sendiri lewat console Neon.${RESET}`);
}

const command = process.argv[2];

if (command === "mark") await mark();
else if (command === "verify") await verify();
else if (command === "clean") await clean();
else {
  console.log("Perintah tidak dikenal.\n");
  console.log("  bun run db:restore-drill mark     # di database asli, sebelum restore");
  console.log("  bun run db:restore-drill verify   # di branch hasil restore");
  console.log("  bun run db:restore-drill clean    # di database asli, setelah selesai");
  console.log("\nProsedur lengkap: docs/guide/restore-drill.md");
  process.exitCode = 1;
}

await pool.end();
