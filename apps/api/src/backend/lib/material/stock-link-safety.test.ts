import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";

test("stock links validate project/category/SKU and attribute each cost once", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      "--preload",
      "./scripts/test-preload.ts",
      "./src/backend/lib/material/fixtures/stock-link-safety-case.ts",
    ],
    {
      cwd: fileURLToPath(new URL("../../../..", import.meta.url)),
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        NODE_ENV: "test",
        BETTER_AUTH_SECRET: "disposable-stock-link-test-only",
      },
    },
  );
  const timeout = setTimeout((): void => {
    child.kill();
  }, 45_000);
  const [output, error, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  clearTimeout(timeout);
  expect({ code, error, output }).toEqual({
    code: 0,
    error: "",
    output: "Stock link safety checks passed\n",
  });
}, 60_000);
