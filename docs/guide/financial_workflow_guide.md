# Panduan Atria: memahami angka dan mencoba seluruh alur dari setup sampai closing

Diperbarui 5 Oktober 2026. Panduan ini mengikuti web Atria dengan backend API terpisah dan memakai satu latihan dengan angka yang bisa dihitung ulang. Tidak perlu punya dasar akuntansi untuk memulainya.

Tujuan akhirnya: kamu bisa menjawab **proyek ini menjual berapa, boleh menghabiskan berapa, sudah memakai biaya berapa, sudah membayar berapa, uang klien yang belum diterima berapa, stok yang masih ada berapa, dan margin yang tersisa berapa**.

## Cara memakai panduan

Kerjakan latihan utama berurutan. Setelah setiap tahap, berhenti dan cocokkan angka pada tabel. Kalau berbeda, cari transaksi penyebabnya sebelum lanjut. Jangan menambah data di luar latihan utama sebelum checkpoint akhir; uji fitur tambahan memakai bagian terpisah agar angka pembanding tetap jelas.

Gunakan database latihan lokal untuk percobaan pertama. Production di [atria-dekoria.netlify.app](https://atria-dekoria.netlify.app) disiapkan kosong untuk setup akun bersama boss. Jika nanti mengisi angka latihan di production, angka itu menjadi data sungguhan dalam instance tersebut; jangan mencampurnya dengan baseline proyek perusahaan.

Urutan baca:

1. [Menjalankan app dan memilih environment](#1-menjalankan-app-dan-memilih-environment).
2. [Dasar finance yang dipakai Atria](#2-dasar-finance-yang-dipakai-atria).
3. [Setup Owner, tim, rekening, dan master](#3-setup-owner-tim-rekening-dan-master).
4. [RAP, RAB, budget, dan aktivasi](#4-rap-rab-budget-dan-aktivasi).
5. [Invoice, pembayaran, stok, dan pengeluaran](#5-invoice-pembayaran-stok-dan-pengeluaran).
6. [Memeriksa angka akhir](#6-memeriksa-angka-akhir).
7. [Rekonsiliasi dan closing](#7-rekonsiliasi-dan-closing).
8. [Fitur tambahan dan pengujian kesalahan](#8-fitur-tambahan-dan-pengujian-kesalahan).
9. [Checklist pribadi](#9-checklist-pribadi).

## 1. Menjalankan app dan memilih environment

### Production dan development mempunyai data berbeda

| Environment                                  | Web                                    | API                                   | Database                  | Dipakai untuk                            |
| -------------------------------------------- | -------------------------------------- | ------------------------------------- | ------------------------- | ---------------------------------------- |
| Production                                   | `https://atria-dekoria.netlify.app`    | API Railway                           | `atria_pilot`             | Setup dan penggunaan bersama boss        |
| Latihan development yang disiapkan 5 Oktober | `http://localhost:3010`                | `http://localhost:3011`               | `atria_practice_20261005` | Percobaan pribadi dari setup kosong      |
| Development sebelumnya                       | Konfigurasi sebelumnya disimpan privat | API lama dapat masih berjalan di 3001 | `atria_uat_guard`         | Data development lama yang dipertahankan |

Web/API latihan berjalan di Mac, tetapi PostgreSQL latihan tetap berada di Neon. Kamu memerlukan internet untuk database, upload ImageKit, dan AI. Database kosong bukan berarti schema kosong: tabel/migration dan fondasi sistem tetap ada, sedangkan akun/proyek/transaksi bisnis belum dibuat.

### Dua terminal untuk web + API

Dari root repository, jalankan:

Terminal pertama:

```sh
PORT=3011 bun run dev:api
```

Terminal kedua:

```sh
PORT=3010 bun dev
```

Buka [localhost:3010/setup](http://localhost:3010/setup).

**`bun dev` hanya menyalakan web.** API perlu terminal pertama. `bun run dev:web` juga merupakan perintah web. Startup tidak menjalankan reset, seed, migration, atau membuat transaksi. Ctrl-C pada masing-masing terminal menghentikan proses yang kamu jalankan.

Port 3010/3011 dipilih karena port 3000 pada Mac ini dipakai layanan lain. Jangan mematikan layanan itu untuk menjalankan Atria. Jika port latihan sudah dipakai Atria yang masih aktif, gunakan instance tersebut atau hentikan terminal Atria milikmu terlebih dahulu; jangan membiarkan Next pindah port tanpa menyamakan origin API.

Konfigurasi privat yang dipakai:

- `apps/api/.env.local`: database latihan, origin web 3010, URL API 3011, serta konfigurasi provider backend.
- `apps/web/.env.local`: `API_ORIGIN=http://localhost:3011`, URL web 3010, dan konfigurasi presentasi.
- `API_BRIDGE_SECRET` harus cocok di web dan API. API key AI/storage serta credential database berada di backend, tidak di `NEXT_PUBLIC_*`.

Pemeriksaan dasar: [API /health](http://localhost:3011/health) harus menunjukkan `ok`; [API /ready](http://localhost:3011/ready) harus menunjukkan `ready`. `ready` membuktikan API dapat mengakses database, belum membuktikan semua workflow.

Jangan menyalin connection string production ke environment latihan. Jangan memakai database development sebagai target integration test otomatis; test Postgres mempunyai database disposable sendiri.

### Mengulang latihan dari nol

Reset menghapus akun, sesi, proyek, settings, transaksi, stok dan audit dalam database tujuan. Login sebelumnya tidak dapat dipakai lagi. Schema/migration dan tenant fondasi tetap dipertahankan; `/setup` membuat Owner dan default baru. Ini berbeda dengan demo seed yang langsung mengisi contoh data.

Untuk mengulang **database latihan saja**, periksa target dahulu dari direktori API:

```sh
cd apps/api
bun scripts/reset-database.ts --dry-run
```

Lanjut hanya jika output tujuan adalah `atria_practice_20261005`, bukan `atria_pilot` atau `atria_uat_guard`:

```sh
bun scripts/reset-database.ts --confirm-reset
```

Kembali ke root sebelum menjalankan web/API. Jangan memakai `db:demo:reset` untuk walkthrough dari kosong: perintah itu memasukkan akun dan transaksi demo. Jangan menjalankan `db:provision` terhadap database yang sudah direset; provisioning khusus database baru yang benar-benar belum berisi fondasi.

## 2. Dasar finance yang dipakai Atria

### Lima pertanyaan yang berbeda

| Pertanyaan                                          | Angka di app                                 | Artinya                                               |
| --------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------- |
| Klien menyetujui harga berapa?                      | Nilai kontrak / nilai proyek / RAB disetujui | Harga jual pekerjaan; belum berarti uang diterima     |
| Maksimal biaya internal yang direncanakan berapa?   | Budget internal / cap                        | Batas biaya untuk mengendalikan margin                |
| Biaya proyek yang sudah diakui berapa?              | Terpakai / actual / consumed                 | Biaya yang telah masuk perhitungan kategori           |
| Uang yang benar-benar dicatat sudah dibayar berapa? | Dibayar / paid                               | Realisasi kas keluar lewat pembayaran proyek          |
| Uang yang masih ada di bank/kas berapa?             | Saldo rekening / total kas                   | Saldo awal ditambah dana masuk, dikurangi dana keluar |

Jangan menyamakan kelima angka ini. Persetujuan dokumen, invoice, pembayaran, dan pemakaian stok adalah peristiwa berbeda.

### Kosakata dasar

| Istilah      | Bahasa sederhana                                 | Contoh                                                                         |
| ------------ | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| Kas          | Uang pada rekening atau kas tunai                | BCA Rp100 juta, Kas Kecil Rp10 juta                                            |
| Piutang      | Tagihan kepada klien yang belum dibayar          | Invoice Rp30 juta, klien baru membayar Rp10 juta → piutang Rp20 juta           |
| Utang vendor | Tagihan vendor yang belum dilunasi               | Bill Rp20 juta, sudah dibayar Rp8 juta → utang Rp12 juta                       |
| Persediaan   | Barang yang masih dimiliki, dinilai dengan biaya | Empat unit tersisa × Rp2 juta = Rp8 juta                                       |
| Biaya        | Nilai yang dibebankan pada proyek                | Tukang, operasional, material dipakai/terbuang                                 |
| Arus kas     | Perubahan uang masuk/keluar                      | Penerimaan klien menaikkan bank; membayar vendor menurunkannya                 |
| Rekonsiliasi | Mencocokkan catatan app dengan bukti mutasi bank | Pembayaran Rp8 juta pada Atria cocok dengan debit Rp8 juta pada rekening koran |
| Audit        | Jejak siapa melakukan apa dan kapan              | Pengajuan, approval, pembayaran, perubahan stok                                |

Persediaan yang masih disimpan adalah aset. Pengeluaran uang untuk membelinya tidak otomatis sama dengan biaya yang sudah terpakai. Pemisahan persediaan dan pengakuan biaya merupakan konsep akuntansi dasar; [IAS 2 dari IFRS Foundation](https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/) menjelaskan prinsip tersebut. Waktu pengakuan pada walkthrough ini mengikuti aturan proyek Atria yang dijelaskan di bawah.

### Kapan angka berubah di Atria?

| Tindakan                                           | Biaya terpakai                              | Kas                                           | Stok                         |
| -------------------------------------------------- | ------------------------------------------- | --------------------------------------------- | ---------------------------- |
| Membuat/menyetujui RAP atau RAB                    | Belum menjadi actual                        | Tetap                                         | Tetap                        |
| Membuat invoice klien                              | Tetap; piutang bertambah                    | Tetap                                         | Tetap                        |
| Mencatat penerimaan pembayaran klien               | Tetap; piutang turun                        | Naik                                          | Tetap                        |
| Mengajukan/verifikasi pengeluaran yang perlu Owner | Masuk menunggu review                       | Tetap                                         | Tetap                        |
| Pengeluaran disetujui                              | Actual naik                                 | Tetap sampai dibayar                          | Tetap                        |
| Membayar pengeluaran                               | Actual tidak dihitung dua kali              | Turun                                         | Tetap                        |
| Membuat bill vendor non-material                   | Actual naik; utang muncul                   | Tetap sampai dibayar                          | Tetap                        |
| Membuat bill Material untuk persediaan             | Belum menjadi biaya pemakaian; utang muncul | Tetap                                         | Tetap sampai barang diterima |
| Membayar bill Material                             | Paid naik, actual pemakaian belum naik      | Turun                                         | Tetap                        |
| Posting penerimaan barang                          | Tidak mencatat pembayaran baru              | Tetap                                         | Naik                         |
| Reservasi material                                 | Tetap                                       | Tetap                                         | Fisik tetap; tersedia turun  |
| Pemakaian / material terbuang untuk proyek         | Actual Material naik                        | Tetap                                         | Turun                        |
| Return sisa material proyek                        | Actual Material turun sesuai biaya tindakan | Tetap                                         | Naik                         |
| Import/matching mutasi bank                        | Tetap                                       | Tetap                                         | Tetap                        |
| Transfer antara rekening perusahaan                | Tidak menjadi biaya proyek                  | Rekening asal turun, tujuan naik; total tetap | Tetap                        |

Pengeluaran yang diajukan atau diverifikasi tetapi belum disetujui berada pada **menunggu review**, bukan consumed. Pengeluaran disetujui dan dibayar masuk consumed. Bill Material untuk persediaan dipisahkan dari actual pemakaian; paid pembelian tetap terlihat.

**Pembayaran dalam app adalah pencatatan realisasi. Atria tidak memindahkan uang melalui bank.** Dalam penggunaan nyata, Finance melakukan transfer pada layanan bank lalu mencatatnya dan melampirkan bukti. Pada latihan, cukup mencatat transaksi sintetis di database latihan.

### Budget, sisa, dan margin

Latihan memakai kontrak Rp100 juta tanpa baris Fee/Jasa terpisah:

```text
Cap internal = Rp100 juta × 90% = Rp90 juta
Target gross = Rp100 juta − Rp90 juta = Rp10 juta
Target margin = Rp10 juta ÷ Rp100 juta = 10%
Sisa cap = cap − biaya terpakai
Sisa kategori = alokasi kategori − biaya terpakai kategori
Persentase terpakai = biaya terpakai ÷ alokasi × 100%
```

Cap bukan saldo bank dan bukan janji bahwa semua Rp90 juta akan dibelanjakan. Alokasi kategori membagi cap, bukan membagi saldo rekening.

Ada dua angka margin yang perlu dibaca berbeda:

- **Proyeksi margin saat berjalan** memakai kontrak dikurangi angka lebih besar antara actual dan cap. Dengan actual Rp30 juta tetapi cap Rp90 juta, proyeksi tetap Rp10 juta/10%; sistem masih mencadangkan kemungkinan biaya sampai cap.
- **Margin realisasi saat closing** memakai kontrak dikurangi actual final. Kontrak Rp100 juta dan actual Rp30 juta menghasilkan Rp70 juta/70% pada snapshot proyek.

Margin proyek belum otomatis menjadi laba bersih perusahaan: app ini tidak menyusun seluruh pajak, overhead perusahaan, penyusutan, payroll, dan jurnal akuntansi formal.

RAB yang mempunyai komponen **Fee/Jasa** terpisah memakai basis budget dari **scope produksi**, bukan seluruh total kontrak. Contoh total Rp100 juta terdiri dari produksi Rp80 juta + fee Rp20 juta: cap 90% menjadi Rp72 juta. Karena itu latihan inti sengaja tidak memakai komponen fee. Harga jual baris Tukang/Subcon pada latihan tetap scope produksi.

### Rencana, actual, paid: tiga lapisan

**RAP** menjawab rencana eksekusi/biaya internal. **RAB** menjawab harga dan scope untuk klien. **Actual** mengikuti kejadian operasional yang dicatat. **Paid** mengikuti pembayaran. Mengubah harga jual RAB tidak mengubah harga pokok RAP, stok fisik, atau saldo bank.

Margin dan markup juga berbeda. Biaya Rp100, harga jual Rp110 berarti markup 10% terhadap biaya, tetapi margin sekitar 9,09% terhadap penjualan. Untuk target margin 10%, harga jualnya Rp100 ÷ 0,9 ≈ Rp111,11. Ini contoh membaca rasio, bukan rekomendasi harga bisnis.

## 3. Setup Owner, tim, rekening, dan master

### 3.1 Owner pertama

1. Buka `/setup` pada environment yang dipilih.
2. Masukkan bootstrap secret **milik environment itu**. Secret lokal berada pada konfigurasi privat API; secret production berbeda. Jangan menaruh nilainya di guide, screenshot publik, atau chat.
3. Isi nama Owner, email, dan password sendiri. Gunakan password sesuai validasi form, minimal 12 karakter dengan huruf besar/kecil dan angka. Tidak ada password bersama yang perlu disalin dari panduan.
4. Selesaikan setup lalu login. Ikuti layar pengenalan/Quick Start.

Hasil: satu akun Owner, role sistem dan izinnya, lima kategori, serta default budget tersedia. Belum ada uang klien, pembayaran vendor, ataupun stock movement. `/setup` kemudian tidak lagi menerima bootstrap pertama.

Untuk production, buat akun boss sebagai akun individual. Akun pribadi staf dibuat terpisah; tidak perlu berbagi akun Owner.

### 3.2 Default budget untuk latihan

Pada tahap **Default Finansial**, gunakan **Sesuaikan** pada **Komposisi default**. Simpan preset latihan:

| Pengaturan            |              Nilai |
| --------------------- | -----------------: |
| Nama preset           | Latihan End-to-End |
| Batas budget internal |                90% |
| Material              |                50% |
| Tukang                |                25% |
| Operasional           |                10% |
| Lain-lain             |                 5% |
| Subcon                |                10% |
| Total kategori        |      100% dari cap |
| Buffer tidak terbagi  |                 0% |

Semua kategori aktif. Ini **preset latihan**, bukan komposisi wajib untuk proyek Dekoria. Default bawaan app bisa berbeda. Mengubah default Settings tidak menghitung ulang proyek lama secara diam-diam; proyek menyimpan alokasinya sendiri.

Atur/periksa threshold approval Rp5.000.000 untuk latihan. Nominal **≥ threshold** atau kondisi overbudget membutuhkan review Owner. Keputusan approval pengeluaran disimpan ketika diajukan; mengubah setting sesudahnya tidak berarti boleh melompati keputusan yang sudah tersimpan.

### 3.3 Proyek pertama

Isi form Quick Start:

| Field          | Nilai latihan          |
| -------------- | ---------------------- |
| Nama proyek    | Latihan Interior Atria |
| Klien baru     | Klien Latihan          |
| Nilai proyek   | Rp100.000.000          |
| Nilai RAB awal | Rp100.000.000          |

Jika belum ada PM, buat akun tim pada tahap kesiapan lalu assign PM pada proyek sebelum aktivasi. Nilai RAB awal pada form budget **belum sama dengan persetujuan dokumen RAB resmi**. Proyek tetap Draft sampai perencanaan dan aktivasi selesai.

Hasil angka awal:

| Kategori    |          Alokasi |
| ----------- | ---------------: |
| Material    |     Rp45.000.000 |
| Tukang      |     Rp22.500.000 |
| Operasional |      Rp9.000.000 |
| Lain-lain   |      Rp4.500.000 |
| Subcon      |      Rp9.000.000 |
| Total cap   | **Rp90.000.000** |

Actual dan paid masih Rp0; sisa cap Rp90 juta. Lihat angka di detail proyek. Dashboard agregat proyek berjalan baru memasukkan proyek sesudah status Aktif.

### 3.4 Akun tim dan cara berganti role

Buka **Pengaturan → Kesiapan** untuk menyelesaikan akun tim dan kebutuhan operasional. Buat akun individual dengan role berikut:

| Role bawaan   | Dipakai dalam latihan                                                            | Batas penting                                                   |
| ------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Owner         | Defaults, approval berisiko, persetujuan RAB, aktivasi/closing, pengaturan akses | Approval dokumen belum berarti pembayaran                       |
| Finance Admin | Rekening, invoice/receipt, verifikasi, jadwal/bayar vendor, rekonsiliasi         | Tidak boleh melompati maker/checker yang diwajibkan             |
| PM            | RAP/scope dan pengajuan pengeluaran proyek yang ditugaskan                       | Tidak memperoleh akses semua proyek atau seluruh kas perusahaan |
| Purchasing    | Master material, lokasi, receipt, reserve/use/return/waste, pengajuan opname     | Tidak mendapat izin mengubah formula budget/margin              |

Role bawaan membantu memulai. **Permission yang tersimpan dan scope proyek tetap menjadi otoritas**, termasuk untuk custom role. Akses desktop adalah permission tersendiri; membuka desktop tidak menambah hak finance/material.

Login dengan empat akun bergantian melalui logout/login atau profil browser terpisah. Akun staf yang memakai password sementara harus menggantinya pada halaman perubahan password. Developer Account Switcher adalah bantuan development opsional dan tidak tersedia di production; panduan ini tidak bergantung padanya.

Pemisahan pelaku latihan: PM mengajukan → Finance memverifikasi → Owner menyetujui bila diperlukan → Finance mencatat pembayaran. Untuk jadwal vendor: Finance menjadwalkan → Owner menyetujui → Finance membayar. Ini menghindari self-approval. Opening stock membutuhkan pembuat dan approver yang berbeda, termasuk bila pembuat adalah Owner.

### 3.5 Rekening

Sebagai Finance/Owner, buat dua rekening pada area rekening Dashboard:

| Rekening          | Tipe      |    Saldo awal |
| ----------------- | --------- | ------------: |
| BCA Latihan       | Bank      | Rp100.000.000 |
| Kas Kecil Latihan | Kas tunai |  Rp10.000.000 |

Catatan saldo awal: `Saldo awal sebelum transaksi latihan`. Pakai rekening ini untuk semua langkah berikut.

Hasil: total kas perusahaan **Rp110 juta**. Saldo awal membuat catatan pembukaan ledger, tetapi **bukan pembayaran klien, omzet, ataupun actual proyek**. Opening rekening tidak dihitung sebagai cash-in proyek.

### 3.6 Vendor, lokasi, dan material

Siapkan vendor **Vendor Material Latihan** dan **Vendor Subcon Latihan**. Pada **Pengaturan → Katalog**, gunakan subtab Material/Library/Lokasi untuk master yang diperlukan.

Buat lokasi **Gudang A Latihan**, lalu Material Master:

| Field                 | Nilai                   |
| --------------------- | ----------------------- |
| Nama                  | Panel Latihan           |
| Satuan                | unit                    |
| Vendor default        | Vendor Material Latihan |
| Lokasi                | Gudang A Latihan        |
| Harga acuan           | Rp2.000.000             |
| Kategori biaya proyek | Material                |

Hasil inventory master baru: fisik 0, reserved 0, available 0, average cost 0. **Harga acuan bukan bukti barang sudah ada** dan tidak langsung menjadi average cost inventory.

Untuk latihan inti, pilih keputusan **Tidak ada stok lama** pada Kesiapan. Keputusan ini tidak menambah stok atau kas. Bila kamu menjalankan latihan opening stock tambahan, baca bagian 8.3 dan catat nilai persediaan tambahan secara terpisah.

## 4. RAP, RAB, budget, dan aktivasi

Navigasi detail proyek saat ini dikelompokkan: **Ringkasan**, **Perencanaan → RAP/RAB**, **Operasional → Stok/Pengeluaran**, dan **Keuangan → Pembayaran/Margin**. Desktop dan shell mobile berbagi data/aturan yang sama; letak kontrol dapat berbeda.

### 4.1 RAP: rencana internal

Sebagai PM proyek yang ditugaskan, buat RAP. Setup berjalan berurutan **Material → Tukang → Subcon → Review**.

1. Material: **Tambah Material**. Bila menggunakan Library, pilih **Isi manual**, lalu tetap pilih Material Master **Panel Latihan** supaya stock link terbentuk.
2. Isi jumlah 10 unit, buffer/cadangan 0, biaya per satuan Rp2 juta. Biaya rencana material Rp20 juta.
3. **Lanjut ke Tukang**; buat paket **Pemasangan Latihan**, jumlah 1 paket, biaya internal Rp10 juta. Buka detail lalu **Tandai Siap**.
4. **Lanjut ke Subcon**; buat paket **Subcon Latihan**, jumlah 1 paket, biaya internal Rp5 juta, vendor Subcon Latihan. **Tandai Siap**.
5. **Lanjut ke Review**; periksa total rencana internal Rp35 juta. **Finalisasi Internal Plan** mengunci RAP.

Untuk scope yang sungguh tidak ada, tersedia keputusan **Tidak Digunakan**. Pada latihan ini kedua paket digunakan. RAP yang dikunci adalah baseline rencana; actual masih 0 dan tidak ada uang keluar.

### 4.2 RAB: harga jual yang aman untuk klien

Pada RAB, generate dari **satu material RAP + dua paket** di atas. Jangan menambah manual line atau bundle pada latihan utama. Harga usulan otomatis belum tentu tepat Rp100 juta, jadi edit dan **Simpan** tiga item:

| Item RAB           |  Jumlah | Harga satuan klien | Total untuk klien |
| ------------------ | ------: | -----------------: | ----------------: |
| Panel Latihan      | 10 unit |        Rp6.000.000 |      Rp60.000.000 |
| Pemasangan Latihan | 1 paket |       Rp25.000.000 |      Rp25.000.000 |
| Subcon Latihan     | 1 paket |       Rp15.000.000 |      Rp15.000.000 |
| Total RAB          |         |                    | **Rp100.000.000** |

Ketiganya adalah scope produksi, tanpa komponen Fee/Jasa terpisah. Harga jual ini sengaja mudah dihitung; bukan contoh pricing wajib. RAP tetap Rp35 juta internal, sedangkan RAB Rp100 juta untuk klien.

Sebagai Owner, periksa preview dan setujui RAB. Periksa nilai kontrak Rp100 juta, cap Rp90 juta, serta alokasi pada 3.3. Budget menjadi disetujui dan sumber rencana dikunci. **Persetujuan RAB belum mengubah status proyek menjadi Aktif.**

Gunakan **Export Dokumen** untuk mencoba **Cetak/PDF**, Excel `.xlsx`, dan PNG. Periksa total Rp100 juta, deskripsi/jumlah/harga klien, serta pastikan biaya internal Rp35 juta, margin/markup, vendor note, dan internal note tidak tampil pada dokumen klien. Export tidak mengubah kas atau stok. Share/WhatsApp adalah tindakan kirim; pilih sendiri penerima bila memang ingin mengirim.

### 4.3 Aktivasi terpisah

Periksa PM sudah ditugaskan, budget disetujui, RAB disetujui, dan RAP sumber terkunci. Buka tindakan aktivasi proyek lalu **Aktifkan**.

Hasil: proyek Aktif dan boleh menjalankan operasional. Dashboard mulai memasukkan proyek ini. Actual 0, paid 0, sisa cap Rp90 juta, target/proyeksi margin Rp10 juta/10%, bank tetap Rp100 juta + Rp10 juta.

## 5. Invoice, pembayaran, stok, dan pengeluaran

Gunakan tanggal latihan yang konsisten. Catat nomor dokumen pada catatanmu; jangan mengulang submit yang sudah sukses ketika halaman masih loading. Semua angka berikut dalam rupiah; tabel checkpoint menggunakan **juta rupiah** agar mudah dibaca.

### 5.1 Buat invoice klien dan terima DP

Sebagai Finance, pada **Keuangan → Pembayaran**, buat jadwal invoice bawaan:

| Termin     | Persentase |           Invoice |
| ---------- | ---------: | ----------------: |
| DP         |        30% |      Rp30.000.000 |
| Progress 1 |        35% |      Rp35.000.000 |
| Progress 2 |        25% |      Rp25.000.000 |
| Pelunasan  |        10% |      Rp10.000.000 |
| Total      |       100% | **Rp100.000.000** |

Setelah invoice dibuat, piutang Rp100 juta dan BCA tetap Rp100 juta. Invoice adalah permintaan bayar, belum penerimaan uang.

Catat penerimaan DP Rp30 juta ke BCA Latihan dengan referensi `DP-LATIHAN`. Setelah berhasil: BCA Rp130 juta, Kas Kecil Rp10 juta, piutang Rp70 juta, actual/paid proyek tetap 0. Jika ingin menguji receipt parsial, bagi DP menjadi dua penerimaan yang totalnya Rp30 juta; checkpoint sama, tetapi CSV bank pada 7.1 perlu disesuaikan menjadi dua baris.

### 5.2 Bill Material dan pembayaran parsial

Sebagai Finance, buat bill `MAT-LATIHAN-01`, proyek Latihan Interior Atria, vendor Material, kategori Material, material Panel Latihan/RAP terkait, jumlah Rp20 juta. Ini pembelian **persediaan** 10 unit × Rp2 juta. Jangan membuat pengeluaran Material tambahan untuk pembelian yang sama.

Jadwalkan Rp8 juta dari BCA; karena nominal melewati threshold, login Owner untuk approval jadwal, lalu Finance mencatat pembayaran. Ulangi sisa Rp12 juta dengan jadwal/approval baru. Scheduling dan approval tidak mengubah bank; pembayaran selesai yang mengubahnya.

| Checkpoint                             | Actual | Paid proyek | Sisa cap | BCA | Utang vendor |
| -------------------------------------- | -----: | ----------: | -------: | --: | -----------: |
| Bill Rp20 juta dibuat                  |      0 |           0 |       90 | 130 |           20 |
| Jadwal Rp8 juta disetujui, belum bayar |      0 |           0 |       90 | 130 |           20 |
| Rp8 juta dibayar                       |      0 |           8 |       90 | 122 |           12 |
| Sisa Rp12 juta dibayar                 |      0 |          20 |       90 | 110 |            0 |

**Paid Rp20 juta dengan actual Rp0 adalah hasil yang benar** pada tahap ini. Barang belum dipakai; persediaan/cost consumption berbeda dari kas. Pembayaran vendor juga tidak otomatis menambah stok fisik.

### 5.3 Posting penerimaan barang

Sebagai Purchasing, buka Material → **Terima Barang**. Isi receipt `GR-LATIHAN-01`, proyek aktif, Gudang A, vendor/bill Material tadi, link RAP Panel Latihan, jumlah 10, unit cost Rp2 juta. **Tinjau → Posting**.

Hasil: fisik 10, reserved 0, available 10, average cost Rp2 juta, nilai inventory Rp20 juta. Actual masih 0, paid tetap Rp20 juta, bank tetap Rp110 juta + Rp10 juta. Receipt membuktikan barang datang, bukan bukti uang baru dibayar.

Receipt bisa dilakukan sebelum pembayaran pada bisnis nyata. Dalam latihan ini urutannya dibayar dahulu agar dua peristiwa terlihat jelas. Nomor receipt unik; total penerimaan terkait bill dan RAP dibatasi nilai/quantity dokumen tersebut.

### 5.4 Reserve, use, return, waste

Di **Operasional → Stok** proyek, pilih material/RAP/lokasi yang sama. Lakukan berurutan:

| Tindakan         | Fisik | Reserved | Available | Actual Material | Paid Material |
| ---------------- | ----: | -------: | --------: | --------------: | ------------: |
| Setelah receipt  |    10 |        0 |        10 |             Rp0 |     Rp20 juta |
| **Reservasi 7**  |    10 |        7 |         3 |             Rp0 |     Rp20 juta |
| **Pakai 6**      |     4 |        1 |         3 |       Rp12 juta |     Rp20 juta |
| **Kembalikan 1** |     5 |        1 |         4 |       Rp10 juta |     Rp20 juta |
| **Terbuang 1**   |     4 |        0 |         4 |   **Rp12 juta** | **Rp20 juta** |

Tulis alasan waste, misalnya `Satu panel rusak dalam simulasi pemasangan latihan`. Semua tindakan memakai **Tinjau → Catat** dan harus punya jejak aktivitas/audit. Tidak ada cash transaction baru dari keempat aksi ini.

Maknanya: reserve menjatah barang, use mengakui pemakaian, return mengembalikan sisa ke stok bebas, waste mengakui kerugian material. Available = fisik − reserved. Pemakaian melindungi jatah proyek lain; app tidak mewajibkan reserve dahulu, tetapi reserve membantu koordinasi tim.

Harga tindakan pada UI memakai average cost inventory saat itu. Return tidak selalu mengambil harga historis pemakaian lama. Angka latihan tepat karena tidak ada pembelian lain yang mengubah average cost di tengah.

Pada proyeksi RAP, angka bisa berbeda dari stok perusahaan. Fixture ini menghasilkan pemakaian net 5 unit, dibeli 10, sisa proyek 3, secured 8, dan perlu beli 2 terhadap rencana 10. Return masuk stok bebas, tidak otomatis menjadi jatah RAP. Rencana sengaja lebih besar dari pemakaian aktual untuk mengajarkan perbedaan tersebut; angka perlu beli bukan perintah transfer uang otomatis.

Tidak ada tombol publik untuk melepas seluruh reservasi secara umum. **Jangan mencatat pemakaian fiktif hanya untuk menghabiskan reservasi saat closing.** Latihan memakai reserve 7 sehingga langkah nyata use/return/waste berakhir reserved 0.

### 5.5 Pengeluaran Tukang: pengajuan sampai pembayaran

Sebagai PM, ajukan pengeluaran `Upah pemasangan latihan`, kategori Tukang, Rp10 juta, tautkan paket Tukang bila tersedia. Isi deskripsi/nota yang relevan.

Finance memverifikasi. Karena ≥ threshold Rp5 juta, Owner melakukan approval. Finance kemudian membayar dari BCA. Gunakan akun berbeda untuk requester dan approver; Owner yang membuat pengeluaran sendiri juga terkena maker/checker, kecuali override darurat yang secara eksplisit diizinkan dan diberi alasan.

| Tahap                        | Actual total | Menunggu review | Paid total | Sisa cap | BCA |
| ---------------------------- | -----------: | --------------: | ---------: | -------: | --: |
| Tukang diajukan/diverifikasi |           12 |              10 |         20 |       78 | 110 |
| Owner menyetujui             |           22 |               0 |         20 |       68 | 110 |
| Finance membayar             |           22 |               0 |         30 |       68 | 100 |

Actual naik saat disetujui, bukan dua kali ketika dibayar. Nota dan approval membenarkan biaya; payment dan bukti bayar membenarkan realisasi kas.

### 5.6 Operasional dan Lain-lain tetap sederhana

Sebagai PM, buat dua pengeluaran tanpa RAP/material/package:

| Pengeluaran                    | Kategori    |     Nominal | Rekening pembayaran |
| ------------------------------ | ----------- | ----------: | ------------------- |
| Transport dan konsumsi latihan | Operasional | Rp2.000.000 | Kas Kecil           |
| Biaya kecil latihan            | Lain-lain   | Rp1.000.000 | Kas Kecil           |

Finance memverifikasi. Dengan threshold Rp5 juta, keduanya di bawah alokasi dan tidak overbudget: hasil verifikasi dapat langsung disetujui, sehingga tidak perlu review Owner tambahan. Finance mencatat kedua pembayaran.

Hasil: actual total Rp25 juta, paid Rp33 juta, sisa cap Rp65 juta, BCA Rp100 juta, Kas Kecil Rp7 juta. Jangan mengurangi rekening lagi melalui menu dana keluar manual.

### 5.7 Bill Subcon

Sebagai Finance, buat `SUB-LATIHAN-01`, vendor Subcon, kategori Subcon, jumlah Rp5 juta dan tautkan paket Subcon. Jangan mengulangnya sebagai field expense.

Bill non-material masuk actual ketika dibuat: actual menjadi Rp30 juta, paid masih Rp33 juta, utang vendor Rp5 juta. Jadwalkan pembayaran BCA → Owner approve karena tepat threshold Rp5 juta → Finance bayar.

Hasil sesudah pembayaran: actual Rp30 juta, paid Rp38 juta, sisa cap Rp60 juta, BCA Rp95 juta, Kas Kecil Rp7 juta, utang vendor Rp0.

### 5.8 Terima tiga termin klien yang tersisa

Catat ke BCA dengan invoice yang tepat:

| Penerimaan           | BCA sesudahnya | Piutang tersisa |
| -------------------- | -------------: | --------------: |
| Progress 1 Rp35 juta |     Rp130 juta |       Rp35 juta |
| Progress 2 Rp25 juta |     Rp155 juta |       Rp10 juta |
| Pelunasan Rp10 juta  | **Rp165 juta** |         **Rp0** |

Actual dan paid tetap Rp30 juta/Rp38 juta. Total kas perusahaan menjadi Rp165 juta + Rp7 juta = **Rp172 juta**.

## 6. Memeriksa angka akhir

Sebelum closing, periksa detail proyek dan Dashboard. Refresh/reload dan pastikan angka tetap sama; angka tidak boleh hanya benar pada toast atau state optimistis.

| Nilai yang diperiksa                   |                 Hasil latihan inti | Tujuannya                                                   |
| -------------------------------------- | ---------------------------------: | ----------------------------------------------------------- |
| Kontrak/RAB disetujui                  |                      Rp100.000.000 | Harga jual yang menjadi acuan invoice                       |
| RAP rencana internal                   |                       Rp35.000.000 | Baseline rencana pekerjaan, bukan total pembayaran          |
| Cap internal                           |                       Rp90.000.000 | Batas biaya yang masih dipakai proyeksi konservatif         |
| Actual/consumed                        |                       Rp30.000.000 | Biaya yang sudah dibebankan pada proyek                     |
| Menunggu review                        |                                Rp0 | Tidak ada pengeluaran yang belum selesai diperiksa          |
| Paid proyek                            |                       Rp38.000.000 | Kas keluar yang telah dicatat untuk proyek                  |
| Sisa cap                               |                       Rp60.000.000 | Rp90 juta − Rp30 juta                                       |
| Budget terpakai total                  |                             33,33% | Rp30 juta ÷ Rp90 juta                                       |
| Proyeksi margin berjalan               |                 Rp10.000.000 / 10% | Kontrak − max(actual, cap)                                  |
| Pembayaran klien diterima              |                      Rp100.000.000 | Cash-in proyek                                              |
| Piutang/utang vendor                   |                          Rp0 / Rp0 | Semua invoice/bill inti selesai                             |
| Posisi kas proyek                      |                       Rp62.000.000 | Receipt Rp100 juta − paid Rp38 juta                         |
| Bank/Kas Kecil/Total kas               | Rp165 juta / Rp7 juta / Rp172 juta | Saldo awal Rp110 juta + receipt Rp100 juta − paid Rp38 juta |
| Panel Latihan fisik/reserved/available |                     4 / 0 / 4 unit | Stok sisa yang belum dijatah                                |
| Nilai Panel Latihan                    |                        Rp8.000.000 | Empat unit × average cost Rp2 juta                          |

Detail kategori:

| Kategori    |       Alokasi |        Actual |          Paid |          Sisa |                Terpakai |
| ----------- | ------------: | ------------: | ------------: | ------------: | ----------------------: |
| Material    |     Rp45 juta |     Rp12 juta |     Rp20 juta |     Rp33 juta |                  26,67% |
| Tukang      |   Rp22,5 juta |     Rp10 juta |     Rp10 juta |   Rp12,5 juta |                  44,44% |
| Operasional |      Rp9 juta |      Rp2 juta |      Rp2 juta |      Rp7 juta |                  22,22% |
| Lain-lain   |    Rp4,5 juta |      Rp1 juta |      Rp1 juta |    Rp3,5 juta |                  22,22% |
| Subcon      |      Rp9 juta |      Rp5 juta |      Rp5 juta |      Rp4 juta |                  55,56% |
| Total       | **Rp90 juta** | **Rp30 juta** | **Rp38 juta** | **Rp60 juta** | **33,33% terhadap cap** |

Total paid lebih besar dari actual sebesar Rp8 juta karena masih ada persediaan utama senilai Rp8 juta. Sesudah closing, margin realisasi Rp70 juta berbeda dari posisi kas proyek Rp62 juta dengan selisih yang sama. Pada fixture ini selisihnya terjelaskan; pada bisnis nyata, periksa juga piutang, utang, saldo awal dan transaksi di luar proyek sebelum menyimpulkan penyebabnya.

Cara Owner membaca app dalam 30 detik: **kontrak → cap → actual → sisa → kategori berisiko → paid/receipt/utang/piutang → stok/shortage → margin**. Sisa budget besar tidak otomatis berarti bank punya uang yang cukup. Bank bisa penuh karena DP, walaupun biaya atau kewajiban proyek masih akan terjadi.

## 7. Rekonsiliasi dan closing

### 7.1 Mutasi bank BCA

Unduh [bca-latihan.csv](./fixtures/financial-workflow/bca-latihan.csv). File berisi delapan mutasi skenario inti, bukan saldo awal: dana masuk Rp100 juta, keluar Rp35 juta, net Rp65 juta. Dengan opening BCA Rp100 juta, saldo akhirnya Rp165 juta.

Header yang diterima:

```csv
tanggal,deskripsi,dana_masuk,dana_keluar
```

Tanggal fixture 2026-10-05. Jika latihan dilakukan pada tanggal lain atau nominal dipecah, sesuaikan file dengan tanggal/transaksi latihanmu. Tiap baris harus berisi salah satu dana masuk atau keluar; pakai nominal angka tanpa `Rp`/pemisah ribuan.

Sebagai Finance:

1. Buka **Rekonsiliasi → Mutasi Bank** dan pilih BCA Latihan.
2. Import CSV lalu review delapan baris sebelum menyimpan. Import tidak menambah/mengurangi saldo dan tidak mencatat pembayaran kedua.
3. Pada **Catatan Atria**, cocokkan setiap transaksi proyek dengan mutasi yang benar: rekening sama, arah sama, nominal tepat sama. Matching manual yang tersedia adalah satu catatan ke satu mutasi.
4. Periksa delapan match pada riwayat. Import file yang sama lagi untuk menguji deduplication: tidak boleh menjadi delapan mutasi baru.

Jika receipt DP atau pembayaran dibagi berbeda dari latihan, jangan memaksa match satu baris statement ke beberapa catatan dengan nominal berbeda. Siapkan statement yang mencerminkan transaksi terpisah dan cocokkan satu per satu. Mutasi yang tidak mempunyai catatan Atria perlu ditelusuri, bukan langsung dianggap biaya proyek.

### 7.2 Kas Kecil dengan pengecualian terdokumentasi

Pembayaran tunai Rp2 juta dan Rp1 juta tidak muncul pada rekening koran BCA. Buka **Catatan Atria**, pilih masing-masing transaksi Kas Kecil → sheet **Cocokkan transaksi** → **Catat pengecualian** → field **Alasan** → **Simpan alasan**.

Gunakan alasan yang dapat diperiksa:

- Operasional: `Pembayaran tunai Operasional dari Kas Kecil dalam skenario latihan; didukung nota dan pemeriksaan kas, bukan mutasi rekening BCA.`
- Lain-lain: `Pembayaran tunai Lain-lain dari Kas Kecil dalam skenario latihan; didukung nota dan pemeriksaan kas, bukan mutasi rekening BCA.`

Alasan wajib 10–1.000 karakter. Pada penggunaan nyata harus ada bukti/opname kas yang sesuai; jangan memakai pengecualian untuk menyembunyikan selisih bank.

Hasil: dua **Pengecualian dicatat**, tetap berbeda dari status direkonsiliasi. Checklist closing proyek dapat menunjukkan unresolved 0 dan documented exceptions 2. Dua catatan saldo awal rekening masih dapat terlihat pada antrean global; jangan menganggap seluruh antrean perusahaan otomatis kosong.

### 7.3 Closing proyek

Sebagai Owner, buka closing/checklist proyek. Sebelum finalisasi, pastikan:

- Total invoice sama dengan kontrak dan semua invoice selesai/void secara sah.
- Semua bill selesai/void dan tidak ada jadwal pembayaran yang masih tertunda.
- Pengeluaran selesai dibayar atau ditolak; tidak ada pengajuan/verifikasi/pembayaran yang belum tuntas.
- Budget disetujui; tepat satu baseline RAB disetujui; tidak ada draft RAB atau Change Order terbuka.
- Reservasi proyek habis melalui tindakan nyata, bukan use fiktif.
- Cash transaction proyek cocok dengan mutasi bank atau punya pengecualian terdokumentasi yang diterima checklist.

Jumlah pemeriksaan mengikuti checklist app; jangan mengandalkan janji jumlah invariant tetap. Bila salah satu blocker muncul, selesaikan dokumen sumber lalu periksa lagi. Barang sisa bebas tetap boleh ada di gudang; barang yang masih direservasi proyek menjadi blocker.

Finalisasi menghasilkan snapshot final dan proyek Selesai. Hasil utama:

| Snapshot                      |               Nilai |
| ----------------------------- | ------------------: |
| Kontrak                       |          Rp100 juta |
| Actual final                  |           Rp30 juta |
| Margin realisasi              | **Rp70 juta / 70%** |
| Posisi kas proyek             |           Rp62 juta |
| Sisa persediaan Panel Latihan |   4 unit / Rp8 juta |

Sesudah closing, app menolak operasional/pembayaran baru yang mensyaratkan proyek aktif. Dashboard budget mengagregasi proyek **Aktif**: bila ini satu-satunya proyek dan sudah selesai, agregat aktif dapat turun menjadi 0. Data/snapshot proyek tetap ada dan saldo perusahaan tetap Rp172 juta. Itu bukan kehilangan data.

## 8. Fitur tambahan dan pengujian kesalahan

Bagian berikut menguji fitur lain. Jangan mengubah fixture utama tanpa mencatat dampaknya. Lakukan aksi yang membutuhkan proyek aktif **sebelum closing** atau gunakan proyek latihan tambahan.

### 8.1 Chat AI, OCR, dan lampiran

Latihan lokal memakai **9Router, Gemini 3.8 Flash** (`ag/gemini-3.8-flash-high`). Model membantu analisis/prefill, tetapi keputusan keuangan/material tetap milik pengguna.

Untuk menguji OCR tanpa mengubah checkpoint utama, gunakan nota sintetis pengeluaran Operasional Rp2 juta pada 5.6 sebagai jalur input pengeluaran itu, **bukan pengeluaran kedua**. Periksa proyek, kategori, tanggal, total, item, lampiran dan deskripsi sebelum submit. Nota bisa berupa gambar/PDF yang sesuai batas UI; jangan memakai dokumen perusahaan pada latihan sintetis.

Untuk chat, minta: `Jelaskan posisi budget, actual, paid, piutang, dan stok proyek Latihan Interior Atria. Jangan membuat transaksi.` Cocokkan jawaban dengan bagian 6; jawaban AI tidak menggantikan data app.

Uji proposal pada proyek tambahan: minta prefill pengeluaran kecil, pastikan belum ada pengeluaran/ledger sebelum tombol konfirmasi manusia. Batalkan satu proposal, konfirmasi proposal lain satu kali, lalu lihat pengeluaran dan audit. Proposal pengeluaran belum otomatis berarti sudah approved/paid.

Lampiran finansial dikirim lewat referensi storage yang terotorisasi. Uji buka/download dengan akun berhak lalu akun tanpa izin. File yang ditolak/terlalu besar tidak boleh menghasilkan transaksi setengah jadi. File PDF/gambar bank yang dianalisis AI harus direview sebelum import; CSV pada latihan utama memberikan hasil deterministik.

Chat/OCR memerlukan API aktif, credential/provider yang benar, internet dan kuota. Pesan gagal tidak membuktikan transaksi gagal bila pembayaran sudah terlanjur tercatat; periksa status/audit sebelum mencoba ulang. Production data-policy provider dan backup byte lampiran merupakan pemeriksaan operasional tersendiri; dump database tidak menyertakan file ImageKit.

### 8.2 Dana masuk/keluar manual dan transfer rekening

Jalankan setelah mencatat checkpoint utama, atau gunakan rekening terpisah:

1. Catat dana masuk umum Rp500 ribu ke Kas Kecil dengan alasan latihan. Saldo naik Rp500 ribu, tetapi bukan receipt invoice/actual proyek.
2. Catat dana keluar umum Rp500 ribu dari Kas Kecil. Saldo kembali Rp7 juta; bukan pengeluaran proyek yang sudah dibuat pada 5.6.
3. Transfer internal Rp1 juta dari BCA ke Kas Kecil. Hasil BCA Rp164 juta, Kas Kecil Rp8 juta, total tetap Rp172 juta. Ledger mempunyai dua sisi transfer yang saling terkait.
4. Bila ingin kembali ke checkpoint bank awal, transfer Rp1 juta kembali: BCA Rp165 juta, Kas Kecil Rp7 juta. Tetap ada riwayat dua transfer; jangan menghapus jejak agar seolah tidak pernah terjadi.

Transaksi umum ini berada di luar proyek. Sesuaikan rekonsiliasi perusahaan untuk mutasi baru; CSV delapan baris inti tidak mencakupnya. Jangan memakai dana keluar manual untuk membayar ulang expense/bill yang sudah dibayar melalui workflow khusus.

### 8.3 Opening, transfer stok, opname, adjustment, dan receipt reversal

Gunakan Material Master lain **Material Gudang Tambahan**, satuan unit, cost Rp100 ribu, dengan Gudang A dan lokasi baru **Gudang B Latihan**. Ini tidak mengubah actual/paid proyek utama, tetapi menambah nilai persediaan perusahaan.

Siapkan opening pada inventory dummy yang belum pernah mempunyai saldo/reservasi/movement, sebaiknya pada fase setup awal. Purchasing membuat batch 5 unit @Rp100 ribu di Gudang A, lalu **Finance/Owner yang berbeda** menyetujuinya. Pengajuan belum mengubah stok; approval menghasilkan A=5, nilai Rp500 ribu. Tidak ada emergency self-approval untuk opening. Jika keputusan stock awal sudah ditetapkan, gunakan pengelolaan/history opening yang tersedia; jangan mengubah saldo barang yang sudah berjalan seolah masih opening.

Lanjutkan ketika proyek utama aktif:

| Tindakan                                 | Dummy A | Dummy B |    Nilai dummy |
| ---------------------------------------- | ------: | ------: | -------------: |
| Opening disetujui                        |       5 |       0 |     Rp500 ribu |
| Transfer 2 A → B, alasan jelas           |       3 |       2 |     Rp500 ribu |
| Stock Opname B dihitung 3, baru dikirim  |       3 |       2 |     Rp500 ribu |
| Finance/Owner berbeda: Setujui & Posting |       3 |       3 |     Rp600 ribu |
| Owner: Penyesuaian Darurat +1 A          |       4 |       3 |     Rp700 ribu |
| Receipt tambahan 1 @Rp100 ribu di B      |       4 |       4 |     Rp800 ribu |
| Purchasing meminta reversal receipt      |       4 |       4 |     Rp800 ribu |
| Approver berbeda menyetujui reversal     |       4 |       3 | **Rp700 ribu** |

Receipt tambahan memilih proyek aktif, **Tanpa tagihan vendor** dan **Tanpa tautan RAP**. Catat nomor baru dan lakukan reversal sebelum movement lain menghabiskan unit tersebut. Request reversal hanya meminta keputusan; approval yang mengurangi stok. Reversal tidak refund vendor payment, tidak void bill, dan bukan reset database.

Opname membandingkan angka app dengan hitungan fisik. Draft/pengajuan tidak mengubah stok; approval menerapkan selisih. Jika stok berubah sejak snapshot opname, hitung ulang. Jumlah terhitung tidak boleh lebih kecil dari reserved. Opname/adjustment bukan biaya proyek atau uang keluar. Tulis alasan minimal 10 karakter pada transfer/adjustment yang mewajibkannya.

Opening reversal hanya dapat diuji pada inventory bersih **sebelum movement berikutnya**. Pakai material dummy lain bila ingin membalik opening, bukan opening yang sudah ditransfer/opname di tabel.

Sesudah appendix ini, Panel Latihan utama tetap 4 unit/Rp8 juta dan actual/paid proyek Rp30 juta/Rp38 juta. **Total inventory perusahaan menjadi Rp8,7 juta**, karena dummy menambah Rp700 ribu. Jangan membandingkan agregat semua material dengan checkpoint Rp8 juta material utama saja.

### 8.4 Revisi RAB dan Change Order

CO adalah perubahan scope/harga yang disetujui setelah baseline; bukan cara mengedit invoice lama diam-diam. Uji sebelum closing atau pada proyek tambahan. Buat revisi/CO produksi tambahan Rp10 juta, review delta dan dokumen klien, lalu Owner approve. Hindari draft/CO yang menggantung ketika ingin closing.

Bila dilakukan pada fixture utama sebelum closing, kontrak menjadi Rp110 juta dan cap Rp99 juta. Kategori yang bukan override manual mengikuti rasio otomatis: Rp49,5 juta / Rp24,75 juta / Rp9,9 juta / Rp4,95 juta / Rp9,9 juta. Actual tetap Rp30 juta selama belum ada biaya baru, sisa cap Rp69 juta, proyeksi Rp11 juta/10%.

Tambah invoice dan penerimaan Rp10 juta sesuai scope baru. BCA menjadi Rp175 juta, Kas Kecil Rp7 juta, posisi kas proyek Rp72 juta. Closing realized menjadi Rp80 juta/72,73%. **Ini cabang berbeda dari checkpoint Rp100 juta**; gunakan angka cabang ini bila benar-benar menyimpan CO. Tidak ada pilihan KEEP/SCALE yang perlu dicari pada approval saat ini.

### 8.5 Penolakan dan batas akses

Gunakan percobaan yang dibatalkan/ditolak untuk memastikan kontrol bekerja. Setelah penolakan, pastikan saldo/stok/actual/audit mutasi finansial tidak berubah.

| Percobaan                                                                     | Hasil yang dicari                                                        |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| PM membuka proyek lain yang tidak ditugaskan                                  | Data/aksi ditolak atau tidak ditampilkan                                 |
| Purchasing membuka pengaturan formula budget                                  | Tidak memperoleh hak edit formula                                        |
| Permission custom role dicabut saat masih login                               | Request berikutnya mengikuti izin terbaru                                |
| Pembayaran expense sebelum approval                                           | Ditolak                                                                  |
| Approver sama dengan requester/scheduler yang diwajibkan maker/checker        | Ditolak; override darurat hanya jika benar-benar diizinkan dan beralasan |
| Pembayaran bill melebihi outstanding                                          | Ditolak                                                                  |
| Penerimaan klien melebihi sisa invoice                                        | Ditolak                                                                  |
| Double-click pembayaran yang sama                                             | Tepat satu realisasi kas; lihat status, bukan jumlah toast               |
| Use/reserve melebihi stok yang tersedia atau jatah proyek lain                | Ditolak                                                                  |
| Return melebihi net pemakaian yang sesuai proyek/material/lokasi/RAP          | Ditolak                                                                  |
| Approval reversal ketika stok receipt tidak lagi cukup/reserved terlindungi   | Ditolak pada approval; request saja belum memeriksa semuanya             |
| Mengedit/menghapus catatan kas yang sudah direkonsiliasi                      | Ditolak; koreksi lewat tindakan kompensasi yang sah                      |
| Closing saat ada invoice/bill/approval/CO/reservasi/rekonsiliasi belum tuntas | Checklist menunjukkan blocker                                            |
| Upload terlalu besar atau file tanpa izin                                     | Ditolak tanpa mutasi bisnis separuh                                      |

Jangan memaksakan uji overbudget dengan biaya palsu ke fixture utama. Pada proyek tambahan, coba biaya yang melampaui alokasi, lihat pending/Owner review dan alasannya, lalu tolak agar tidak menjadi actual. Status penolakan harus tetap mempunyai jejak yang sesuai.

### 8.6 Notifikasi, profil, audit, dan pemulihan

- Periksa notifikasi in-app setelah pengajuan/approval; buka tujuan dan cocokkan dokumennya. Browser push memerlukan VAPID dan izin perangkat, sehingga belum otomatis aktif hanya karena notifikasi in-app muncul.
- Uji profil/password/logout dengan akunmu. Setelah logout, halaman terproteksi meminta login. Jangan berbagi password sementara dalam dokumen latihan.
- Pada riwayat/audit, periksa pelaku, nominal, waktu, sumber dokumen, dan status. Request yang sukses harus memiliki satu mutasi yang tepat; retry tidak boleh mengubah saldo/stok dua kali.
- Putuskan koneksi sesaat lalu pulihkan. Bedakan data yang belum dimuat dari transaksi gagal. Jangan mengulang aksi uang otomatis; setelah koneksi pulih, baca status dan refresh sebelum retry eksplisit.
- Backup database dan backup lampiran berbeda. Restore harus menuju database terpisah, lalu dibandingkan counts/angka/checksum. Jangan menjalankan restore di production untuk mencoba fitur.

## 9. Checklist pribadi

Tulis tanggal, akun yang dipakai, nomor dokumen, expected, actual, dan screenshot bila perlu. Centang setelah melihat data tersimpan, bukan hanya toast sukses.

- [ ] Environment/DB yang dipakai jelas; web dan API hidup; `/ready` lulus.
- [ ] Setup Owner sendiri, default budget, akun Finance/PM/Purchasing dan password sementara diuji.
- [ ] PM ditugaskan; scope asing dan custom grant/revoke diuji.
- [ ] Rekening opening total Rp110 juta tanpa dianggap receipt proyek.
- [ ] Master vendor/material/lokasi dan keputusan stok awal selesai.
- [ ] RAP Material/Tukang/Subcon siap dan terkunci; internal plan Rp35 juta.
- [ ] RAB Rp100 juta, client-safe PDF/Excel/PNG benar; approval dan aktivasi dilakukan terpisah.
- [ ] Empat invoice total Rp100 juta; DP dan tiga termin dicatat, piutang akhir 0.
- [ ] Bill Material Rp20 juta dibayar parsial 8 + 12, utang akhir 0, tidak dibuat expense ganda.
- [ ] Receipt10 → reserve7 → use6 → return1 → waste1, hasil stok4/reserved0/actualMaterial12/paidMaterial20.
- [ ] Tukang10/Ops2/Lain1 selesai sesuai approval dan rekening; Subcon5 lewat bill, tidak diduplikasi.
- [ ] Actual30/paid38/sisa60; BCA165/KasKecil7; semua kategori cocok.
- [ ] OCR/chat/lampiran diuji dengan data sintetis; proposal AI memerlukan konfirmasi manusia.
- [ ] Delapan mutasi BCA diimport/matched, import ulang tidak menggandakan; dua pengecualian kas terdokumentasi.
- [ ] Fitur cash umum/transfer dan gudang tambahan dicoba dengan perubahan angka terpisah yang dicatat.
- [ ] Revisi/CO diuji pada cabang/proyek tambahan; checkpoint disesuaikan bila CO disimpan.
- [ ] Negative checks, notifikasi, audit, refresh/logout/koneksi pulih diperiksa.
- [ ] Closing tanpa blocker: snapshot actual30/margin70/posisiKas62 untuk skenario inti; data proyek tetap dapat dibaca setelah selesai.

Jika angka berbeda, telusuri **sumber dan tahap**: invoice belum diterima, approval belum dibayar, bill inventory dibanding actual pemakaian, transaksi ganda lewat menu kas umum, scope fee mengubah cap, perubahan average cost, proyek belum aktif/sudah closed, atau appendix yang ikut masuk agregat. Catat selisih yang belum terjelaskan dan hentikan langkah berikutnya sampai penyebabnya jelas.

## Referensi untuk pemeriksa teknis

Aturan walkthrough dicocokkan dengan implementasi: `budget-sync.ts` (actual/pending/paid), `excel-budget.ts` (derivasi cap), `vendor-bill-write.ts`, `inventory-project-movements.ts`, `project-material-projection.ts`, `rap-rab-approval.ts`, `activation-readiness.ts`, `reconcile-cash-transaction.ts`, dan `project/closing.ts`. Semua backend business code berada di `apps/api/src/backend/`; shared calculation berada di `packages/core/`.

Lihat juga [arsitektur](../06-technical/ARCHITECTURE.md), [mobile/API development](./mobile-api-development.md), [evidence hosted](../plans/2026-10-05-hosted-workflow-verification.md), [rencana setup bersih](../plans/2026-10-05-self-guided-workflow-and-clean-setup.md), dan [demo yang sudah terisi](./seeded_demo_walkthrough.md). Demo terisi bukan dataset latihan kosong pada panduan ini.
