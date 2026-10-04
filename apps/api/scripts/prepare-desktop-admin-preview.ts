/**
 * Prepare only a separately created Neon preview clone; never the source UAT.
 * Bun loads DATABASE_URL from the caller's explicit verification env file.
 * --expected-host must name that clone. Historical inherited drift is reported,
 * never repaired. Only reviewed 0041 and 0042 can be applied transactionally.
 */
import { Pool } from "@neondatabase/serverless";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import {
  DESKTOP_MIGRATION_TAG,
  MigrationGuardError,
  type AppliedMigration,
  type HashedMigration,
} from "./apply-desktop-admin-migration";

const RAB_MIGRATION_TAG = "0041_rab_item_nature";
const ORIGINAL_UAT_HOST = "ep-square-mountain-aomb85pp.c-2.ap-southeast-1.aws.neon.tech";
const ROLE_IDS = ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"];
const journalSchema = z.object({
  entries: z.array(z.object({ tag: z.string(), when: z.number().int() })),
});
const hostIdentity = (host: string): string => host.toLowerCase().replace("-pooler.", ".");

export function assertPreviewHost(
  actual: string,
  expected: string,
  forbidden: readonly string[],
): void {
  if (actual !== expected || !actual.endsWith(".neon.tech")) {
    throw new MigrationGuardError(
      "Expected clone hostname must exactly match the configured Neon host.",
    );
  }
  if (
    [ORIGINAL_UAT_HOST, ...forbidden].some((host) => hostIdentity(host) === hostIdentity(actual))
  ) {
    throw new MigrationGuardError("Original UAT/production hostname is forbidden.");
  }
}

export function previewMigrationPlan(
  journal: readonly HashedMigration[],
  applied: readonly AppliedMigration[],
): {
  readonly pending: readonly HashedMigration[];
  readonly inheritedDrift: readonly string[];
} {
  if (applied.length === 0)
    throw new MigrationGuardError("Clone migration history must already exist.");
  const appliedTags = new Set<string>();
  const drift: string[] = [];
  for (const row of applied) {
    const migration = journal.find(
      (entry) => row.created_at !== null && entry.when === Number(row.created_at),
    );
    if (!migration || appliedTags.has(migration.tag)) {
      throw new MigrationGuardError("Clone has unknown or duplicate migration history.");
    }
    appliedTags.add(migration.tag);
    if (row.hash !== migration.hash) {
      if ([RAB_MIGRATION_TAG, DESKTOP_MIGRATION_TAG].includes(migration.tag)) {
        throw new MigrationGuardError("Preview migration hash does not match its reviewed file.");
      }
      drift.push(migration.tag);
    }
  }
  const pending = journal.filter((entry) => !appliedTags.has(entry.tag));
  if (pending.some((entry) => ![RAB_MIGRATION_TAG, DESKTOP_MIGRATION_TAG].includes(entry.tag))) {
    throw new MigrationGuardError("Clone is missing a predecessor outside reviewed 0041/0042.");
  }
  return { pending, inheritedDrift: drift };
}

function sourceHosts(): readonly string[] {
  const hosts: string[] = [];
  for (const filename of ["../.env", "../.env.bak-before-dev-branch"]) {
    const file = new URL(filename, import.meta.url);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = /^\s*(?:#\s*)?(?:PRODUCTION_)?DATABASE_URL\s*=\s*(.+)$/.exec(line);
      if (!match?.[1]) continue;
      try {
        hosts.push(new URL(match[1].trim().replace(/^["']|["']$/g, "")).hostname);
      } catch {
        /* Ignore malformed comments. */
      }
    }
  }
  return hosts;
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
  const args = process.argv.slice(2);
  const expected = args[args.indexOf("--expected-host") + 1];
  if (
    !args.includes("--expected-host") ||
    !expected ||
    expected.startsWith("--") ||
    args.length !== 2
  ) {
    throw new MigrationGuardError("Only --expected-host <exact-clone-hostname> is accepted.");
  }
  if (process.env.NODE_ENV === "production")
    throw new MigrationGuardError("Production mode is forbidden.");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new MigrationGuardError("DATABASE_URL is required.");
  const configured = new URL(connectionString);
  assertPreviewHost(configured.hostname, expected, sourceHosts());
  const journal = loadJournal();
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  let transaction = false;
  try {
    const table = await client.query<{ present: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='drizzle' AND table_name='__drizzle_migrations') AS present",
    );
    if (!table.rows[0]?.present)
      throw new MigrationGuardError("Clone migration tracking table is absent.");
    await client.query("BEGIN");
    transaction = true;
    await client.query("LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE");
    const history = await client.query<AppliedMigration>(
      "SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at, id",
    );
    const plan = previewMigrationPlan(journal, history.rows);
    const appliedNames: string[] = [];
    for (const entry of plan.pending) {
      if (entry.tag === RAB_MIGRATION_TAG) {
        const column = await client.query<{
          data_type: string;
          is_nullable: string;
          character_maximum_length: number;
          column_default: string;
        }>(
          "SELECT data_type, is_nullable, character_maximum_length, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='rab_estimate_item' AND column_name='item_nature'",
        );
        const index = await client.query<{ indexdef: string }>(
          "SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='rab_estimate_item' AND indexname='rei_item_nature_idx'",
        );
        const field = column.rows[0];
        if (Boolean(field) !== Boolean(index.rows[0]))
          throw new MigrationGuardError("0041 schema is only partially present; refused.");
        if (field) {
          if (
            field.data_type !== "character varying" ||
            field.character_maximum_length !== 50 ||
            field.is_nullable !== "NO" ||
            !field.column_default.includes("PRODUCTION") ||
            !index.rows[0]?.indexdef.includes("USING btree (item_nature)")
          ) {
            throw new MigrationGuardError(
              "Existing 0041 column/index do not match the reviewed schema.",
            );
          }
        } else {
          for (const statement of entry.sql
            .split("--> statement-breakpoint")
            .filter((value) => value.trim()))
            await client.query(statement);
        }
      } else {
        const roles = await client.query<{ id: string }>(
          "SELECT id FROM role WHERE id=ANY($1::uuid[]) FOR UPDATE",
          [ROLE_IDS],
        );
        if (roles.rows.length !== ROLE_IDS.length)
          throw new MigrationGuardError("Both default roles must already exist.");
        await client.query(entry.sql);
      }
      await client.query(
        "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1,$2)",
        [entry.hash, entry.when],
      );
      appliedNames.push(entry.tag);
    }
    const grants = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM role_permission WHERE role_id=ANY($1::uuid[]) AND permission_key=$2",
      [ROLE_IDS, "use:desktop_admin"],
    );
    await client.query("COMMIT");
    transaction = false;
    console.log(
      JSON.stringify({
        appliedMigrations: appliedNames,
        inheritedDrift: plan.inheritedDrift,
        defaultDesktopGrants: grants.rows[0]?.count ?? 0,
      }),
    );
  } finally {
    if (transaction) await client.query("ROLLBACK");
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
        : "Preview preparation failed; transaction not committed.",
    );
    process.exitCode = 1;
  }
}
