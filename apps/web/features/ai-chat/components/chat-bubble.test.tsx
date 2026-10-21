import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatBubble } from "./chat-bubble";

describe("ChatBubble", () => {
  test("merender teks pesan pengguna di dalam gelembung bubble", () => {
    const html = renderToStaticMarkup(<ChatBubble side="user">Tolong periksa anggaran</ChatBubble>);
    expect(html).toContain("Tolong periksa anggaran");
    expect(html).toContain("bg-surface-inverse");
  });

  test("merender deretan foto dalam grid stacked kompak (bukan scrollable melebar)", () => {
    const html = renderToStaticMarkup(
      <ChatBubble
        side="user"
        attachments={[
          {
            url: "https://example.com/struk1.jpg",
            fileName: "struk1.jpg",
            mimeType: "image/jpeg",
          },
          {
            url: "https://example.com/struk2.jpg",
            fileName: "struk2.jpg",
            mimeType: "image/jpeg",
          },
        ]}
      >
        Ini struk pembelian material
      </ChatBubble>,
    );

    // Rendered thumbnails
    expect(html).toContain('src="https://example.com/struk1.jpg"');
    expect(html).toContain('src="https://example.com/struk2.jpg"');
    // Grid layout
    expect(html).toContain("grid grid-cols-2");
    expect(html).toContain("max-w-[240px]");
    // Text bubble remains sibling
    expect(html).toContain("Ini struk pembelian material");
  });

  test("merender foto tunggal dengan ukuran kompak terkontrol", () => {
    const html = renderToStaticMarkup(
      <ChatBubble
        side="user"
        attachments={[
          {
            url: "https://example.com/struk1.jpg",
            fileName: "struk1.jpg",
            mimeType: "image/jpeg",
          },
        ]}
      >
        {null}
      </ChatBubble>,
    );

    expect(html).toContain('src="https://example.com/struk1.jpg"');
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("max-w-[180px]");
    expect(html).not.toContain("bg-surface-inverse");
  });
});
