/**
 * Deliberate, narrowly reviewed adoption of three existing migration baselines.
 * Default is read-only; --apply changes tracking metadata only after exact SQL
 * evidence and live schema postconditions pass inside the same locked transaction.
 */
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  MigrationGuardError,
  type AppliedMigration,
  type HashedMigration,
} from "./apply-desktop-admin-migration";

const DEVELOPMENT_HOST = "ep-square-mountain-aomb85pp-pooler.c-2.ap-southeast-1.aws.neon.tech";
const PREVIEW_HOST = "ep-green-truth-aown0bbp-pooler.c-2.ap-southeast-1.aws.neon.tech";
const BASELINE_TAGS = [
  "0033_add_role_permission",
  "0035_tenant_foundation",
  "0039_notification_sse_cursor",
] as const;
type BaselineTag = (typeof BASELINE_TAGS)[number];
// Filled with the exact source/clone tracking hashes observed during the audit.
export const REVIEWED_BASELINE_HASHES: Record<
  BaselineTag,
  { readonly previous: string; readonly current: string }
> = {
  "0033_add_role_permission": {
    previous: "80764ff19a90d51058839c119fe36109b0f5d9f44b1f2e5a67c7b23ecbfdb330",
    current: "b189c9adcee59ef7acf40ec586bc0fb2491cfd99f4d88b6dacb309c293c89ad6",
  },
  "0035_tenant_foundation": {
    previous: "874042ccc95bd3876efad4390a6c8251983d884fbe24e48874ce470e5537ab1d",
    current: "4ee2deb70a777f1b851c7b1cfb1684e884b360ed24225d1b5f62a825f9f9af7a",
  },
  "0039_notification_sse_cursor": {
    previous: "058e1b8daf62cbb5d496a293dd14c9c055dbac9bcc57d3fd6220d7f5386e31b1",
    current: "6485401082c664f574b63107f48095f26d2e7ecb3d7bd0084744fdc7ae936a83",
  },
};
const schema = z.object({
  entries: z.array(z.object({ tag: z.string(), when: z.number().int() })),
});
const hash = (sql: string): string => createHash("sha256").update(sql).digest("hex");
const normalizeSql = (sql: string): string =>
  sql
    .toLowerCase()
    .replaceAll('"', "")
    .replaceAll("public.", "")
    .replace(/on (?:delete|update) no action/g, "")
    .replace(/\s+/g, "")
    .replace(/;$/, "");
const sqlTokens = (sql: string): readonly string[] =>
  sql
    .replace(/--[^\n]*/g, "")
    .match(/'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9$]*|\d+|[^\s]/g) ?? [];

type TrackingRow = AppliedMigration & { readonly id: number };
export type BaselineChange = {
  readonly id: number;
  readonly tag: BaselineTag;
  readonly previous: string;
  readonly current: string;
};
export function baselineChanges(
  journal: readonly HashedMigration[],
  history: readonly TrackingRow[],
): readonly BaselineChange[] {
  const changes: BaselineChange[] = [];
  for (const tag of BASELINE_TAGS) {
    const entry = journal.find((row) => row.tag === tag);
    const reviewed = REVIEWED_BASELINE_HASHES[tag];
    if (!entry || entry.hash !== reviewed.current)
      throw new MigrationGuardError(`Reviewed SQL changed: ${tag}`);
    const rows = history.filter(
      (row) => row.created_at !== null && Number(row.created_at) === entry.when,
    );
    if (rows.length !== 1)
      throw new MigrationGuardError(`Missing/duplicate tracking identity: ${tag}`);
    const row = rows[0];
    if (!row || (row.hash !== reviewed.previous && row.hash !== reviewed.current))
      throw new MigrationGuardError(`Unrecognized tracking hash: ${tag}`);
    if (row.hash === reviewed.previous)
      changes.push({ id: row.id, tag, previous: row.hash, current: entry.hash });
  }
  for (const row of history) {
    const entry = journal.find(
      (item) => row.created_at !== null && item.when === Number(row.created_at),
    );
    if (!entry || (!BASELINE_TAGS.some((tag) => tag === entry.tag) && entry.hash !== row.hash))
      throw new MigrationGuardError("Unreviewed migration history drift; refused.");
  }
  return changes;
}

type Column = {
  readonly table_name: string;
  readonly column_name: string;
  readonly data_type: string;
  readonly character_maximum_length: number | null;
  readonly is_nullable: string;
  readonly column_default: string | null;
};
type Constraint = {
  readonly conname: string;
  readonly table_name: string;
  readonly definition: string;
};
type Index = { readonly indexname: string; readonly tablename: string; readonly indexdef: string };
type Catalog = {
  readonly columns: readonly Column[];
  readonly constraints: readonly Constraint[];
  readonly indexes: readonly Index[];
};
function assertColumn(
  catalog: Catalog,
  table: string,
  name: string,
  type: string,
  nullable: boolean,
  defaultValue: string | null,
  length?: number,
): void {
  const column = catalog.columns.find(
    (row) => row.table_name === table && row.column_name === name,
  );
  const actualDefault =
    column?.column_default?.replace(/::(?:character varying|uuid)/g, "") ?? null;
  if (
    !column ||
    column.data_type !== type ||
    column.is_nullable !== (nullable ? "YES" : "NO") ||
    (length !== undefined && column.character_maximum_length !== length) ||
    actualDefault !== defaultValue
  )
    throw new MigrationGuardError(`Column postcondition mismatch: ${table}.${name}`);
}

export function assertDdlPostconditions(sql: string, catalog: Catalog): void {
  for (const match of sql.matchAll(
    /ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" (FOREIGN KEY .*?);/g,
  )) {
    const row = catalog.constraints.find(
      (item) => item.table_name === match[1] && item.conname === match[2],
    );
    if (!row || normalizeSql(row.definition) !== normalizeSql(match[3] ?? ""))
      throw new MigrationGuardError(`FK postcondition mismatch: ${match[2]}`);
  }
  for (const match of sql.matchAll(/CREATE (?:UNIQUE )?INDEX "([^"]+)" ON "([^"]+)".*?;/g)) {
    const row = catalog.indexes.find(
      (item) => item.indexname === match[1] && item.tablename === match[2],
    );
    if (!row || normalizeSql(row.indexdef) !== normalizeSql(match[0]))
      throw new MigrationGuardError(`Index postcondition mismatch: ${match[1]}`);
  }
  for (const match of sql.matchAll(/ALTER TABLE "([^"]+)" DROP CONSTRAINT "([^"]+)"/g)) {
    if (catalog.constraints.some((row) => row.table_name === match[1] && row.conname === match[2]))
      throw new MigrationGuardError(`Legacy constraint still present: ${match[2]}`);
  }
  for (const match of sql.matchAll(/DROP INDEX "([^"]+)"/g)) {
    if (catalog.indexes.some((row) => row.indexname === match[1]))
      throw new MigrationGuardError(`Legacy index still present: ${match[1]}`);
  }
}

async function assertSchema(
  client: PoolClient,
  journal: readonly HashedMigration[],
): Promise<void> {
  const columns = await client.query<Column>(
    "SELECT table_name,column_name,data_type,character_maximum_length,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public'",
  );
  const constraints = await client.query<Constraint>(
    "SELECT conname,c.relname AS table_name,pg_get_constraintdef(p.oid) AS definition FROM pg_constraint p JOIN pg_class c ON c.oid=p.conrelid WHERE p.connamespace='public'::regnamespace",
  );
  const indexes = await client.query<Index>(
    "SELECT indexname,tablename,indexdef FROM pg_indexes WHERE schemaname='public'",
  );
  const catalog: Catalog = {
    columns: columns.rows,
    constraints: constraints.rows,
    indexes: indexes.rows,
  };
  const sql = (tag: BaselineTag): string => journal.find((entry) => entry.tag === tag)?.sql ?? "";
  const historicalRoleSql = execFileSync(
    "git",
    ["show", "8e97cd81:apps/web/drizzle/0033_add_role_permission.sql"],
    { cwd: fileURLToPath(new URL("../../../", import.meta.url)), encoding: "utf8" },
  );
  if (hash(historicalRoleSql) !== REVIEWED_BASELINE_HASHES["0033_add_role_permission"].previous)
    throw new MigrationGuardError("0033 historical source proof changed.");
  const currentWithoutInsert = sql("0033_add_role_permission").replace(
    /INSERT INTO "role" \("id", "name", "description"\) VALUES[\s\S]*?ON CONFLICT \("id"\) DO NOTHING;/,
    "",
  );
  if (
    JSON.stringify(sqlTokens(currentWithoutInsert)) !== JSON.stringify(sqlTokens(historicalRoleSql))
  )
    throw new MigrationGuardError("0033 differs beyond reviewed idempotent role INSERT.");
  const roles = await client.query<{ id: string }>(
    "SELECT id FROM role WHERE id=ANY($1::uuid[]) FOR SHARE",
    [
      [
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
        "00000000-0000-0000-0000-000000000003",
        "00000000-0000-0000-0000-000000000004",
      ],
    ],
  );
  if (roles.rows.length !== 4)
    throw new MigrationGuardError("0033 role INSERT is not proven a no-op.");
  for (const tag of BASELINE_TAGS) assertDdlPostconditions(sql(tag), catalog);
  assertColumn(catalog, "role_permission", "id", "uuid", false, "gen_random_uuid()");
  assertColumn(catalog, "role_permission", "role_id", "uuid", false, null);
  assertColumn(catalog, "role_permission", "permission_key", "character varying", false, null, 64);
  assertColumn(
    catalog,
    "role_permission",
    "created_at",
    "timestamp without time zone",
    false,
    "now()",
  );
  assertColumn(catalog, "role", "data_scope", "character varying", false, "'NONE'", 20);
  assertColumn(catalog, "role", "is_system", "boolean", false, "false");
  assertColumn(catalog, "role", "updated_at", "timestamp without time zone", false, "now()");
  const tenantSql = sql("0035_tenant_foundation");
  for (const match of tenantSql.matchAll(/ALTER TABLE "([^"]+)" ADD COLUMN "tenant_id"/g))
    assertColumn(
      catalog,
      match[1] ?? "",
      "tenant_id",
      "uuid",
      false,
      "'00000000-0000-4000-8000-000000000001'",
    );
  for (const table of ["tenant", "tenant_member"]) {
    assertColumn(catalog, table, "id", "uuid", false, "gen_random_uuid()");
    assertColumn(catalog, table, "created_at", "timestamp without time zone", false, "now()");
    assertColumn(catalog, table, "updated_at", "timestamp without time zone", false, "now()");
    if (
      !catalog.constraints.some(
        (row) => row.table_name === table && normalizeSql(row.definition) === "primarykey(id)",
      )
    )
      throw new MigrationGuardError(`Missing primary key: ${table}`);
  }
  assertColumn(catalog, "tenant", "name", "character varying", false, null, 150);
  assertColumn(catalog, "tenant", "slug", "character varying", false, null, 60);
  assertColumn(catalog, "tenant", "status", "character varying", false, "'ACTIVE'", 30);
  assertColumn(
    catalog,
    "tenant",
    "subscription_starts_at",
    "timestamp without time zone",
    true,
    null,
  );
  assertColumn(
    catalog,
    "tenant",
    "subscription_ends_at",
    "timestamp without time zone",
    true,
    null,
  );
  assertColumn(catalog, "tenant", "notes", "text", true, null);
  for (const name of ["tenant_id", "user_id", "role_id"])
    assertColumn(catalog, "tenant_member", name, "uuid", false, null);
  assertColumn(catalog, "tenant_member", "is_active", "boolean", false, "true");
  const scaffold = await client.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM tenant WHERE id='00000000-0000-4000-8000-000000000001'",
  );
  if (scaffold.rows[0]?.count !== 1)
    throw new MigrationGuardError("0035 scaffold INSERT is not proven a no-op.");
  const notificationSql = sql("0039_notification_sse_cursor");
  if (
    hash(notificationSql.replace(/\n$/, "")) !==
    REVIEWED_BASELINE_HASHES["0039_notification_sse_cursor"].previous
  )
    throw new MigrationGuardError("0039 drift is not exactly the reviewed final newline.");
  assertColumn(
    catalog,
    "notification",
    "updated_at",
    "timestamp without time zone",
    false,
    "now()",
  );
}

async function domainSnapshot(client: PoolClient): Promise<string> {
  const roles = await client.query("SELECT * FROM role ORDER BY id");
  const permissions = await client.query(
    "SELECT * FROM role_permission ORDER BY role_id,permission_key",
  );
  const tables = [
    "bank_account",
    "cash_transaction",
    "project",
    "project_cost",
    "project_budget_category",
    "project_expenses",
    "vendor_bill",
    "vendor_payment",
    "client_invoice",
    "client_payment",
    "material_inventory",
    "stock_movement",
  ];
  const counts: Record<string, number> = {};
  for (const table of tables)
    counts[table] =
      (await client.query<{ count: number }>(`SELECT count(*)::int AS count FROM "${table}"`))
        .rows[0]?.count ?? 0;
  return JSON.stringify({ roles: roles.rows, permissions: permissions.rows, counts });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const expectedHost = args[args.indexOf("--expected-host") + 1];
  const expectedDatabase = args[args.indexOf("--database-name") + 1];
  const allowed = new Set([
    "--expected-host",
    expectedHost,
    "--database-name",
    expectedDatabase,
    "--apply",
    "--dry-run",
  ]);
  if (
    !args.includes("--expected-host") ||
    !args.includes("--database-name") ||
    !expectedHost ||
    !expectedDatabase ||
    args.some((value) => !allowed.has(value)) ||
    (args.includes("--apply") && args.includes("--dry-run"))
  )
    throw new MigrationGuardError("Explicit host/database and one execution mode are required.");
  if (
    process.env.NODE_ENV === "production" ||
    expectedDatabase !== "atria_uat_guard" ||
    ![DEVELOPMENT_HOST, PREVIEW_HOST].includes(expectedHost)
  )
    throw new MigrationGuardError(
      "Only the verified development database/preview clone is permitted.",
    );
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new MigrationGuardError("DATABASE_URL is required.");
  const configured = new URL(connectionString);
  if (
    configured.hostname !== expectedHost ||
    decodeURIComponent(configured.pathname.slice(1)) !== expectedDatabase
  )
    throw new MigrationGuardError("Explicit host/database do not match configured target.");
  const directory = new URL("../drizzle/", import.meta.url);
  const journal = schema
    .parse(JSON.parse(readFileSync(new URL("meta/_journal.json", directory), "utf8")))
    .entries.map((entry): HashedMigration => {
      const sql = readFileSync(new URL(`${entry.tag}.sql`, directory), "utf8");
      return { ...entry, sql, hash: hash(sql) };
    });
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  let transaction = false;
  try {
    await client.query("BEGIN");
    transaction = true;
    await client.query("LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE");
    const actual = await client.query<{ name: string }>("SELECT current_database() AS name");
    if (actual.rows[0]?.name !== expectedDatabase)
      throw new MigrationGuardError("Connected database name mismatch.");
    const before = await client.query<TrackingRow>(
      "SELECT id,hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at,id",
    );
    const changes = baselineChanges(journal, before.rows);
    await assertSchema(client, journal);
    const domainsBefore = await domainSnapshot(client);
    let backupFile: string | null = null;
    if (args.includes("--apply") && changes.length > 0) {
      backupFile = `/tmp/atria-migration-baseline-${randomUUID()}.json`;
      const backup = {
        targetHost: expectedHost,
        databaseName: expectedDatabase,
        changes,
        before: before.rows,
        after: null,
        status: "before-adoption",
      };
      writeFileSync(backupFile, JSON.stringify(backup, null, 2), { mode: 0o600 });
      for (const change of changes) {
        const updated = await client.query(
          "UPDATE drizzle.__drizzle_migrations SET hash=$1 WHERE id=$2 AND hash=$3",
          [change.current, change.id, change.previous],
        );
        if (updated.rowCount !== 1)
          throw new MigrationGuardError("Tracking changed concurrently; rolling back.");
      }
      if ((await domainSnapshot(client)) !== domainsBefore)
        throw new MigrationGuardError("Role/scope/permission/domain count changed; rolling back.");
      const after = await client.query<TrackingRow>(
        "SELECT id,hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at,id",
      );
      writeFileSync(
        backupFile,
        JSON.stringify({ ...backup, after: after.rows, status: "pending-commit" }, null, 2),
        { mode: 0o600 },
      );
      await client.query("COMMIT");
      transaction = false;
      writeFileSync(
        backupFile,
        JSON.stringify({ ...backup, after: after.rows, status: "committed" }, null, 2),
        { mode: 0o600 },
      );
    } else {
      await client.query("ROLLBACK");
      transaction = false;
    }
    console.log(
      JSON.stringify({
        status: args.includes("--apply") ? "adopted" : "dry-run",
        migrations: changes.map((change) => change.tag),
        domainCountsAndRoleGrantsUnchanged: true,
        metadataBackup: backupFile,
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
        : "Baseline adoption failed; inspect private backup if present.",
    );
    process.exitCode = 1;
  }
}
