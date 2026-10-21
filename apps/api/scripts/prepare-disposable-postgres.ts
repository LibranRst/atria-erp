import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { disposablePostgresTarget } from "./disposable-postgres-guard";

const journalSchema = z.object({
  entries: z.array(z.object({ tag: z.string().regex(/^\d+_[a-z0-9_]+$/), when: z.number().int() })),
});

/** Creates synthetic seeded/empty templates only on an explicitly empty local database. */
export async function prepareDisposablePostgres(
  databaseUrl: string | undefined,
  emptyTemplate: string,
): Promise<void> {
  const target = disposablePostgresTarget(databaseUrl, process.env.NODE_ENV);
  if (!/^atria_audit_[a-z0-9_]+$/.test(emptyTemplate) || `/${emptyTemplate}` === target.pathname) {
    throw new Error("The empty template must be a separate atria_audit_* database.");
  }
  const pool = new Pool({ connectionString: target.href });
  let sourceClosed = false;
  const directory = path.resolve(import.meta.dir, "../drizzle");
  try {
    const existing = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') AND schemaname NOT LIKE 'pg_toast%'",
    );
    if (existing.rows[0]?.count !== 0) {
      throw new Error("Target is not fresh. Preparation never resets an existing database.");
    }
    const journal = journalSchema.parse(
      JSON.parse(await readFile(path.join(directory, "meta/_journal.json"), "utf8")),
    );
    await pool.query("CREATE SCHEMA drizzle");
    await pool.query(
      "CREATE TABLE drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)",
    );
    for (const entry of journal.entries) {
      const sql = await readFile(path.join(directory, `${entry.tag}.sql`), "utf8");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const statement of sql
          .split("--> statement-breakpoint")
          .map((part): string => part.trim())
          .filter(Boolean)) {
          await client.query(statement);
        }
        await client.query(
          "INSERT INTO drizzle.__drizzle_migrations(hash, created_at) VALUES ($1, $2)",
          [createHash("sha256").update(sql).digest("hex"), entry.when],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
    // All tables above were just created by this operator. Remove migration seed
    // rows for the connected synthetic seed; retain the tenant scaffold and journal.
    const tables = await pool.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'tenant'",
    );
    const quotedTables = tables.rows.map(
      (row): string => `"${row.tablename.replaceAll('"', '""')}"`,
    );
    if (quotedTables.length > 0)
      await pool.query(`TRUNCATE ${quotedTables.join(", ")} RESTART IDENTITY CASCADE`);
    await pool.end();
    sourceClosed = true;

    // CREATE DATABASE cannot run in a transaction and the source must have no connections.
    const adminUrl = new URL(target);
    adminUrl.pathname = "/postgres";
    const admin = new Pool({ connectionString: adminUrl.href });
    try {
      await admin.query(
        `CREATE DATABASE "${emptyTemplate}" TEMPLATE "${target.pathname.slice(1)}"`,
      );
    } finally {
      await admin.end();
    }

    process.env.ATRIA_LOCAL_TEST_DATABASE_URL = target.href;
    process.env.ATRIA_LOCAL_TEST_MODE = "seeded";
    // This proven local TCP adapter is test/operator-only; application runtime
    // retains the Neon driver. Import before the seeder can load backend/db.
    await import("./local-postgres-preload");
    const { seedDemoDatabase } = await import("../src/backend/db/seed");
    const { pool: backendPool } = await import("../src/backend/db");
    const originalLog = console.log;
    console.log = (): void => undefined; // Seeder prints synthetic login passwords.
    try {
      await seedDemoDatabase();
    } finally {
      console.log = originalLog;
      await backendPool.end();
    }
    console.info(`Prepared synthetic templates: ${target.pathname.slice(1)} and ${emptyTemplate}`);
  } finally {
    if (!sourceClosed) await pool.end();
  }
}

if (import.meta.main) {
  const emptyTemplate = process.argv[2] ?? "atria_audit_empty";
  await prepareDisposablePostgres(process.env.ATRIA_LOCAL_TEST_DATABASE_URL, emptyTemplate);
}
