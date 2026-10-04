import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { buttonTapActiveScale } from "@/lib/utils/motion";
import { Button, ButtonLink, IconButton, IconButtonLink, SectionAction } from "./button";

describe("Button motion and active scale-up contract (iOS 27 style)", () => {
  test("buttonTapActiveScale constant is 1.05 for dynamic iOS scale-up feel", () => {
    expect(buttonTapActiveScale).toBe(1.05);
  });

  test("Button renders with active elevation classes", () => {
    const html = renderToStaticMarkup(
      <Button variant="primary">Simpan</Button>,
    );

    expect(html).toContain("active:shadow-raised");
    expect(html).toContain("active:z-10");
  });

  test("IconButton renders with active elevation and z-index classes", () => {
    const html = renderToStaticMarkup(
      <IconButton label="Tutup" icon={<span>x</span>} />,
    );

    expect(html).toContain("active:shadow-raised");
    expect(html).toContain("active:z-10");
  });

  test("ButtonLink includes active:scale-[1.05], active:shadow-raised, and active:z-10", () => {
    const html = renderToStaticMarkup(
      <ButtonLink href="/projects" variant="primary">
        Buka Proyek
      </ButtonLink>,
    );

    expect(html).toContain("active:scale-[1.05]");
    expect(html).toContain("active:shadow-raised");
    expect(html).toContain("active:z-10");
  });

  test("IconButtonLink includes active:scale-[1.05], active:shadow-raised, and active:z-10", () => {
    const html = renderToStaticMarkup(
      <IconButtonLink href="/settings" label="Pengaturan">
        <span>gear</span>
      </IconButtonLink>,
    );

    expect(html).toContain("active:scale-[1.05]");
    expect(html).toContain("active:shadow-raised");
    expect(html).toContain("active:z-10");
  });

  test("SectionAction includes active:scale-[1.05] and active:shadow-raised", () => {
    const html = renderToStaticMarkup(
      <SectionAction label="Lihat Semua" href="/details" />,
    );

    expect(html).toContain("active:scale-[1.05]");
    expect(html).toContain("active:shadow-raised");
    expect(html).toContain("active:z-10");
  });
});
