import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DetailSection,
  GroupedSurface,
  InlineStateRow,
  MainSection,
  RowGroup,
  SectionHeader,
  SummaryFact,
  SummarySurface,
} from "./main-surface";

describe("global main-surface primitives", () => {
  test("shares one summary and inset-fact grammar across domains", () => {
    const html = renderToStaticMarkup(
      <SummarySurface
        ariaLabel="Ringkasan operasional"
        eyebrow="Antrean"
        icon="approval"
        status="Perlu ditinjau"
        statusTone="warning"
      >
        <SummaryFact label="Kritis" value="5" tone="danger" />
      </SummarySurface>,
    );

    expect(html).toContain('aria-label="Ringkasan operasional"');
    expect(html).toContain("Perlu ditinjau");
    expect(html).toContain("bg-surface-container-low");
    expect(html).toContain("Kritis");
    expect(html).toContain("text-error");
  });

  test("shares section headers, counts, grouped surfaces, and row grouping", () => {
    const html = renderToStaticMarkup(
      <MainSection title="Daftar" count={8} countLabel="Item">
        <GroupedSurface>
          <RowGroup>
            <div>Satu</div>
            <div>Dua</div>
          </RowGroup>
        </GroupedSurface>
      </MainSection>,
    );

    expect(html).toContain('aria-label="8 item"');
    expect(html).toContain("rounded-owner");
    // Owning surfaces carry the shared gentle lift, never an ad-hoc shadow.
    expect(html).toContain("shadow-surface");
    expect(html).not.toMatch(/shadow-\[/);
    expect(html).toContain("divide-y");
  });

  test("keeps compact inline state separate from a full-page empty state", () => {
    const html = renderToStaticMarkup(
      <InlineStateRow
        icon="inbox"
        title="Belum ada aktivitas"
        description="Aktivitas baru akan tampil di sini."
        action={<button type="button">Coba lagi</button>}
      />,
    );

    expect(html).toContain("min-h-19");
    expect(html).toContain("Belum ada aktivitas");
    expect(html).toContain("Coba lagi");
    expect(html).not.toContain("py-14");
  });

  test("composes a reusable detail section and accessible header id", () => {
    const detail = renderToStaticMarkup(
      <DetailSection title="Hari ini" href="/approvals">
        <span>Antrean</span>
      </DetailSection>,
    );
    const header = renderToStaticMarkup(<SectionHeader id="project-list" title="Daftar proyek" />);

    expect(detail).toContain('href="/approvals"');
    expect(detail).toContain("Antrean");
    expect(header).toContain('id="project-list"');
  });
});
