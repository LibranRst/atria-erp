/** Targeted real-Neon tests; each suite receives a fresh migrated and seeded audit DB. */
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { Pool } from "@neondatabase/serverless";

const AUDIT_ENDPOINT = "ep-blue-frog-azgry6vg";
const DIRECT_HOST = `${AUDIT_ENDPOINT}.c-3.ap-southeast-1.aws.neon.tech`;
const POOLED_HOST = `${AUDIT_ENDPOINT}-pooler.c-3.ap-southeast-1.aws.neon.tech`;
const configured = process.env.ATRIA_NEON_AUDIT_DATABASE_URL;
if (!configured) throw new Error("ATRIA_NEON_AUDIT_DATABASE_URL must be explicit.");
const seedUrl = new URL(configured);
if (
  !["postgres:", "postgresql:"].includes(seedUrl.protocol) ||
  ![DIRECT_HOST, POOLED_HOST].includes(seedUrl.hostname) ||
  !/^\/atria_audit_[a-z0-9_]+_seed$/.test(seedUrl.pathname) ||
  process.env.NODE_ENV === "production"
) {
  throw new Error("Only an atria_audit_*_seed database on the approved audit branch is allowed.");
}

const app = fileURLToPath(new URL("..", import.meta.url));
const logDirectory = resolve(process.argv[2] ?? `/tmp/atria-neon-pooled-${Date.now()}`);
mkdirSync(logDirectory, { recursive: true, mode: 0o700 });
const runId = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
const seedDatabase = seedUrl.pathname.slice(1);
const files = [
  "lib/finance/demo-walkthrough.integration.test.ts",
  "lib/finance/balance-concurrency.integration.test.ts",
  "lib/finance/actions.test.ts",
  "lib/finance/actions-field.test.ts",
  "lib/material/warehouse-operations.integration.test.ts",
  "lib/material/cross-project-reserve.integration.test.ts",
  "lib/auth/bearer-http.integration.test.ts",
] as const;

type AuditResult = {
  readonly file: string;
  readonly database: string;
  readonly exit: number | null;
  readonly seconds: number;
  readonly counts: Readonly<Record<string, number>>;
  readonly log: string;
  readonly invariantExit?: number | null;
};

function pooledUrl(database: string): string {
  const url = new URL(seedUrl);
  url.hostname = POOLED_HOST;
  url.pathname = `/${database}`;
  return url.toString();
}

function run(
  command: readonly string[],
  database: string,
  logName: string,
  connection: "pooled" | "direct" = "pooled",
): {
  readonly status: number | null;
  readonly output: string;
} {
  const url = new URL(pooledUrl(database));
  if (connection === "direct") url.hostname = DIRECT_HOST;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: url.toString(),
    ATRIA_TEST_DATABASE_URL: pooledUrl(database),
  };
  delete env.ATRIA_TEST_EMPTY_DATABASE_URL;
  delete env.ATRIA_LOCAL_TEST_DATABASE_URL;
  const result = spawnSync(process.execPath, [...command], {
    cwd: app,
    env,
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  writeFileSync(resolve(logDirectory, logName), output, { mode: 0o600 });
  return { status: result.status, output };
}

const verify = run(
  ["--conditions", "react-server", "scripts/check-invariants.ts"],
  seedDatabase,
  "seed-invariants.log",
);
if (verify.status !== 0)
  throw new Error("Audit seed invariant check failed; inspect seed-invariants.log.");
const directUrl = new URL(seedUrl);
directUrl.hostname = DIRECT_HOST;
directUrl.pathname = "/neondb";
const admin = new Pool({ connectionString: directUrl.toString(), max: 1 });
const results: AuditResult[] = [];
try {
  for (const [index, file] of files.entries()) {
    const database = `atria_audit_${runId}_${index}`;
    // A new generated name on the approved audit branch, never a reused application DB.
    await admin.query(`CREATE DATABASE "${database}"`);
    const preparation: ReadonlyArray<{
      readonly label: string;
      readonly args: readonly string[];
      readonly connection: "pooled" | "direct";
    }> = [
      {
        label: "provision",
        args: [
          "--conditions",
          "react-server",
          "scripts/provision-instance.ts",
          "--name",
          "Atria Pooled Audit",
          "--slug",
          "atria-pooled-audit",
        ],
        connection: "direct",
      },
      {
        label: "clear-scaffold",
        args: ["--conditions", "react-server", "scripts/reset-database.ts", "--confirm-reset"],
        connection: "direct",
      },
      { label: "seed", args: ["--conditions", "react-server", "db/seed.ts"], connection: "pooled" },
      {
        label: "verify-seed",
        args: ["--conditions", "react-server", "scripts/verify-demo-seed.ts"],
        connection: "pooled",
      },
    ];
    for (const step of preparation) {
      const prepared = run(step.args, database, `${index}-${step.label}.log`, step.connection);
      console.log(JSON.stringify({ suite: index, step: step.label, exit: prepared.status }));
      if (prepared.status !== 0)
        throw new Error(`Audit preparation failed: ${index}-${step.label}.log`);
    }
    const started = Date.now();
    const log = `${index.toString().padStart(2, "0")}.log`;
    const result = run(["test", "--timeout", "30000", file], database, log);
    const counts = Object.fromEntries(
      [...result.output.matchAll(/^\s*(\d+) (pass|fail|skip)$/gm)].map((match) => [
        match[2],
        Number(match[1]),
      ]),
    );
    let invariantExit: number | null | undefined;
    if (
      file.includes("demo-walkthrough") ||
      file.includes("warehouse-operations") ||
      file.includes("balance-concurrency")
    ) {
      invariantExit = run(
        ["--conditions", "react-server", "scripts/check-invariants.ts"],
        database,
        `${index}-invariants.log`,
      ).status;
    }
    const row: AuditResult = {
      file,
      database,
      exit: result.status,
      seconds: Math.round((Date.now() - started) / 100) / 10,
      counts,
      log,
      invariantExit,
    };
    results.push(row);
    writeFileSync(resolve(logDirectory, "results.json"), JSON.stringify(results, null, 2) + "\n", {
      mode: 0o600,
    });
    console.log(JSON.stringify(row));
  }
} finally {
  await admin.end();
}
// Test databases are deliberately retained. None is a deployment target.
if (
  results.some(
    (row) =>
      row.exit !== 0 ||
      (row.counts.pass ?? 0) === 0 ||
      (row.counts.skip ?? 0) > 0 ||
      (row.invariantExit !== undefined && row.invariantExit !== 0),
  )
) {
  process.exitCode = 1;
}
