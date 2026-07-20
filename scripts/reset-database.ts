import { Pool, type PoolClient } from "pg";

const RESET_CONFIRMATION_FLAG = "--confirm-reset";
const PRODUCTION_OVERRIDE_FLAG = "--allow-production";
const DRY_RUN_FLAG = "--dry-run";
const DATA_SCHEMA = "public";
const PRESERVED_TABLES = new Set(["__drizzle_migrations"]);

type DatabaseTarget = {
  readonly host: string;
  readonly database: string;
};

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function describeTarget(connectionString: string): DatabaseTarget {
  const url = new URL(connectionString);
  return {
    host: url.hostname,
    database: url.pathname.replace(/^\//, "") || "postgres",
  };
}

function normalizeConnectionString(connectionString: string): string {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode");
  if (sslMode && ["prefer", "require", "verify-ca"].includes(sslMode)) {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}

function assertResetAllowed(args: readonly string[]): void {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL wajib tersedia. Reset tidak memakai fallback database.");
  }
  if (!args.includes(RESET_CONFIRMATION_FLAG) && !args.includes(DRY_RUN_FLAG)) {
    throw new Error(
      `Reset dibatalkan. Jalankan ulang dengan ${RESET_CONFIRMATION_FLAG} atau periksa target memakai ${DRY_RUN_FLAG}.`,
    );
  }
  if (process.env.NODE_ENV === "production" && !args.includes(PRODUCTION_OVERRIDE_FLAG)) {
    throw new Error(
      `NODE_ENV=production terdeteksi. Tambahkan ${PRODUCTION_OVERRIDE_FLAG} hanya bila reset production memang disengaja.`,
    );
  }
}

async function listDataTables(client: PoolClient): Promise<readonly string[]> {
  const result = await client.query<{ table_name: string }>(
    `select table_name
       from information_schema.tables
      where table_schema = $1
        and table_type = 'BASE TABLE'
      order by table_name`,
    [DATA_SCHEMA],
  );
  return result.rows
    .map((row) => row.table_name)
    .filter((tableName) => !PRESERVED_TABLES.has(tableName));
}

async function verifyTablesAreEmpty(
  client: PoolClient,
  tableNames: readonly string[],
): Promise<void> {
  for (const tableName of tableNames) {
    const qualifiedTable = `${quoteIdentifier(DATA_SCHEMA)}.${quoteIdentifier(tableName)}`;
    const result = await client.query<{ count: string }>(`select count(*)::text as count from ${qualifiedTable}`);
    if (result.rows[0]?.count !== "0") {
      throw new Error(`Verifikasi gagal: ${DATA_SCHEMA}.${tableName} masih memiliki data.`);
    }
  }
}

async function resetDatabase(): Promise<void> {
  const args = process.argv.slice(2);
  assertResetAllowed(args);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL wajib tersedia.");
  const target = describeTarget(connectionString);
  const pool = new Pool({ connectionString: normalizeConnectionString(connectionString), max: 1 });
  const client = await pool.connect();

  try {
    const tableNames = await listDataTables(client);
    console.log(`Target: ${target.host}/${target.database}`);
    console.log(`Schema data: ${DATA_SCHEMA}`);
    console.log(`Tabel yang akan dikosongkan: ${tableNames.length}`);

    if (tableNames.length === 0) {
      console.log("Tidak ada tabel data yang perlu direset.");
      return;
    }

    if (args.includes(DRY_RUN_FLAG)) {
      console.log(tableNames.join("\n"));
      console.log("Dry run selesai. Tidak ada data yang diubah.");
      return;
    }

    const qualifiedTables = tableNames
      .map((tableName) => `${quoteIdentifier(DATA_SCHEMA)}.${quoteIdentifier(tableName)}`)
      .join(", ");

    await client.query("begin");
    try {
      await client.query(`truncate table ${qualifiedTables} restart identity cascade`);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }

    await verifyTablesAreEmpty(client, tableNames);
    console.log("Database berhasil dikosongkan dan sudah diverifikasi.");
    console.log("Schema serta metadata migration tetap dipertahankan. Buka /setup untuk membuat Owner pertama.");
  } finally {
    client.release();
    await pool.end();
  }
}

if (import.meta.main) {
  resetDatabase().catch((error: unknown) => {
    console.error("Reset database gagal:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
