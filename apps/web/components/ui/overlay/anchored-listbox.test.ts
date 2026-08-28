import { describe, expect, test } from "bun:test";

const sourcePath = new URL("./anchored-listbox.tsx", import.meta.url);

describe("AnchoredListbox contextual options", () => {
  test("keeps descriptions, groups, and disabled reasons in the dropdown", async () => {
    const source = await Bun.file(sourcePath).text();

    expect(source).toContain("option.group");
    expect(source).toContain("option.description || option.meta || option.disabledReason");
    expect(source).toContain("option.disabledReason ?? option.description ?? option.meta");
    expect(source).toContain('aria-disabled={option.disabled ? "true" : undefined}');
    expect(source).toContain("aria-describedby={reasonId}");
    expect(source).not.toContain("disabled={option.disabled}");
    expect(source).toContain("options.length === 0");
    expect(source).toContain("{emptyText}");
  });
});
