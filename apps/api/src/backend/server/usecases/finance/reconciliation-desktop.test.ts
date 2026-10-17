import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("desktop reconciliation reads full filtered pages, exact matching context and tenant scope", async () => {
  const fixture = fileURLToPath(
    new URL("./reconciliation-desktop-dom.fixture.ts", import.meta.url),
  );
  const child = Bun.spawn(["bun", "--preload", "./scripts/test-preload.ts", fixture], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
  expect(stdout).toContain("desktop reconciliation complete paging and guarded context passed");
}, 30_000);
