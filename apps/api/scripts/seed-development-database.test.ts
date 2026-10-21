import { expect, test } from "bun:test";
import {
  runDevelopmentSeed,
  type DevelopmentSeedConnection,
  type DevelopmentSeedDependencies,
  type DevelopmentSeedEnvironment,
} from "./seed-development-database";
import { isLoopbackDevelopmentTarget } from "./development-seed-guard";

const ENVIRONMENT = {
  DATABASE_URL: "postgresql://postgres:local-only@127.0.0.1:5432/atria_development",
  NODE_ENV: "development",
};

type Fixture = {
  readonly dependencies: DevelopmentSeedDependencies;
  readonly calls: string[];
  readonly targets: URL[];
};

function fixture(failAt?: "reset" | "seed" | "verify"): Fixture {
  const calls: string[] = [];
  const targets: URL[] = [];
  return {
    calls,
    targets,
    dependencies: {
      reset: async (): Promise<void> => {
        calls.push("reset");
        if (failAt === "reset") throw new Error("reset failed");
      },
      open: async (target: URL): Promise<DevelopmentSeedConnection> => {
        calls.push("open");
        targets.push(target);
        return {
          seed: async (): Promise<void> => {
            calls.push("seed");
            if (failAt === "seed") throw new Error("database not empty");
          },
          verify: async (): Promise<{ valid: boolean }> => {
            calls.push("verify");
            if (failAt === "verify") throw new Error("invariant failed");
            return { valid: true };
          },
          close: async (): Promise<void> => {
            calls.push("close");
          },
        };
      },
    },
  };
}

test("normal command seeds, verifies, and closes the database", async (): Promise<void> => {
  const { dependencies, calls } = fixture();
  expect(await runDevelopmentSeed([], ENVIRONMENT, dependencies)).toEqual({ valid: true });
  expect(calls).toEqual(["open", "seed", "verify", "close"]);
});

test("verify command never invokes writes", async (): Promise<void> => {
  const { dependencies, calls } = fixture();
  await runDevelopmentSeed(["--verify"], ENVIRONMENT, dependencies);
  expect(calls).toEqual(["open", "verify", "close"]);
});

test("configured Neon target preserves its URI and selects the existing transport", async (): Promise<void> => {
  const { dependencies, calls, targets } = fixture();
  const databaseUrl =
    "postgresql://neondb_owner:fixture-only@ep-example-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
  await runDevelopmentSeed(
    [],
    { NODE_ENV: "development", DATABASE_URL: databaseUrl },
    dependencies,
  );
  expect(calls).toEqual(["open", "seed", "verify", "close"]);
  expect(targets[0]?.href).toBe(databaseUrl);
  expect(targets[0] && isLoopbackDevelopmentTarget(targets[0])).toBe(false);
});

test("confirmed reset finishes before opening the seed connection", async (): Promise<void> => {
  const { dependencies, calls } = fixture();
  await runDevelopmentSeed(["--reset", "--confirm-reset"], ENVIRONMENT, dependencies);
  expect(calls).toEqual(["reset", "open", "seed", "verify", "close"]);
});

const FAILURE_POINTS: ("seed" | "verify")[] = ["seed", "verify"];

test.each(FAILURE_POINTS)(
  "closes pool when %s fails",
  async (failAt: "seed" | "verify"): Promise<void> => {
    const { dependencies, calls } = fixture(failAt);
    await expect(runDevelopmentSeed([], ENVIRONMENT, dependencies)).rejects.toThrow();
    expect(calls.at(-1)).toBe("close");
    if (failAt === "seed") expect(calls).not.toContain("verify");
  },
);

test("a failed reset does not import backend seed modules", async (): Promise<void> => {
  const { dependencies, calls } = fixture("reset");
  await expect(
    runDevelopmentSeed(["--reset", "--confirm-reset"], ENVIRONMENT, dependencies),
  ).rejects.toThrow("reset failed");
  expect(calls).toEqual(["reset"]);
});

test.each([
  { ...ENVIRONMENT, NODE_ENV: "production" },
  { ...ENVIRONMENT, DATABASE_URL: "postgresql://postgres:local-only@remote.invalid/atria" },
  { NODE_ENV: "development" },
])(
  "rejects unsafe environment before reset or backend imports",
  async (environment: DevelopmentSeedEnvironment): Promise<void> => {
    const { dependencies, calls } = fixture();
    await expect(
      runDevelopmentSeed(["--reset", "--confirm-reset"], environment, dependencies),
    ).rejects.toThrow();
    expect(calls).toEqual([]);
  },
);

test("rejects unconfirmed reset before opening a connection", async (): Promise<void> => {
  const { dependencies, calls } = fixture();
  await expect(runDevelopmentSeed(["--reset"], ENVIRONMENT, dependencies)).rejects.toThrow();
  expect(calls).toEqual([]);
});
