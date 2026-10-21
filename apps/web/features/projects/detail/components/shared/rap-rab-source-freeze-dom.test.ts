import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("actual RAP/RAB manager preserves reviewed IDs, input DOM, drafts and source choices across incoming revisions, nulls, pending failure and resize", async (): Promise<void> => {
  const fixture = fileURLToPath(
    new URL("./rap-rab-source-freeze-dom.fixture.tsx", import.meta.url),
  );
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
    stdout: expect.stringContaining("RAP/RAB actual manager source-freeze regression passed"),
  });
}, 30_000);
