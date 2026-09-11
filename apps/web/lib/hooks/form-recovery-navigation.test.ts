import { describe, expect, test } from "bun:test";

const recoverySources = [
  new URL("./use-local-form-recovery.ts", import.meta.url),
  new URL("../../features/expenses/hooks/use-hybrid-expense-draft.ts", import.meta.url),
  new URL("../../features/expenses/hooks/use-hybrid-vendor-bill-draft.ts", import.meta.url),
];

describe("form recovery navigation", () => {
  test("does not install a native unload prompt for data already persisted locally", async () => {
    const sources = await Promise.all(recoverySources.map((source) => Bun.file(source).text()));

    for (const source of sources) {
      expect(source).not.toContain('addEventListener("beforeunload"');
    }
  });
});
