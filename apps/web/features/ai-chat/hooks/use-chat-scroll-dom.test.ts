import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

for (const width of [390, 1280] as const) {
  test(`streaming preserves question and reader scroll (${width}px)`, async (): Promise<void> => {
    const fixture = fileURLToPath(new URL("./use-chat-scroll-dom.fixture.tsx", import.meta.url));
    const child = Bun.spawn(
      ["bun", "--preload", "./scripts/test-preload.ts", fixture, String(width)],
      {
        cwd: fileURLToPath(new URL("../../../", import.meta.url)),
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
    expect(stdout).toContain(`chat scroll DOM passed (${width}px)`);
  }, 15_000);
}
