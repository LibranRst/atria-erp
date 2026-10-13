import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test.each([
  "wrong-claim",
  "attachment-boundary",
  "no-read",
  "partial",
  "failed-read",
  "retry-throw",
  "invalid-read",
  "forbidden-proposal",
  "provider-error",
])(
  "current factual reads control publication and persistence through actual SDK: %s",
  async (mode): Promise<void> => {
    const fixture = fileURLToPath(new URL("./fixtures/chat-grounded-sdk-case.ts", import.meta.url));
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
    if (code !== 0) throw new Error(`Grounded SDK fixture failed: ${stdout}\n${stderr}`);
    expect(stdout).toContain("grounded SDK fixture passed");
  },
  10000,
);
