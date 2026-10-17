import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("RAB export retains latest file intent and verifies source before releasing an in-memory artifact", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./rab-export-lifecycle-dom.fixture.tsx", import.meta.url));
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
  expect(stdout).toContain(
    "RAB export lifecycle, normalized logos and source release regressions passed",
  );
}, 30000);
