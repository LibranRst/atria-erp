import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("actual Margin owner preserves reviewed sources, closing draft and permission/confirmation guards", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./project-margin-owner-dom.fixture.tsx", import.meta.url));
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
  expect(stdout).toContain("Project Margin actual owner DOM regressions passed");
}, 30_000);
