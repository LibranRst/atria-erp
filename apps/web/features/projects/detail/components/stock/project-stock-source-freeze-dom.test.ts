import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("actual stock route and operation owners freeze reviewed sources, IDs and draft through resize, pending and failure", async (): Promise<void> => {
  const fixture = fileURLToPath(
    new URL("./project-stock-source-freeze-dom.fixture.tsx", import.meta.url),
  );
  const child = Bun.spawn([process.execPath, "--preload", "./scripts/test-preload.ts", fixture], {
    cwd: fileURLToPath(new URL("../../../../../", import.meta.url)),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
  expect(stdout).toContain("Project stock actual owner source-freeze DOM regressions passed");
}, 30_000);
