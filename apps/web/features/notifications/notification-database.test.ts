import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";
test("Postgres notification queries, isolation, pagination, idempotency, rollback and recovery", async () => {
  // Child process isolates Bun module mocks from the rest of the finance test suite.
  const child = Bun.spawn(
    [
      process.execPath,
      "--preload",
      "./scripts/test-preload.ts",
      "./features/notifications/fixtures/database-case.ts",
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), stdout: "pipe", stderr: "pipe" },
  );
  const [output, error, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ code, error, output }).toEqual({
    code: 0,
    error: "",
    output: "Notification database checks passed\n",
  });
}, 60_000);
