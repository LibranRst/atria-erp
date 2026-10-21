import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("material activity preserves query, focus, narrow selection and complete-row workflow context", async (): Promise<void> => {
  const fixture = fileURLToPath(
    new URL("./material-desktop-activity-dom.fixture.tsx", import.meta.url),
  );
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
  expect(stdout).toContain(
    "material activity owner preserves complete totals, focus, URL filters, response ordering, viewport selection and full-row actions",
  );
}, 30000);
