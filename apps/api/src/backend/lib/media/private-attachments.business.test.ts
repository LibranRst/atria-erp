import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";

test("private attachments enforce database ownership and project permissions", async () => {
  const child = Bun.spawn([
    process.execPath, "--preload", "./scripts/test-preload.ts", "./src/backend/lib/media/fixtures/private-attachments-case.ts",
  ], {
    cwd: fileURLToPath(new URL("../../../..", import.meta.url)), stdout: "pipe", stderr: "pipe",
    env: {
      ...process.env, NODE_ENV: "test", BETTER_AUTH_SECRET: "private-media-fixture-only-secret",
      IMAGEKIT_PRIVATE_KEY: "private-media-test-only-key", IMAGEKIT_URL_ENDPOINT: "https://ik.imagekit.io/disposable",
      NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT: "https://ik.imagekit.io/disposable", WEB_ORIGIN: "https://atria.test", API_PUBLIC_URL: "https://api.atria.test",
    },
  });
  const timeout = setTimeout((): void => { child.kill(); }, 45_000);
  const [output, error, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  clearTimeout(timeout);
  expect({ code, error, output }).toEqual({ code: 0, error: "", output: "Private attachment business checks passed\n" });
}, 60_000);
