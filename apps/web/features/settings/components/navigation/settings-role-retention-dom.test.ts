import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
test("Settings role reads survive entity/main tab remount and refresh safely after mutations and scope changes", async (): Promise<void> => {
  const fixture = fileURLToPath(
    new URL("./settings-role-retention-dom.fixture.tsx", import.meta.url),
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
  expect({ code, stderr, stdout }).toEqual({
    code: 0,
    stderr: "",
    stdout: expect.stringContaining("Settings roles retained read owner regression passed"),
  });
}, 30000);
