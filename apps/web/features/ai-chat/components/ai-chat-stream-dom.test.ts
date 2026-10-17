import { test, expect } from "bun:test";
import { fileURLToPath } from "node:url";

for (const scenario of ["complete", "intro-only", "scroll-mobile", "scroll-desktop"] as const) {
  test(
    scenario === "complete"
      ? "completed SDK stream renders its final reply without reloading history"
      : scenario === "intro-only"
        ? "introduction-only SDK finish preserves pending recovery without a duplicate request"
        : `real SDK conversation promotion and response growth preserve the reading position (${scenario})`,
    async (): Promise<void> => {
      const child = Bun.spawn(
        [
          "bun",
          "--preload",
          "./scripts/test-preload.ts",
          fileURLToPath(new URL("./ai-chat-stream-dom.fixture.tsx", import.meta.url)),
          "normal",
          scenario,
        ],
        {
          cwd: fileURLToPath(new URL("../../../", import.meta.url)),
          stdout: "pipe",
          stderr: "pipe",
        },
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
      expect(stdout).toContain(
        scenario === "complete"
          ? "chat stream final response DOM passed"
          : scenario === "intro-only"
            ? "chat stream introduction-only recovery DOM passed"
            : `chat stream scroll stability DOM passed (${scenario === "scroll-desktop" ? 1280 : 390})`,
      );
    },
    30_000,
  );
}
