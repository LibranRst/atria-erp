import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Approval workspace preserves first-click detail, permissions and a pending decision across resize", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./approval-workspace-dom.fixture.tsx", import.meta.url));
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
  expect({ exitCode, stderr, stdout }).toEqual({
    exitCode: 0,
    stderr: "",
    stdout: expect.stringContaining("Approval workspace integration regression passed"),
  });
}, 30_000);
