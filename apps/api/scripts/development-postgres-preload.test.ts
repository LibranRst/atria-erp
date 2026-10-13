import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

type ProbeResult = {
  readonly code: number;
  readonly output: string;
  readonly error: string;
};

async function probe(databaseUrl: string, nodeEnvironment: string): Promise<ProbeResult> {
  const child = Bun.spawn(
    [
      process.execPath,
      "--preload",
      "./scripts/development-postgres-preload.ts",
      "-e",
      "const { pool } = await import('./src/backend/db'); " +
        "const { Pool } = await import('pg'); " +
        "console.log(pool instanceof Pool); await pool.end();",
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: nodeEnvironment },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [code, output, error] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { code, output, error };
}

test("local API and seed preload use the real pg pool without opening a connection", async (): Promise<void> => {
  const result = await probe("postgresql://user:pass@127.0.0.1:1/atria_development", "development");
  expect(result).toEqual({ code: 0, output: "true\n", error: "" });
});

test("local API preload rejects production before backend import", async (): Promise<void> => {
  const result = await probe("postgresql://user:pass@127.0.0.1:1/atria_development", "production");
  expect(result.code).not.toBe(0);
  expect(result.error).toContain("NODE_ENV=production");
  expect(result.output).toBe("");
});

test("local API preload rejects remote connections", async (): Promise<void> => {
  const result = await probe(
    "postgresql://user:pass@remote.invalid/atria_development",
    "development",
  );
  expect(result.code).not.toBe(0);
  expect(result.error).toContain("Seed development hanya menerima");
  expect(result.output).toBe("");
});

test("optional local API preload rejects valid Neon targets before replacing its driver", async (): Promise<void> => {
  const result = await probe(
    "postgresql://neondb_owner:fixture-only@ep-example.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
    "development",
  );
  expect(result.code).not.toBe(0);
  expect(result.error).toContain("Preload PostgreSQL lokal hanya menerima database loopback");
  expect(result.output).toBe("");
});

test("local API preload rejects host parameters before backend import", async (): Promise<void> => {
  const result = await probe(
    "postgresql://user:pass@127.0.0.1:1/atria_development?host=remote.invalid",
    "development",
  );
  expect(result.code).not.toBe(0);
  expect(result.error).toContain("Parameter DATABASE_URL lokal");
  expect(result.output).toBe("");
});
