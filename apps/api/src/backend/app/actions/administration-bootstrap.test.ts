import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";

const CASES = [
  ["fresh", "first Owner receives the complete default system grants after reset"],
  ["staff", "bootstrapped Owner can create a staff credential and company membership"],
  ["scaffold", "empty role scaffolding is initialized while configured grants stay intact"],
  ["existing", "existing users' customized grants and revocations stay intact"],
  ["repeat", "repeated bootstrap cannot recreate revoked permissions"],
  ["forbidden", "invalid bootstrap credentials write no initialization data"],
  ["rollback", "a late bootstrap failure rolls back roles, grants, credentials and settings"],
] as const;

for (const [caseName, label] of CASES) {
  test(
    label,
    async () => {
      // Keep real database/authorization behavior and isolate the PGlite mock.
      const child = Bun.spawn(
        [
          process.execPath,
          "--preload",
          "./scripts/test-preload.ts",
          "./src/backend/app/actions/fixtures/administration-bootstrap-case.ts",
          caseName,
        ],
        {
          cwd: fileURLToPath(new URL("../../../..", import.meta.url)),
          stdout: "pipe",
          stderr: "pipe",
          env: {
            ...process.env,
            NODE_ENV: "test",
            ATRIA_TEST_DATABASE_URL: undefined,
            ATRIA_TEST_EMPTY_DATABASE_URL: undefined,
            ATRIA_BOOTSTRAP_SECRET: "bootstrap-fixture-only-secret",
            BETTER_AUTH_URL: "http://127.0.0.1:3001",
            BETTER_AUTH_SECRET: "bootstrap-fixture-only-auth-secret",
            WEB_ORIGIN: "http://127.0.0.1:3000",
          },
        },
      );
      const timeout = setTimeout((): void => {
        child.kill();
      }, 45_000);
      try {
        const [output, error, code] = await Promise.all([
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
          child.exited,
        ]);
        expect({ code, error, output }).toEqual({
          code: 0,
          error: "",
          output: `Bootstrap ${caseName} checks passed\n`,
        });
      } finally {
        clearTimeout(timeout);
      }
    },
    60_000,
  );
}
