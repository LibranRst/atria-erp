import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DetailSection, RowGroup, SectionAction, SummaryFact } from "@/components/ui";
import { OverviewPreviewSection } from "./dashboard-primitives";

describe("native editorial dashboard sections", () => {
  test("renders section actions as compact neutral capsule buttons", () => {
    const html = renderToStaticMarkup(
      <SectionAction href="/ledger?tab=budget" label="Lihat semua" />,
    );

    expect(html).toContain('href="/ledger?tab=budget"');
    expect(html).toContain("h-8");
    expect(html).toContain("bg-surface-container-low");
    expect(html).toContain("gap-1");
    expect(html).toContain("pl-3 pr-2.5");
    expect(html).toContain("after:-inset-y-2");
    expect(html).toContain("text-on-surface-variant");
    expect(html).toContain('viewBox="0 0 256 256"');
    expect(html).toContain("active:bg-surface-container");
  });

  test("keeps preview and detail sections inside the established card language", () => {
    const html = renderToStaticMarkup(
      <>
        <OverviewPreviewSection title="Budget berisiko" href="/ledger?tab=budget">
          <span>Preview</span>
        </OverviewPreviewSection>
        <DetailSection title="Project berisiko">
          <span>Detail</span>
        </DetailSection>
      </>,
    );

    expect(html).toContain("Budget berisiko");
    expect(html).toContain("Project berisiko");
    expect(html).toContain("rounded-owner");
    expect(html).toContain("bg-surface-container-lowest");
    // Owning surfaces carry the shared gentle lift, never an ad-hoc shadow.
    expect(html).toContain("shadow-surface");
    expect(html).not.toMatch(/shadow-\[/);
    expect(html).not.toContain("backdrop-blur-xl");
  });

  test("renders a section count as a neutral trailing pill", () => {
    const html = renderToStaticMarkup(
      <DetailSection title="Hari ini" count={23} countLabel="Pengajuan">
        <span>Detail</span>
      </DetailSection>,
    );

    expect(html).toContain("Hari ini");
    expect(html).toContain('aria-label="23 pengajuan"');
    expect(html).toContain(">Pengajuan</span>");
    expect(html).toContain("inline-grid h-5 min-w-5");
    expect(html).toContain("min-h-8");
    expect(html).toContain("text-support");
    expect(html).toContain("px-3");
    expect(html).not.toContain("Hari ini · 23");
  });

  test("uses divider grouping inside its parent card", () => {
    const html = renderToStaticMarkup(
      <RowGroup>
        <div>Baris satu</div>
        <div>Baris dua</div>
      </RowGroup>,
    );

    expect(html).toContain("divide-y");
    expect(html).not.toContain("bg-white");
  });

  test("removes horizontal dividers for a connected timeline", () => {
    const html = renderToStaticMarkup(
      <RowGroup connected>
        <div>Hari ini</div>
        <div>Besok</div>
      </RowGroup>,
    );

    expect(html).not.toContain("divide-y");
    expect(html).toContain("inset-y-0");
    expect(html).toContain("left-13.5");
    expect(html).toContain("max-[430px]:left-12.5");
  });

  test("uses compact neutral cards while keeping tone on the value", () => {
    const html = renderToStaticMarkup(
      <SummaryFact label="Prioritas kritis" value="23" tone="danger" />,
    );

    expect(html).toContain("rounded-inset");
    expect(html).toContain("bg-white");
    expect(html).toContain("text-error");
    expect(html).not.toContain("bg-error-container");
  });
});
