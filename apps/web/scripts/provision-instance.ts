/**
 * Menyiapkan satu instance Atria untuk satu perusahaan.
 *
 *   DATABASE_URL="<database kosong>" bun run db:provision \
 *     --name "PT Vendor Interior" --slug vendor-interior
 *
 * Satu instance melayani satu perusahaan: datanya di databasenya sendiri,
 * terpisah secara fisik dari perusahaan lain. Tidak ada baris milik dua
 * perusahaan yang pernah bertemu, jadi isolasinya dijamin batas database — bukan
 * oleh ingatan menulis `WHERE tenant_id` di 865 tempat.
 *
 * Skrip ini menolak database yang sudah berisi data. Menimpa instance pelanggan
 * yang sudah berjalan adalah kesalahan yang tidak boleh mungkin terjadi karena
 * salah menyalin connection string.
 */
import { Pool } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DEKORIA_TENANT_ID } from "@/db/schema/tenant-constants";

const PASS = "[32m✓[0m";
const FAIL = "[31m✗[0m";
const DIM = "[2m";
const RESET = "[0m";

function arg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

function fail(message: string): never {
  console.error(`${FAIL} ${message}`);
  process.exit(1);
}

const companyName = arg("--name");
const slug = arg("--slug");
const connectionString = process.env.DATABASE_URL;

if (!companyName || !slug) {
  fail(
    'Wajib: --name "Nama Perusahaan" --slug nama-perusahaan\n' +
      '  Contoh: DATABASE_URL=… bun run db:provision --name "PT Vendor" --slug vendor',
  );
}
if (!/^[a-z0-9-]{2,60}$/.test(slug)) {
  fail("--slug hanya boleh huruf kecil, angka, dan tanda hubung (2–60 karakter).");
}
if (!connectionString) fail("DATABASE_URL wajib diisi dan menunjuk database kosong.");

const pool = new Pool({ connectionString });
const target = connectionString.replace(/:[^:@/]+@/, ":***@");
console.log(`Menyiapkan instance untuk "${companyName}"`);
console.log(`${DIM}  ${target}${RESET}\n`);

// --- 1. Tolak database yang sudah berisi -------------------------------------
const existing = await pool.query<{ n: number }>(
  `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`,
);
if (existing.rows[0].n > 0) {
  const rows = await pool.query<{ n: number }>(
    `SELECT COALESCE(sum(n_live_tup),0)::int AS n FROM pg_stat_user_tables`,
  );
  if (rows.rows[0].n > 0) {
    await pool.end();
    fail(
      `Database ini sudah berisi ${rows.rows[0].n} baris data.\n` +
        "  Provisioning dibatalkan — instance yang sudah berjalan tidak boleh ditimpa.",
    );
  }
}

// --- 2. Jalankan seluruh migrasi ---------------------------------------------
const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
  entries: ReadonlyArray<{ tag: string; when: number }>;
};

await pool.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
await pool.query(
  `CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
     id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
);
const applied = new Set(
  (await pool.query<{ hash: string }>(`SELECT hash FROM drizzle.__drizzle_migrations`)).rows.map(
    (row) => row.hash,
  ),
);

let count = 0;
for (const entry of journal.entries) {
  const sql = readFileSync(`drizzle/${entry.tag}.sql`, "utf8");
  const hash = createHash("sha256").update(sql).digest("hex");
  if (applied.has(hash)) continue;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const statement of sql
      .split("--> statement-breakpoint")
      .map((part) => part.trim())
      .filter(Boolean)) {
      await client.query(statement);
    }
    await client.query(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1,$2)`,
      [hash, entry.when],
    );
    await client.query("COMMIT");
    count += 1;
  } catch (error) {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
    fail(`Migrasi ${entry.tag} gagal: ${(error as Error).message}`);
  }
  client.release();
}
console.log(`${PASS} ${count} migrasi diterapkan`);

// --- 3. Beri nama perusahaannya ----------------------------------------------
await pool.query(
  `UPDATE "tenant" SET "name" = $1, "slug" = $2, "updated_at" = now() WHERE "id" = $3`,
  [companyName, slug, DEKORIA_TENANT_ID],
);
console.log(`${PASS} Instance dinamai "${companyName}"`);

// --- 4. Buktikan hasilnya bisa dipakai memulai -------------------------------
const checks: Array<{ label: string; ok: boolean; detail: string }> = [];

const tables = await pool.query<{ n: number }>(
  `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`,
);
checks.push({
  label: "Tabel terbentuk",
  ok: tables.rows[0].n >= 60,
  detail: `${tables.rows[0].n}`,
});

const roles = await pool.query<{ name: string; data_scope: string }>(
  `SELECT name, data_scope FROM "role" ORDER BY id`,
);
const ownerScope = roles.rows.find((row) => row.name === "owner")?.data_scope;
checks.push({
  label: "Peran sistem punya cakupan",
  ok: roles.rows.length === 4 && ownerScope === "GLOBAL",
  detail: `${roles.rows.length} peran, owner=${ownerScope ?? "tidak ada"}`,
});

const users = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM "user"`);
checks.push({
  label: "Belum ada pengguna",
  ok: users.rows[0].n === 0,
  detail: `${users.rows[0].n}`,
});

// Uji sebenarnya: apakah baris pertama bisa ditulis sama sekali?
let insertOk = false;
let insertDetail = "";
const probe = await pool.connect();
try {
  await probe.query("BEGIN");
  await probe.query(
    `INSERT INTO inventory_location (name, description) VALUES ('__probe__','uji provisioning')`,
  );
  await probe.query("ROLLBACK");
  insertOk = true;
  insertDetail = "berhasil, di-rollback";
} catch (error) {
  await probe.query("ROLLBACK");
  insertDetail = (error as Error).message;
}
probe.release();
checks.push({ label: "Baris pertama bisa ditulis", ok: insertOk, detail: insertDetail });

console.log("");
for (const check of checks) {
  console.log(`${check.ok ? PASS : FAIL} ${check.label}${DIM} — ${check.detail}${RESET}`);
}

await pool.end();

if (checks.some((check) => !check.ok)) {
  console.log(`\n${FAIL} Instance BELUM siap. Jangan serahkan ke pelanggan.`);
  process.exit(1);
}

console.log(`\n${PASS} Instance siap.`);
console.log(`
Langkah berikutnya:
  1. Deploy aplikasi dengan DATABASE_URL di atas, BETTER_AUTH_SECRET dan
     ATRIA_BOOTSTRAP_SECRET yang BARU (jangan dipakai ulang antar pelanggan),
     serta NEXT_PUBLIC_APP_URL milik mereka sendiri.
  2. Buka /setup untuk membuat Owner pertama milik mereka.
  3. Ikuti onboarding enam langkah di docs/guide/financial_workflow_guide.md.
  4. Jalankan 'bun run db:check-invariants' setelah data pertama masuk.

Selengkapnya: docs/guide/provision-instance.md`);
