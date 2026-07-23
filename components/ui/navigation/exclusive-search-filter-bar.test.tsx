import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ExclusiveSearchFilterBar } from "./exclusive-search-filter-bar";

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
      />,
    );

    expect(html).toContain('data-control-mode="filter"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Buka cari proyek"');
    expect(html.match(/data-search-surface="true"/g)?.length).toBe(1);
    expect(html).toContain("absolute inset-y-0 right-0 flex w-12");
    expect(html).not.toContain('type="search"');
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
      />,
    );

    expect(html).toContain('data-control-mode="search"');
    expect(html).toContain('type="search"');
    expect(html).toContain('value="menteng"');
    expect(html).toContain('aria-label="Tutup pencarian"');
    expect(html.match(/data-search-surface="true"/g)?.length).toBe(1);
    expect(html).not.toContain('role="tablist"');
  });
});
