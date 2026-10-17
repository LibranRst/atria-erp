import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("actual chat POST keeps deterministic company defaults scoped, fresh and persisted", async (): Promise<void> => {
  const fixture = fileURLToPath(
    new URL("./fixtures/company-budget-route-case.ts", import.meta.url),
  );
  const child = Bun.spawn([process.execPath, "--no-env-file", "--no-install", fixture], {
    cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      BETTER_AUTH_URL: "https://fixture.invalid",
      ATRIA_AI_TIMING_LOG: "1",
      DATABASE_URL: "postgresql://disabled:disabled@127.0.0.1:1/no_live_database",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0) throw new Error(`Company budget route fixture failed: ${stdout}\n${stderr}`);
  expect(stdout).toContain("company budget route fixture passed");
}, 10_000);
