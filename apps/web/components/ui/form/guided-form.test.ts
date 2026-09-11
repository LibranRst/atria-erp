import { describe, expect, test } from "bun:test";

const guidedFormPath = new URL("./guided-form.tsx", import.meta.url);

describe("guided form sheet actions", () => {
  test("delegates the two-action footer layout to the shared primitive", async () => {
    const source = await Bun.file(guidedFormPath).text();

    expect(source).toContain(
      'import { SheetFooterActions } from "../overlay/sheet-footer-actions"',
    );
    expect(source).toContain("<SheetFooterActions");
    expect(source).not.toContain('? "grid-cols-2"');
    expect(source).not.toContain("actionPlacement");
  });
});

describe("FormDisclosure motion container", () => {
  test("allows overflow to transition to visible so shadows and focus rings are not clipped", async () => {
    const source = await Bun.file(guidedFormPath).text();

    expect(source).toContain('transitionEnd: { overflow: "visible" }');
    expect(source).toContain('exit={{ opacity: 0, height: 0, overflow: "hidden" }}');
  });
});

describe("decimalValue normalization", () => {
  test("strips unwanted leading zeros when typing integers", async () => {
    const { decimalValue } = await import("./form-control-utils");
    expect(decimalValue("01")).toBe("1");
    expect(decimalValue("001")).toBe("1");
    expect(decimalValue("05")).toBe("5");
    expect(decimalValue("0123")).toBe("123");
  });

  test("normalizes multiple zeros into a single zero", async () => {
    const { decimalValue } = await import("./form-control-utils");
    expect(decimalValue("00")).toBe("0");
    expect(decimalValue("000")).toBe("0");
    expect(decimalValue("0")).toBe("0");
  });

  test("preserves valid decimals starting with zero", async () => {
    const { decimalValue } = await import("./form-control-utils");
    expect(decimalValue("0.")).toBe("0.");
    expect(decimalValue("0.5")).toBe("0.5");
    expect(decimalValue("0.25")).toBe("0.25");
    expect(decimalValue("0.05")).toBe("0.05");
  });

  test("auto-prepends 0 when decimal point is typed first", async () => {
    const { decimalValue } = await import("./form-control-utils");
    expect(decimalValue(".5")).toBe("0.5");
    expect(decimalValue(".25")).toBe("0.25");
  });

  test("cleans up leading zeros before decimal point", async () => {
    const { decimalValue } = await import("./form-control-utils");
    expect(decimalValue("00.5")).toBe("0.5");
    expect(decimalValue("001.5")).toBe("1.5");
  });

  test("discards duplicate decimal points", async () => {
    const { decimalValue } = await import("./form-control-utils");
    expect(decimalValue("1.2.3")).toBe("1.23");
    expect(decimalValue("0..5")).toBe("0.5");
  });

  test("handles empty string and standard positive numbers", async () => {
    const { decimalValue } = await import("./form-control-utils");
    expect(decimalValue("")).toBe("");
    expect(decimalValue("100")).toBe("100");
    expect(decimalValue("2500000")).toBe("2500000");
  });

  test("replaces comma with dot for Indonesian locale typing", async () => {
    const { decimalValue } = await import("./form-control-utils");
    expect(decimalValue("12,5")).toBe("12.5");
    expect(decimalValue("0,75")).toBe("0.75");
  });
});
