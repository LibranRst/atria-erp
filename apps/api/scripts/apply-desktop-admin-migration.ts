/**
 * Guarded, reviewed desktop migration path for an existing instance. Run from apps/api:
 *   bun scripts/apply-desktop-admin-migration.ts --expected-host <verified-host> --database-name atria_uat_guard
 * Add --include-rab-item-nature only for the reviewed additive 0041 predecessor.
 * Default is read-only. Never prints the connection string or credentials.
 */
import { Pool } from "@neondatabase/serverless";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";

export const DESKTOP_MIGRATION_TAG = "0042_grant_desktop_admin";
const RAB_MIGRATION_TAG = "0041_rab_item_nature";
const ROLE_IDS = ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"];
const journalSchema = z.object({
  entries: z.array(z.object({ tag: z.string(), when: z.number().int() })),
});

export type HashedMigration = {
  readonly tag: string;
  readonly when: number;
  readonly hash: string;
  readonly sql: string;
};
export type AppliedMigration = {
  readonly hash: string;
  readonly created_at: string | number | null;
};

export class MigrationGuardError extends Error {}

/** Exact journal identity is required; never repair or guess migration history. */
export function pendingDesktopMigration(
  journal: readonly HashedMigration[],
  applied: readonly AppliedMigration[],
): HashedMigration | null {
  return pendingDesktopMigrations(journal, applied, false)[0] ?? null;
}

export function pendingDesktopMigrations(
  journal: readonly HashedMigration[],
  applied: readonly AppliedMigration[],
  includeRab: boolean,
): readonly HashedMigration[] {
  if (applied.length === 0) throw new MigrationGuardError("Migration history is empty; refused.");
  const target = journal.find((entry) => entry.tag === DESKTOP_MIGRATION_TAG);
  if (!target) throw new MigrationGuardError("Desktop migration is absent from the journal.");
  const seen = new Set<string>();
  for (const record of applied) {
    const expected = journal.find((entry) => entry.hash === record.hash);
    if (!expected || record.created_at === null || Number(record.created_at) !== expected.when) {
      throw new MigrationGuardError(
        "Migration history does not exactly match the repository; refused.",
      );
    }
    if (seen.has(record.hash))
      throw new MigrationGuardError("Migration history is duplicated; refused.");
    seen.add(record.hash);
  }
  const pending = journal.filter((entry) => !seen.has(entry.hash));
  if (
    pending.some(
      (entry) =>
        entry.tag !== DESKTOP_MIGRATION_TAG && !(includeRab && entry.tag === RAB_MIGRATION_TAG),
    )
  ) {
    throw new MigrationGuardError(
      `Other migrations are pending: ${pending.map((entry) => entry.tag).join(", ")}`,
    );
  }
  return pending;
}

function loadJournal(): readonly HashedMigration[] {
  const directory = new URL("../drizzle/", import.meta.url);
  const journal = journalSchema.parse(
    JSON.parse(readFileSync(new URL("meta/_journal.json", directory), "utf8")),
  );
  return journal.entries.map((entry) => {
    const sql = readFileSync(new URL(`${entry.tag}.sql`, directory), "utf8");
    return { ...entry, sql, hash: createHash("sha256").update(sql).digest("hex") };
  });
}

async function main(): Promise<void> {
  const argumentsList = process.argv.slice(2);
  const nameIndex = argumentsList.indexOf("--database-name");
  const expectedDatabase = nameIndex >= 0 ? argumentsList[nameIndex + 1] : undefined;
  const hostIndex = argumentsList.indexOf("--expected-host");
  const expectedHost = hostIndex >= 0 ? argumentsList[hostIndex + 1] : undefined;
  if (!expectedDatabase || expectedDatabase.startsWith("--")) {
    throw new MigrationGuardError("An explicit --database-name is required.");
  }
  if (!expectedHost || expectedHost.startsWith("--"))
    throw new MigrationGuardError("An explicit --expected-host is required.");
  const allowedArguments = new Set([
    "--database-name",
    expectedDatabase,
    "--expected-host",
    expectedHost,
    "--include-rab-item-nature",
    "--apply",
    "--dry-run",
  ]);
  if (argumentsList.some((argument) => !allowedArguments.has(argument))) {
    throw new MigrationGuardError("Unknown migration argument; refused.");
  }
  if (argumentsList.includes("--apply") && argumentsList.includes("--dry-run")) {
    throw new MigrationGuardError("Choose --apply or --dry-run, not both.");
  }
  if (process.env.NODE_ENV === "production") {
    throw new MigrationGuardError(
      "This tool refuses production mode; use the deployment migration workflow.",
    );
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new MigrationGuardError("DATABASE_URL is required.");
  const configured = new URL(connectionString);
  if (
    configured.hostname !== expectedHost ||
    expectedDatabase !== "atria_uat_guard" ||
    ![
      "ep-square-mountain-aomb85pp-pooler.c-2.ap-southeast-1.aws.neon.tech",
      "ep-green-truth-aown0bbp-pooler.c-2.ap-southeast-1.aws.neon.tech",
    ].includes(expectedHost)
  )
    throw new MigrationGuardError(
      "Only the explicitly verified development/preview target is permitted.",
    );
  if (decodeURIComponent(configured.pathname.slice(1)) !== expectedDatabase) {
    throw new MigrationGuardError(
      "Configured database name differs from the explicitly selected target.",
    );
  }
  const journal = loadJournal();
  const apply = argumentsList.includes("--apply");
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    const actual = await client.query<{ name: string }>("SELECT current_database() AS name");
    if (actual.rows[0]?.name !== expectedDatabase) {
      throw new MigrationGuardError(
        "Connected database differs from the explicitly selected target.",
      );
    }
    const tracking = await client.query<{ present: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations') AS present",
    );
    if (!tracking.rows[0]?.present)
      throw new MigrationGuardError("Migration tracking table is absent; refused.");
    if (apply) {
      await client.query("BEGIN");
      transactionStarted = true;
      await client.query("LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE");
    }
    const history = await client.query<AppliedMigration>(
      "SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at, id",
    );
    const pending = pendingDesktopMigrations(
      journal,
      history.rows,
      argumentsList.includes("--include-rab-item-nature"),
    );
    const roles = await client.query<{ id: string }>(
      `SELECT id FROM role WHERE id = ANY($1::uuid[])${apply ? " FOR UPDATE" : ""}`,
      [ROLE_IDS],
    );
    if (roles.rows.length !== ROLE_IDS.length) {
      throw new MigrationGuardError("Both default target roles must already exist; refused.");
    }
    const grantsBefore = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM role_permission WHERE role_id = ANY($1::uuid[]) AND permission_key = $2",
      [ROLE_IDS, "use:desktop_admin"],
    );
    for (const entry of pending) {
      if (entry.tag === RAB_MIGRATION_TAG) {
        const column = await client.query<{
          data_type: string;
          is_nullable: string;
          character_maximum_length: number;
          column_default: string | null;
        }>(
          "SELECT data_type,is_nullable,character_maximum_length,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='rab_estimate_item' AND column_name='item_nature'",
        );
        const index = await client.query<{ indexdef: string }>(
          "SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='rab_estimate_item' AND indexname='rei_item_nature_idx'",
        );
        const field = column.rows[0];
        if (Boolean(field) !== Boolean(index.rows[0]))
          throw new MigrationGuardError("0041 column/index only partially present; refused.");
        if (
          field &&
          (field.data_type !== "character varying" ||
            field.character_maximum_length !== 50 ||
            field.is_nullable !== "NO" ||
            !field.column_default?.includes("PRODUCTION") ||
            !index.rows[0]?.indexdef.includes("USING btree (item_nature)"))
        )
          throw new MigrationGuardError(
            "0041 existing schema differs from the reviewed migration.",
          );
        if (apply && !field)
          for (const statement of entry.sql
            .split("--> statement-breakpoint")
            .filter((value) => value.trim()))
            await client.query(statement);
      } else if (apply) {
        // Execute the reviewed grants verbatim; no other migration is permitted.
        await client.query(entry.sql);
      }
      if (apply)
        await client.query(
          "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
          [entry.hash, entry.when],
        );
    }
    const grantsAfter = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM role_permission WHERE role_id = ANY($1::uuid[]) AND permission_key = $2",
      [ROLE_IDS, "use:desktop_admin"],
    );
    if (
      apply &&
      pending.some((entry) => entry.tag === DESKTOP_MIGRATION_TAG) &&
      grantsAfter.rows[0]?.count !== ROLE_IDS.length
    ) {
      throw new MigrationGuardError("Expected grants were not created; rolling back.");
    }
    if (transactionStarted) {
      await client.query("COMMIT");
      transactionStarted = false;
    }
    console.log(
      JSON.stringify({
        status: apply ? (pending.length > 0 ? "applied" : "already-applied") : "dry-run",
        pendingMigrations: pending.map((entry) => entry.tag),
        grantsBefore: grantsBefore.rows[0]?.count ?? 0,
        grantsAfter: grantsAfter.rows[0]?.count ?? 0,
      }),
    );
  } finally {
    if (transactionStarted) await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch (error: unknown) {
    console.error(
      error instanceof MigrationGuardError
        ? error.message
        : "Migration failed; no grant transaction committed.",
    );
    process.exitCode = 1;
  }
}
