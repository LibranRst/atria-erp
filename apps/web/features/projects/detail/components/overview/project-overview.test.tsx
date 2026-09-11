import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { UsageBlockMeter } from "@/components/ui";

const projectOverviewPath = new URL("./project-overview.tsx", import.meta.url);

describe("project-overview budget per kategori redesign", () => {
  test("uses Button component with variant='secondary' and size='compact' for Atur alokasi action", async () => {
    const source = await Bun.file(projectOverviewPath).text();

    expect(source).toContain("<SectionHeading");
    expect(source).toContain('title="Budget per kategori"');
    expect(source).toContain("<Button");
    expect(source).toContain('variant="secondary"');
    expect(source).toContain('size="compact"');
    expect(source).toContain("Atur alokasi");
  });

  test("renders budget item list with two cleanly separated rows", async () => {
    const source = await Bun.file(projectOverviewPath).text();

    // Row 1: title + badge with price on the right (justify-between)
    expect(source).toContain("flex items-center justify-between gap-3");
    expect(source).toContain("{category.name}");
    expect(source).toContain("<Badge");
    expect(source).toContain("amount={category.remainingAmount}");

    // Row 2: usage block meter inline with percentage and fixed width to prevent jitter
    expect(source).toContain("<UsageBlockMeter");
    expect(source).toContain("w-12 shrink-0 text-right");
    expect(source).toContain("{category.usedPercentage.toFixed(1)}%");
  });

  test("UsageBlockMeter respects custom className without breaking default spacing", () => {
    const defaultHtml = renderToStaticMarkup(<UsageBlockMeter value={50} tone="positive" />);
    expect(defaultHtml).toContain("mt-2.5");

    const customHtml = renderToStaticMarkup(
      <UsageBlockMeter value={50} tone="positive" className="mt-0 flex-1" />,
    );
    expect(customHtml).toContain("mt-0");
    expect(customHtml).toContain("flex-1");
  });
});
