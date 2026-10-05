# Preview Home mobile

Home native memakai `screen.ledger`, loader dan perhitungan yang sama dengan Dashboard web **mobile `/ledger`**. Konten enam tab telah disesuaikan dengan web pada 2 Oktober 2026: Ringkasan, Persetujuan, Budget, Jatuh Tempo, Rekening dan Material. Setelah refinement berikutnya, strip iOS memakai label lengkap tersebut, ikon native, badge dari DTO yang sama dengan web, track abu-abu dan pill aktif ink. Jumlah pekerjaan juga tetap tersedia di ringkasan/header konten.

Button dan aksi baris memakai kontrol native bersama. Button memakai ukuran kontekstual: header section sekitar 40pt, action halaman sekitar 44pt, dan action sheet sekitar 50–52pt, dengan frame interaksi minimum 48pt. Sheet owners memberi default melalui React context tanpa menambah native wrapper; prop `size` eksplisit tetap diutamakan. Segmented tabs iOS mengadaptasi komposisi web melalui UIButton dan UIScrollView native, pill glass bertint ink, spring dari preset bersama dan feedback seleksi native. Tap dan swipe cepat telah diperiksa pada iOS 26.5; hold-and-slide, pembatalan hold dan edge scrolling sudah diimplementasikan tetapi durasi sentuhannya belum dapat diverifikasi dengan alat preview yang tersedia.

Bottom tab bar tetap dimiliki UIKit. Underlay putih yang dahulu menutup sampel warna telah dihapus; canvas bar transparan dan tombol “+” memakai glass clear tanpa tint putih tebal. Material kini mengikuti warna kartu rekening yang bergerak di bawahnya; menu dan dismissal tetap memakai pemilik native yang sama.

Detail persetujuan beserta nota/dokumen pendukung dan dampak budget, detail rekening, serta detail **transaksi kas yang diketuk** tersedia dalam sheet native yang hanya membaca data. Keputusan persetujuan, tambah/edit/arsip rekening, pencatatan mutasi, transfer dan workflow material yang belum diport tetap memakai tombol web eksplisit.

## Lingkungan preview saat ini

- API: `http://127.0.0.1:3001`.
- Metro: port `8081`, development client iOS yang sudah terpasang.
- Runtime pengembangan: **iOS 26.5 yang sudah tersedia**. Runtime iOS 27 dan perangkat simulator yang baru dibuat untuknya telah dihapus sesuai arahan pengguna. Tampilan dan gesture khusus runtime iOS 27 belum diverifikasi.
- Web pendamping: `http://127.0.0.1:3030`; port 3000 dipakai layanan lain.
- Database: `atria_uat_guard` pada branch **`codex-mobile-home-preview-2026-10-01`**, ID `br-rough-sound-aoi4a26u`, project `rapid-mountain-50889409`. Branch berasal dari development dan memiliki compute sendiri `ep-blue-fog-ao69uxk3`. Data UAT pada parent dipertahankan.
- Seed awal berpatokan pada **1 Oktober 2026 WIB**; label jatuh tempo dihitung terhadap tanggal aktual saat layar dimuat.

URL loopback ini untuk simulator di Mac yang sama. Perangkat fisik memerlukan alamat LAN yang bisa dijangkau serta server web yang mendengarkan alamat tersebut.

Cache build QA **3,3 GB di SSD eksternal** dan output export sementara **26 MB** telah dihapus setelah client final dipasang. Source, client terpasang, screenshot dan sandbox demo tetap tersedia. Unduhan runtime baru atau cache build besar tambahan memerlukan penjelasan biaya penyimpanan dan izin eksplisit pengguna terlebih dahulu.

Jalankan dari root ketika server belum hidup:

```sh
bun run dev:mobile
```

Web pendamping berada di terminal terpisah:

```sh
bun --filter @atria/web dev:default --port 3030 --hostname 127.0.0.1
```

## Akun demo

Seluruh akun berikut memakai kata sandi demo **`password123`**.

| Peran         | Email                | Preview                                                       |
| ------------- | -------------------- | ------------------------------------------------------------- |
| Owner         | `ronald@dekoria.com` | Semua tab Home dan antrean keputusan Owner                    |
| Finance Admin | `lisa@dekoria.com`   | Home dan prioritas Finance sesuai izin                        |
| PM Budi       | `budi@dekoria.com`   | Proyek yang ditugaskan; tidak mendapatkan Home finance global |
| PM Siti       | `siti@dekoria.com`   | Proyek yang ditugaskan                                        |
| Purchasing    | `agus@dekoria.com`   | Akses material sesuai izin                                    |

## Elemen yang dapat diperiksa

- Ringkasan: kas tersedia, piutang, hutang, hutang ≤7 hari, penggunaan/sisa budget dan margin proyeksi; prioritas keputusan, preview project berisiko, jadwal terdekat, perhatian material dan perubahan kas terbaru. Grid tambahan nilai project/internal budget serta daftar lengkap kategori yang sebelumnya hanya ada di native telah dihapus dari tab ini agar hierarkinya mengikuti web.
- Persetujuan: jumlah/nilai antrean, prioritas kritis, lama menunggu, dan urutan prioritas. Ketuk satu pengajuan untuk membaca konteks, nota bila tersedia dan dampak sebelum/sesudah. Pembelian persediaan Material tidak diproyeksikan sebagai kenaikan actual cost proyek; saldo awal stok tidak membuat kas keluar atau actual cost proyek.
- Budget: perbandingan nominal, pemakaian, margin, project berisiko dan kategori. Status manual project ditampilkan sebagai perhatian tim, tanpa mengklaim bahwa pemakaian budget pasti mendekati batas.
- Jatuh Tempo: **Outstanding 7 hari** mencakup hutang dan piutang pada kelompok terlambat/hari ini/7 hari. **Cakupan kas** membandingkan kas dengan hutang jatuh tempo saja; tanpa hutang tampil “Tidak ada hutang”. Baris dokumen mengikuti timeline dan memakai nomor dokumen sebagai identitas utama.
- Rekening: empat rekening, gradient dari Settings, saldo dan nilai persis. Ketuk rekening untuk membaca identitas, nomor rekening lengkap dan transaksi terbaru. Ketuk perubahan kas atau satu transaksi rekening untuk membaca detail transaksi tersebut, status rekonsiliasi dan konteks auditnya. Sheet tidak menjalankan perubahan saldo.
- Material: konteks budget Material sebelum shortage, stok rendah dan aktivitas waste/penyesuaian. “Kurang” hanya menunjukkan defisit kebutuhan RAP; stok rendah menunjukkan “Tersedia” dengan konteks minimum. Waste menunjukkan “Terbuang”, penyesuaian mempertahankan jumlah yang diberikan tanpa menebak arah, dan reversal tanpa jumlah tidak mengarang angka. Event historis memakai konteks project/lokasi; nilai stok placeholder pada DTO event tidak ditampilkan sebagai persediaan fisik saat ini.
- Nominal mengikuti varian `MoneyValue` web: terutama `fullDynamic` untuk angka persis, dengan nilai compact yang memang dipakai pada metrik sekunder tertentu.
- Runtime: skeleton mengikuti tab. Cache layar dan posisi baca dibatasi identitas user, sesi, role, izin dan data scope; pergantian scope membatalkan/menghapus cache sebelumnya. Data terakhir dalam scope yang sama dapat dipakai saat pembaruan gagal, sedangkan pencabutan akses menutup data.

Seed terhubung berisi 9 project, 6 budget project, 4 rekening, 11 transaksi kas, 6 approval menunggu, 5 RAP, 6 RAB, 12 baris inventory dan 12 notifikasi. Home hanya menampilkan item yang memenuhi status, izin, scope dan batas preview loader.

## Konteks tombol web

Browser memakai sesi cookie tersendiri; login native memakai bearer/SecureStore. Bila browser belum login, masuk memakai akun demo dengan izin yang sesuai.

- Tambah rekening: `/ledger?tab=accounts&bank-action=create`.
- Detail rekening: `/ledger?tab=accounts&account=<id>`.
- Form edit/mutasi/transfer: URL detail rekening dengan `bank-action=edit`, `movement` atau `transfer`. Form mutasi dibuka dengan arah awal masuk; pengguna memilih arah dan mengisi data sebelum menyimpan.
- Parameter hanya membuka sheet yang diizinkan dan rekening yang tersedia. Transfer memerlukan rekening sumber aktif serta tujuan aktif lain. Intent tidak pernah otomatis menyimpan, mengarsipkan, menyetujui atau memindahkan uang.
- Web menunggu dismissal sheet yang sedang terbuka, lalu mengonsumsi parameter `account` dan `bank-action` sekali lewat penggantian URL. Tab, `surface=mobile`, parameter lain dan fragmen tetap dipertahankan; menutup sheet tidak membuka ulang intent lama.

## Seed ulang dan pemulihan lingkungan

Konfigurasi privat berada di `.atria-demo/mobile-home-preview/` dan diabaikan Git. File `preview-api.env` mengarah ke compute preview. **Periksa host tersebut sebelum seed ulang; jangan gunakan reset ini pada parent UAT atau production.** Seed ulang akan mengganti data dan sesi pada sandbox preview.

```sh
cd apps/api
bun --env-file=../../.atria-demo/mobile-home-preview/preview-api.env scripts/reset-demo-database.ts --confirm-reset
```

Verifikasi database yang sedang dikonfigurasi:

```sh
bun run db:demo:verify
```

Konfigurasi API dan mobile sebelum pekerjaan ini disimpan sebagai `original-api.env` dan `original-mobile.env` di direktori privat yang sama. Salin kembali bila ingin kembali ke UAT, lalu restart API dan Metro. Web tetap merupakan presentation/HTTP adapter menuju API.

## Bukti dan batas verifikasi

Catatan **1 Oktober 2026** berikut adalah bukti implementasi sebelumnya. Kontrol bersama dan komposisi Home berubah pada 2 Oktober; hasil lama tidak membuktikan bahwa seluruh ukuran atau gesture pada versi sekarang telah diuji kembali.

- Typecheck API, web dan mobile lulus; workspace lint lulus; 30 tes mobile dan 3 tes label bisnis lulus; export iOS/Android lulus; invariant seed lulus.
- Layout konten React Native web diperiksa pada 320/360/390/430px tanpa overflow horizontal. Adapter cookie khusus inspeksi telah dibuang; ini bukti tambahan layout konten, bukan pengganti bukti native.
- iPhone 17 Pro, iOS 26.5, 402pt: Home dengan data seed, perubahan tab, gradient rekening, sheet setengah/penuh, transaksi dan swipe dismiss kembali ke tab asal diperiksa. Web pendamping berhasil login demo dan membaca rekening yang sama.
- Artefak lokal: `.atria-demo/verification/2026-10-01-mobile-home/` berisi screenshot native, DTO Home dan laporan coverage. Pemeriksaan format file perubahan lulus; format seluruh repo masih melaporkan 418 file lama di luar pekerjaan ini.
- Android runtime, perangkat fisik, VoiceOver/TalkBack dan Dynamic Type besar belum diuji. Tidak ada pembayaran, approval atau perubahan stok yang dijalankan selama pemeriksaan UI.

Untuk perubahan **2 Oktober 2026**:

- Typecheck API, web dan mobile, workspace lint, format file terkait, 34 tes mobile, regresi cash coverage/material quantity/intent bank serta fixture HTTP native dengan database disposable lulus. Export iOS dan Android serta build native final lulus. Tidak ada debug trace atau batas lebar QA yang tertinggal di source.
- iPhone 17 Pro, iOS 26.5, 402pt: enam tab, sheet rekening/transaksi/persetujuan setengah dan penuh, swipe dismiss, bukti gagal/retry/perbesar serta tombol shared pada Home, Proyek, Biaya dan footer sheet diperiksa. Slot ikon button diberi ukuran tetap setelah runtime menemukan label Proyek terdesak; label native kini utuh.
- Swipe horizontal cepat di kedua arah menggeser strip tanpa mengganti konten atau posisi vertikal. Trace diagnostik sementara membuktikan offset bergeser 189,7pt tanpa commit; tap Rekening menghasilkan satu commit. UIKit tetap merender segmented control; native UIPan menggeser container setelah pan bawaan berkonflik dengan tracking kontrol. Diagnostik telah dibuang sebelum build final.
- Konten keenam tab diperiksa pada batas lebar native 320pt; Material juga diperiksa pada 360/390pt. Ini uji batas layout pada simulator 402pt, bukan bukti perangkat berukuran lain. Lebar 430pt, Dynamic Type besar, Reduce Motion, VoiceOver/TalkBack, perangkat fisik dan runtime Android belum diuji pada versi ini.
- Intent web tambah/edit/mutasi/transfer membuka form yang benar dan mempertahankan konteks BCA Operasional. Form hanya dibuka, tanpa submit. Fixture publik sintetis `/receipt_test.png` kini dapat dimuat native tanpa cookie web; pengecualian proxy hanya berlaku untuk path tersebut, dengan sembilan pemeriksaan matcher lulus. Status dampak pengajuan positif tanpa alokasi kini jelas: “Belum ada alokasi budget”.
- Hold–geser, commit saat release, pembatalan hold dan auto-scroll tepi belum dibuktikan dengan durasi native: input drag dari alat preview termampatkan dan tidak menyediakan kontrol durasi. Implementasinya tetap tersedia untuk pemeriksaan dengan sentuhan langsung. Runtime iOS 27 tetap tidak dipasang dan tidak diuji sesuai arahan storage.
- Artefak baru berada di `.atria-demo/verification/2026-10-02-home-parity/`, termasuk `home-final.png`, `approval-proof.png`, `budget-320.png`, `overview-320.png` dan `material-320.png`. Cache build/export dibuang; hanya runtime iOS 26.5 dan sembilan device simulator sebelumnya yang tersisa. Tidak ada pembayaran, keputusan approval atau perubahan stok dijalankan selama QA.

Primitif yang digunakan: native `Button`/`RowAction`, `SegmentedTabs`, `MoneyValue`, `SummarySurface`, `SummaryFact`, `GroupedSurface`, `RowGroup`, `BudgetSplitIndicator`, `ScreenQueryState`, `ScreenRefreshNotice`, `BottomSheet` dan native Stack form sheet. `AccountIdentity` dan `BudgetCategoryRow` tetap berupa komposisi fitur; overlay dan kontrol finance mempunyai satu pemilik bersama.

Refinement kontrol berikutnya pada 2 Oktober: typecheck/lint mobile, 34 tes mobile, build native final dan export iOS/Android lulus. iOS 26.5 pada 402pt diperiksa untuk ikon/label/badge tab, swipe tanpa perubahan halaman, tap dan centering, button Proyek dengan ikon, action sheet rekening serta glass di atas gradient bank. Halo selected biru bawaan UIButton dinetralkan agar pill tetap ink. Screenshot terbaru berada di `.atria-demo/verification/2026-10-02-controls-refinement/`; source/seed dipertahankan, cache build 3,3 GB dan export 26 MB sudah dibuang lagi. Runtime Android, perangkat fisik/haptics, timing hold dan matrix ukuran lain belum diuji kembali untuk refinement ini.

Action header seperti “Lihat semua” dan “Buka semua” kini memakai varian native `section`: teks netral semibold kecil dan chevron kanan tanpa background/pill. Button tetap satu pemilik aksi dengan label aksesibilitas menyebut section/tujuan; chevron dekoratif tidak menjadi aksi terpisah. Sizing sheet tetap mengikuti konteks sebelumnya. Tampilan dan navigasi approval diperiksa di iOS 26.5; typecheck/lint mobile lulus tanpa rebuild native.

Dock/FAB kini memakai depth dari token floating bersama untuk lebih terbaca pada background terang. Native shadow mengikuti alpha surface yang dirender tanpa underlay putih solid baru; glass tetap menampilkan warna rekening di bawahnya. Perubahan style ini diverifikasi pada iOS 26.5 dengan background netral dan gradient bank, serta typecheck/lint mobile lulus tanpa rebuild.
