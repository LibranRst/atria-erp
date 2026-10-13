import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("public desktop Button native pointer click opens its UI inside a selectable HeroUI table", async (): Promise<void> => {
  const fixture = fileURLToPath(new URL("./desktop-button-dom.fixture.tsx", import.meta.url));
  const child = Bun.spawn(["bun", "--preload", "./scripts/test-preload.ts", fixture], {
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
  expect(stdout).toContain("public desktop Button pointer regression passed");
}, 30_000);
