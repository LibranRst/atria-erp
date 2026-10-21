import { expect, test } from "bun:test";
test("bank reconciliation selection stays optimistic and serial, confirm uses owned revision and privacy holds", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "run",
      "--preload",
      "./scripts/test-preload.ts",
      "./features/ai-chat/components/proposal-cards/reconciliation-dom.fixture.tsx",
    ],
    { cwd: process.cwd(), stdout: "pipe", stderr: "pipe", timeout: 30000 },
  );
  expect(new TextDecoder().decode(result.stderr)).toBe("");
  expect(new TextDecoder().decode(result.stdout)).toContain(
    "reconciliation optimistic selection and protected confirmation DOM passed",
  );
  expect(result.exitCode).toBe(0);
});
