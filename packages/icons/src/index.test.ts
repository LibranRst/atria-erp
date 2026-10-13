import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { APP_ICON_STROKE_WIDTH, appIconByName, isAppIconName, resolveAppIcon } from "./index";
import { nativeIconImageData, nativeIconImageSource } from "./native-images";

test("every registered glyph can render through the native SVG primitive set", () => {
  const supported = new Set(["path", "circle", "rect", "line", "g", "svg"]);
  expect(Object.keys(appIconByName).length).toBeGreaterThanOrEqual(149);
  for (const [name, data] of Object.entries(appIconByName)) {
    expect(isAppIconName(name)).toBe(true);
    expect(resolveAppIcon(name)).toBe(data);
    expect(data.length).toBeGreaterThan(0);
    for (const [tag] of data) expect(supported.has(tag.toLowerCase())).toBe(true);
  }
  expect(APP_ICON_STROKE_WIDTH).toBe(1.5);
});

test("unknown names and prototype properties use a safe fallback", () => {
  const fallback = resolveAppIcon("unregistered-icon");
  for (const name of ["__proto__", "constructor", "toString", "", "unknown"]) {
    expect(isAppIconName(name)).toBe(false);
    expect(resolveAppIcon(name)).toBe(fallback);
    expect(nativeIconImageData(name)).toBe(nativeIconImageData("unknown"));
  }
});

test("all native control templates are valid 20pt @3x PNGs", () => {
  for (const name of Object.keys(appIconByName)) {
    const bytes = Buffer.from(nativeIconImageData(name), "base64");
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(bytes.readUInt32BE(16)).toBe(60);
    expect(bytes.readUInt32BE(20)).toBe(60);
    const source = nativeIconImageSource(name);
    expect(source.width).toBe(20);
    expect(source.height).toBe(20);
    expect(source.scale).toBe(3);
  }
});

test("registry is independent of React and platform runtimes", () => {
  const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  for (const runtime of [
    "react",
    "react-native",
    "@hugeicons/react",
    "@hugeicons/react-native",
    "node:",
  ]) {
    expect(source).not.toContain(`from "${runtime}"`);
  }
});
