import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DesktopTablePagination } from "./desktop-table-pagination";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";

function footer(page: number, total: number, pageSize = 10): string {
  return renderToStaticMarkup(
    <WorkspacePresentationProvider presentation="desktop">
      <DesktopTablePagination
        page={page}
        total={total}
        pageSize={pageSize}
        onPageChange={(): void => {}}
        onPageSizeChange={(): void => {}}
      />
    </WorkspacePresentationProvider>,
  );
}

describe("controlled table pagination", () => {
  test("reports the complete result and page range while guarding unavailable navigation", () => {
    const html = footer(1, 27);
    expect(html).toContain("27 hasil");
    expect(html).toContain("Halaman 1 dari 3");
    expect(html).toContain("10 baris");
    expect(html.match(/disabled=""/g)?.length).toBe(1);
  });
  test("an empty collection and a shrunk final page cannot navigate beyond the result", () => {
    const empty = footer(1, 0);
    expect(empty).toContain("0 hasil");
    expect(empty).toContain("Halaman 1 dari 1");
    expect(empty.match(/disabled=""/g)?.length).toBe(2);
    const shrunk = footer(5, 27, 25);
    expect(shrunk).toContain("Halaman 2 dari 2");
    expect(shrunk.match(/disabled=""/g)?.length).toBe(1);
  });
});
