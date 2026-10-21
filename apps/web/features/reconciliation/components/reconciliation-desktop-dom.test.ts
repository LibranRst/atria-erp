import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("desktop reconciliation preserves focus, URL queries, response order, narrow selection and history dates", async (): Promise<void> => {
  const fixture = fileURLToPath(
    new URL("./reconciliation-desktop-dom.fixture.tsx", import.meta.url),
  );
  const child = Bun.spawn(["bun", "--preload", "./scripts/test-preload.ts", fixture], {
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
  expect(stdout).toContain(
    "reconciliation desktop owner preserves focus, queries, response order, viewport selection and history confirmation dates",
  );
}, 30000);
