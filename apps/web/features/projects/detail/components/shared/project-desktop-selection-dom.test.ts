import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("project desktop collections start unselected and support pointer/keyboard deselection across resize", async (): Promise<void> => {
  const fixture = fileURLToPath(
    new URL("./project-desktop-selection-dom.fixture.tsx", import.meta.url),
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
  expect({ code, stderr, stdout }).toEqual({
    code: 0,
    stderr: "",
    stdout: expect.stringContaining("Project desktop optional selection matrix passed"),
  });
}, 30_000);
