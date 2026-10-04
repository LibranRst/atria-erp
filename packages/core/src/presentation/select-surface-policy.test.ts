import { describe, expect, test } from "bun:test";
import {
  canUseCustomSelectValue,
  filterSelectOptions,
  resolveSelectPresentation,
  selectDialogNeedsSearch,
} from "./select-surface-policy";
const options = (count: number): { value: string; label: string }[] =>
  Array.from({ length: count }, (_, index) => ({
    value: String(index),
    label: `Pilihan ${index}`,
  }));

describe("shared selection policy", () => {
  test("searches human-readable context while preserving option identity", () => {
    const choices = [
      { value: "one", label: "Cat", meta: "Dulux", group: "Finishing" },
      { value: "two", label: "Kayu", description: "Plywood" },
    ];
    expect(filterSelectOptions(choices, " DULUX ")[0]).toBe(choices[0]);
    expect(filterSelectOptions(choices, "finishing")[0]).toBe(choices[0]);
    expect(filterSelectOptions(choices, "plywood")[0]).toBe(choices[1]);
    expect(filterSelectOptions(choices, "  ")).toBe(choices);
  });
  test("custom values reject empty and equivalent presets", () => {
    const choices = [{ value: "Renovasi interior" }];
    expect(canUseCustomSelectValue(choices, "  ")).toBe(false);
    expect(canUseCustomSelectValue(choices, " RENOVASI INTERIOR ")).toBe(false);
    expect(canUseCustomSelectValue(choices, "Kitchen set")).toBe(true);
  });
  test("zero through six options stay anchored; seven needs search", () => {
    for (const count of [0, 1, 6])
      expect(resolveSelectPresentation({ options: options(count) })).toBe("menu");
    expect(resolveSelectPresentation({ options: options(7) })).toBe("dialog");
  });
  test("rich rows do not change presentation", () => {
    const rich = [
      {
        value: "one",
        label: "Satu",
        description: "Info",
        group: "Grup",
        meta: "Meta",
        disabled: true,
        disabledReason: "Belum siap",
      },
    ];
    expect(resolveSelectPresentation({ options: rich })).toBe("menu");
  });
  test("create and custom entries need search", () => {
    expect(selectDialogNeedsSearch({ options: [], hasCreateAction: true })).toBe(true);
    expect(resolveSelectPresentation({ options: options(2), hasCustomValue: true })).toBe("dialog");
  });
  test("explicit presentation and deprecated sheet alias retain their contracts", () => {
    expect(resolveSelectPresentation({ options: options(7), presentation: "menu" })).toBe("menu");
    for (const presentation of ["dialog", "sheet"] as const)
      expect(resolveSelectPresentation({ options: [], presentation })).toBe("dialog");
  });
});
