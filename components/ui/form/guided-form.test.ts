import { describe, expect, test } from "bun:test";

const guidedFormPath = new URL("./guided-form.tsx", import.meta.url);

describe("guided form sheet actions", () => {
  test("delegates the two-action footer layout to the shared primitive", async () => {
    const source = await Bun.file(guidedFormPath).text();

    expect(source).toContain('import { SheetFooterActions } from "./sheet-footer-actions"');
    expect(source).toContain("<SheetFooterActions");
    expect(source).not.toContain('? "grid-cols-2"');
    expect(source).not.toContain("actionPlacement");
  });
});
