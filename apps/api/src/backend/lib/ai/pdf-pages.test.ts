import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";

const fixture = new URL("./fixtures/pdf-pages-case.ts", import.meta.url);

describe("PDF page rasterization isolated from API credentials", (): void => {
  for (const scenario of [
    "render",
    "limits",
    "image-limit",
    "concurrency-abort",
    "environment",
    "deadline",
  ]) {
    it(
      scenario,
      async (): Promise<void> => {
        const child = Bun.spawn(
          [process.execPath, "--no-env-file", fileURLToPath(fixture), scenario],
          {
            env: {
              NODE_ENV: "test",
              DATABASE_URL: "postgresql://synthetic:synthetic@invalid.invalid/never_used",
              IMAGEKIT_PRIVATE_KEY: "synthetic-private-key",
              NINEROUTER_API_KEY: "synthetic-gateway-key",
            },
            stdout: "pipe",
            stderr: "pipe",
          },
        );
        const [stdout, stderr, exitCode] = await Promise.all([
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
          child.exited,
        ]);
        expect(exitCode).toBe(0);
        expect(stderr).toBe("");
        expect(stdout.trim()).toBe("PASS");
      },
      25_000,
    );
  }
});
