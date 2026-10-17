import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Expenses native selection follows visible detail across 1093/1280/1440 without clearing explicit IDs", async (): Promise<void> => {
  const fixture = fileURLToPath(
    new URL("./expense-selection-viewport-dom.fixture.tsx", import.meta.url),
  );
  const child = Bun.spawn([process.execPath, "--preload", "./scripts/test-preload.ts", fixture], {
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
  expect(stdout).toContain("Expenses claims/bills/payments viewport selection regression passed");
}, 30_000);
