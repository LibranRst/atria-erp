import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("RAP setup requires explicit lock confirmation, cancels safely and refuses stale proposals", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./rap-setup-dom.fixture.tsx", import.meta.url));
  const child = Bun.spawn(["bun", "--preload", "./scripts/test-preload.ts", fixture], {
    cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
  expect(stdout).toContain("RAP setup confirmation DOM passed");
}, 30_000);
