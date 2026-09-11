import { describe, expect, test } from "bun:test";

const sheetPath = new URL("./semantic-sheets.tsx", import.meta.url);

describe("semantic form-sheet dismissal", () => {
  test("requires an explicit policy and centralizes dirty confirmation", async () => {
    const source = await Bun.file(sheetPath).text();

    expect(source).toContain('readonly mode: "discard"');
    expect(source).toContain('readonly mode: "confirm"');
    expect(source).toContain('readonly mode: "preserve"');
    expect(source).toContain('readonly mode: "managed"');
    expect(source).toContain("readonly dismissal: FormSheetDismissal");
    expect(source).toContain("<ConfirmationDialog");
    expect(source).toContain('confirmLabel="Buang perubahan"');
    expect(source).toContain("const closeBlocked = pending || Boolean(dismissal.blocked)");
  });

  test("keeps read-only DetailSheet outside the editable dismissal contract", async () => {
    const source = await Bun.file(sheetPath).text();

    expect(source).toContain("export type DetailSheetProps = BottomSheetProps");
    expect(source).toContain("export function DetailSheet");
  });
});
