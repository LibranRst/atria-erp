import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SheetFooterActions } from "./sheet-footer-actions";

/**
 * Sebuah aksi yang terblokir hanya berguna kalau alasannya sampai ke pengguna.
 *
 * Tombol ber-`disabled` keluar dari urutan fokus: pengguna keyboard menyusuri
 * sheet sampai ujung lalu mendapati tombol kirimnya seolah tidak ada, dan tidak
 * pernah tahu apa yang kurang. Karena itu, begitu ada alasan, tombolnya
 * dinonaktifkan secara lunak — tetap dapat difokus, alasannya tertaut, dan
 * perubahan alasannya diumumkan.
 */

function markupFor(props: Parameters<typeof SheetFooterActions>[0]): string {
  return renderToStaticMarkup(<SheetFooterActions {...props} />);
}

/**
 * Nama kelas Tailwind memuat teks `aria-disabled:` maupun `disabled:`, jadi
 * pencarian substring biasa akan cocok pada gaya, bukan pada atributnya.
 * Pemeriksaan di bawah membaca atribut pada elemen `button` saja.
 */
function buttonAttributes(html: string): string {
  return /<button([^>]*)>/.exec(html)?.[1]?.replace(/class="[^"]*"/, "") ?? "";
}

describe("SheetFooterActions saat terblokir", () => {
  const blocked = {
    primary: { label: "Catat", disabled: true, type: "submit" as const, form: "demo-form" },
    disabledReason: "Audit note minimal 10 karakter.",
  };

  test("menonaktifkan secara lunak agar tombolnya tetap dapat difokus", () => {
    const attributes = buttonAttributes(markupFor(blocked));
    expect(attributes).toContain('aria-disabled="true"');
    // Atribut `disabled` bawaan akan mengeluarkannya dari urutan fokus.
    expect(attributes).not.toContain('disabled=""');
  });

  test("menautkan alasannya ke tombol lewat aria-describedby", () => {
    const html = markupFor(blocked);
    const described = /aria-describedby="([^"]+)"/.exec(html);
    expect(described).not.toBeNull();
    const reasonId = described?.[1] ?? "";
    expect(reasonId.length).toBeGreaterThan(0);
    expect(html).toContain(`id="${reasonId}"`);
    expect(html).toContain("Audit note minimal 10 karakter.");
  });

  test("mengumumkan perubahan alasan lewat live region", () => {
    expect(markupFor(blocked)).toContain('aria-live="polite"');
  });

  test("tidak mengirim form selagi terblokir", () => {
    const attributes = buttonAttributes(markupFor(blocked));
    // `type="submit"` tetap mengirim walau tombolnya beratribut aria-disabled.
    expect(attributes).not.toContain('type="submit"');
    expect(attributes).not.toContain('form="demo-form"');
  });
});

describe("SheetFooterActions saat tidak terblokir", () => {
  test("tombol aktif tidak membawa penanda nonaktif apa pun", () => {
    const html = markupFor({ primary: { label: "Catat" } });
    expect(buttonAttributes(html)).not.toContain("aria-disabled");
    expect(buttonAttributes(html)).not.toContain('disabled=""');
    expect(html).toContain("Catat");
  });

  test("nonaktif tanpa alasan tetap memakai atribut disabled biasa", () => {
    // Tanpa alasan untuk dibacakan, tidak ada gunanya menahan tombolnya di
    // urutan fokus — perilaku bawaan justru yang paling jujur.
    const attributes = buttonAttributes(markupFor({ primary: { label: "Catat", disabled: true } }));
    expect(attributes).toContain('disabled=""');
    expect(attributes).not.toContain("aria-disabled");
  });
});
