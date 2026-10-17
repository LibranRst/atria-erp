import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test.each([
  "expense-status",
  "full-comparison",
  "stock-cost-comparison",
  "paginated-current-only",
  "stale-history-only",
  "wrong-period",
  "wrong-scope",
  "mixed-history-complete",
  "mixed-history-partial",
  "mixed-current",
  "project-count-current",
  "project-count-retry",
  "attachment-boundary",
  "forbidden-proposal",
  "unsupported-snapshot",
  "unsupported-remembered-bank",
])(
  "final factual coverage publishes and persists actual SDK results: %s",
  async (mode): Promise<void> => {
    const fixture = fileURLToPath(
      new URL("./fixtures/chat-factual-finish-sdk-case.ts", import.meta.url),
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
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    if (code !== 0) throw new Error(`Final factual SDK fixture failed: ${stdout}\n${stderr}`);
    expect(stdout).toContain("final factual SDK fixture passed");
  },
  10000,
);
