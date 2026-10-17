import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

for (const mode of [
  "ordinary",
  "grounded",
  "fallback",
  "late-error",
  "invalid",
  "reordered",
  "retry",
  "expense-first",
  "expense-ambiguous",
  "expense-document",
  "expense-complex",
]) {
  test(`model introduction stream contract: ${mode}`, async (): Promise<void> => {
    const fixture = fileURLToPath(
      new URL("./fixtures/chat-introduction-sdk-case.ts", import.meta.url),
    );
    const child = Bun.spawn([process.execPath, "--no-env-file", "--no-install", fixture, mode], {
      cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "test",
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
    if (exitCode !== 0) throw new Error(`Introduction fixture failed: ${stdout}\n${stderr}`);
    expect(stdout).toContain("fixture passed");
  }, 10_000);
}
