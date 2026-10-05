import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";

test("izin efektif: revoke-all tetap kosong pada database dan guard asli", async () => {
  // Isolasi module mock koneksi DB dari suite lain.
  const child = Bun.spawn(
    [
      process.execPath,
      "--preload",
      "./scripts/test-preload.ts",
      "./src/backend/lib/auth/fixtures/effective-permissions-case.ts",
    ],
    {
      cwd: fileURLToPath(new URL("../../../..", import.meta.url)),
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        BETTER_AUTH_URL: "http://127.0.0.1:4000",
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:4000",
        BETTER_AUTH_SECRET: "effective-permission-test-only-secret",
      },
    },
  );
  const [output, error, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ code, error, output }).toEqual({
    code: 0,
    error: "",
    output: "Effective permission checks passed\n",
  });
}, 60_000);
