# Panduan identitas visual

## Logo

Logo utama adalah **simbol Temu + wordmark Paduna**. Bentuk dua bidang, celah diagonal, dan proporsinya mengikuti master yang telah disetujui. Huruf berasal dari Manrope 700 dan sudah di-outline pada SVG.

Versi tersedia: primary (simbol terracotta, tulisan ink), ink, putih, dan stacked. Lockup produk menambahkan Build/Office memakai Manrope 500 pada baseline yang sama. Tinggi kapital label 176 unit dibanding Paduna 232 unit; jarak setelah nama 48 unit pada konstruksi master.

Gunakan logo utama di latar putih. Di latar ink, pilih versi putih; di latar terracotta, gunakan putih. Logo di atas foto hanya dipakai bila area tenang dan keterbacaan terjaga; opsi paling konsisten adalah bidang solid.

## Ruang aman dan ukuran minimum

Tetapkan **X = 32 unit**, dibanding lebar simbol 320 unit. Ruang aman minimum di semua sisi adalah 1X, diukur dari batas bentuk terlihat. Canvas logo horizontal menyediakan margin 48 unit (1,5X); pertahankan margin tersebut saat menempatkan file sumber.

| Bentuk                   | Minimum digital yang disarankan | Minimum cetak awal          |
| ------------------------ | ------------------------------- | --------------------------- |
| Paduna horizontal        | 176 CSS px                      | 30 mm                       |
| Lockup produk horizontal | 240 CSS px                      | 45 mm                       |
| Compact produk           | 176 CSS px lebar                | Uji pada hasil cetak aktual |
| Simbol mandiri           | 24 CSS px lebar                 | 5 mm lebar                  |
| Favicon                  | 16 px, khusus favicon           | Tidak berlaku               |

Ukuran di atas adalah batas kerja identitas v1, bukan jaminan keterbacaan pada semua media. Uji hasil cetak, material, dan layar sebenarnya. Pada header sempit, gunakan compact atau simbol bersama nama aplikasi sebagai teks aksesibel.

**Penyesuaian khusus web, 17 Oktober 2026:** setelah koreksi pengguna, login dan sidebar memakai logo utama **Paduna** horizontal tanpa suffix Build. Lebarnya **176 px pada login** dan **152 px pada sidebar**. Nama aplikasi tetap **Paduna Build**. Ini penyesuaian penempatan web; proporsi, clear space bawaan, dan master logo dipertahankan.

**Penerapan Expo, 17 Oktober 2026:** login memakai logo Paduna yang sama, rata kiri dengan lebar **176 dp**; layar persiapan memakai artwork yang sama di tengah. Nama aplikasi tetap **Paduna Build**. Gunakan aset lokal hasil ekspor master, tanpa mengetik ulang wordmark. Ikon launcher memakai Temu putih pada terracotta; splash memakai simbol terracotta pada canvas terang dan putih pada ink untuk konfigurasi gelap. Status pemeriksaan native dicatat terpisah pada laporan QA rollout.

Jangan meregangkan, memiringkan, memutar, mengubah celah, menambahkan outline, gradient, bayangan, glow, efek 3D, atau mengganti font wordmark. Jangan mengetik ulang logo. Simbol tidak dibalik atau dibentuk menjadi inisial baru untuk tiap produk.

## Palet

| Warna        | HEX       | RGB           | Peran                              |
| ------------ | --------- | ------------- | ---------------------------------- |
| Ink          | `#181817` | 24, 24, 23    | Wordmark, teks utama, bidang kuat. |
| Terracotta   | `#B84B2C` | 184, 75, 44   | Identitas, penekanan yang terarah. |
| White        | `#FFFFFF` | 255, 255, 255 | Latar utama dan logo reverse.      |
| Canvas       | `#F5F5F7` | 245, 245, 247 | Latar pendukung produk.            |
| Neutral gray | `#636366` | 99, 99, 102   | Teks pendukung yang tetap terbaca. |

Palet utama tidak menambah warna pembeda baru untuk Office. Identitas ikon Build memakai terracotta; Office memakai ink, keduanya dengan Temu putih. Nama aplikasi harus menyertai ikon dalam konteks pemilihan produk.

Gunakan sRGB untuk digital. Konversi cetak harus mengikuti profil warna percetakan dan proof; paket ini tidak menetapkan Pantone atau CMYK produksi yang belum diuji.

## Kontras

Teks biasa menargetkan rasio sekurangnya 4,5:1, teks besar 3:1, mengikuti [WCAG 2.2 SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Matriks rasio aktual disertakan dalam `color-contrast.json` dan brand book.

Ink di atas putih, putih di atas ink, terracotta di atas putih, serta putih di atas terracotta memenuhi ambang teks biasa berdasarkan nilai solid tersebut. Terracotta di atas ink tidak dipakai untuk teks kecil. Pemeriksaan ini bukan klaim bahwa seluruh aplikasi telah memenuhi WCAG; setiap komponen dan state tetap perlu diverifikasi.

Arti status produk mengikuti token dan aturan DESIGN.md. Warna ikon produk tidak mengubah arti status finance, material, atau approval. Jangan memakai warna sebagai satu-satunya pembawa informasi.

## Tipografi

**Manrope** dipakai untuk brand dan materi komunikasi. Gunakan 700 untuk judul/wordmark, 500 untuk isi dan suffix produk. Manrope berada di bawah SIL Open Font License; teks lisensi disertakan bersama font.

Gunakan sentence case, baris pendek yang nyaman, dan jarak yang cukup. Hindari all caps untuk paragraf panjang. Materi komunikasi dapat memakai skala awal 48/32/24/16/12 px untuk display/judul/subjudul/isi/label; komponen aplikasi tetap mengikuti skala semantik DESIGN.md dan token proyek.

Angka keuangan harus mudah dibandingkan. Pada produk, gunakan MoneyValue dan tabular numerals sesuai sistem yang ada; jangan membuat format uang baru hanya demi branding.

## Bahasa grafis

Dua bidang dan celah Temu boleh menjadi motif dalam bidang besar yang tenang. Motif berada di latar/editorial, tidak menutupi informasi atau mengubah logo master. Satu titik fokus per komposisi; gunakan dividers dan whitespace untuk membangun urutan.

Ilustrasi dan foto harus terkait pekerjaan nyata: tim, material, aktivitas kantor, atau konteks proyek. Hindari foto stok berjabat tangan yang generik dan ilustrasi AI robot untuk menjelaskan manfaat yang tidak spesifik. Grafik data harus bersumber, punya label, dan tidak dekoratif.

## Ikon aplikasi dan splash

Ekspor ikon aplikasi merupakan kotak penuh tanpa sudut rounded yang dibakar ke file; platform menentukan mask-nya. Preview sosial boleh menampilkan pembulatan. Android memakai foreground transparan, background solid, dan layer monochrome. iOS mendapat PNG 1024 dan foreground SVG untuk proyek Icon Composer yang sudah ada.

Area kerja aset: simbol normal 60% lebar canvas; PWA maskable 56% di dalam lingkaran aman radius 40%; Android foreground 44% di dalam zona aman radius 33/108. Splash simbol menggunakan canvas transparan, versi light/dark, dan imageWidth 76 sebagai acuan konfigurasi aplikasi saat ini.

Rujukan: [maskable icons](https://web.dev/articles/maskable-icon), [Android adaptive icons](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive), [Expo app config](https://docs.expo.dev/versions/v57.0.0/config/app/). Aset disiapkan; tampilan terpasang tetap diverifikasi melalui native build pada rollout.
