import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  calculateCenteredScrollLeft,
  SegmentedTabs,
  shouldContainSegmentedTabWheel,
} from "./segmented-tabs";

describe("segmented tabs", () => {
  test("marks the active item inside an overflow-capable tablist", () => {
    const html = renderToStaticMarkup(
      <SegmentedTabs
        value="budget"
        onChange={() => undefined}
        ariaLabel="Dashboard tabs"
        scrollable
        options={[
          { value: "overview", label: "Ringkasan" },
          { value: "budget", label: "Budget", count: 2 },
          { value: "materials", label: "Material" },
        ]}
      />,
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("touch-pan-x");
    expect(html).toContain("overscroll-x-contain");
    expect(html).toContain('data-indicator-id="segmented-tabs-active-dashboard-tabs"');
    expect(html).toContain("pointer-events-none absolute inset-y-0");
  });

  test("keeps compact tabs visually short with an expanded touch area", () => {
    const html = renderToStaticMarkup(
      <SegmentedTabs
        value="overview"
        onChange={() => undefined}
        ariaLabel="Compact dashboard tabs"
        scrollable
        density="compact"
        options={[
          { value: "overview", label: "Ringkasan" },
          { value: "budget", label: "Budget", count: 2 },
        ]}
      />,
    );

    expect(html).toContain("h-10 min-h-10");
    expect(html).toContain("after:-inset-y-1");
    expect(html).toContain("inline-grid h-5 min-w-5");
    expect(html).toContain("max-[430px]:h-4.5 max-[430px]:min-w-4.5");
    expect(html).toContain("translate-y-px");
  });

  test("fills spare width while preserving intrinsic overflow", () => {
    const html = renderToStaticMarkup(
      <SegmentedTabs
        value="all"
        onChange={() => undefined}
        ariaLabel="Adaptive approval filters"
        scrollable
        fillAvailableSpace
        density="compact"
        options={[
          { value: "all", label: "Semua", count: 4 },
          { value: "field", label: "Lapangan" },
          { value: "vendor", label: "Vendor", count: 4 },
          { value: "risk", label: "Risiko" },
        ]}
      />,
    );

    expect(html).toContain("min-w-max flex-1 px-3 whitespace-nowrap");
    expect(html).toContain("w-max min-w-full");
    expect(html).toContain("overflow-x-auto");
  });

  test("centers the active tab inside its horizontal scroller only", () => {
    expect(
      calculateCenteredScrollLeft({
        itemLeft: 360,
        itemWidth: 100,
        viewportWidth: 320,
        scrollWidth: 760,
      }),
    ).toBe(250);
    expect(
      calculateCenteredScrollLeft({
        itemLeft: 10,
        itemWidth: 90,
        viewportWidth: 320,
        scrollWidth: 760,
      }),
    ).toBe(0);
    expect(
      calculateCenteredScrollLeft({
        itemLeft: 720,
        itemWidth: 90,
        viewportWidth: 320,
        scrollWidth: 760,
      }),
    ).toBe(440);
  });

  test("contains any vertical touchpad delta inside the tab scroller", () => {
    expect(shouldContainSegmentedTabWheel(0)).toBeFalse();
    expect(shouldContainSegmentedTabWheel(0.25)).toBeTrue();
    expect(shouldContainSegmentedTabWheel(-12)).toBeTrue();
  });

  test("keeps unavailable tabs focusable so they can explain the lock", () => {
    const html = renderToStaticMarkup(
      <SegmentedTabs
        value="planning"
        onChange={() => undefined}
        onUnavailableSelect={() => undefined}
        ariaLabel="Project domains"
        options={[
          { value: "planning", label: "Perencanaan" },
          {
            value: "operations",
            label: "Operasional",
            unavailable: true,
            unavailableReason: "Selesaikan perencanaan dahulu.",
          },
        ]}
      />,
    );

    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('title="Selesaikan perencanaan dahulu."');
    expect(html).not.toContain('disabled=""');
  });
});
