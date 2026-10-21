import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Dashboard retains four table tabs and both trend periods in the stable page owner", async (): Promise<void> => {
  const fixture = fileURLToPath(
    new URL("./dashboard-tab-retention-dom.fixture.tsx", import.meta.url),
  );
  const child = Bun.spawn([process.execPath, "--preload", "./scripts/test-preload.ts", fixture], {
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
  expect(stdout).toContain("Dashboard retained table and trend ownership passed");
}, 30_000);
