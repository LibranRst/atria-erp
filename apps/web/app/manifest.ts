import type { MetadataRoute } from "next";
import { WEB_BRAND_REVISION, WEB_PRODUCT_DESCRIPTION, WEB_PRODUCT_NAME } from "@/lib/brand";

/**
 * Manifest aplikasi web.
 *
 * `start_url` sengaja `/`, bukan rute dalam: `/` adalah satu-satunya alamat yang
 * benar untuk pemilik yang sudah login maupun yang belum. Server mengarahkan
 * dari sana — ke rute kerja yang sesuai peran, atau ke `/login` bila sesinya
 * tidak ada (`app/page.tsx` → `resolveHomeDestination`). Rute dalam mana pun
 * akan salah untuk salah satu dari kedua keadaan itu: `/ledger` memantulkan
 * pengguna yang belum login keluar dari aplikasi tepat saat ia membukanya dari
 * Layar Utama.
 *
 * `scope` `/` dan warna kanvas `#f5f5f7` diambil dari token merek di
 * `app/globals.css` (`--ios-canvas`) dan `DESIGN.md`, bukan dikarang di sini.
 *
 * Nama produk, bukan nama perusahaan: satu instance melayani satu perusahaan,
 * jadi menyebut perusahaan tertentu di sini akan menyebut nama yang salah pada
 * instance pelanggan. Nama perusahaan datang dari `tenant.name` lewat
 * `lib/company/identity.ts` dan hanya dipakai di layar, bukan di manifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: WEB_PRODUCT_NAME,
    short_name: WEB_PRODUCT_NAME,
    description: WEB_PRODUCT_DESCRIPTION,
    lang: "id",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    /*
     * `false` adalah nilai bawaan parser Chrome, jadi baris ini tidak mengubah
     * apa pun hari ini — Chrome sudah melaporkannya `preferRelatedApplications:
     * false` tanpa baris ini. Baris ini ditulis eksplisit karena `true` adalah
     * salah satu dari sedikit keadaan yang membuat Chrome menolak memasang
     * WebAPK (`prefer-related-applications`), dan kontrak pemasangan lebih baik
     * berdiri sendiri daripada bergantung pada nilai bawaan parser.
     */
    prefer_related_applications: false,
    orientation: "portrait",
    background_color: "#f5f5f7",
    theme_color: "#f5f5f7",
    categories: ["business", "finance", "productivity"],
    icons: [
      {
        src: `/icons/icon-192.png?v=${WEB_BRAND_REVISION}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icons/icon-512.png?v=${WEB_BRAND_REVISION}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icons/icon-maskable-512.png?v=${WEB_BRAND_REVISION}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
