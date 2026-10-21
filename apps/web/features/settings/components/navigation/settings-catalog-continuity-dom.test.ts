import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
test("Catalog restores collection queries and keeps permission-safe controls", async (): Promise<void> => {
  const fixture = fileURLToPath(
    new URL("./settings-catalog-continuity-dom.fixture.tsx", import.meta.url),
  );
  const child = Bun.spawn([process.execPath, "--preload", "./scripts/test-preload.ts", fixture], {
    cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
  expect(stdout).toContain("Settings catalog query, count and permission regression passed");
}, 30_000);
