import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ExclusiveSearchFilterBar } from "./exclusive-search-filter-bar";

const sourcePath = new URL("./exclusive-search-filter-bar.tsx", import.meta.url);

const options = [
  { value: "ALL", label: "Semua" },
  { value: "ACTIVE", label: "Aktif", count: 2 },
] as const;

describe("ExclusiveSearchFilterBar", () => {
  test("shows filters and a separate circular search trigger in filter mode", () => {
    const html = renderToStaticMarkup(
      <ExclusiveSearchFilterBar
        mode="filter"
        filterValue="ALL"
        filterOptions={options}
        searchValue=""
        onFilterChange={() => undefined}
        onSearchChange={() => undefined}
        onModeChange={() => undefined}
        filterAriaLabel="Filter proyek"
        searchAriaLabel="Cari proyek"
        searchPlaceholder="Cari proyek"
        filterLayoutId="test-filter"
        searchLayoutId="test-search"
        endControl={<button type="button">Filter lanjutan</button>}
      />,
    );

    expect(html).toContain('data-control-mode="filter"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Buka cari proyek"');
    expect(html.match(/data-search-surface="true"/g)?.length).toBe(1);
    expect(html).toContain("Filter lanjutan");
    expect(html).toContain("block h-12 w-12 shrink-0");
    expect(html).toContain("absolute inset-y-0 left-0");
    expect(html).toContain('type="search"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-hidden="true" inert=""');
  });

  test("replaces filters with one focused search surface in search mode", () => {
    const html = renderToStaticMarkup(
      <ExclusiveSearchFilterBar
        mode="search"
        filterValue="ALL"
        filterOptions={options}
        searchValue="menteng"
        onFilterChange={() => undefined}
        onSearchChange={() => undefined}
        onModeChange={() => undefined}
        filterAriaLabel="Filter proyek"
        searchAriaLabel="Cari proyek"
        searchPlaceholder="Cari proyek"
        filterLayoutId="test-filter"
        searchLayoutId="test-search"
        endControl={<button type="button">Filter lanjutan</button>}
      />,
    );

    expect(html).toContain('data-control-mode="search"');
    expect(html).toContain('type="search"');
    expect(html).toContain('value="menteng"');
    expect(html).toContain('aria-label="Tutup pencarian"');
    expect(html.match(/data-search-surface="true"/g)?.length).toBe(1);
    expect(html).toContain('aria-hidden="true" inert=""');
    expect(html).toContain('role="tablist"');
  });

  test("measures x and width without Framer layout scaling", async () => {
    const source = await Bun.file(sourcePath).text();

    expect(source).toContain("new ResizeObserver(measure)");
    expect(source).toContain("triggerX: triggerRect.left - railRect.left");
    expect(source).toContain("geometry?.railWidth");
    expect(source).not.toContain("layoutId={searchLayoutId}");
  });
});
