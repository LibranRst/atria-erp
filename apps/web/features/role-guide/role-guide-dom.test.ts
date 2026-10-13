import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("guide coordinates routes, overlays, focused drafts, failed acknowledgment and late responses", async () => {
  const child = Bun.spawn(
    [
      "bun",
      "--preload",
      "./scripts/test-preload.ts",
      fileURLToPath(new URL("./role-guide-dom.fixture.tsx", import.meta.url)),
    ],
    {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [output, error, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ exitCode, error }).toEqual({ exitCode: 0, error: "" });
  expect(output).toContain("Role guide DOM regressions passed");
}, 30_000);
