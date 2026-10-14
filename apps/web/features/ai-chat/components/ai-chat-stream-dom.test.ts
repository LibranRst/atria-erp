import { test, expect } from "bun:test";
import { fileURLToPath } from "node:url";

test("completed SDK stream renders its final reply without reloading history", async (): Promise<void> => {
  const child = Bun.spawn(
    [
      "bun",
      "--preload",
      "./scripts/test-preload.ts",
      fileURLToPath(new URL("./ai-chat-stream-dom.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../../../", import.meta.url)), stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  const unexpected = stderr.replaceAll(
    'You are trying to animate opacity from "undefined" to "1". "undefined" is not an animatable value.. For more information and steps for solving, visit https://motion.dev/troubleshooting/value-not-animatable\n',
    "",
  );
  expect({ code, stderr: unexpected }).toEqual({ code: 0, stderr: "" });
  expect(stdout).toContain("chat stream final response DOM passed");
}, 30_000);
