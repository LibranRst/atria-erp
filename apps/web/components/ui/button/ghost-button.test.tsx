import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "@/components/ui";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";

test("neutral activity actions use the real HeroUI ghost variant instead of falling back to a filled commit", () => {
  const html = renderToStaticMarkup(
    <WorkspacePresentationProvider presentation="desktop">
      <Button variant="ghost" type="button" aria-label="Buka detail mutasi">
        <span>Material masuk</span>
        <span className="text-on-surface-variant">Gudang utama</span>
      </Button>
    </WorkspacePresentationProvider>,
  );
  expect(html).toContain('data-atria-variant="ghost"');
  expect(html).toContain("button--ghost");
  expect(html).not.toContain("button--primary");
  expect(html).toContain('aria-label="Buka detail mutasi"');
});
