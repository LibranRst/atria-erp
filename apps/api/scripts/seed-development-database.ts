import { fileURLToPath } from "node:url";
import {
  developmentDatabaseTarget,
  developmentSeedOptions,
  isLoopbackDevelopmentTarget,
} from "./development-seed-guard";

export type DevelopmentSeedConnection = {
  readonly seed: () => Promise<void>;
  readonly verify: () => Promise<unknown>;
  readonly close: () => Promise<void>;
};

export type DevelopmentSeedDependencies = {
  readonly open: (target: URL) => Promise<DevelopmentSeedConnection>;
  readonly reset: (target: URL) => Promise<void>;
};

export type DevelopmentSeedEnvironment = {
  readonly DATABASE_URL?: string;
  readonly NODE_ENV?: string;
};

async function openSeedConnection(target: URL): Promise<DevelopmentSeedConnection> {
  process.env.DATABASE_URL = target.href;
  // Neon uses the application's existing driver. The optional TCP adapter is
  // loaded only for loopback PostgreSQL, after the target guard has succeeded.
  if (isLoopbackDevelopmentTarget(target)) await import("./development-postgres-preload");
  const { pool } = await import("../src/backend/db");
  try {
    const { seedDemoDatabase } = await import("../src/backend/db/seed");
    const { verifyDevelopmentSeed } = await import("./verify-development-seed");
    return {
      seed: (): Promise<void> => seedDemoDatabase({ profile: "development" }),
      verify: verifyDevelopmentSeed,
      close: (): Promise<void> => pool.end(),
    };
  } catch (error: unknown) {
    await pool.end();
    throw error;
  }
}

async function resetConfiguredDatabase(target: URL): Promise<void> {
  const child = Bun.spawn([process.execPath, "scripts/reset-database.ts", "--confirm-reset"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, DATABASE_URL: target.href },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await child.exited;
  if (code !== 0) throw new Error(`Reset database development gagal (exit ${code}).`);
}

const defaultDependencies: DevelopmentSeedDependencies = {
  open: openSeedConnection,
  reset: resetConfiguredDatabase,
};

export async function runDevelopmentSeed(
  args: readonly string[],
  environment: DevelopmentSeedEnvironment,
  dependencies: DevelopmentSeedDependencies = defaultDependencies,
): Promise<unknown> {
  const target = developmentDatabaseTarget(environment.DATABASE_URL, environment.NODE_ENV);
  const options = developmentSeedOptions(args);
  console.log(`Target development: ${target.hostname}/${target.pathname.slice(1)}`);
  if (options.reset) await dependencies.reset(target);
  const connection = await dependencies.open(target);
  try {
    if (!options.verifyOnly) await connection.seed();
    const report = await connection.verify();
    if (options.verifyOnly) console.log(JSON.stringify(report, null, 2));
    console.log(
      options.verifyOnly
        ? "Data development sudah diverifikasi. Tidak ada data yang diubah."
        : "Database development siap; koneksi RAP, RAB, keuangan, dan stok sudah diverifikasi.",
    );
    return report;
  } finally {
    await connection.close();
  }
}

if (import.meta.main) {
  runDevelopmentSeed(process.argv.slice(2), process.env).catch((error: unknown): void => {
    console.error(error instanceof Error ? error.message : "Seed development gagal.");
    process.exitCode = 1;
  });
}
