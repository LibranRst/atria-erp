import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Profile owners keep drafts and restore logical focus after responsive invokers change", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./profile-owner-focus-dom.fixture.tsx", import.meta.url));
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
    stdout: expect.stringContaining("Profile owner responsive focus regression passed"),
  });
}, 30_000);
