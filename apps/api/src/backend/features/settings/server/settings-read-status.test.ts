import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Settings distinguishes rejected/failed/denied sources from valid empty data", async (): Promise<void> => {
  const child = Bun.spawn(
    [
      process.execPath,
      "--preload",
      "./scripts/test-preload.ts",
      "./src/backend/features/settings/server/settings-read-status-case.fixture.ts",
    ],
    {
      cwd: fileURLToPath(new URL("../../../../../", import.meta.url)),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
  expect(stdout).toContain("Settings source status passed");
}, 30_000);
