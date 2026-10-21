import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("document AI uses the selected gateway for JSON, image and PDF without leaking failures", async (): Promise<void> => {
  const fixture = new URL("./fixtures/document-model-case.ts", import.meta.url);
  const child = Bun.spawn([process.execPath, "--no-env-file", fileURLToPath(fixture)], {
    cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
    env: { ...Bun.env, NODE_ENV: "test" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect(exitCode).toBe(0);
  expect(stderr).toBe("");
  expect(stdout).toContain("document model checks passed");
}, 20_000);
