import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("standalone API authenticates native HTTP and preserves finance invariants on a disposable database", async (): Promise<void> => {
  const directory = await mkdtemp(path.join(tmpdir(), "atria-native-http-"));
  try {
    const child = Bun.spawn(
      [process.execPath, path.join(import.meta.dir, "fixtures/native-http-case.ts")],
      {
        cwd: directory,
        env: {
          ...process.env,
          NODE_ENV: "test",
          DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/disposable-only",
          ATRIA_TEST_DATABASE_URL: undefined,
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect({ code, stderr: code ? stderr : "" }).toEqual({ code: 0, stderr: "" });
    expect(stdout).toContain("Standalone native HTTP:");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 60000);
