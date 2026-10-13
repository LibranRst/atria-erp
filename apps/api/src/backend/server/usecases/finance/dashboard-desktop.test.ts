import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
test("desktop cashflow uses independent authorized tenant/date-bounded aggregates", async () => {
  const fixture = fileURLToPath(new URL("./dashboard-desktop-dom.fixture.ts", import.meta.url));
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
  expect(stdout).toContain("desktop cashflow auth, tenant and bounded query regression passed");
}, 30_000);
