import { describe, expect, test } from "bun:test";

const bottomSheetPath = new URL("./bottom-sheet.tsx", import.meta.url);

describe("BottomSheet floating chrome", () => {
  test("keeps shared sheet chrome floating over one measured scroll plane", async () => {
    const source = await Bun.file(bottomSheetPath).text();

    expect(source).toContain("bg-surface-container-low");
    expect(source).toContain("bg-linear-to-b");
    expect(source).toContain("bg-linear-to-t");
    // Chrome atas tetap memudar di atas bidang scroll yang sama.
    expect(source).toContain("via-surface-container-low/95 via-70%");
    expect(source).toContain("absolute inset-0 bg-linear-to-b");
    expect(source).toContain("px-margin-mobile pt-sm");
    // Footer harus solid. Ketika latarnya berupa gradien yang transparan di
    // sisi atas, baris status footer berada di pita transparan itu dan
    // bertumpuk dengan isi form yang di-scroll di belakangnya.
    expect(source).toContain("bottom-0 z-20 bg-surface-container-low px-margin-mobile");
    // Peredupannya adalah pita terpisah di luar kotak footer (`bottom-full`),
    // sehingga tidak ikut terukur `offsetHeight` dan spacer tetap akurat.
    expect(source).toContain("absolute inset-x-0 bottom-full");
    expect(source).not.toContain("top-0 h-24 bg-linear-to-b");
    expect(source).toContain("scrollPaddingTop: topChromeHeight + 16");
    expect(source).toContain("scrollPaddingBottom: footerHeight + 16");
    expect(source).toContain("style={{ height: topChromeHeight }}");
    expect(source).toContain("style={{ height: footerHeight }}");
    expect(source).not.toContain(
      "border-t border-outline-variant/15 bg-background px-margin-mobile",
    );
    expect(source).not.toContain("bg-background px-margin-mobile backdrop-blur-md");
  });
});
