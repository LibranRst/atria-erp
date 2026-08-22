import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AppTopBar } from "@/components/layout/app-top-bar";
import { aiChatTopBarSlots } from "./ai-chat-top-bar";

function slots(overrides: Partial<Parameters<typeof aiChatTopBarSlots>[0]> = {}) {
  return aiChatTopBarSlots({
    showPicker: false,
    isBusy: false,
    onBack: () => {},
    onNewConversation: () => {},
    onOpenPicker: () => {},
    ...overrides,
  });
}

/** Slot-nya dipasang ke bilah yang sama dengan yang dipakai rute lain. */
function render(overrides: Partial<Parameters<typeof aiChatTopBarSlots>[0]> = {}): string {
  const { left, right } = slots(overrides);
  return renderToStaticMarkup(<AppTopBar left={left} center={null} right={right} />);
}

describe("AI chat top bar slots", () => {
  test("contributes slot content rather than a bar of its own", () => {
    /**
     * Halaman ini dulu merender bilahnya sendiri, dan itu berarti menyeberangi
     * batas rute membongkar satu komponen lalu memasang komponen lain — tidak
     * ada instance yang bertahan, sehingga lebar pil judul patah alih-alih
     * bermorf. Yang dititipkan sekarang hanyalah isinya.
     */
    const value = slots();

    expect(value.title).toBe("Asisten AI");
    expect(value.left).toBeDefined();
    expect(value.right).toBeDefined();
  });

  test("names the in-page state, which no route can derive", () => {
    // Satu-satunya judul di aplikasi yang mengikuti keadaan dalam halaman dan
    // bukan rutenya — dan alasan `title` bisa dititipkan sama sekali.
    expect(slots().title).toBe("Asisten AI");
    expect(slots({ showPicker: true }).title).toBe("Riwayat Percakapan");
  });

  test("offers back, new conversation, and history while chatting", () => {
    const html = render();

    expect(html).toContain('aria-label="Kembali"');
    expect(html).toContain('aria-label="Percakapan baru"');
    expect(html).toContain('aria-label="Daftar riwayat"');
  });

  test("collapses to a single closing control while history is open", () => {
    const html = render({ showPicker: true });

    // Dulu tombol silang di kanan dan tombol kembali di kiri sama-sama menutup
    // riwayat; satu perilaku tidak butuh dua kontrol.
    expect(html).toContain('aria-label="Tutup riwayat"');
    expect(html).not.toContain('aria-label="Daftar riwayat"');
    expect(html).not.toContain('aria-label="Percakapan baru"');
    expect(html.match(/aria-label="Tutup riwayat"/g)).toHaveLength(1);
  });

  test("blocks starting a new conversation while a reply is streaming", () => {
    const html = render({ isBusy: true });
    const newButton = html.match(/<button[^>]*Percakapan baru[^>]*>/)?.[0];

    expect(newButton).toContain("disabled");
  });

  test("keeps the avatar out of the right slot", () => {
    // Tiga kontrol 40px memaksa judul terpotong di 320px, dan menu di pil tengah
    // sudah memuat Profil Saya.
    const html = render();

    expect(html).not.toContain('aria-label="Profil Saya"');
  });

  test("uses the compact control size for every action", () => {
    const html = render();

    expect(html).toContain("h-10 w-10");
    expect(html).not.toContain("h-12 w-12");
  });
});
