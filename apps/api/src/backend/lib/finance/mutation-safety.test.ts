import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";

test("finance mutations: scoped permissions, frozen approvals and atomic AI confirmations", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      "--preload",
      "./scripts/test-preload.ts",
      "./src/backend/lib/finance/fixtures/mutation-safety-case.ts",
    ],
    {
      cwd: fileURLToPath(new URL("../../../..", import.meta.url)),
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        NODE_ENV: "test",
        BETTER_AUTH_URL: "http://127.0.0.1:3001",
        BETTER_AUTH_SECRET: "disposable-finance-fixture-secret",
        WEB_ORIGIN: "http://127.0.0.1:3000",
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
    output: "Finance mutation safety checks passed\n",
  });
}, 60_000);
