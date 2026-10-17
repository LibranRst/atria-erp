import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
test("sheet owners restore after exit, nested discard, conditional unmount and respect moved focus", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./sheet-focus-return-dom.fixture.tsx", import.meta.url));
  const child = Bun.spawn([process.execPath, "--preload", "./scripts/test-preload.ts", fixture], {
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
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
    stdout: expect.stringContaining("Sheet exit focus return regressions passed"),
  });
}, 30000);
