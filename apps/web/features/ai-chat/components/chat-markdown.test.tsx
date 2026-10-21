import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ChatMarkdown } from "./chat-markdown";

describe("ChatMarkdown component", () => {
  test("renders bold, italic, and inline code formatting cleanly", () => {
    const content =
      "Status proyek **Sudirman Suites** saat ini *aman* dengan saldo `Rp 150.000.000`.";
    const html = renderToStaticMarkup(<ChatMarkdown content={content} />);

    expect(html).toContain("<strong");
    expect(html).toContain("Sudirman Suites</strong>");
    expect(html).toContain("<em");
    expect(html).toContain("aman</em>");
    expect(html).toContain("<code");
    expect(html).toContain("Rp 150.000.000</code>");
  });

  test("renders Markdown tables with header and rows properly", () => {
    const tableMd = `| Kategori | Alokasi | Sisa |
| :--- | :---: | ---: |
| Material | Rp 400 Jt | Rp 150 Jt |
| Tukang | Rp 200 Jt | Rp 80 Jt |`;

    const html = renderToStaticMarkup(<ChatMarkdown content={tableMd} />);

    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toContain("<th");
    expect(html).toContain("Kategori");
    expect(html).toContain("Alokasi");
    expect(html).toContain("Sisa");
    expect(html).toContain("Material");
    expect(html).toContain("Rp 400 Jt");
    expect(html).toContain("text-right");
  });

  test("renders callouts (> [!TIP], > [!WARNING]) with semantic tone", () => {
    const calloutMd = `> [!TIP]
> Pastikan alokasi budget telah diverifikasi oleh Owner.`;

    const html = renderToStaticMarkup(<ChatMarkdown content={calloutMd} />);

    expect(html).toContain("Pastikan alokasi budget");
  });

  test("renders fenced code blocks", () => {
    const codeMd = `\`\`\`json
{ "status": "APPROVED", "cap": 0.85 }
\`\`\``;

    const html = renderToStaticMarkup(<ChatMarkdown content={codeMd} />);

    expect(html).toContain("<pre");
    expect(html).toContain("<code");
    expect(html).toContain("json");
    expect(html).toContain("APPROVED");
  });

  test("renders bullet lists and numbered lists properly", () => {
    const content = `Berikut langkah berikutnya:
- Siapkan alokasi budget
- Hubungi vendor material
1. Verifikasi invoice
2. Transfer pembayaran`;

    const html = renderToStaticMarkup(<ChatMarkdown content={content} />);

    expect(html).toContain("<ul");
    expect(html).toContain("Siapkan alokasi budget</li>");
    expect(html).toContain("Hubungi vendor material</li>");
    expect(html).toContain("<ol");
    expect(html).toContain("Verifikasi invoice</li>");
    expect(html).toContain("Transfer pembayaran</li>");
  });

  test("renders blockquotes and headers safely", () => {
    const content = `### Ringkasan Eksekutif
> Sisa budget material masih cukup untuk 3 minggu ke depan.`;

    const html = renderToStaticMarkup(<ChatMarkdown content={content} />);

    expect(html).toContain("<h4");
    expect(html).toContain("Ringkasan Eksekutif</h4>");
    expect(html).toContain("<blockquote");
    expect(html).toContain("Sisa budget material masih cukup");
  });

  test("handles empty or single string without errors", () => {
    expect(renderToStaticMarkup(<ChatMarkdown content="" />)).toContain("space-y-2.5");
    expect(renderToStaticMarkup(<ChatMarkdown content="Halo Paduna Build" />)).toContain("Halo Paduna Build");
  });
});
