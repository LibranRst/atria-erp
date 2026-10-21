import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { getTableName, is, notInArray } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/backend/db/schema";

export const LATENCY_METADATA_TABLES: readonly string[] = [
  "ai_conversation",
  "ai_message",
  "ai_run",
  "ai_user_preference",
  "material_import_analysis_job",
  "form_draft",
  "attachment",
  "session",
  "verification",
];

export function assertLatencyQaTarget(
  value: string | undefined,
  nodeEnv: string | undefined,
): string {
  try {
    const target = new URL(value ?? "http://invalid");
    if (
      nodeEnv === "production" ||
      target.protocol !== "postgresql:" ||
      target.hostname !== "127.0.0.1" ||
      target.port !== "32768" ||
      target.pathname !== "/atria_audit_reconciliation" ||
      target.search !== "" ||
      target.hash !== ""
    )
      throw new Error("Rejected target");
    return target.toString();
  } catch {
    throw new Error("Exact loopback disposable latency QA database required");
  }
}

export function snapshotRows(rows: readonly unknown[]): { count: number; sha256: string } {
  const sorted = rows.map((row) => JSON.stringify(row)).sort();
  return {
    count: rows.length,
    sha256: createHash("sha256").update(JSON.stringify(sorted)).digest("hex"),
  };
}

export async function saveLatencyQaSnapshot(outputPath: string): Promise<void> {
  const connectionString = assertLatencyQaTarget(
    process.env.ATRIA_TEST_DATABASE_URL,
    process.env.NODE_ENV,
  );
  const pool = new Pool({ connectionString, max: 1 });
  const database = drizzle({ client: pool });
  try {
    const evidence = await database.transaction(
      async (tx) => {
        const protectedTables: Record<string, { count: number; sha256: string }> = {};
        const metadataTables: Record<string, { count: number; sha256: string }> = {};
        const exportedValues: readonly unknown[] = Object.values(schema);
        const tables = exportedValues.filter((value): value is PgTable => is(value, PgTable));
        for (const table of tables.sort((left, right) =>
          getTableName(left).localeCompare(getTableName(right)),
        )) {
          const name = getTableName(table);
          const rows =
            name === "audit_log"
              ? await tx
                  .select()
                  .from(schema.auditLog)
                  .where(notInArray(schema.auditLog.targetTable, [...LATENCY_METADATA_TABLES]))
              : await tx.select().from(table);
          const destination = LATENCY_METADATA_TABLES.includes(name)
            ? metadataTables
            : protectedTables;
          destination[name] = snapshotRows(rows);
        }
        return {
          capturedAt: new Date().toISOString(),
          target: { hostname: "127.0.0.1", port: "32768", database: "atria_audit_reconciliation" },
          protectedTables,
          metadataTables,
          excludedAuditTargets: LATENCY_METADATA_TABLES,
          policy:
            "Business rows and credentials are protected. Only chat/form/AI/file and ordinary auth session metadata are separate; their scoped audit rows are excluded. Raw rows and secrets are never written.",
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
    writeFileSync(outputPath, JSON.stringify(evidence, null, 2), { mode: 0o600, flag: "wx" });
    console.log(
      JSON.stringify({
        path: outputPath,
        protectedTableCount: Object.keys(evidence.protectedTables).length,
        metadataTableCount: Object.keys(evidence.metadataTables).length,
      }),
    );
  } finally {
    await pool.end();
  }
}

if (import.meta.main) {
  const outputPath = process.argv[2];
  if (!outputPath) throw new Error("Provide a new snapshot output path");
  await saveLatencyQaSnapshot(outputPath);
}
