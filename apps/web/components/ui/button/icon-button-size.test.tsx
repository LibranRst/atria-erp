import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Button, IconButton } from "./button";

describe("IconButton size", () => {
  test("stays 48px by default so existing call sites are untouched", () => {
    const html = renderToStaticMarkup(<IconButton label="Tutup" icon={<span>x</span>} />);

    expect(html).toContain("h-12 w-12");
    expect(html).not.toContain("h-10 w-10");
    expect(html).not.toContain("title=");
  });

  test("compact renders at 40px but keeps a 48px touch target", () => {
    const html = renderToStaticMarkup(
      <IconButton label="Kembali" size="compact" icon={<span>x</span>} />,
    );

    expect(html).toContain("h-10 w-10");
    // 40px + 4px pada tiap sisi = 48px area sentuh efektif, sesuai panduan.
    expect(html).toContain("after:-inset-1");
    expect(html).toContain("relative");
  });
});

describe("Button size and color contract", () => {
  test("preserves text-on-primary with compact text-meta typography", () => {
    const html = renderToStaticMarkup(
      <Button variant="primary" size="compact">
        Kembali
      </Button>,
    );

    expect(html).toContain("bg-primary");
    expect(html).toContain("text-on-primary");
    expect(html).toContain("text-meta");
    expect(html).toContain("h-10");
    expect(html).toContain("Kembali");
  });
});
