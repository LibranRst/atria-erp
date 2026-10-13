/** Applies only the additive guide receipt migration to an explicitly selected development DB. */
import { Pool } from "@neondatabase/serverless";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const TAG = "0047_user_role_guide_state";
const journalSchema = z.object({
  entries: z.array(z.object({ tag: z.string(), when: z.number() })),
});
export type GuideMigration = {
  readonly tag: string;
  readonly when: number;
  readonly hash: string;
  readonly sql: string;
};
export function pendingRoleGuideMigration(
  journal: readonly GuideMigration[],
  appliedHashes: ReadonlySet<string>,
): GuideMigration | null {
  const index = journal.findIndex((entry) => entry.tag === TAG);
  const entry = journal[index];
  if (!entry) throw new Error("Role-guide migration is missing.");
  if (appliedHashes.has(entry.hash)) return null;
  const missing = journal.slice(0, index).filter((prior) => !appliedHashes.has(prior.hash));
  if (missing.length > 0)
    throw new Error(
      `Earlier migrations must be applied first: ${missing.map((prior) => prior.tag).join(", ")}`,
    );
  return entry;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const database = args[args.indexOf("--database-name") + 1];
  const hostname = args[args.indexOf("--expected-host") + 1];
  const apply = args.includes("--apply");
  if (
    !args.includes("--database-name") ||
    !args.includes("--expected-host") ||
    !database ||
    !hostname
  )
    throw new Error("Explicit --database-name and --expected-host are required.");
  if (
    args.some(
      (arg) =>
        ![
          "--database-name",
          "--expected-host",
          "--apply",
          "--dry-run",
          database,
          hostname,
        ].includes(arg),
    )
  )
    throw new Error("Unknown argument.");
  if (apply && args.includes("--dry-run")) throw new Error("Choose --apply or --dry-run.");
  if (
    process.env.NODE_ENV === "production" ||
    !/^atria_(practice_[0-9]+|uat_guard|audit_[a-z0-9_]+)$/.test(database)
  )
    throw new Error(
      "Only development/disposable databases are supported; production requires its release workflow.",
    );
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (url.hostname !== hostname || decodeURIComponent(url.pathname.slice(1)) !== database)
    throw new Error("Configured database differs from the selected target.");
  const directory = new URL("../drizzle/", import.meta.url);
  const journal = journalSchema.parse(
    JSON.parse(await readFile(new URL("meta/_journal.json", directory), "utf8")),
  );
  const migrations = await Promise.all(
    journal.entries.map(async (entry): Promise<GuideMigration> => {
      if (!/^\d+_[a-z0-9_]+$/.test(entry.tag)) throw new Error("Invalid migration tag.");
      const sql = await readFile(new URL(`${entry.tag}.sql`, directory), "utf8");
      return { ...entry, sql, hash: createHash("sha256").update(sql).digest("hex") };
    }),
  );
  const pool = new Pool({ connectionString: url.href });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE");
    const actual = await client.query<{ name: string }>("SELECT current_database() AS name");
    if (actual.rows[0]?.name !== database) throw new Error("Connected to an unexpected database.");
    const history = await client.query<{ hash: string }>(
      "SELECT hash FROM drizzle.__drizzle_migrations",
    );
    const pending = pendingRoleGuideMigration(
      migrations,
      new Set(history.rows.map((row) => row.hash)),
    );
    if (!pending || !apply) {
      await client.query("ROLLBACK");
      console.info(
        pending
          ? "Validated 0047: one additive receipt table; dry-run made no changes."
          : "Role-guide migration is already applied.",
      );
      return;
    }
    for (const statement of pending.sql
      .split("--> statement-breakpoint")
      .map((part) => part.trim())
      .filter(Boolean)) {
      await client.query(statement);
    }
    await client.query(
      "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
      [pending.hash, pending.when],
    );
    await client.query("COMMIT");
    console.info("Applied 0047: guide receipts ready; existing business data unchanged.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
if (import.meta.main) await main();
