import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ColorPickerField,
  CustomColorPicker,
  hexToHsv,
  hsvToHex,
  isValidHex,
  normalizeHex,
} from "./color-picker";

describe("CustomColorPicker unit & math tests", () => {
  it("converts hex to hsv correctly", () => {
    const black = hexToHsv("#000000");
    expect(black.s).toBe(0);
    expect(black.v).toBe(0);

    const white = hexToHsv("#FFFFFF");
    expect(white.s).toBe(0);
    expect(white.v).toBe(1);

    const red = hexToHsv("#FF0000");
    expect(red.h).toBe(0);
    expect(red.s).toBe(1);
    expect(red.v).toBe(1);

    const green = hexToHsv("#00FF00");
    expect(green.h).toBe(120);
    expect(green.s).toBe(1);
    expect(green.v).toBe(1);

    const blue = hexToHsv("#0000FF");
    expect(blue.h).toBe(240);
    expect(blue.s).toBe(1);
    expect(blue.v).toBe(1);
  });

  it("converts hsv to hex roundtrip accurately", () => {
    const colors = ["#181817", "#97371F", "#0F172A", "#1C2E24", "#FF0000", "#00FF00", "#0000FF"];
    for (const hex of colors) {
      const hsv = hexToHsv(hex);
      const res = hsvToHex(hsv.h, hsv.s, hsv.v);
      expect(res).toBe(hex);
    }
  });

  it("validates hex correctly", () => {
    expect(isValidHex("#181817")).toBe(true);
    expect(isValidHex("#fff")).toBe(false);
    expect(isValidHex("181817")).toBe(false);
    expect(isValidHex("#GGGGGG")).toBe(false);
    expect(isValidHex("#1234567")).toBe(false);
  });

  it("normalizes hex strings with auto-hash prefix", () => {
    expect(normalizeHex("181817")).toBe("#181817");
    expect(normalizeHex("#97371f")).toBe("#97371F");
    expect(normalizeHex("#123456789")).toBe("#123456");
  });

  it("renders CustomColorPicker markup cleanly with accessibility attributes", () => {
    const html = renderToStaticMarkup(
      <CustomColorPicker
        value="#97371F"
        onChange={() => {}}
        presets={[
          { id: "obsidian", name: "Obsidian Black", hex: "#181817" },
          { id: "terracotta", name: "Terracotta", hex: "#97371F" },
        ]}
      />,
    );

    expect(html).toContain("#97371F");
    expect(html).toContain("Obsidian Black");
    expect(html).toContain("Terracotta");
    expect(html).toContain('placeholder="#181817"');
    expect(html).toContain('aria-label="Pemilih warna kustom: kode HEX"');
  });

  it("renders ColorPickerField with label and helper text", () => {
    const html = renderToStaticMarkup(
      <ColorPickerField
        label="Warna Dokumen"
        helper="Tentukan warna aksen"
        value="#181817"
        onChange={() => {}}
      />,
    );

    expect(html).toContain("Warna Dokumen");
    expect(html).toContain("Tentukan warna aksen");
    expect(html).toContain("#181817");
  });
});
