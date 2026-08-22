import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AppTopBar,
  TopBarControl,
  TOP_BAR_BAND_PX,
  TOP_BAR_FADE_PX,
  TOP_BAR_INSET_PX,
} from "./app-top-bar";

function render(overrides: Partial<Parameters<typeof AppTopBar>[0]> = {}): string {
  return renderToStaticMarkup(
    <AppTopBar
      left={<span>kiri</span>}
      center={<span>tengah</span>}
      right={<span>kanan</span>}
      {...overrides}
    />,
  );
}

describe("AppTopBar layout", () => {
  test("centres the middle slot with equal side columns rather than space-between", () => {
    const html = render();

    // `justify-between` menggeser judul mengikuti isi sisi kanan, dan isi itu
    // berbeda antar keadaan — grid dengan sisi selebar sama yang menahannya.
    expect(html).toContain("minmax(max-content,1fr)");
    expect(html).not.toContain("justify-between");
  });

  test("never lets the controls compress before the title does", () => {
    // Kontrol adalah sasaran sentuh 48px dan tidak bisa ditawar: kolom tepi
    // berlantai `max-content`, kolom tengah berlantai nol.
    const html = render();

    expect(html).toContain("minmax(0,max-content)");
  });

  test("anchors the actions to the outer edges", () => {
    const html = render();

    expect(html).toContain("justify-self-start");
    expect(html).toContain("justify-self-end");
  });

  test("renders every slot it is given", () => {
    const html = render();

    expect(html).toContain("kiri");
    expect(html).toContain("tengah");
    expect(html).toContain("kanan");
  });

  test("lifts above the page only while a menu needs to cover it", () => {
    // Latar gelap menu dirender di dalam bilah, jadi tanpa kenaikan ini ia
    // terkurung dalam konteks penumpukan bilah sendiri.
    expect(render()).toContain("z-50");
    expect(render({ elevated: true })).toContain("z-90");
  });
});

describe("AppTopBar slot choreography", () => {
  test("positions each slot so an exiting control can leave the flow", () => {
    /**
     * `mode="popLayout"` menempatkan kontrol yang sedang keluar secara absolut
     * supaya tetangganya bergeser pada frame yang sama. Itu hanya benar kalau
     * slotnya menjadi containing block-nya.
     *
     * Tanpa ini, kontrol yang pergi tetap memakan ruang flex sampai animasi
     * keluarnya selesai — tetangganya diam, lalu melompat tanpa animasi begitu
     * simpulnya dilepas.
     */
    const html = render();
    const slots = html.match(
      /class="pointer-events-auto relative flex items-center gap-1\.5[^"]*"/g,
    );

    expect(slots).toHaveLength(2);
  });

  test("hugs its control instead of leaving a line box around it", () => {
    /**
     * Kontrolnya `inline-flex`; di dalam blok ia membuat kotak baris dan
     * menambah ~6px sisa turunan huruf di bawah tombol 40px. popLayout mengukur
     * pembungkusnya apa adanya, lalu memakunya dengan tinggi yang salah itu dan
     * `top: 0` — kontrol yang pergi bergeser ke atas selagi memudar.
     */
    const html = renderToStaticMarkup(
      <TopBarControl>
        <button type="button">satu</button>
      </TopBarControl>,
    );

    expect(html).toContain('class="flex"');
  });

  test("forwards its ref, without which popLayout silently does nothing", () => {
    /**
     * `PopChild` mengambil simpul DOM lewat `children.props.ref`, lalu
     * `PopChildMeasure.getSnapshotBeforeUpdate` berhenti kalau yang didapat
     * bukan `HTMLElement`. Komponen fungsi biasa yang mengabaikan `ref` membuat
     * pengukuran itu dilewati **tanpa error** — popLayout tampak terpasang tapi
     * tidak melakukan apa pun, dan kontrol yang pergi tetap memakan ruangnya
     * sampai benar-benar dilepas.
     */
    const asForwardRef = TopBarControl as unknown as { $$typeof?: symbol };

    expect(asForwardRef.$$typeof).toBe(Symbol.for("react.forward_ref"));
  });

  test("wraps a control in a motion element popLayout can pop", () => {
    // popLayout hanya bekerja pada anak langsung berupa komponen motion; tombol
    // telanjang tidak bisa dikeluarkan dari aliran.
    const html = renderToStaticMarkup(
      <AppTopBar
        left={[
          <TopBarControl key="a">
            <button type="button">satu</button>
          </TopBarControl>,
        ]}
        center={null}
        right={null}
      />,
    );

    expect(html).toContain("<div");
    expect(html).toContain("satu");
  });
});

describe("AppTopBar geometry", () => {
  test("derives the content inset from the band and the fade", () => {
    expect(TOP_BAR_INSET_PX).toBe(TOP_BAR_BAND_PX + TOP_BAR_FADE_PX);
  });

  test("extends the fade past the band so text dissolves before touching it", () => {
    expect(TOP_BAR_INSET_PX).toBeGreaterThan(TOP_BAR_BAND_PX);
    expect(TOP_BAR_FADE_PX).toBeGreaterThanOrEqual(16);
  });

  test("keeps the inset at the value every page already used", () => {
    // Penyatuan ini tidak boleh menggeser setiap halaman aplikasi sebagai efek
    // samping: `pt-20` lama juga 80px.
    expect(TOP_BAR_INSET_PX).toBe(80);
  });

  test("leaves a 40px control centred in the band", () => {
    // Pita 56px berisi kontrol 40px berarti 8px di atas dan di bawah. Bilah AI
    // dulu 40px pada offset 12 — beda 4px yang hanya lahir dari penulisan kedua.
    expect((TOP_BAR_BAND_PX - 40) % 2).toBe(0);
    expect(TOP_BAR_BAND_PX).toBeGreaterThanOrEqual(48);
  });
});
