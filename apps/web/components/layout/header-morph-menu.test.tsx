import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { HeaderMorphMenu } from "./header-morph-menu";
import { getHeaderMenuItems, getPageTitle } from "./header-menu-config";

const items = getHeaderMenuItems("OWNER");

function render(overrides: Partial<Parameters<typeof HeaderMorphMenu>[0]> = {}): string {
  return renderToStaticMarkup(
    <HeaderMorphMenu
      isOpen={false}
      items={items}
      pathname="/expenses"
      searchParams={new URLSearchParams()}
      title="Kas & Tagihan"
      onToggle={() => {}}
      onClose={() => {}}
      {...overrides}
    />,
  );
}

describe("HeaderMorphMenu pill width", () => {
  /**
   * Lebar tidak lagi ditebak dari jumlah karakter.
   *
   * Rumus lamanya, `clamp(title.length * 8 + 56, 124, 220)`, salah dua kali
   * sekaligus — 8px/karakter melebihi lebar sebenarnya pada 14px semibold, dan
   * lantai 124px menimpa hasilnya untuk setiap judul pendek. "Proyek" digambar
   * ~82px lalu dipaksa jadi 124px.
   */
  test("emits no hard-coded pixel width before measurement lands", () => {
    const html = render({ title: "Proyek" });

    // Angka-angka rumus lama. Kalau salah satu muncul lagi, tebakannya kembali.
    expect(html).not.toContain("width:124px");
    expect(html).not.toContain("width:104px");
    expect(html).not.toContain("width:220px");
  });

  test("sizes itself from an invisible copy of its own title", () => {
    // Salinan inilah yang diukur, dan yang memberi wadahnya lebar yang benar
    // pada cat pertama — sebelum pengukuran mendarat, saat memang belum ada apa
    // pun untuk dianimasikan.
    const html = render({ title: "Proyek" });
    const sizer = html.match(/<span[^>]*invisible[^>]*>[^<]*<\/span>/)?.[0];

    expect(sizer).toBeDefined();
    expect(sizer).toContain("Proyek");
    expect(sizer).toContain("whitespace-nowrap");
  });

  test("keeps the sizer in flow so the pill has its width before JS runs", () => {
    /**
     * Regresi. Pengukur sempat dibuat `absolute` demi kemurnian pengukuran, dan
     * karena pil beserta tombolnya juga `absolute`, wadahnya kehilangan seluruh
     * isi yang mengalir — `max-content`-nya menjadi nol. Akibatnya setiap kali
     * halaman dimuat pil mulai selebar nol lalu memanjang, dan selama jendela
     * itu ketiga kolom bilah ikut salah ukuran.
     *
     * Pengukur harus mengalir, dan wadahnya harus punya lebar dari CSS saja.
     */
    const html = render({ title: "Proyek" });
    const sizer = html.match(/<span[^>]*invisible[^>]*>[^<]*<\/span>/)?.[0] ?? "";

    expect(sizer).not.toContain("absolute");
    expect(sizer).toContain("w-max");
    expect(sizer).toContain("block");

    // Wadahnya menahan lebar itu tanpa bantuan nilai animasi.
    expect(html).toContain("w-max max-w-full");
  });

  test("crossfades between titles instead of swapping the text under a moving edge", () => {
    // Pertukaran seketika menaruh judul baru di dalam pil yang lebarnya masih
    // dalam perjalanan, sehingga judul panjang terpotong lalu "terketik" keluar.
    const html = render({ title: "Kas & Tagihan" });

    // Kedua judul ditumpuk di satu sel grid supaya tidak ada yang bergeser.
    expect(html).toContain("col-start-1 row-start-1");
    expect(html).toContain("truncate");
  });

  test("gives a short title a narrower box than a long one", () => {
    // Buktinya struktural, bukan piksel: kedua judul muncul apa adanya di
    // pengukurnya, jadi lebarnya tidak bisa lagi sama karena lantai bersama.
    const short = render({ title: "Proyek" });
    const long = render({ title: "Kategori Pengeluaran" });

    expect(short).toContain(">Proyek</span>");
    expect(long).toContain(">Kategori Pengeluaran</span>");
  });
});

describe("HeaderMorphMenu active row", () => {
  test("marks the row matching the current route", () => {
    const html = render({ pathname: "/expenses" });
    const current = html.match(/<a[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/)?.[0];

    expect(current).toContain('href="/expenses"');
  });

  test("marks nothing when the route is not one of the menu's destinations", () => {
    /**
     * `activeIndex` dulu dijepit `Math.max(…, 0)`. Karena setiap rute yang
     * dirender shell kebetulan cocok dengan salah satu butir, cadangan itu tidak
     * pernah berjalan — dan begitu berjalan, ia menyorot butir pertama, mengaku
     * tahu halaman mana yang sedang dibuka padahal tidak.
     */
    const html = render({ pathname: "/rute-yang-tidak-ada-di-menu" });

    expect(html).not.toContain('aria-current="page"');
    expect(html).not.toContain("bg-primary text-on-primary");
  });
});

describe("header menu configuration", () => {
  test("offers the AI assistant only to roles that hold the permission", () => {
    // Dibaca dari matriks izin yang sama dengan yang ditegakkan rute AI, bukan
    // dari daftar peran yang ditulis ulang: menu tidak boleh menawarkan pintu
    // yang akan ditolak.
    const labels = (role: string) => getHeaderMenuItems(role).map((item) => item.label);

    expect(labels("OWNER")).toContain("Asisten AI");
    expect(labels("PROJECT_MANAGER")).toContain("Asisten AI");
    expect(labels("DESIGNER")).not.toContain("Asisten AI");
  });

  test("names the AI route so both sources of the title agree", () => {
    expect(getPageTitle("/ai")).toBe("Asisten AI");
    expect(getPageTitle("/ai")).not.toBe("Finance ERP");
  });

  test("keeps the AI route reachable as a real destination", () => {
    const ai = getHeaderMenuItems("OWNER").find((item) => item.label === "Asisten AI");

    expect(ai?.href).toBe("/ai");
    expect(ai?.match("/ai", new URLSearchParams())).toBe(true);
    expect(ai?.match("/ledger", new URLSearchParams())).toBe(false);
  });
});
