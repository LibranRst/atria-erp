import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DashboardDetailSection,
  DashboardRowGroup,
  OverviewPreviewSection,
  SectionAction,
} from "./dashboard-primitives";

describe("native editorial dashboard sections", () => {
  test("renders section actions as compact light-blue capsule buttons", () => {
    const html = renderToStaticMarkup(
      <SectionAction href="/ledger?tab=budget" label="Lihat semua" />,
    );

    expect(html).toContain('href="/ledger?tab=budget"');
    expect(html).toContain("h-9");
    expect(html).toContain("bg-accent/8");
    expect(html).toContain("gap-1");
    expect(html).toContain("pl-3 pr-2.5");
    expect(html).toContain("after:-inset-y-1.5");
    expect(html).toContain("text-accent");
    expect(html).toContain('viewBox="0 0 256 256"');
    expect(html).toContain("active:bg-accent/[0.14]");
  });

  test("keeps preview and detail sections inside the established card language", () => {
    const html = renderToStaticMarkup(
      <>
        <OverviewPreviewSection title="Budget berisiko" href="/ledger?tab=budget">
          <span>Preview</span>
        </OverviewPreviewSection>
        <DashboardDetailSection title="Project berisiko">
          <span>Detail</span>
        </DashboardDetailSection>
      </>,
    );

    expect(html).toContain("Budget berisiko");
    expect(html).toContain("Project berisiko");
    expect(html).toContain("rounded-3xl");
    expect(html).toContain("shadow-[0_1px_2px");
    expect(html).toContain("bg-white");
    expect(html).toContain("backdrop-blur-xl");
  });

  test("uses divider grouping inside its parent card", () => {
    const html = renderToStaticMarkup(
      <DashboardRowGroup>
        <div>Baris satu</div>
        <div>Baris dua</div>
      </DashboardRowGroup>,
    );

    expect(html).toContain("divide-y");
    expect(html).not.toContain("bg-white");
  });

  test("removes horizontal dividers for a connected timeline", () => {
    const html = renderToStaticMarkup(
      <DashboardRowGroup connected>
        <div>Hari ini</div>
        <div>Besok</div>
      </DashboardRowGroup>,
    );

    expect(html).not.toContain("divide-y");
    expect(html).toContain("inset-y-0");
    expect(html).toContain("left-13.5");
    expect(html).toContain("max-[430px]:left-12.5");
  });
});
