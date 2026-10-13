import { mock, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { appIconByName } from "@atria/icons";

// Exercise the actual native renderer with host SVG primitives; no OS painting.
mock.module("react-native-svg", () => ({
  Svg: "svg",
  Path: "path",
  Circle: "circle",
  Rect: "rect",
  Line: "line",
  G: "g",
}));
mock.module("nativewind", () => ({}));
const { AppIcon } = await import("./app-icon");

test("all shared aliases render in the native adapter", () => {
  const fallback = renderToStaticMarkup(<AppIcon name="unknown" />);
  for (const name of Object.keys(appIconByName)) {
    const html = renderToStaticMarkup(<AppIcon name={name} />);
    expect(html).not.toBe(fallback);
    expect(html).toContain('width="18"');
    expect(html).toContain('stroke-width="1.5"');
  }
});

test("native caller size, color, labels and legacy weights are preserved", () => {
  const plain = renderToStaticMarkup(
    <AppIcon name="folder" size={24} color="red" accessibilityLabel="Proyek" />,
  );
  expect(plain).toContain('width="24"');
  expect(plain).toContain('color="red"');
  expect(plain).toContain('accessibilityLabel="Proyek"');
  for (const weight of ["thin", "light", "regular", "bold", "fill", "duotone"] as const) {
    expect(
      renderToStaticMarkup(
        <AppIcon name="folder" size={24} color="red" accessibilityLabel="Proyek" weight={weight} />,
      ),
    ).toBe(plain);
  }
});
