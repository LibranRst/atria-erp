import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

test.each(["empty", "future-queued", "future-lease", "snapshot-race", "read-failure", "cancelled"])(
  "material recovery polls actual work and leaves an empty database idle: %s",
  async (mode): Promise<void> => {
    const fixture = fileURLToPath(
      new URL("./fixtures/material-analysis-recovery-case.ts", import.meta.url),
    );
    const child = Bun.spawn([process.execPath, "--no-env-file", "--no-install", fixture, mode], {
      cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://disabled:disabled@127.0.0.1:1/no_live_database",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    if (code !== 0) throw new Error(`Recovery fixture failed: ${stdout}\n${stderr}`);
    expect(stdout).toContain("material recovery fixture passed");
  },
  10000,
);

test("the60s startup recovery gate remains shutdown-aware and drain keeps30-step bound", () => {
  const index = readFileSync(fileURLToPath(new URL("../../../index.ts", import.meta.url)), "utf8");
  expect(index).toMatch(/if\s*\(\s*!draining\s*&&\s*materialAnalysisRecoveryNeeded\(\)\s*\)/);
  expect(index).toContain("setInterval(recoverMaterialAnalysis, 60_000)");
  expect(index).toContain("recoverMaterialAnalysis();");
  const worker = readFileSync(
    fileURLToPath(new URL("./material-analysis-worker.ts", import.meta.url)),
    "utf8",
  );
  expect(worker).toContain("step < 30");
});
