import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("material CSV preview reuses tenant-scoped references and stays read-only", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./fixtures/material-import-case.ts", import.meta.url));
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
  expect(stdout).toContain("Material import tenant preview regression passed");
}, 30_000);
