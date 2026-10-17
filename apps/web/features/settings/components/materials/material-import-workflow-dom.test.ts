import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("actual material import owners keep current file intent, recover failures, paginate exact previews and return focus after resize", async (): Promise<void> => {
  const fixture = fileURLToPath(
    new URL("./material-import-workflow-dom.fixture.tsx", import.meta.url),
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
  expect(stdout).toContain("Material import workflow DOM regression passed");
}, 45_000);
