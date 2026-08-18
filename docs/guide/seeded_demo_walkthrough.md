# Walkthrough Sandbox Demo Atria

Panduan ini memakai connected demo seed untuk belajar sambil menjalankan flow Atria. Dataset sudah
berisi histori dan pekerjaan terbuka. Ikuti urutan karena transaksi dari satu langkah menjadi input
untuk rekonsiliasi dan dashboard pada langkah berikutnya.

Untuk UAT production-style dari data kosong, gunakan
[`financial_workflow_guide.md`](./financial_workflow_guide.md), bukan panduan ini.

## Status verifikasi

Diperiksa 18 Agustus 2026 terhadap database demo sekali pakai hasil
`db:demo:reset`, bukan terhadap database development.

**Seluruh bagian 3 sampai 12 kini terbukti terhadap aplikasi.** Bagian 6 sampai
12 dijalankan berurutan lewat Server Action asli oleh
`lib/finance/demo-walkthrough.integration.test.ts` — 21 test, satu rantai, dalam
urutan yang sama dengan panduan ini.

**Angka statis (bagian 3, 4, 5, 8):** keempat saldo rekening, indikator dua
transaksi belum rekonsiliasi, nominal dan status setiap expense serta vendor
bill, hitungan rekonsiliasi 2/2/9, formula budget 90% dengan rasio
18/35/1/0,5/0 dan buffer 45,5%, header Menteng Rp800 juta / Rp720 juta / target
gross Rp80 juta, alokasi Subcon Rp0 pada Sudirman, budget Brawijaya yang masih
`DRAFT` tanpa transaksi, serta invoice `INV/2026/002` Rp320 juta dengan
Rp120 juta diterima — semuanya cocok dengan seed.

**Tulang punggung kas (bagian 6 sampai 9):** mendarat persis pada saldo yang
dijanjikan — Kas Budi Rp14.150.000 → Rp13.100.000 → Rp8.100.000, Mandiri
Rp500.000.000 → Rp493.800.000, BCA Rp655.000.000 → Rp651.000.000 →
Rp641.000.000 → Rp841.000.000 → Rp836.000.000. Termasuk maker-checker 6.2,
penolakan vendor payment Rp10 juta sebelum approval Owner, penolakan
overpayment invoice, dan transfer internal yang tidak mengubah kas bersih.

**Rekonsiliasi (bagian 10):** pengecualian terdokumentasi tanpa menggerakkan
saldo dan dapat dicabut; alasan di bawah 10 karakter ditolak; kedua pasangan
seed cocok tanpa saldo bergerak; pencocokan lintas rekening ditolak dengan
pesan ketidakcocokan yang benar; dan transaksi yang sudah direkonsiliasi
membeku terhadap ketiga jalur tulis yang ada. Yang
terpenting, sesudah ketiga CSV `.atria-demo/` diimpor, **setiap transaksi yang
dibuat walkthrough ini menemukan tepat satu lawan** pada rekening dan arah yang
sama — diperiksa sebagai perbandingan himpunan, bukan sekadar jumlah baris.
Impor ulang file yang sama melewatkan seluruh baris dan saldo tetap.

**Material (bagian 11):** batch opening `OPB-2026-07-0002` ditolak ketika
pembuatnya sendiri yang menyetujui, lalu terposting ketika Owner yang
menyetujui; siklus reserve → use → return → waste bergerak persis seperti yang
dijanjikan (reserve mengunci tanpa memindahkan stok fisik) dan **tidak membuat
satu pun cash transaction**; waste tanpa catatan audit ditolak; pemakaian
melebihi isi gudang ditolak tanpa menggeser stok.

**Gudang (bagian 11.2 dan 11.4):** goods receipt menaikkan stok sebesar
quantity yang diposting, dan posting kedua dengan nomor receipt yang sama
ditolak tanpa menggeser stok; transfer memindahkan tanpa menciptakan —
lokasi asal turun, tujuan naik, total perusahaan tetap; stock count hanya
menghasilkan adjustment untuk item yang selisih, dan **menuntut approver yang
berbeda dari penghitungnya**; emergency adjustment menolak alasan di bawah 10
karakter lalu terposting dengan alasan yang layak.

**Closing (bagian 12):** Senopati dilaporkan tanpa blocker dan benar-benar
tertutup menjadi `COMPLETED` dengan end date terisi, sementara Menteng tetap
diblokir dan penutupannya ditolak.

**Penjagaan script (bagian 1 dan 14):** `reset-demo-database.ts` tanpa
`--confirm-reset` berhenti dengan pesan yang menyebut flag-nya, dan `db:seed`
pada database yang sudah berisi data menolak dengan
`DEMO_DATABASE_NOT_EMPTY` tanpa menghapus apa pun. Keduanya keluar dengan
exit code 1, jadi kegagalannya terlihat, bukan diam-diam.

**Catatan tentang baris "Edit/delete cash transaction yang sudah reconciled"
pada bagian 13:** aplikasi tidak mempunyai jalur edit maupun delete untuk
transaksi kas sama sekali — buku besar bersifat append-only. Satu-satunya yang
boleh menulis ke `cash_transaction` adalah ketiga aksi rekonsiliasi, dan
ketiganya menolak baris yang sudah direkonsiliasi di bawah row lock. Jadi
harapan baris itu benar, tetapi tidak ada tombol yang bisa dicoba; yang
sebenarnya diuji adalah ketiga jalur tersebut.

**Belum diverifikasi — dan hanya ini yang tersisa:**

1. **Jalur klik.** Semuanya dibuktikan di lapisan Server Action, bukan lewat
   layar. Tombol, sheet, dan penempatan angka pada UI belum ditelusuri.
2. **Bagian 12A (Asisten AI).** Jawaban model bersifat non-deterministik dan
   menuntut jaringan, jadi tidak dijadikan test. Yang sudah dipaku hanyalah
   aturan aksesnya — Owner, Finance Admin, dan PM boleh; Purchasing, Sales,
   Designer, dan Marketing tidak (`packages/core/src/auth/ai-chat-access.test.ts`).

### Menjalankan ulang rantainya

Suite ini mengonsumsi fixture-nya, jadi ia memeriksa baseline demo lebih dulu
dan menyebut perintah yang harus dijalankan alih-alih gagal beruntun:

```bash
bun run db:demo:reset --confirm-reset
cd apps/web && ATRIA_TEST_DATABASE_URL="<url database demo>" bun test lib/finance/demo-walkthrough.integration.test.ts
```

Arahkan `ATRIA_TEST_DATABASE_URL` hanya ke database demo sekali pakai, tidak
pernah ke database development.

## 1. Persiapan dan reset

Pastikan `DATABASE_URL` menunjuk database development/sandbox, kemudian jalankan:

```bash
bun run db:reset --dry-run
bun run db:demo:reset --confirm-reset
```

Command kedua akan:

1. mengosongkan tabel data;
2. memasukkan connected demo seed;
3. membuat CSV di `.atria-demo/`;
4. menjalankan verifier read-only.

Expected terminal terakhir:

```text
Connected demo seed verification passed.
Sandbox demo siap digunakan.
```

Aktifkan switcher pada `.env`, lalu restart server:

```env
ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED="true"
```

```bash
bun run dev
```

Login awal:

```text
ronald@dekoria.com
password123
```

Jika switcher tidak tersedia, gunakan akun fallback pada
[`SEED_DATA.md`](../04-data/SEED_DATA.md#akun-demo) dan login ulang setiap berganti role.

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
- Mandiri Giro Utama: **Rp500.000.000**;
- Kas Kecil PM Siti: **Rp9.500.000**;
- indikator transaksi yang belum rekonsiliasi: **2**.

Saldo berasal dari ledger, bukan dari statement bank. Rekonsiliasi hanya membuktikan bahwa ledger
dan rekening koran menunjuk transaksi yang sama; mencocokkan tidak mengubah saldo.

### 3.2 Expenses — `/expenses`

Gunakan tab/filter untuk menemukan:

- expense Rp1.050.000 berstatus Approved;
- expense Rp5.000.000 dan Rp6.200.000 yang masih perlu review;
- payment vendor Rp4.000.000 dan Rp10.000.000 berstatus terjadwal;
- dua vendor bill paid sebagai histori.

### 3.3 Projects — `/projects`

- Menteng adalah skenario finance/material utama.
- Sudirman menunjukkan risk dan approval.
- Brawijaya adalah planning sandbox.
- Senopati adalah project siap closing.
- BSD, Kemang, dan PIK adalah referensi lifecycle.

### 3.4 Reconciliation — `/reconciliation`

- **Mutasi bank**: dua row belum cocok.
- **Catatan Atria**: dua transaksi perlu tindakan.
- **Riwayat**: sembilan pasangan selesai.

Setiap row awal yang belum cocok mempunyai tepat satu counterpart.

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

## 5. Project Budget, RAP, dan RAB

### 5.1 Membaca Menteng

Sebagai Owner, buka **Menteng Villa**:

- Project Value Rp800.000.000;
- Internal Budget Rp720.000.000;
- target gross Rp80.000.000;
- RAP material revision 1 sudah locked;
- RAB client Rp800.000.000 sudah approved.

Di budget category, bedakan:

- **Pending review**: request belum final;
- **Consumed/actual**: approved atau committed cost;
- **Paid**: kas benar-benar keluar;
- **Remaining**: allocation dikurangi consumed cost.

### 5.2 Brawijaya planning sandbox

Buka **Brawijaya Residence — RAB Sandbox**. Canonical budget-nya masih Draft dan tidak mempunyai
transaksi finance. Gunakan project ini untuk mencoba kontrol RAP/RAB tanpa mengubah skenario
Menteng/Sudirman.

Kontrol yang relevan:

- **Gunakan template Library** mengambil referensi item/harga, tetapi row tetap editable;
- **Tinjau** membuka review sebelum mutasi;
- **Simpan/Buat** menyimpan draft atau dokumen;
- approval budget/RAB harus dilakukan Owner dan meninggalkan audit evidence.

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

### 6.3 Expense Rp6.200.000 — over-budget Subcon

1. Sebagai Lisa, verifikasi **Pekerjaan perbaikan waterproofing mendesak** milik Sudirman.
2. Sebagai Owner, setujui dari `/approvals`.
3. Sebagai Lisa, cairkan dari **Mandiri Giro Utama** dengan referensi `DEMO-EXP-6200`.

Expected:

- approval tetap wajib karena nominal > Rp5 juta dan category Subcon seed beralokasi Rp0;
- saldo Mandiri Rp500.000.000 → Rp493.800.000;
- ledger OUTFLOW Rp6.200.000 belum reconciled;
- Sudirman menampilkan risk category, bukan menyembunyikannya sebagai material issue.

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

| File `.atria-demo/`            | Pilih rekening     | Counterpart                     |
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
audit mencatat approver.

### 11.2 Goods Receipt

Sebagai Agus/Purchasing, buka Materials. Histori GRN menunjukkan hubungan:

`Vendor Bill → Goods Receipt → Goods Receipt Item → Stock Movement → Material Inventory`.

Untuk mencoba entry baru, gunakan **Tinjau** lalu **Posting**. Quantity yang diposting harus muncul
sebagai movement IN; posting ulang record yang sama harus ditolak.

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
  atau tujuan" bila belum. Pada seed demo hanya dua pasangan yang memenuhi syarat:
  Multipleks 18mm (Gudang Utama ↔ Gudang Transit Menteng) dan Cabinet Hardware Set
  Soft-close (Gudang Utama ↔ Workshop Cikupa).
- Stock count memakai **Tinjau → Kirim**. Hanya variance non-zero yang menghasilkan adjustment,
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
3. Expected blocker kosong, dengan invoice Rp500 juta sudah paid dan reconciled, satu RAB approved,
   approved canonical budget, tanpa bill/expense/reservation terbuka.
4. Isi catatan minimal 10 karakter, misalnya `Seluruh dokumen final sudah diperiksa.`
5. Tekan action penyelesaian project.

Expected: status Active → Completed, final profitability snapshot dibuat, end date diisi, dan audit
`COMPLETE_PROJECT` tercatat.

Sebagai negative test, buka Menteng dan tekan **Periksa kesiapan closing**. Menteng harus tetap
blocked karena masih mempunyai invoice/vendor/payment/reservation yang belum final.

## 12A. Asisten AI

Prasyarat: `DEEPSEEK_API_KEY` terisi di `.env` (lihat `.env.example`). Tanpa key mana pun, tombol
asisten tetap muncul untuk peran yang berhak tetapi setiap pertanyaan gagal dijawab.

Seed demo tidak membuat percakapan apa pun — percakapan adalah data pengguna, bukan fixture. Setelah
reset, chat dimulai kosong dan riwayat terbentuk dari yang Anda tanyakan sendiri.

Buka tombol chat di header (kiri atas). Tombol hanya muncul untuk Owner, Finance Admin, dan PM.

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

| Test                                                   | Expected                                         |
| ------------------------------------------------------ | ------------------------------------------------ |
| `db:seed` dijalankan lagi pada DB berisi data          | Ditolak tanpa delete                             |
| Demo reset tanpa `--confirm-reset`                     | Ditolak                                          |
| Payment invoice > outstanding                          | Ditolak, saldo tidak berubah                     |
| Vendor payment Rp10 juta sebelum Owner approval        | Ditolak                                          |
| PM membuka project yang tidak di-assign                | Forbidden/tidak terlihat                         |
| Purchasing membuka saldo atau margin komersial         | Tidak memperoleh akses                           |
| Cocokkan rekening/arah/amount yang berbeda             | Ditolak                                          |
| Impor file CSV yang sama dua kali                      | Duplicate dilewati                               |
| Edit/delete cash transaction yang sudah reconciled     | Ditolak                                          |
| Stock use melebihi available stock                     | Ditolak                                          |
| Closing Menteng sebelum semua blocker selesai          | Ditolak dan blocker dijelaskan                   |
| PM bertanya ke asisten soal proyek yang bukan miliknya | Dijawab di luar akses, tanpa membocorkan datanya |
| Purchasing atau Sales membuka tombol asisten AI        | Tombol tidak muncul                              |
| Menekan Konfirmasi dua kali pada satu kartu usulan     | Hanya satu pengajuan tercatat                    |

## 14. Mengulang atau mengaudit hasil

Untuk kembali persis ke baseline:

```bash
bun run db:demo:reset --confirm-reset
```

Untuk membaca kesehatan database saat ini tanpa mengubahnya:

```bash
bun run db:demo:verify
```

Verifier baseline dapat gagal setelah walkthrough yang belum selesai, karena transaksi baru belum
diimpor/dicocokkan atau status sudah bergerak dari state awal. Selesaikan urutan walkthrough atau
reset kembali. Jangan melakukan repair langsung lewat SQL.
