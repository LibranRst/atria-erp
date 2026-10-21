import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("chat attachments use the configured document provider while preserving local parsing and guards", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./fixtures/chat-attachments-case.ts", import.meta.url));
  const child = Bun.spawn([process.execPath, "--no-env-file", "--no-install", fixture], {
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
  if (exitCode !== 0) throw new Error(`Chat attachment fixture failed: ${stdout}\n${stderr}`);
  expect(stdout).toContain("chat attachment fixture passed");
}, 10_000);
