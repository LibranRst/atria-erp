import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("receipt native file-picker controls retain validation, retry and busy guards", async (): Promise<void> => {
  const fixture = fileURLToPath(
    new URL("./expense-receipt-upload-dom.fixture.tsx", import.meta.url),
  );
  const child = Bun.spawn([process.execPath, "--preload", "./scripts/test-preload.ts", fixture], {
    cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
  expect(stdout).toContain(
    "Receipt upload native controls preserve file selection, validation, retry and busy guards",
  );
}, 30_000);
