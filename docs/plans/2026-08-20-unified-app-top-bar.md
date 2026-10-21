# Bilah Atas Terpadu

**Tanggal:** 2026-08-20
**Status:** Disetujui (22 keputusan, empat putaran)

## Masalah

Dua bilah atas dengan rancangan yang praktis sama, tetapi ditulis dua kali.

|            | `MobileHeader` (semua rute)                           | `AiChatTopBar` (`/ai`)                            |
| ---------- | ----------------------------------------------------- | ------------------------------------------------- |
| Geometri   | pita `h-14`, `top-0`, kontrol 40px di y 8–48          | melayang `top: 12`, tinggi 40, kontrol di y 12–52 |
| Tata letak | `flex justify-between`, slot `w-22` / `w-55` / `w-22` | `grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]`    |
| Kontrol    | `motion.button` mentah dengan kelas inline            | `IconButton size="compact"` bersama               |
| Tengah     | pil judul yang bermorf jadi menu                      | label statis                                      |
| Topeng     | tidak ada                                             | gradien `TOP_INSET_PX`                            |

Selisihnya **4px**. Yang berbeda hanyalah cara penulisannya.

### Tiga cacat yang ikut terungkap

1. **Lebar pil ditebak dari jumlah karakter.** `header-morph-menu.tsx:64` memakai
   `clamp(title.length * 8 + 56, 124, 220)`. Dua kekeliruan yang saling menumpuk:
   8px/karakter melebihi lebar sebenarnya (≈6,5–7px pada 14px semibold), dan
   lantai 124px menimpa hasilnya untuk setiap judul pendek.

   | Judul                | Rumus            | Isi sebenarnya + `px-5` | Kelebihan |
   | -------------------- | ---------------- | ----------------------- | --------- |
   | Proyek               | **124** (lantai) | ~82px                   | **+42px** |
   | Dashboard            | **128**          | ~106px                  | +22px     |
   | Kas & Tagihan        | **160**          | ~128px                  | +32px     |
   | Kategori Pengeluaran | **216**          | ~180px                  | +36px     |

2. **Slot lebarnya tidak muat.** `w-22` + `w-55` + `w-22` = 396px, sedangkan
   viewport 360px hanya menyediakan 320px. Terlihat rapi hanya karena anak flex
   tengah menyusut simetris dan pilnya kabur dari kotaknya lewat
   `absolute left-1/2` + `max-w-[calc(100vw-2rem)]`.

3. **Fallback Suspense mendorong halaman turun 56px.** `mobile-shell.tsx:151`
   memasang blok `h-14` **dalam aliran**, padahal `MobileHeader` yang
   digantikannya `fixed` dan tidak memakan ruang aliran sama sekali. Isi halaman
   duduk 56px lebih rendah selama boundary tertunda, lalu menyentak naik. Blok
   itu juga buram dan bergaris bawah, sementara bilah aslinya transparan.

4. **Tiga salinan konstanta yang sama.** `TOP_INSET_PX = 72`
   (`ai-chat-top-bar.tsx`), `STREAM_TOP_INSET_PX = 72` (`use-chat-scroll.ts`,
   dideklarasikan terpisah, komentarnya sudah menyebut angka yang salah:
   "top-3 + h-11"), dan `pt-20` = 80px di shell.

## Keputusan

| #   | Keputusan                                                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Satu primitif `AppTopBar` berslot `left`/`center`/`right`; `MobileHeader` dan bilah AI menjadi perakit tipis.                                                                                                                            |
| 2   | Pita 56px di mana pun; kontrol 40px di tengah pita (y 8–48). Semua inset diturunkan dari satu konstanta.                                                                                                                                 |
| 3   | Lebar pil **diukur** lewat cermin tersembunyi + `ResizeObserver`. Rumus karakter dihapus, bukan dikalibrasi.                                                                                                                             |
| 4   | Pil tengah `/ai` menjadi menu navigasi penuh — halaman AI berhenti jadi jalan buntu.                                                                                                                                                     |
| 5   | Bilah beranimasi ketika **teks judulnya** berubah: pindah rute, dan percakapan ↔ riwayat. Tab dalam halaman tidak.                                                                                                                       |
| 6   | Slot generik berisi daftar kontrol terurut.                                                                                                                                                                                              |
| 7   | ~~`/ai` merender `<AppTopBar>`-nya sendiri~~ → **dibalik setelah tinjauan pemilik.** Shell merender satu bilah untuk **semua** rute termasuk `/ai`; halaman AI menitipkan isi slotnya lewat `useProvideTopBarSlots`. Alasannya di bawah. |
| 8   | Topeng gradien pindah ke primitif dan berlaku di semua rute.                                                                                                                                                                             |
| 9   | `minmax(max-content,1fr) minmax(0,max-content) minmax(max-content,1fr)`: kontrol tidak pernah tergencet, judul yang terpotong.                                                                                                           |
| 10  | Avatar 32px → 40px, seukuran kontrol lain.                                                                                                                                                                                               |
| 11  | `width: max-content` sampai pengukuran mendarat; tidak ada animasi pada cat pertama.                                                                                                                                                     |
| 12  | Tinggi panel terbuka diukur; lebarnya tetap 292 (itu nilai rancangan, bukan turunan).                                                                                                                                                    |
| 13  | `transitionSpringSmooth` untuk lebar dan geseran slot, `transitionEaseSmooth` untuk silang-pudar label, Bouncy-masuk/Smooth-keluar dipertahankan untuk menu.                                                                             |
| 14  | Slot kanan `/ai` tetap baru + riwayat, tanpa avatar (menu sudah memuat Profil).                                                                                                                                                          |
| 15  | `layout="position"` untuk koreografi slot — melarang skala, dan semua kontrol 40px tetap. Lebar pil tengah tetap diukur.                                                                                                                 |
| 16  | "Asisten AI" masuk `HEADER_MENU_ITEMS` (disaring `use:ai_chat`), **dan** `activeIndex === -1` didukung sebagai bawaan bertahan.                                                                                                          |
| 17  | Uji satuan + pengukuran geometri 320/360/390/430 + migrasi uji/cerita + DESIGN.md + dokumen rencana ini.                                                                                                                                 |
| 18  | Satu lintasan; bukti lebar dilaporkan terpisah.                                                                                                                                                                                          |
| 19  | Keduanya di `components/layout/`; tepi `features/ai-chat → components/layout` diakui dan **ditegakkan** di `feature-boundaries.test.ts`.                                                                                                 |
| 20  | `FADE = 24` → inset 80px. Halaman biasa tidak bergeser sepiksel pun; halaman AI menyerap 8px.                                                                                                                                            |
| 21  | Fallback Suspense → `null`.                                                                                                                                                                                                              |
| 22  | `AiChatLauncher` dilipat ke perakit (satu impor `layout → features` hilang); `getPageTitle` menerima `/ai`.                                                                                                                              |

### Bug yang diciptakan keputusan 4, dan tambalannya

```ts
activeIndex = Math.max(items.findIndex(...), 0)
```

Setiap rute yang dirender shell hari ini cocok dengan salah satu butir menu,
jadi cadangan `Math.max(…, 0)` belum pernah berjalan. `/ai` adalah rute pertama
yang tidak cocok — menunya akan menyorot **Dashboard** sebagai halaman berjalan,
dan judulnya mendarat di baris Dashboard. Keputusan 16 menutup keduanya.

## Bentuk akhir

```
components/layout/
  app-top-bar.tsx        ← BARU: geometri, grid, slot, topeng
  app-top-bar.test.tsx   ← BARU
  use-header-menu.ts     ← BARU: pathname + searchParams + peran → butir menu
  header-morph-menu.tsx  ← lebar & tinggi diukur, activeIndex -1, reduced motion
  header-menu-config.ts  ← butir "Asisten AI", judul /ai
  mobile-shell.tsx       ← perakit standar; peluncur dilipat; fallback null

features/ai-chat/components/
  ai-chat-top-bar.tsx    ← perakit tipis di atas AppTopBar
  ai-chat-launcher.tsx   ← DIHAPUS
  ai-chat-view.tsx       ← topeng sendiri dilepas; inset bersama
features/ai-chat/hooks/
  use-chat-scroll.ts     ← mengimpor konstanta, bukan menyatakannya ulang
```

Konstanta tunggal:

```ts
export const TOP_BAR_BAND_PX = 56;
export const TOP_BAR_FADE_PX = 24;
export const TOP_BAR_INSET_PX = TOP_BAR_BAND_PX + TOP_BAR_FADE_PX; // 80
```

## Revisi setelah tinjauan pemilik

Keputusan 7 dibalik. Alasan awalnya — tombol kembali halaman AI bergantung pada
`showPicker` yang merupakan state lokal `AiChatView` — masih benar, tetapi
harganya baru terlihat saat dipakai: dua bilah berarti menyeberangi batas rute
**membongkar** satu komponen lalu **memasang** komponen lain. Tidak ada instance
yang bertahan, jadi tidak ada yang bisa dianimasikan, dan lebar pil judul patah
alih-alih bermorf.

Satu bilah untuk semua rute menjaga `HeaderMorphMenu` tetap satu instance, dan
lebarnya bergerak dari judul lama ke judul baru. Kepemilikan state tetap di
`AiChatView`; yang naik ke shell hanyalah isi slotnya, lewat context
`top-bar-slots.tsx`.

Dua cacat lain yang ditemukan pada tinjauan yang sama:

1. **Pengukur `absolute` membuat pil selebar nol pada cat pertama.** Pil dan
   tombolnya juga `absolute`, jadi wadahnya kehilangan seluruh isi yang mengalir
   dan `max-content`-nya nol. Setiap muat ulang, pil mulai dari nol lalu
   memanjang — dan selama jendela itu ketiga kolom bilah ikut salah ukuran.
   Pengukur sekarang mengalir; ada uji regresinya.

2. **`maxWidth` di `style`, bukan di `animate`.** Nilainya melompat dari
   `calc(100vw - 2rem)` ke `100%` begitu menu ditutup, sehingga panel terjepit
   dari 292px ke lebar judul baru dalam satu frame: tingginya bermorf, lebarnya
   patah. `maxWidth` kini tetap, dan penjepitan sudah termasuk di dalam
   `closedWidth` — diukur dengan melepas lebar wadah sejenak, sehingga CSS
   sendiri yang menghitung "selebar judul, atau selebar sisa ruang, mana yang
   lebih kecil".

Judul juga tidak lagi ditukar seketika: keduanya disilang-pudarkan dengan
`mode="wait"`, supaya judul baru tidak "terketik" keluar di dalam pil yang
lebarnya masih dalam perjalanan.

## Yang tidak bisa diverifikasi di sini

Panel pratinjau berjalan dengan `visibilityState: hidden`; nol callback
`requestAnimationFrame` terukur selama 11,8 detik, jadi animasi Framer tidak
pernah dieksekusi. Geometri yang **sudah mengendap** bisa diukur dan akan
dilaporkan pada 320/360/390/430. **Rasa** morf-nya butuh mata pemilik.
