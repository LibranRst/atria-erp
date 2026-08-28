import { describe, expect, test } from "bun:test";

import {
  resolveSelectPresentation,
  SIMPLE_SELECT_OPTION_LIMIT,
} from "./interaction-surface-policy";

function simpleOptions(count: number): Array<{ value: string; label: string }> {
  return Array.from({ length: count }, (_, index) => ({
    value: String(index),
    label: `Pilihan ${index + 1}`,
  }));
}

describe("resolveSelectPresentation", () => {
  test("uses an anchored menu for one through six simple options", () => {
    expect(resolveSelectPresentation({ options: simpleOptions(1) })).toBe("menu");
    expect(resolveSelectPresentation({ options: simpleOptions(SIMPLE_SELECT_OPTION_LIMIT) })).toBe(
      "menu",
    );
  });

  test("keeps empty and non-search lists anchored, but searches long lists", () => {
    expect(resolveSelectPresentation({ options: [] })).toBe("menu");
    expect(resolveSelectPresentation({ options: simpleOptions(7) })).toBe("dialog");
  });

  test("keeps contextual options anchored when search is unnecessary", () => {
    const contextualFields = [
      { description: "Keterangan" },
      { meta: "Metadata" },
      { group: "Grup" },
      { disabledReason: "Belum tersedia", disabled: true },
    ] as const;

    for (const context of contextualFields) {
      expect(
        resolveSelectPresentation({
          options: [{ value: "one", label: "Satu", ...context }],
        }),
      ).toBe("menu");
    }
  });

  test("keeps create actions inside a searchable dialog", () => {
    expect(resolveSelectPresentation({ options: simpleOptions(2), hasCreateAction: true })).toBe(
      "dialog",
    );
  });

  test("honors explicit overrides and maps deprecated sheet to dialog", () => {
    expect(resolveSelectPresentation({ options: simpleOptions(12), presentation: "menu" })).toBe(
      "menu",
    );
    expect(resolveSelectPresentation({ options: simpleOptions(2), presentation: "dialog" })).toBe(
      "dialog",
    );
    expect(resolveSelectPresentation({ options: simpleOptions(2), presentation: "sheet" })).toBe(
      "dialog",
    );
  });
});
