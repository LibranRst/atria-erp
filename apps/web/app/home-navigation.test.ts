import { test } from "bun:test";
import { fileURLToPath } from "node:url";

for (const scenario of [
  "ledger",
  "onboarding",
  "password",
  "anonymous",
  "mobile",
  "projects",
  "other-surface",
]) {
  test(`Home preserves ${scenario} destination with one backend request`, async (): Promise<void> => {
    const fixture = fileURLToPath(new URL("./fixtures/home-navigation-case.ts", import.meta.url));
    const child = Bun.spawn(
      [
        process.execPath,
        "--no-env-file",
        "--no-install",
        "--preload",
        "./scripts/test-preload.ts",
        fixture,
        scenario,
      ],
      {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        env: {
          PATH: process.env.PATH,
          NODE_ENV: "test",
          API_ORIGIN: "https://fixture-api.invalid",
          API_BRIDGE_SECRET: "home-fixture-bridge-secret-for-isolated-tests",
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
    if (code !== 0) throw new Error(`Home fixture ${scenario} failed: ${output}\n${error}`);
    if (output.trim() !== "Home navigation fixture passed")
      throw new Error("Fixture did not finish.");
  }, 10_000);
}
