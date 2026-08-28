import { Pool } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const p = new Pool({ connectionString: process.env.PROBE_URL });
const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));

await p.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
await p.query(`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`);

const done = new Set(
  (await p.query(`SELECT hash FROM drizzle.__drizzle_migrations`)).rows.map((r) => r.hash),
);

for (const entry of journal.entries) {
  const sql = readFileSync(`drizzle/${entry.tag}.sql`, "utf8");
  const hash = createHash("sha256").update(sql).digest("hex");
  if (done.has(hash)) continue;

  const statements = sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    for (const statement of statements) await client.query(statement);
    await client.query(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1,$2)`,
      [hash, entry.when],
    );
    await client.query("COMMIT");
    process.stdout.write(".");
  } catch (e) {
    await client.query("ROLLBACK");
    console.log(`\n\n✗ GAGAL di ${entry.tag}`);
    console.log(`  ${(e as Error).message}`);
    const detail = (e as { detail?: string }).detail;
    if (detail) console.log(`  detail: ${detail}`);
    client.release();
    await p.end();
    process.exit(1);
  }
  client.release();
}
console.log("\n\n✓ Seluruh migrasi terpasang.");
await p.end();
