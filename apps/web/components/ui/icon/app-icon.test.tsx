import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppIcon } from "./app-icon";
import { appIconByName } from "@atria/icons";

test("all shared names render real Hugeicons instead of the fallback", () => {
  const fallback = renderToStaticMarkup(<AppIcon name="unregistered-test-icon" />);
  for (const name of Object.keys(appIconByName)) {
    const html = renderToStaticMarkup(<AppIcon name={name} />);
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('stroke-width="1.5"');
    expect(html).not.toEqual(fallback);
  }
});

test("legacy weights keep the free outline treatment and SVG sizing", () => {
  const regular = renderToStaticMarkup(<AppIcon name="folder" className="icon-lg" />);
  for (const weight of ["thin", "light", "regular", "bold", "fill", "duotone"] as const) {
    expect(
      renderToStaticMarkup(<AppIcon name="folder" weight={weight} className="icon-lg" />),
    ).toBe(regular);
  }
  expect(regular).toContain('width="1em"');
  expect(regular).toContain('class="icon-lg"');
  expect(regular).not.toContain("scale-110");
});

test("review disclosure states render opposite carets instead of the question fallback", () => {
  const fallback = renderToStaticMarkup(<AppIcon name="unregistered-test-icon" />);
  const collapsed = renderToStaticMarkup(<AppIcon name="expand_more" />);
  const expanded = renderToStaticMarkup(<AppIcon name="expand_less" />);
  expect(collapsed).not.toEqual(fallback);
  expect(expanded).not.toEqual(fallback);
  expect(expanded).not.toEqual(collapsed);
});

test("chat stop and interrupted-state icons render real icons instead of the question fallback", () => {
  const fallback = renderToStaticMarkup(<AppIcon name="unregistered-test-icon" />);
  for (const name of ["stop", "stop_circle"]) {
    const icon = renderToStaticMarkup(<AppIcon name={name} />);
    expect(icon).toContain("<svg");
    expect(icon).not.toEqual(fallback);
  }
});
