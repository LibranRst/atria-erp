import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("shared overlay focus and viewport events keep editable fields above the keyboard", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./overlay-keyboard-dom.fixture.tsx", import.meta.url));
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
  expect(stdout).toContain("Overlay keyboard DOM regressions passed");
}, 30_000);
