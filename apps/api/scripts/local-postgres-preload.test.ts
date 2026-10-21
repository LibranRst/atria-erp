import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

async function probe(
  url: string,
  production = false,
  empty = false,
): Promise<{ code: number; output: string; error: string }> {
  const child = Bun.spawn(
    [
      process.execPath,
      "--preload",
      "./scripts/local-postgres-preload.ts",
      "-e",
      'console.log(process.env.ATRIA_TEST_EMPTY_DATABASE_URL ? "empty" : "seeded")',
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: {
        ...process.env,
        NODE_ENV: production ? "production" : "test",
        ATRIA_LOCAL_TEST_DATABASE_URL: url,
        ATRIA_LOCAL_TEST_MODE: empty ? "empty" : "seeded",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [code, output, error] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { code, output, error };
}

test("preload menolak host remote dan database bukan audit", async () => {
  for (const url of [
    "postgresql://user:pass@example.invalid/atria_audit_seed",
    "postgresql://user:pass@127.0.0.1/production",
  ]) {
    const result = await probe(url);
    expect(result.code).not.toBe(0);
    expect(result.error).toContain("Preload hanya menerima");
  }
});

test("preload tidak dapat dipakai dengan NODE_ENV production", async () => {
  expect((await probe("postgresql://user:pass@127.0.0.1/atria_audit_seed", true)).code).not.toBe(0);
});

test("preload memisahkan gerbang seeded dan empty tanpa membuka koneksi", async () => {
  const url = "postgresql://user:pass@127.0.0.1:1/atria_audit_seed";
  expect(await probe(url)).toEqual({ code: 0, output: "seeded\n", error: "" });
  expect(await probe(url, false, true)).toEqual({ code: 0, output: "empty\n", error: "" });
});
