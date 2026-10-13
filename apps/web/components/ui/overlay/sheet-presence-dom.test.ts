import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("sheet exit cleanup retains content and ignores interrupted/stale exits", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./sheet-presence-dom.fixture.tsx", import.meta.url));
  const child = Bun.spawn([process.execPath, "--preload", "./scripts/test-preload.ts", fixture], {
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
  expect(stdout).toContain("Sheet presence DOM regressions passed");
}, 30_000);
