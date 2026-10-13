import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
test("RAB workflow review preserves pagination and protects confirmation, stale data and budget access", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./rab-workflow-dom.fixture.tsx", import.meta.url));
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
  expect(stdout).toContain("RAB workflow DOM passed");
}, 30000);
