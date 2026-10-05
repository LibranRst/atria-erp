import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Next adapter preserves action cookies, session dates, navigation, and successful typed revalidation", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      "--preload",
      "./scripts/test-preload.ts",
      "./lib/api/fixtures/backend-case.ts",
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), stdout: "pipe", stderr: "pipe" },
  );
  const [output, error, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ code, error, output }).toEqual({
    code: 0,
    error: "",
    output: "Backend web adapter passed\n",
  });
});
