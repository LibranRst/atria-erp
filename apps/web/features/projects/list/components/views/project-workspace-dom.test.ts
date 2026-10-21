import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Project workspace keeps complete table results and edit/create drafts across responsive changes", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./project-workspace-dom.fixture.tsx", import.meta.url));
  const child = Bun.spawn([process.execPath, "--preload", "./scripts/test-preload.ts", fixture], {
    cwd: fileURLToPath(new URL("../../../../../", import.meta.url)),
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
    stdout: expect.stringContaining("Project workspace integration regression passed"),
  });
}, 30_000);
