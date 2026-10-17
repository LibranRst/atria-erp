import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Expenses skeleton mounts all desktop collections without key collisions and retains mobile loading", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./expenses-skeleton-dom.fixture.tsx", import.meta.url));
  const child = Bun.spawn([process.execPath, "--preload", "./scripts/test-preload.ts", fixture], {
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
  expect(stdout).toContain("Expenses skeleton responsive structure passed");
}, 30_000);
