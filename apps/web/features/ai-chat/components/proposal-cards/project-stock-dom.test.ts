import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
test("Project stock review protects explicit confirmation, exact retry identity, pagination and budget privacy", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./project-stock-dom.fixture.tsx", import.meta.url));
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
  expect(stdout).toContain("Project stock DOM passed");
}, 30000);
