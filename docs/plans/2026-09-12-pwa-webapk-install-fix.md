# Perbaikan Pemasangan PWA / WebAPK di Android

Tanggal: 2026-09-12
Status: selesai (menunggu deploy)

## Laporan pengguna

Pengguna memasang Atria dari peramban ponsel Android mereka. Hasilnya:

1. Toolbar Chrome masih terlihat saat aplikasi dibuka dari Layar Utama.
2. Ikon di Layar Utama memuat lencana Chrome kecil di tepinya.

Hipotesis awal: keduanya adalah tanda **shortcut biasa**, bukan WebAPK sungguhan —
Chrome menurunkan "Install app" menjadi "Add to Home screen" ketika syarat
kelayakan tidak terpenuhi, sehingga `display: "standalone"` tidak pernah dipakai.

## Kesimpulan: hipotesis benar, tetapi penyebabnya di luar dugaan

Hipotesis shortcut-vs-WebAPK **terkonfirmasi** — gejala yang dilaporkan memang
tanda khas shortcut. Tetapi penyebab yang diduga (pengalihan `start_url`)
**terbantah** oleh pengukuran langsung. Penyebab sebenarnya:

> **Produksi tidak pernah menyajikan manifest sama sekali.**

`https://atria-erp.vercel.app/manifest.webmanifest` menjawab `307 → /login`,
begitu pula `/icons/*.png`, `/notification-sw.js`, dan `/offline`. HTML produksi
tidak memuat `<link rel="manifest">`. Chrome karena itu melaporkan
`{"errorId": "no-manifest"}`.

Akar masalahnya ada dua lapis:

1. `apps/web/proxy.ts` (gerbang autentikasi) masih memakai matcher lama yang
   **tidak** mengecualikan berkas PWA. Versi yang mengecualikannya belum
   ter-deploy.
2. Integrasi Git Vercel menunjuk production branch `main`, sedangkan seluruh
   pekerjaan ada di `development`, sehingga push tidak pernah menjadi rilis
   produksi (lihat `docs/guide/vercel-deployment.md`).

Berkas PWA juga masih *untracked* di git: `git ls-files apps/web/app/manifest.ts
apps/web/public/icons apps/web/lib/pwa` mengembalikan kosong, dan
`git cat-file -e HEAD:apps/web/app/manifest.ts` gagal dengan "exists on disk, but
not in 'HEAD'". Selama berkas-berkas itu tidak di-commit dan tidak di-deploy,
manifest tidak akan pernah sampai ke pengguna.

## Bukti

Semua pengukuran dilakukan pada **production build** (`bun run build` lalu
`bun run start`), di `http://localhost:3200`, digerakkan lewat Chrome DevTools
Protocol (`Page.getAppManifest`, `Page.getInstallabilityErrors`), dengan user
agent Android (Pixel 7, Chrome 152) karena sebagian pemeriksaan hanya aktif di
Android.

### Sebelum perbaikan

Produksi (`https://atria-erp.vercel.app/login`):

```
installabilityErrors: [{ "errorId": "no-manifest", "errorArguments": [] }]
getAppManifest.url:   ""
getAppManifest.data:  ""
```

Server lokal pun sebenarnya sudah benar untuk manifest; yang salah adalah
produksi.

### Sesudah perbaikan

```
installabilityErrors: []
manifest.errors:      []
manifest.url:         http://localhost:3200/manifest.webmanifest
startUrl:             http://localhost:3200/
scope:                http://localhost:3200/
display:              kStandalone
preferRelatedApplications: false
themeColor:           rgba(245,245,247,1)
backgroundColor:      rgba(245,245,247,1)
```

Diuji pada dua keadaan: belum login (start_url `/` mengalihkan ke `/login`) dan
sudah login (start_url `/` mengalihkan ke rute peran). Keduanya melaporkan
`[]`.

### Kontrol positif — membuktikan alat ukurnya bekerja

Agar `[]` tidak diterima begitu saja sebagai "API-nya memang selalu kosong",
tiga kontrol dijalankan dan ketiganya menghasilkan galat nyata:

| Kontrol | Hasil |
| --- | --- |
| Manifest tidak dapat dijangkau | `manifest-parsing-or-network-error` |
| `display: "browser"` tanpa ikon | `manifest-display-not-supported`, `manifest-missing-suitable-icon`, `no-acceptable-icon` |
| `start_url` lintas origin | `manifest-parsing-or-network-error` + `start-url-not-valid` |
| **Bentuk produksi**: gerbang auth 307 manifest + ikon + SW | enam galat sekaligus |

Kontrol terakhir meniru persis bentuk produksi dan mereproduksi kegagalannya:
`manifest.webmanifest` yang dialihkan ke `/login` membuat Chrome membaca HTML
login sebagai manifest (`Line: 1, column: 1, Syntax error.`) lalu melaporkan
enam galat berantai.

### `start_url` yang mengalihkan BUKAN penyebabnya

Ini sengaja diuji karena `/` memang tidak pernah mengembalikan 200 — ia
mengalihkan ke rute peran atau ke `/login`. Hasilnya:

- `start_url` yang 302 ke `/login` (belum login) → `installabilityErrors: []`
- `start_url` yang 302 ke `/ledger` (sudah login) → `installabilityErrors: []`
- `start_url` yang 404 → `installabilityErrors: []`

Chrome hanya memvalidasi bahwa `start_url` adalah URL sah pada origin yang
sama (`HasValidStartUrl` → `manifest.has_valid_specified_start_url`); ia tidak
memeriksa kode status maupun pengalihannya saat menilai kelayakan. Karena itu
`start_url: "/"` **dipertahankan** — dan memang harus dipertahankan, sebab rute
dalam mana pun akan salah untuk salah satu dari kedua keadaan pengguna.

## Perubahan yang dilakukan

### `apps/web/app/manifest.ts`

Menambahkan `prefer_related_applications: false` secara eksplisit.

Perlu jujur soal nilainya: ini **bukan** penyebab kegagalan, dan Chrome sudah
melaporkan `preferRelatedApplications: false` tanpa baris ini. Baris ini ditulis
sebagai penegasan kontrak, karena `true` adalah salah satu dari sedikit keadaan
yang membuat Chrome menolak memasang WebAPK (`prefer-related-applications`).
Tidak ada perubahan perilaku hari ini.

### Yang sengaja TIDAK diubah

- **`start_url`**: tetap `/`. Dibuktikan bukan penyebab, dan opsi "rute
  ramah-instal" akan merusak pengalaman salah satu keadaan pengguna.
- **`display_override`**: tidak menolong gejala yang dilaporkan. Gejalanya
  adalah aplikasi dibuka di UI peramban; itu terjadi karena WebAPK tidak pernah
  terpasang, bukan karena mode tampilan diturunkan.
- **`screenshots` / `shortcuts`**: hanya memperkaya dialog pemasangan Android,
  tidak diperlukan untuk minting WebAPK. Tidak ditambahkan karena tidak ada
  aset tangkapan layar yang sah, dan membuat gambar placeholder adalah fabrikasi.
- **`theme_color` / `background_color`**: tetap `#f5f5f7` (`--ios-canvas` di
  `app/globals.css`). Warnanya sudah sesuai token merek.
- **Ikon**: kelima PNG valid dan dipakai apa adanya. `icon-maskable-512.png`
  diperiksa terhadap safe zone maskable: kontennya berjari-jari maksimum 149 px
  dari pusat pada kanvas 512 px, sedangkan ambang aman adalah 40% × 512 = 204,8
  px. Latar `#f5f5f7` memenuhi seluruh tepi. Chrome mengunduh dan menerima
  ikon 144×144 turunan darinya.

## Checklist kelayakan WebAPK

Berdasarkan `components/webapps/browser/installable/installable_evaluator.cc`
dan `installable_logging.cc` (Chromium), diterapkan pada build produksi lokal
dengan `prefer_related_applications: false`:

| Pemeriksaan | Hasil | Bukti |
| --- | --- | --- |
| Origin aman (*secure context*) | PASS | `isSecureContext: true`; produksi HTTPS |
| Bukan jendela incognito | PASS | `Page.getInstallabilityErrors: []` (tidak ada `in-incognito`) |
| Manifest ada dan dapat di-parse | PASS | `Page.getAppManifest.url = http://localhost:3200/manifest.webmanifest`, `errors: []` |
| `name` / `short_name` terisi | PASS | `"Atria ERP"` / `"Atria"` |
| `start_url` sah pada origin yang sama | PASS | `startUrl: http://localhost:3200/`, `scope` sama |
| Mode tampilan dapat dipasang | PASS | `display: kStandalone` |
| `id` ada dan cocok | PASS | `id: http://localhost:3200/` (dari `id: "/"`) |
| Ikon `any` ≥ 144 px | PASS | `icon-192.png` (192²) dan `icon-512.png` (512²), keduanya HTTP 200 / `image/png` |
| Ikon dapat diunduh dan tidak rusak | PASS | Chrome memilih ikon turunan 144×144 dari `icon-512.png` |
| `prefer_related_applications` tidak `true` | PASS | `preferRelatedApplications: false` |
| URL manifest tanpa kredensial/port | PASS | Produksi `https://atria-erp.vercel.app` tanpa port |
| Tidak ada galat kelayakan | PASS | `installabilityErrors: []` |

Catatan: dua baris terakhir hanya berlaku untuk lintasan WebAPK di Android.
`url-not-supported-for-webapk` dan `already-installed` tidak dapat dipicu di
mesin desktop.

## Hal yang tidak dapat diverifikasi tanpa perangkat Android nyata

`[UNVERIFIED — needs real device]`:

1. Apakah WebAPK sungguhan benar-benar di-mint. Minting WebAPK memerlukan
   Google Play Services dan panggilan ke server WebAPK milik Google; tidak ada
   langkah itu yang dapat dijalankan dari mesin ini. Emulator Android tidak
   tersedia (`emulator -list-avds` kosong, tidak ada system image).
2. Apakah toolbar Chrome hilang dan lencana Chrome tidak muncul setelah
   perbaikan ini ter-deploy.
3. Apakah `@media (display-mode: standalone)` aktif saat dibuka dari Layar Utama
   di perangkat pengguna.
4. Perilaku khusus perangkat: sebagian produsen tanpa GMS, atau pemasangan lewat
   "Add to Home screen" alih-alih "Install app", akan **selalu** menghasilkan
   shortcut berlencana Chrome. Ini penjelasan alternatif yang tetap mungkin dan
   perlu diperiksa pengguna di perangkatnya.

## Yang harus diperiksa pengguna di perangkatnya

1. Buka `chrome://webapks` di Chrome Android — WebAPK yang terpasang terdaftar
   di sana dengan nama paket `org.chromium.webapk.*`. Bila daftarnya kosong,
   yang terpasang hanyalah shortcut.
2. Buka menu Chrome dan pastikan yang muncul adalah **"Install app"**, bukan
   "Add to Home screen". Bila yang muncul hanya "Add to Home screen", situs
   belum dianggap layak pasang oleh Chrome di perangkat itu.
3. **Copot pemasangan dulu.** Shortcut lama untuk origin yang sama dapat dipakai
   ulang Chrome walaupun manifest sudah diperbaiki. Hapus ikon lama dari Layar
   Utama, tutup semua tab Atria, lalu pasang ulang. Bila ikon lencana masih
   muncul setelah pemasangan ulang, perangkatnya yang menurunkan ke shortcut.

## Cara membedakan WebAPK dari shortcut

| | WebAPK | Shortcut biasa |
| --- | --- | --- |
| Ikon | Ikon aplikasi Atria, tanpa lencana | Ikon dengan lencana Chrome kecil |
| Saat dibuka | Layar penuh, tanpa toolbar Chrome dan tanpa bilah alamat | Tab Chrome biasa; toolbar dan bilah alamat terlihat |
| Daftar tugas | Muncul di layar "Aplikasi terbaru" sebagai aplikasi | Tidak muncul sebagai aplikasi |
| `chrome://webapks` | Terdaftar | Kosong |

Cara memastikan mode mandiri aktif: jalankan di konsol peramban atau periksa
lewat CSS, `@media (display-mode: standalone)`. Kode Atria sudah mengandalkan
keduanya — `matchMedia("(display-mode: standalone)")` dan
`navigator.standalone` di `apps/web/lib/pwa/install.ts`. Pada saat pengukuran,
keduanya bernilai `false` karena halaman memang dibuka di tab biasa; nilainya
menjadi `true` hanya bila dibuka dari ikon WebAPK yang sudah terpasang. Untuk
pengguna iOS, `navigator.standalone` juga `true` saat dibuka dari Layar Utama.

## Tindakan lanjutan di luar cakupan berkas ini

Perbaikan manifest saja belum cukup sampai berkas PWA benar-benar ter-deploy.
Dua hal ini harus diselesaikan oleh pemilik jalur deploy:

1. Pastikan matcher di `apps/web/proxy.ts` yang mengecualikan
   `manifest.webmanifest`, `notification-sw.js`, `icons/`, dan `offline`
   benar-benar ikut ter-deploy.
2. Commit berkas PWA yang masih *untracked*, lalu rilis produksi — perbaiki
   production branch Vercel atau deploy lewat CLI
   (`npx vercel deploy --prod --yes` dari root repo).

Setelah itu, verifikasi ulang dari luar:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://atria-erp.vercel.app/manifest.webmanifest  # harus 200
curl -s -o /dev/null -w '%{http_code}\n' https://atria-erp.vercel.app/icons/icon-192.png      # harus 200
```
