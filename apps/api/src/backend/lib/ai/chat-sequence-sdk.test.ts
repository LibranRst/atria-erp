import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test.each(["competing", "out-of-stage", "invalid-input", "forbidden", "failed-read"])(
  "fresh-reader sequencing through the actual SDK: %s",
  async (mode): Promise<void> => {
    const fixture = fileURLToPath(new URL("./fixtures/chat-sequence-sdk-case.ts", import.meta.url));
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
    if (code !== 0) throw new Error(`Sequence SDK fixture failed: ${stdout}\n${stderr}`);
    expect(stdout).toContain("sequence SDK fixture passed");
  },
  10000,
);
