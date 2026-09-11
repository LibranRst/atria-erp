import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { canSendDraft, ChatComposer, shouldSubmitOnKey } from "./chat-composer";

describe("syarat pengiriman pesan", () => {
  test("menolak kiriman kosong atau hanya spasi", () => {
    expect(canSendDraft("", false)).toBe(false);
    expect(canSendDraft("   \n ", false)).toBe(false);
  });

  test("menolak kiriman baru selama jawaban masih berjalan", () => {
    expect(canSendDraft("Sisa budget material?", true)).toBe(false);
  });

  test("mengizinkan kiriman berisi saat asisten menganggur", () => {
    expect(canSendDraft("Sisa budget material?", false)).toBe(true);
  });
});

describe("pintasan papan ketik composer", () => {
  test("Enter mengirim pesan", () => {
    expect(shouldSubmitOnKey({ key: "Enter", shiftKey: false })).toBe(true);
  });

  test("Shift+Enter membuat baris baru, bukan mengirim", () => {
    expect(shouldSubmitOnKey({ key: "Enter", shiftKey: true })).toBe(false);
  });

  test("Enter saat IME aktif memilih kandidat kata, bukan mengirim", () => {
    expect(
      shouldSubmitOnKey({ key: "Enter", shiftKey: false, nativeEvent: { isComposing: true } }),
    ).toBe(false);
  });

  test("tombol lain tidak mengirim", () => {
    expect(shouldSubmitOnKey({ key: "a", shiftKey: false })).toBe(false);
  });
});

describe("struktur composer", () => {
  test("memberi label tersembunyi dan batas panjang pada kolom isian", () => {
    const html = renderToStaticMarkup(
      <ChatComposer
        value=""
        onChange={() => undefined}
        onSubmit={() => undefined}
        onStop={() => undefined}
        isBusy={false}
      />,
    );

    expect(html).toContain('for="ai-chat-input"');
    expect(html).toContain("Tulis pertanyaan untuk asisten AI");
    expect(html).toContain('maxLength="2000"');
    expect(html).toContain("Kirim pertanyaan");
  });

  test("menukar tombol kirim menjadi tombol henti saat jawaban berjalan", () => {
    const html = renderToStaticMarkup(
      <ChatComposer
        value="Sisa budget?"
        onChange={() => undefined}
        onSubmit={() => undefined}
        onStop={() => undefined}
        isBusy
      />,
    );

    expect(html).toContain("Hentikan jawaban");
    expect(html).not.toContain("Kirim pertanyaan");
  });

  test("menampilkan tombol lampirkan berkas inline di dalam komposer", () => {
    const html = renderToStaticMarkup(
      <ChatComposer
        value=""
        onChange={() => undefined}
        onSubmit={() => undefined}
        onStop={() => undefined}
        isBusy={false}
      />,
    );

    expect(html).toContain('aria-label="Lampirkan berkas"');
    expect(html).toContain('type="file"');
  });
});
