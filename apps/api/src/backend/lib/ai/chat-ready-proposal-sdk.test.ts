import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test.each([
  "ready",
  "failed",
  "mixed",
  "read-shaped",
  "unfresh",
  "wrong-family",
  "same-step-error",
  "prefilled",
  "shadow-prefilled",
  "prefilled-mixed",
  "flag-only",
  "prefilled-reference",
])(
  "actual SDK finishes only a complete single-command proposal after fresh reads: %s",
  async (scenario: string): Promise<void> => {
    const fixture = fileURLToPath(
      new URL("./fixtures/chat-ready-proposal-sdk-case.ts", import.meta.url),
    );
    const child = Bun.spawn(
      [process.execPath, "--no-env-file", "--no-install", fixture, scenario],
      {
        cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
        env: {
          PATH: process.env.PATH,
          NODE_ENV: "test",
          DATABASE_URL: "postgresql://disabled:disabled@127.0.0.1:1/no_live_database",
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    if (code !== 0) throw new Error(`Ready proposal SDK fixture failed: ${stdout}\n${stderr}`);
    expect(stdout).toContain("ready proposal SDK fixture passed");
  },
  10000,
);
