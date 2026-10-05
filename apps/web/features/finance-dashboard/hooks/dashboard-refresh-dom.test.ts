import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("server refresh, pending mutations, permissions and shared controls remain consistent", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./dashboard-refresh-dom.fixture.tsx", import.meta.url));
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
  expect(stdout).toContain("DOM regressions passed");
}, 30_000);
