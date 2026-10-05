import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { describeIntegration } from "@backend/lib/testing/integration-db";

describeIntegration("izin efektif melalui HTTP dan sesi Better Auth asli", () => {
  test("token yang sama kehilangan izin segera setelah pencabutan", async () => {
    const preload = process.env.ATRIA_LOCAL_TEST_DATABASE_URL
      ? "./scripts/local-postgres-preload.ts"
      : "./scripts/test-preload.ts";
    const child = Bun.spawn(
      [
        process.execPath,
        "--preload",
        preload,
        "./src/backend/lib/auth/fixtures/bearer-http-case.ts",
      ],
      {
        cwd: fileURLToPath(new URL("../../../..", import.meta.url)),
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [code, output, error] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect({ code, output, error }).toEqual({
      code: 0,
      output: "HTTP bearer permission checks passed\n",
      error: "",
    });
  }, 30_000);
});
