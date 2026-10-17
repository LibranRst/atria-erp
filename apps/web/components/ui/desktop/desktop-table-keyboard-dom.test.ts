import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
test("optional DesktopTable rows suppress Mac Enter defaults without replacing native selection", async (): Promise<void> => {
  const child = Bun.spawn(
    [
      process.execPath,
      "--preload",
      "./scripts/test-preload.ts",
      fileURLToPath(new URL("./desktop-table-keyboard-dom.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../../../", import.meta.url)), stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
  expect(stdout).toContain("Desktop Table Mac Enter and nested controls passed");
}, 30_000);
