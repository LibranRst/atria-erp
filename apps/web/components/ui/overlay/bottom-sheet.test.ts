import { describe, expect, test } from "bun:test";

const bottomSheetPath = new URL("./bottom-sheet.tsx", import.meta.url);

describe("BottomSheet floating chrome", () => {
  test("keeps shared sheet chrome floating over one measured scroll plane", async () => {
    const source = await Bun.file(bottomSheetPath).text();

    expect(source).toContain("bg-surface-container-low");
    // Header/footer share the page chrome's gradual ramp on the sheet canvas.
    expect(source).toContain("scroll-edge-scrim-sheet");
    expect(source).toContain("scroll-edge-scrim-bottom");
    expect(source).not.toContain("via-surface-container-low/95 via-70%");
    expect(source).toContain("px-margin-mobile pt-sm");
    // Footer harus solid. Ketika latarnya berupa gradien yang transparan di
    // sisi atas, baris status footer berada di pita transparan itu dan
    // bertumpuk dengan isi form yang di-scroll di belakangnya.
    expect(source).toContain("scroll-edge-scrim-sheet-footer");
    expect(source).toContain("[&_button]:shadow-raised!");
    // The decorative wash is absolute and cannot change measured footer clearance.
    expect(source).toContain("absolute inset-x-0 bottom-0 h-[calc(100%+2rem)]");
    expect(source).not.toContain("top-0 h-24 bg-linear-to-b");
    expect(source).toContain("scrollPaddingTop: topChromeHeight + 16");
    expect(source).toContain("scrollPaddingBottom: (sideFooter ? 0 : footerHeight) + 16");
    expect(source).toContain("style={{ height: topChromeHeight }}");
    expect(source).toContain("style={{ height: footerHeight }}");
    expect(source).not.toContain(
      "border-t border-outline-variant/15 bg-background px-margin-mobile",
    );
    expect(source).not.toContain("bg-background px-margin-mobile backdrop-blur-md");
    // Anchored select/menu di dalam sheet harus berada di atas sheet induknya,
    // tanpa menaikkan layer global di atas confirmation sheet berikutnya.
    expect(source).toContain("<OverlayLayerProvider anchored={zIndex + 2}>");
  });

  test("removes automatic sheet travel for reduced-motion users", async () => {
    const source = await Bun.file(bottomSheetPath).text();

    expect(source).toContain("useReducedMotion");
    expect(source).toMatch(/reduceMotion\s*\?\s*\{\s*y: 0, opacity: 0\s*\}/);
    expect(source).toMatch(/reduceMotion\s*\?\s*\{\s*duration: 0\s*\}/);
    expect(source).toContain("transitionSpringSmooth");
    expect(source).toContain("reduceMotion ? { duration: 0 } : transitionEaseSmooth");
  });
});
