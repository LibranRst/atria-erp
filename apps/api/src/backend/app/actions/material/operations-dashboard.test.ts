import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("dashboard lists configured active warehouses independently of inventory under existing read permission", async (): Promise<void> => {
  const child = Bun.spawn(
    [
      process.execPath,
      "--preload",
      "./scripts/test-preload.ts",
      "./src/backend/app/actions/material/fixtures/operations-dashboard-case.ts",
    ],
    {
      cwd: fileURLToPath(new URL("../../../../..", import.meta.url)),
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        NODE_ENV: "test",
        ATRIA_TEST_DATABASE_URL: undefined,
        ATRIA_TEST_EMPTY_DATABASE_URL: undefined,
      },
    },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
  expect(stdout).toContain("Material dashboard location checks passed");
}, 45_000);
