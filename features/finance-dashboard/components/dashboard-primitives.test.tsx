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
  test("renders section actions as accessible text links without a pill surface", () => {
    const html = renderToStaticMarkup(
      <SectionAction href="/ledger?tab=budget" label="Lihat semua" />,
    );

    expect(html).toContain('href="/ledger?tab=budget"');
    expect(html).toContain("h-8");
    expect(html).toContain("after:-inset-y-2");
    expect(html).toContain("bg-[#007AFF]/8");
    expect(html).toContain("chevron_right");
    expect(html).not.toContain("bg-primary/5");
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
    expect(html).toContain("rounded-[24px]");
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
    expect(html).toContain("left-[54px]");
    expect(html).toContain("max-[430px]:left-[50px]");
  });
});
