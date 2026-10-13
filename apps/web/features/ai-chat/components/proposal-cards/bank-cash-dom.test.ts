import { expect, test } from "bun:test";
test("bank cash protects confirmation, pending retry identity and revoked read snapshots", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "run",
      "--preload",
      "./scripts/test-preload.ts",
      "./features/ai-chat/components/proposal-cards/bank-cash-dom.fixture.tsx",
    ],
    { cwd: process.cwd(), stdout: "pipe", stderr: "pipe", timeout: 30000 },
  );
  expect(new TextDecoder().decode(result.stderr)).toBe("");
  expect(new TextDecoder().decode(result.stdout)).toContain(
    "bank cash confirmation and permission DOM regression passed",
  );
  expect(result.exitCode).toBe(0);
});
