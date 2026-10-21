import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Global project expense and vendor forms preserve fixed route context", async (): Promise<void> => {
  const fixture = fileURLToPath(
    new URL("./project-expense-route-forms-dom.fixture.tsx", import.meta.url),
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
  expect(stdout).toContain(
    "Global project expense and vendor forms keep route context through delayed bootstrap and resize",
  );
}, 30_000);
