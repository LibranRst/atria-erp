# Walkthrough Seed Development Atria — Neon, API, dan Web

Panduan ini memakai **profil development baru** untuk mencoba UI dan alur Atria dengan data
proyek interior yang saling terhubung. Web berjalan di komputer lokal, sedangkan database tetap
Neon yang sudah dikonfigurasi di `apps/api/.env`. Tidak perlu Docker atau mengganti database app.

Mulai dari bagian 1 untuk menyiapkan data dan menyalakan server. Lakukan tur baca pada bagian 3–5
sebelum mengubah data. Untuk rangkaian pembayaran dan rekonsiliasi, ikuti bagian 6–10 berurutan;
transaksi dari satu langkah menjadi counterpart pada langkah berikutnya.

Untuk UAT dari data operasional kosong, gunakan
[`financial_workflow_guide.md`](./financial_workflow_guide.md).
Detail kontrak dataset dan sumber fixture berada di [development-seed](./development-seed.md).

## Status verifikasi

Diperiksa 6 Oktober 2026 pada PostgreSQL disposable, bukan dengan mereset Neon pengguna.
Seed/reset dan verifier lolos; 70 test unit/kontrak serta 5 test invariant PostgreSQL lolos.
Login API, loader tujuh proyek, scoping PM, dan export delapan dokumen RAB juga diperiksa pada
clone terpisah. API, web, dan mobile lolos typecheck. Langkah klik/mutasi di bawah merupakan
walkthrough manual; jawaban AI baru bergantung pada provider yang dikonfigurasi.

Baseline development:

| Data                              |       Jumlah |
| --------------------------------- | -----------: |
| Proyek / Project Budget           |        9 / 8 |
| Dokumen RAP / baris material      |      8 / 231 |
| Paket Tukang/Subcon               |           67 |
| Dokumen RAB / bundle / detail     | 8 / 52 / 326 |
| Vendor bill / expense canonical   |      54 / 90 |
| Transaksi kas / stock movement    |     86 / 124 |
| Item & Price Library              |           20 |
| Notifikasi / percakapan contoh AI |       25 / 5 |

Tujuh proyek mempunyai RAP utama dengan 6–8 area kerja. Pakubuwono belum mempunyai RAP/RAB karena
budget menunggu keputusan, Cipete belum mempunyai RAB karena RAP belum final, dan PIK dibatalkan
sebelum transaksi. Kondisi kosong tersebut adalah skenario gating yang sengaja disediakan.

Angka di panduan ini berlaku pada baseline baru sebelum transaksi manual. Harga adalah asumsi
fixture development, bukan penawaran vendor aktual. Tanggal bergeser mengikuti hari seed dalam
zona Asia/Jakarta; ID dokumen perencanaan dan nomor referensi tetap stabil.

## 1. Persiapan, seed Neon, dan menyalakan API + web

### 1.1 Periksa konfigurasi yang sudah ada

Jalankan semua command dari root repo. Pada workspace ini:

```sh
cd "/Volumes/DekoriaSSD/App Projects/Websites/atria-erp"
```

Periksa file berikut tanpa mengganti credentials yang sudah bekerja:

| File                                       | Yang perlu benar                                                                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/.env`                            | `DATABASE_URL` menunjuk Neon development yang akan diisi; `NODE_ENV=development`; auth settings dan `API_BRIDGE_SECRET` tersedia |
| `apps/web/.env` atau `apps/web/.env.local` | `API_BRIDGE_SECRET` sama dengan API; `API_ORIGIN=http://localhost:3001`                                                          |

Backend credentials berada di API, tidak di `NEXT_PUBLIC_*`. Nilai env yang sudah diekspor di
terminal mengalahkan file `.env`; jangan meninggalkan `DATABASE_URL` dari percobaan database lain.
Schema Neon harus sudah mengikuti migration repo. Seed tidak melakukan migration/schema push.

Jika ingin memakai Developer Account Switcher, set flag berikut **di env API dan web**, lalu
restart server. Ini opsional; login biasa tetap bisa digunakan.

```env
ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED=true
```

### 1.2 Hentikan server, isi ulang data, lalu verifikasi

**Reset berikut menghapus seluruh data pada database Neon development yang dipilih oleh
`DATABASE_URL`, termasuk akun lama, lalu menggantinya dengan dataset development baru.**
Periksa target host/database yang dicetak command dan gunakan hanya database yang memang ingin
dikembalikan ke fixture.

```sh
bun run dev:stop
bun install
bun run db:dev:reset --confirm-reset
bun run db:dev:verify
```

`bun install` cukup saat dependencies belum terpasang atau telah berubah. `dev:stop` menghentikan
proses development checkout ini agar tidak membaca/menulis data ketika reset berlangsung.

Reset mempertahankan schema dan metadata migration, mengisi data dalam satu transaksi,
menulis CSV ke `apps/api/.atria-demo/`, lalu memverifikasi relasi dan perhitungannya.
Command menolak `NODE_ENV=production`. Kegagalan invariant sebelum commit membatalkan insert.

Expected output sukses memuat jumlah baseline pada tabel di atas dan:

```text
Database development siap; koneksi RAP, RAB, keuangan, dan stok sudah diverifikasi.
```

Command verify mencetak jumlah dataset dan:

```text
Data development sudah diverifikasi. Tidak ada data yang diubah.
```

Jika database migrated benar-benar kosong, gunakan **seed biasa sebagai pengganti reset**:

```sh
bun run db:dev:seed
bun run db:dev:verify
```

Seed biasa menolak database berisi data. Jangan memakai `db:demo:reset` untuk dataset baru ini;
command tersebut membuat baseline demo lama yang lebih kecil.

### 1.3 Nyalakan kedua server dalam satu terminal

Setelah seed/verifikasi sukses:

```sh
bun run dev:web-api
```

Biarkan terminal ini berjalan. Preset menyiapkan deklarasi API, menjalankan API sekali, dan
menjalankan web dengan origin yang sesuai. Ia tetap memakai Neon dari env backend dan tidak
melakukan seed/reset otomatis.

| Layanan                        | Alamat default                                                 |
| ------------------------------ | -------------------------------------------------------------- |
| Web app yang dibuka di browser | <http://localhost:3003>                                        |
| API                            | <http://localhost:3001>                                        |
| API health / koneksi database  | <http://localhost:3001/health> / <http://localhost:3001/ready> |

Tidak perlu menjalankan `bun run dev:api` atau `bun run dev` lagi ketika preset ini sudah aktif.
Untuk melihat health dari terminal lain:

```sh
curl --fail http://localhost:3001/health
curl --fail http://localhost:3001/ready
```

`/ready` memeriksa koneksi database. Jika port terpakai, preset berhenti dengan pesan konflik;
lihat bagian 15. Ctrl-C menghentikan API dan web bersama. `bun run dev:stop` juga dapat dipakai
untuk menghentikan preset dari terminal lain.

### 1.4 Login dan mulai tur

Buka <http://localhost:3003>, lalu login sebagai Owner:

```text
Email: ronald@dekoria.com
Password: password123
```

Setelah reset, session akun sebelumnya tidak berlaku; muat ulang dan login kembali. Seluruh akun
seed menggunakan password `password123`:

| Peran         | Nama          | Email                |
| ------------- | ------------- | -------------------- |
| Owner         | Ronald Wijaya | `ronald@dekoria.com` |
| Finance Admin | Lisa Permata  | `lisa@dekoria.com`   |
| PM            | Budi Santoso  | `budi@dekoria.com`   |
| PM            | Siti Aminah   | `siti@dekoria.com`   |
| Purchasing    | Agus Pratama  | `agus@dekoria.com`   |

Mulai sebagai Ronald untuk melihat semua proyek dan ringkasan keuangan. Berganti akun pada
bagian 2 untuk memeriksa hak akses dan data masing-masing peran.

## 2. Cara mengganti role

1. Sebagai Ronald/Owner, buka **Profil**.
2. Pada **Simulasi developer**, pilih Lisa untuk Finance, Budi/Siti untuk PM, atau Agus untuk
   Purchasing.
3. Tekan **Mulai simulasi**.
4. Setelah aksi selesai, tekan **Kembali** pada status simulasi untuk kembali ke Owner.

Switcher mengganti effective user server-side. Permission, project scoping, maker-checker, dan actor
audit mengikuti akun yang dipilih.

## 3. Quick tour 15 menit

### 3.1 Dashboard — `/ledger`

Sebagai Owner atau Finance, baca:

- saldo BCA Operasional: **Rp655.000.000**;
- Kas Kecil PM Budi: **Rp14.150.000**;
- Mandiri Giro Utama: **Rp394.955.000**;
- Kas Kecil PM Siti: **Rp9.500.000**;
- indikator transaksi yang belum rekonsiliasi: **2**.

Saldo berasal dari ledger, bukan dari statement bank. Rekonsiliasi hanya membuktikan bahwa ledger
dan rekening koran menunjuk transaksi yang sama; mencocokkan tidak mengubah saldo.

### 3.2 Expenses — `/expenses`

Gunakan tab/filter untuk menemukan:

- expense Rp1.050.000 berstatus Approved;
- expense Rp5.000.000 dan Rp6.200.000 yang masih perlu review;
- expense Cipete Rp7.500.000 dan Rp18.000.000 yang sudah Verified dan langsung
  terlihat pada antrean Owner;
- payment vendor Rp4.000.000 dan Rp10.000.000 berstatus terjadwal;
- histori vendor bill paid Menteng, Senopati, dan BSD; total dataset mempunyai 54 bill.

Gunakan pencarian dan filter status/proyek untuk membedakan pekerjaan terbuka dari histori
lunas. Paket Tukang/Subcon Senopati dan BSD mempunyai expense dengan link ke scope pekerjaan;
expense pemakaian stok mempunyai consumed cost tanpa cash-out baru.

### 3.3 Projects — `/projects`

| Project              | Status awal                                        | Gunakan untuk                                    |
| -------------------- | -------------------------------------------------- | ------------------------------------------------ |
| Menteng Villa        | Active, RAB R1 approved, R2 void                   | Finance/material utama dan histori revisi batal  |
| Sudirman Suites      | Active, RAB R1 approved, R2 + Change Order pending | Approval revisi scope dan budget berisiko        |
| Brawijaya Residence  | Active, RAP locked, initial RAB draft              | Edit RAB, bundle, hidden line, dan approval awal |
| Cipete House         | Active, RAP draft tahap Review                     | Finalisasi internal plan lalu generate RAB       |
| Pakubuwono Apartment | Draft, Project Budget pending approval             | Approve/reject budget dan downstream gating      |
| Senopati Office      | Active, seluruh kewajiban selesai                  | Project closing                                  |
| Kemang Townhouse     | On Hold, RAP final, RAB draft Rp260 juta           | Rencana siap lanjut dan filter lifecycle         |
| BSD Boutique Cafe    | Completed, kontrak Rp380 juta dan pembayaran lunas | Histori biaya, stock, payment, dan margin akhir  |
| PIK Shophouse        | Cancelled                                          | Histori pembatalan project                       |

Sebagai PM Budi hanya Menteng, Brawijaya, Cipete, Senopati, dan PIK yang boleh
terlihat. Sebagai PM Siti hanya Sudirman, Pakubuwono, Kemang, dan BSD yang boleh
terlihat. Owner dan Finance melihat seluruh project.

### 3.4 Approvals — `/approvals`

Sebelum walkthrough mengubah data, Owner langsung melihat:

- **Rp18.000.000 · Cipete** — Lapangan, kritis karena Subcon beralokasi Rp0;
- **Rp7.500.000 · Cipete** — Lapangan, sudah diverifikasi Finance;
- **Rp10.000.000 · vendor** — pencairan yang membutuhkan Owner;
- **OPB-2026-07-0002** — saldo awal stok Workshop Cikupa.

Expense Menteng Rp5.000.000 dan Sudirman Rp6.200.000 belum tampil pada baseline
karena masih `SUBMITTED`. Keduanya baru masuk antrean sesudah Lisa melakukan
verifikasi pada langkah 6.2 dan 6.3. Ini perilaku yang benar, bukan data hilang.

### 3.5 Reconciliation — `/reconciliation`

- **Mutasi bank**: dua row belum cocok.
- **Catatan Atria**: dua transaksi perlu tindakan.
- **Riwayat**: 84 pasangan selesai, termasuk histori Senopati dan BSD.

Setiap row awal yang belum cocok mempunyai tepat satu counterpart.

### 3.6 Materials, Settings, notifikasi, dan draft

- Buka `/materials`: cari material, pindah lokasi, bandingkan stok fisik/reservasi/tersedia,
  lalu buka histori penerimaan, transfer, penggunaan dan stock count.
- Buka `/settings/library`: 20 template memiliki unit, harga internal/jual, vendor/context dan
  rincian komponen biaya. Buka `/settings/materials` serta `/settings/categories` untuk master
  material dan lima kategori expense.
- Buka `/notifications` sebagai Ronald, Lisa, kedua PM, dan Agus: tiap peran mempunyai notifikasi
  yang sesuai pekerjaannya. Coba status dibaca/belum dibaca dan tujuan tautannya.
- Sebagai PM, buka form expense/vendor bill yang mempunyai draft tersimpan; periksa pemulihan
  isian dan scope proyek sebelum mengirim. Seed tidak otomatis mengirim draft.
- Buka histori AI sebagai akun yang mempunyai izin asisten; contoh percakapan sudah tersedia
  tanpa harus mengirim pertanyaan baru. Bagian 12A menjelaskan provider untuk chat baru.

Periksa mobile 320/360/390/430 px dan desktop 1024/1280/1440 px. Utamakan angka uang yang tidak
terpotong, filter/pencarian, isi detail/sheet, tombol keyboard/touch, dan posisi baca saat berganti
tab. Data yang hanya dibaca mempertahankan seluruh state awal untuk langkah berikutnya.

## 4. Settings dan master data

Sebagai Owner, buka `/settings` dan periksa:

| Area                | Nilai seed                |
| ------------------- | ------------------------- |
| Internal Budget Cap | 90%                       |
| Tukang              | 18% dari Internal Budget  |
| Material            | 35%                       |
| Operasional         | 1%                        |
| Lain-lain           | 0,5%                      |
| Subcon              | 0%                        |
| Unallocated Buffer  | 45,5%; bukan gross margin |

Buka Settings Material dan Item & Price Library. Material, vendor, unit, dan harga di sana menjadi
referensi RAP serta form, tetapi mengubah default tidak menulis ulang budget project yang sudah ada.

Alokasi proyek pada profil development sudah disesuaikan dengan RAP dan paket tiap proyek.
Karena itu persentase pada budget Menteng/Sudirman tidak harus sama dengan default Settings.
Cipete sengaja mempertahankan Subcon Rp0 untuk mengetes risiko dan approval biaya tanpa alokasi.

## 5. Project Budget, RAP, dan RAB

### 5.1 Membaca Menteng

Sebagai Owner, buka **Menteng Villa**:

- Project Value Rp800.000.000;
- Internal Budget Rp720.000.000;
- target gross Rp80.000.000;
- RAP material revision 1 sudah locked;
- RAB client Rp800.000.000 sudah approved.
- 6 area, 26 baris material RAP, dan 9 paket Tukang/Subcon;
- histori RAB mempunyai R2 berstatus **Dibatalkan**: baseline Rp800 juta ditambah opsi mini bar
  Rp90 juta menjadi Rp890 juta; Change Order juga dibatalkan dan tidak mengubah kontrak aktif.

Di budget category, bedakan:

- **Pending review**: request belum final;
- **Consumed/actual**: approved atau committed cost;
- **Paid**: kas benar-benar keluar;
- **Remaining**: allocation dikurangi consumed cost.

### 5.2 Pakubuwono — keputusan Project Budget

Buka **Pakubuwono Apartment - Budget Review** sebagai Owner, lalu pilih
**Ringkasan**. Keputusan berada pada surface **Workflow Project Budget**.

State awal:

- project `DRAFT`, PM Siti sudah ditugaskan;
- contract value Rp650.000.000;
- Internal Budget Rp585.000.000 atau 90%;
- Project Budget `PENDING_APPROVAL`;
- RAP dan RAB belum ada.

Periksa seluruh kategori lalu pilih salah satu jalur:

1. **Setujui Project Budget**: status menjadi Approved dan tab RAP dapat dipakai.
2. **Tolak Budget**: isi alasan minimal tiga karakter; budget kembali editable.

Approval budget belum mengaktifkan project. Aktivasi tetap harus ditolak sampai
RAP terkunci dan RAB approved tersedia.

### 5.3 Cipete — final review RAP

Buka **Cipete House - RAP Review** sebagai Owner, Finance, atau PM Budi.

State awal:

- budget Approved: Rp420.000.000 dengan Internal Budget Rp378.000.000;
- RAP R1 `DRAFT`, `setupStage=REVIEW`;
- 6 area, 27 baris Material, 6 paket Tukang, dan 3 paket Subcon;
- planned Material Rp174.260.000, Tukang Rp68.000.000, Subcon Rp64.940.000;
- alokasi budget Subcon masih Rp0: periksa risiko usulan ini sebelum finalisasi;
- belum mempunyai RAB.

Di tab RAP, pindah antar tahap 1–4 untuk memeriksa state lengkap. Pada Review,
pastikan total Material, Tukang, Subcon, dan Total Plan tampil. Tekan
**Finalisasi Internal Plan** sebagai role yang berizin.

Expected:

- RAP menjadi `LOCKED` dan setup selesai;
- tidak ada cash transaction atau perubahan stok;
- tab RAB menawarkan sumber Material, Tukang, dan Subcon;
- setelah generate, RAB R1 tetap Draft sampai keputusan eksplisit Owner.

### 5.4 Brawijaya — initial RAB draft lengkap

Buka **Brawijaya Residence - RAB Sandbox**. Ini sandbox utama untuk mengetes UI
RAB tanpa mengubah skenario Menteng dan Sudirman.

State awal:

- budget Approved, RAP R1 locked dengan 6 area dan 28 baris material;
- 6 paket Tukang berbiaya internal total Rp120.850.000 dan 3 paket Subcon Rp114.150.000;
- RAB R1 `DRAFT` dengan ketiga source type: Material, Category Plan, dan Manual;
- 6 bundle sesuai area kerja dengan child Material dan Tukang;
- pekerjaan spesialis Subcon, loose furniture, dan proteksi/mobilisasi ditampilkan terpisah;
- hidden line **Opsi dekorasi tambahan** Rp15.000.000, tidak termasuk total aktif;
- nilai visible RAB tepat **Rp950.000.000**.

Uji edit label/harga, buka detail bundle, tampilkan/sembunyikan line, tambah item
manual, dan buat bundle baru. Hidden line tidak boleh ikut total. Pilih
**Tinjau & Setujui RAB** untuk menguji approval awal.

Expected setelah approval **jika nilai total belum Anda ubah**:

- RAB menjadi Approved dan project value tetap Rp950.000.000;
- bila harga/line yang Anda edit mengubah total, nilai approved mengikuti total visible terbaru;
- RAP serta package yang dipakai menjadi locked;
- perubahan berikutnya hanya dapat dilakukan melalui revision + Change Order.

Reset development dengan `bun run db:dev:reset --confirm-reset` untuk mengembalikan RAB ini ke Draft.

### 5.5 Sudirman — Change Order R2 menunggu approval

Buka **Sudirman Suites - Penthouse Fit-Out** sebagai Owner.

State awal:

- RAB R1 Approved Rp1.200.000.000;
- RAP R1 locked sebagai baseline;
- RAP R2 sudah Locked/Complete agar sumber internal siap untuk keputusan scope;
- RAB R2 masih Draft sebagai revisi aktif;
- setiap RAP R1/R2 memiliki 8 area dan 36 baris material; paket sumber R2 mencakup
  9 paket Tukang dan 3 paket Subcon;
- revisi visible Rp1.335.000.000, delta **+Rp135.000.000**;
- Change Order sudah mempunyai bukti konfirmasi klien dan berstatus
  `PENDING_APPROVAL`;
- pembuatnya Lisa/Finance, sehingga Ronald/Owner memenuhi maker-checker.

Buka ringkasan revisi dan histori Change Order. Periksa reference
`WA-CLIENT-SUD-CO-02 / 20-07-2026` dan tanggal konfirmasi pada histori, lalu setujui sebagai Owner.
Nomor referensi adalah fixture stabil; tanggal record mengikuti anchor seed.

Expected:

- RAB R1 dan RAP R1 menjadi Superseded;
- RAB R2 menjadi Approved, RAP R2 dan source package menjadi Locked;
- project value, approved RAB, dan category allocations dihitung ulang dari
  Rp1.335.000.000;
- Change Order menyimpan Ronald sebagai approver;
- approval ulang atau approval oleh maker tanpa emergency override ditolak.

### 5.6 Urutan aman untuk visual regression

Jika tujuan utama hanya memeriksa tampilan, gunakan urutan berikut agar state
awal tidak cepat habis:

1. baca Menteng dan histori pembatalannya tanpa mutasi;
2. baca seluruh panel Sudirman sebelum menyetujui Change Order;
3. edit Brawijaya, tetapi tunda approval sampai seluruh drawer diperiksa;
4. finalisasi Cipete terakhir;
5. gunakan Pakubuwono untuk mencoba approve atau reject budget;
6. jalankan reset untuk mengembalikan semua state.

## 6. Expense: direct flow dan Owner approval

### 6.1 Expense Rp1.050.000 — direct payment

1. Ganti ke Lisa/Finance dan buka `/expenses`.
2. Cari **Operasional bensin & e-toll trip supervisi tim tukang**.
3. Status awal **Approved**; tekan **Cairkan**.
4. Pilih **Kas Kecil PM Budi**.
5. Isi referensi `DEMO-EXP-1050`.
6. Tekan **Tinjau**, lalu **Cairkan**.

Expected:

- status menjadi Paid;
- saldo Kas Budi Rp14.150.000 → Rp13.100.000;
- ledger membuat OUTFLOW Rp1.050.000, belum reconciled;
- paid amount category Operasional bertambah Rp1.050.000;
- audit actor Lisa.

### 6.2 Expense Rp5.000.000 — maker, verifier, approver, payer

1. Sebagai Lisa, cari **Pembelian tripleks tambahan mendesak** dan tekan **Verifikasi**.
2. Status berubah Submitted → Verified karena nominal mencapai threshold Rp5 juta.
3. Kembali ke Owner, buka `/approvals`, pilih pengajuan Rp5.000.000, lalu tekan
   **Setujui pengajuan** dan konfirmasi **Setujui**.
4. Kembali ke Lisa, tekan **Cairkan**.
5. Pilih **Kas Kecil PM Budi**, referensi `DEMO-EXP-5000`, lalu konfirmasi.

Expected:

- approval actor Ronald berbeda dari requester Budi dan payer Lisa;
- saldo Kas Budi Rp13.100.000 → Rp8.100.000;
- Material pending/actual/paid tersinkron;
- ledger OUTFLOW Rp5.000.000 menunggu rekonsiliasi.

### 6.3 Expense Rp6.200.000 — approval Subcon berdasarkan nominal

1. Sebagai Lisa, verifikasi **Pekerjaan perbaikan waterproofing mendesak** milik Sudirman.
2. Sebagai Owner, setujui dari `/approvals`.
3. Sebagai Lisa, cairkan dari **Mandiri Giro Utama** dengan referensi `DEMO-EXP-6200`.

Expected:

- approval wajib karena nominal Rp6,2 juta melewati threshold Owner Rp5 juta;
- alokasi Subcon Sudirman pada baseline development adalah Rp194.953.500, sehingga expense ini
  bukan contoh Subcon tanpa alokasi; gunakan expense Cipete Rp18 juta untuk contoh kritis itu;
- saldo Mandiri Rp394.955.000 → Rp388.755.000;
- ledger OUTFLOW Rp6.200.000 belum reconciled;
- cost Subcon dan paid amount kategori terbarui; bandingkan risk dengan alokasi proyek tersebut.

## 7. Vendor bill dan partial payment

### 7.1 Payment Rp4.000.000

1. Sebagai Lisa, buka vendor payment untuk BILL-2026-091.
2. Payment sudah PENDING/terjadwal dan tidak memerlukan Owner.
3. Tekan **Cairkan**, isi referensi `DEMO-VENDOR-4000`, pilih BCA Operasional.
4. Tekan **Tinjau**, lalu **Bayar**.

Expected:

- saldo BCA Rp655.000.000 → Rp651.000.000;
- bill Rp20 juta menjadi Partially Paid;
- completed paid Rp4 juta, outstanding Rp16 juta;
- payment tidak dihitung dua kali.

### 7.2 Payment Rp10.000.000

1. Coba cairkan payment BILL-2026-092 sebagai Lisa sebelum approval: action harus ditolak.
2. Kembali ke Owner → `/approvals` → pilih vendor payment Rp10 juta → **Setujui pengajuan**.
3. Kembali ke Lisa, cairkan dengan referensi `DEMO-VENDOR-10000` dari BCA.

Expected:

- saldo BCA Rp651.000.000 → Rp641.000.000;
- bill Rp41 juta menjadi Partially Paid dengan outstanding Rp31 juta;
- approval history menyimpan Ronald, pencairan menyimpan Lisa;
- duplicate reference atau pembayaran melebihi outstanding ditolak.

## 8. Cumulative client payment

1. Sebagai Owner/Finance, buka Menteng → invoice **INV/2026/002**.
2. Nilai invoice Rp320.000.000, sudah diterima Rp120.000.000, outstanding Rp200.000.000.
3. Tekan action pembayaran, isi:
   - rekening: BCA Operasional;
   - amount: Rp200.000.000;
   - referensi: `DEMO-CLIENT-200M`.
4. Tekan **Tinjau**, lalu **Catat**.

Expected:

- status Partially Paid → Paid berdasarkan total Rp120 juta + Rp200 juta;
- saldo BCA Rp641.000.000 → Rp841.000.000;
- ledger INFLOW Rp200 juta belum reconciled;
- percobaan payment tambahan ditolak sebagai overpayment.

## 9. Transfer antar rekening

1. Sebagai Lisa, buka `/ledger` dan rekening BCA Operasional.
2. Tekan **Transfer**.
3. Tujuan **Kas Kecil PM Budi**, nominal Rp5.000.000.
4. Isi deskripsi `Top up kas kecil demo` dan referensi `DEMO-TRANSFER-5M`.
5. Tekan **Tinjau**, lalu **Transfer**.

Expected:

- BCA Rp841.000.000 → Rp836.000.000;
- Kas Budi Rp8.100.000 → Rp13.100.000;
- terbentuk dua ledger entries dengan shared transfer ID;
- net cash perusahaan tidak berubah;
- kedua sisi belum reconciled dan membutuhkan mutasi bank pada rekening masing-masing.

## 10. Rekonsiliasi

### 10.1 Test exception pada pasangan seed

1. Buka `/reconciliation` → **Catatan Atria**.
2. Pilih transaksi Rp850.000.
3. Tekan **Catat pengecualian** dan isi alasan minimal 10 karakter, misalnya
   `Menunggu konfirmasi tanggal dari kasir proyek.`

Expected: transaksi tetap belum cocok, saldo tidak berubah, dan closing menganggapnya documented
exception. Tekan lagi **Hapus pengecualian** agar transaksi kembali perlu tindakan.

### 10.2 Cocokkan dua pasangan awal

Untuk Rp850.000 dan Rp2.500.000:

1. pilih Catatan Atria;
2. pilih satu saran Mutasi Bank yang nominal/rekening/arahnya sama;
3. tekan **Cocokkan**.

Expected: kedua row hilang dari daftar belum cocok dan muncul di **Riwayat** dengan tanggal serta
nama pemeriksa. Saldo bank tidak berubah.

### 10.3 Import transaksi dari walkthrough

Setelah langkah expense, vendor, invoice, dan transfer selesai, impor tiga file berikut melalui
tab **Mutasi bank** → **Impor CSV**:

| File `apps/api/.atria-demo/`   | Pilih rekening     | Counterpart                     |
| ------------------------------ | ------------------ | ------------------------------- |
| `bca-operasional-<anchor>.csv` | BCA Operasional    | Client, vendor, transfer keluar |
| `kas-pm-budi-<anchor>.csv`     | Kas Kecil PM Budi  | Transfer masuk dan dua expense  |
| `mandiri-utama-<anchor>.csv`   | Mandiri Giro Utama | Expense Rp6,2 juta              |

Sesudah import, cocokkan setiap row. Nominal sama tidak cukup: rekening dan arah juga wajib sama.
Jika file yang sama diimpor ulang, fingerprint duplicate harus dilewati dan saldo tetap tidak berubah.

## 11. Material dan stock

### 11.1 Pending opening stock

1. Sebagai Owner, buka approval **OPB-2026-07-0002**.
2. Periksa material, lokasi Workshop Cikupa, quantity, unit cost, dan requester.
3. Setujui hanya setelah maker dan approver berbeda.

Expected: batch posted, setiap item mempunyai stock movement IN, inventory location bertambah, dan
audit mencatat approver. Buka lokasi Workshop Cikupa untuk membandingkan stok sebelum/sesudah.

### 11.2 Goods Receipt

Sebagai Agus/Purchasing, buka Materials. Histori GRN menunjukkan hubungan:

`Vendor Bill → Goods Receipt → Goods Receipt Item → Stock Movement → Material Inventory`.

Development juga menyediakan draft **DEV-GRN-DRAFT-1** (Menteng) dan **DEV-GRN-DRAFT-2** (Sudirman).
Buka draft sebagai Agus, periksa RAP, lokasi, quantity shortage dan unit cost, lalu gunakan
**Tinjau → Posting**. Kedua draft ini belum ditautkan ke vendor bill; hubungan tagihan dapat
diperiksa pada histori receipt Senopati/BSD. Quantity yang diterima muncul sebagai movement IN; posting ulang record yang
sama harus ditolak. Histori Senopati/BSD sudah Posted dan tidak perlu diposting ulang.

### 11.3 Reserve, use, return, waste

Buka Menteng → Stock. Gunakan operation sheet:

- Reserve: quantity tersedia turun, current stock tidak berubah;
- Use: current dan reserved turun sesuai penggunaan;
- Return: current stock naik dan usage net project turun;
- Waste: current stock turun dan wajib mempunyai catatan audit.

Setiap form memakai **Tinjau** lalu **Catat**. Operasi stock tidak membuat cash transaction.

### 11.4 Transfer dan stock count

- Transfer material memakai **Tinjau → Posting** dan menghasilkan movement OUT asal serta IN tujuan.
  Material harus **sudah mempunyai baris inventory di kedua lokasi**; tombolnya
  dinonaktifkan dengan alasan "Inventory material belum tersedia di lokasi sumber
  atau tujuan" bila belum. Contoh yang mudah dipakai: Multipleks 18mm
  (Gudang Utama ↔ Gudang Transit Menteng) dan Cabinet Hardware Set Soft-close
  (Gudang Utama ↔ Workshop Cikupa). Dataset juga mempunyai lokasi Site BSD Boutique Cafe dan
  Site Senopati Executive Suite dengan stok akhir nol; jangan mengubah histori proyek selesai
  bila masih ingin memeriksa baseline closing/margin.
- Buka stock count draft **DEV-STC-GUDANG-DRAFT** di Gudang Utama: 8 baris dimulai dengan
  counted quantity sama dengan system quantity. Ubah satu hasil hitung fisik untuk membuat
  variance, isi catatan, lalu gunakan **Tinjau → Kirim**.
- Hanya variance non-zero yang menghasilkan adjustment,
  dan **penghitungnya sendiri tidak boleh menyetujui** — approval menuntut user lain
  (Owner dapat memakai emergency override dengan alasan).
- Emergency adjustment wajib mempunyai alasan audit dan memakai **Tinjau → Posting**.

## 12. Dashboard, profitability, dan closing

### 12.1 Baca perubahan dashboard

Kembali ke `/ledger` dan Menteng/Sudirman. Periksa bahwa:

- saldo mengikuti semua cash transactions;
- consumed budget dan paid amount tidak tertukar;
- invoice cash-in meningkatkan saldo dan client receipts;
- payment vendor/expense meningkatkan paid cost;
- reconciliation tidak mengubah nominal apa pun;
- material stock usage tetap terpisah dari perpindahan kas.

### 12.2 Closing Senopati

1. Sebagai Owner, buka Senopati → Overview/Profitability.
2. Tekan **Periksa kesiapan closing**.
3. Pada baseline baru, expected blocker kosong: invoice Rp500 juta sudah paid/reconciled,
   satu RAB approved, budget approved, dan tanpa bill/expense/reservation terbuka.
   Histori tetap lengkap: 25 tagihan material lunas, 25 receipt Posted, 25 penggunaan material,
   9 expense paket Tukang/Subcon lunas, serta 2 expense Operasional/Lain-lain lunas.
4. Bandingkan biaya aktual **Rp260.395.000** dan margin aktual/cash position proyek
   **Rp239.605.000**. Saldo rekening Mandiri adalah saldo gabungan beberapa proyek, bukan cash
   position Senopati saja.
5. Isi catatan minimal 10 karakter, misalnya `Seluruh dokumen final sudah diperiksa.`
6. Tekan action penyelesaian project.

Expected: status Active → Completed, final profitability snapshot dibuat, end date diisi, dan audit
`COMPLETE_PROJECT` tercatat.

Sebagai negative test, buka Menteng dan tekan **Periksa kesiapan closing**. Menteng harus tetap
blocked karena masih mempunyai invoice/vendor/payment/reservation yang belum final.

Buka BSD sebagai referensi proyek yang sudah Completed: kontrak Rp380 juta, seluruh termin
30%/45%/25% lunas, biaya aktual **Rp224.650.000**, dan margin akhir **Rp155.350.000**.
Telusuri satu baris RAP ke tagihan, pembayaran, receipt, pemakaian stok, dan expense kategorinya.
Penggunaan material mencatat input produksi termasuk buffer potongan; kas keluar berasal dari
pembayaran vendor dan tidak dibuat lagi ketika stok dipakai.

## 12A. Asisten AI

Profil development membuat **5 percakapan contoh**, masing-masing terkait pengguna seed.
Buka histori untuk memeriksa list percakapan, message bubble, judul, dan pemulihan percakapan.
Pesan tersebut adalah snapshot sintetis yang ditulis fixture; membacanya tidak membutuhkan key
atau panggilan provider dan tidak membuat transaksi.

Untuk mengirim **pertanyaan baru**, gunakan konfigurasi provider pada `apps/api/.env` sesuai
`apps/api/.env.example`: misalnya NINEROUTER beserta key/base URL jika itu provider aktif, atau
GEMINI/DEEPSEEK sesuai konfigurasi yang dipilih. Provider yang tidak dikonfigurasi tidak dapat
menghasilkan jawaban baru; ini berbeda dari histori seed yang sudah bisa dibaca.

Tombol asisten mengikuti permission `use:ai_chat`. Owner, Finance, PM, dan Purchasing pada role
saat ini dapat mengaksesnya, dengan data/tool sesuai izin dan project scope masing-masing.
Gunakan Owner/Finance untuk pengujian finance, PM untuk proyeknya sendiri, dan Agus untuk
pertanyaan material yang diizinkan.

### 12A.1 Jawaban berbasis data

Tanyakan berturut-turut dan bandingkan angkanya dengan layar terkait:

| Pertanyaan                                           | Expected                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| "Berapa sisa budget proyek Sudirman?"                | Satu kartu budget Sudirman saja, bukan daftar seluruh proyek                 |
| "Proyek mana yang budgetnya paling mengkhawatirkan?" | Satu kartu berisi hanya proyek berisiko; Senopati dan Brawijaya tidak muncul |
| "Berapa total kas kita?"                             | Kartu saldo; totalnya sama dengan `/ledger` tab Rekening                     |
| "Ada tagihan vendor yang jatuh tempo?"               | Kartu tagihan; yang telat berada di baris teratas                            |

Periksa juga: jejak "N sumber data dibaca" bisa dibuka, angka di kartu cocok dengan halaman aslinya,
dan menekan kartu membuka rute terkait sambil menutup sheet.

### 12A.2 Kartu usulan pengeluaran

Minta: "Catat pengeluaran material Rp 750.000 untuk beli cat di proyek Sudirman."

Expected: muncul kartu usulan berstatus **Belum dikirim**. Tidak ada apa pun yang tercatat sampai
Anda menekan Konfirmasi. Setelah dikonfirmasi, kartu berubah menjadi **Terkirim**, dan pengajuan
muncul di `/expenses` dengan status Diajukan.

Muat ulang halaman lalu buka lagi percakapan itu: kartu harus tetap **Terkirim** tanpa tombol
konfirmasi. Ini penjaga terhadap dokumen ganda.

## 13. Negative test ringkas

| Test                                                   | Expected                                        |
| ------------------------------------------------------ | ----------------------------------------------- |
| `db:dev:seed` dijalankan lagi pada DB berisi data      | Ditolak tanpa delete                            |
| Development reset tanpa `--confirm-reset`              | Ditolak                                         |
| Payment invoice > outstanding                          | Ditolak, saldo tidak berubah                    |
| Vendor payment Rp10 juta sebelum Owner approval        | Ditolak                                         |
| PM membuka project yang tidak di-assign                | Forbidden/tidak terlihat                        |
| Purchasing membuka saldo atau margin komersial         | Tidak memperoleh akses                          |
| Cocokkan rekening/arah/amount yang berbeda             | Ditolak                                         |
| Impor file CSV yang sama dua kali                      | Duplicate dilewati                              |
| Edit/delete cash transaction yang sudah reconciled     | Ditolak                                         |
| Stock use melebihi available stock                     | Ditolak                                         |
| Closing Menteng sebelum semua blocker selesai          | Ditolak dan blocker dijelaskan                  |
| PM bertanya ke asisten soal proyek yang bukan miliknya | Ditolak/dibatasi tanpa membocorkan data project |
| Akun tanpa `use:ai_chat` membuka asisten               | Tombol tidak muncul / akses ditolak             |
| Menekan Konfirmasi dua kali pada satu kartu usulan     | Hanya satu pengajuan tercatat                   |

Baris terakhir dahulu hanya benar untuk penekanan **berurutan**. Dua permintaan
yang benar-benar berlomba — bentuk klik ganda yang sesungguhnya — sama-sama
lolos pemeriksaan "sudah pernah dikonfirmasi?" dan menghasilkan dua pengajuan
biaya dengan id berbeda. Sejak perbaikan itu, seluruh urutan periksa lalu tulis
diserialkan oleh kunci baris percakapan, dan kasusnya dijaga regression test.

## 14. Mengulang atau mengaudit hasil

Jika ingin mengembalikan seluruh skenario ke baseline baru, hentikan server dahulu. Reset
menghapus perubahan manual di database development terpilih.

```sh
bun run dev:stop
bun run db:dev:reset --confirm-reset
bun run db:dev:verify
bun run dev:web-api
```

Untuk pemeriksaan read-only saja, jalankan dari terminal lain:

```sh
bun run db:dev:verify
```

Verifier menguji baseline development dan relasi/perhitungan datanya. Jalankan segera setelah seed
sebelum mulai mutasi. Snapshot, jumlah item, referensi dan state tertentu dapat berubah setelah
Anda mencoba form; kegagalan setelah walkthrough tidak otomatis berarti seed awal salah.

Gunakan halaman detail, ledger, category budget, stock movement dan audit untuk membandingkan
perubahan setelah tindakan manual. Selesaikan rekonsiliasi dari bagian 10 atau reset untuk
mengulang dari kondisi awal. Jangan melakukan repair langsung lewat SQL.

### Baseline demo lama untuk suite otomatis lama

`db:demo:*` tetap tersedia untuk connected demo lama. Suite walkthrough finance lama menyimpan
expectation saldo/record profil demo, sehingga tidak dipakai pada profil development baru.
Jika menjalankan suite tersebut, gunakan database demo disposable yang terpisah dari Neon dev:

```sh
# Gunakan URL database demo disposable yang terpisah dari Neon development.
DATABASE_URL="<URL demo disposable>" bun run db:demo:reset --confirm-reset

# Subshell menjaga terminal tetap berada di root setelah test selesai.
(
  cd apps/api && ATRIA_TEST_DATABASE_URL="<URL demo disposable yang sama>" \
    bun test src/backend/lib/finance/demo-walkthrough.integration.test.ts
)
```

Untuk eksplorasi UI pada panduan ini, tetap gunakan `db:dev:*`.

## 15. Jika belum bisa masuk atau data belum terlihat

| Gejala                                              | Periksa / tindakan                                                                                                                                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEMO_DATABASE_NOT_EMPTY` ketika seed biasa         | Pilih reset development terkonfirmasi jika data lama memang ingin diganti; jangan mengulang seed biasa pada DB berisi data                                                                          |
| Reset ditolak karena production                     | Gunakan env development yang benar; command seed development tidak berjalan pada `NODE_ENV=production`                                                                                              |
| `relation ... does not exist` atau kolom belum ada  | Schema belum mengikuti migration repo; perbarui schema pada Neon development terlebih dahulu, menggunakan direct connection untuk migration                                                         |
| Web menampilkan data lama                           | Pastikan seed dan API memakai `DATABASE_URL` yang sama; periksa env yang diekspor di terminal, restart preset, muat ulang dan login kembali                                                         |
| Login/loader gagal karena bridge atau transport     | Periksa API hidup di 3001 dan `API_BRIDGE_SECRET` sama pada API/web, lalu restart preset                                                                                                            |
| Port 3001 atau 3003 terpakai                        | Jalankan `bun run dev:stop` untuk checkout ini; listener aplikasi lain tidak dihentikan otomatis. Jika web perlu port lain: `ATRIA_DEV_WEB_PORT=3004 bun run dev:web-api`, lalu buka localhost:3004 |
| Switcher tidak muncul                               | Aktifkan flag di env API **dan** web, lalu restart; login akun biasa tetap dapat dipakai                                                                                                            |
| RAP/RAB Pakubuwono kosong atau RAB Cipete belum ada | Ini state gating yang disengaja; lakukan bagian 5.2/5.3, bukan mencari data yang hilang                                                                                                             |
| Chat lama terbaca tetapi pertanyaan baru gagal      | Histori seed tidak memanggil provider; pertanyaan baru membutuhkan provider/key aktif                                                                                                               |

Ringkasan port/preset ada di [development-presets](./development-presets.md); konfigurasi backend
ada di [mobile-api-development](./mobile-api-development.md).
