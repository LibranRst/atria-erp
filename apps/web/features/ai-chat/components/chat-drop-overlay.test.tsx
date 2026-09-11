import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatDropOverlay } from "./chat-drop-overlay";

describe("ChatDropOverlay", () => {
  test("tidak merender overlay saat tidak sedang dragging", () => {
    const html = renderToStaticMarkup(<ChatDropOverlay isDragging={false} />);
    expect(html).toBe("");
  });

  test("merender overlay dengan pesan instruksi saat dragging", () => {
    const html = renderToStaticMarkup(<ChatDropOverlay isDragging={true} />);
    expect(html).toContain("Lepaskan berkas untuk melampirkan");
    expect(html).toContain("Gambar, PDF, Excel, CSV, TXT (maks. 10 MB)");
    expect(html).toContain("pointer-events-none");
  });
});
