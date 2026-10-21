import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("RAP material and package editors expose failed saves and retain corrections for a single retry", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./rap-editor-feedback-dom.fixture.tsx", import.meta.url));
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
  expect(stdout).toContain("RAP editor feedback DOM regression passed");
}, 30_000);
