# Rencana Implementasi: Reset Database & Seeding Minimal (Minimalist Seed Data)

Rencana ini menjelaskan pembaruan pada script seeding database `db/seed.ts`. Kami akan menambahkan fase pembersihan (cleanup) untuk mengosongkan seluruh tabel database secara aman, dan mendesain ulang data dummy agar menjadi minimal dan ringkas. Hal ini akan memudahkan proses pengujian manual alur pembayaran klien, persetujuan Owner, dan pencairan dana tanpa kebingungan akibat data yang terlalu banyak.

---

## User Review Required

> [!WARNING]
> **Penghapusan Seluruh Data Database (Database Truncate/Reset):**
> Script `db:seed` akan diubah agar menghapus terlebih dahulu seluruh baris data di semua tabel database sebelum menyisipkan data baru. Tindakan ini diperlukan untuk memastikan database dalam kondisi bersih dan bebas dari bentrokan constraint UUID saat proses seeding ulang.

---

## Proposed Changes

### Komponen: Database Seeding Script

#### [MODIFY] [seed.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/db/seed.ts)

- **Pembersihan Database (Cleanup Phase):**
  - Di bagian awal transaksi database, tambahkan baris penghapusan data (`tx.delete(...)`) untuk seluruh 19 tabel dalam urutan dependensi terbalik (dari tabel anak ke tabel induk) untuk menghindari error foreign key violation.
- **Data Seeding Minimalis:**
  - **Roles & Users:** Tetap menyertakan 3 peran standar dan 3 pengguna utama (Ronald Wijaya - Owner, Lisa Permata - Finance, Budi Santoso - PM).
  - **Bank Accounts:** Sediakan 2 akun bank: _BCA Operational_ (Saldo awal Rp 500.000.000,00) dan _Petty Cash Office_ (Saldo awal Rp 10.000.000,00).
  - **Client & Project:** Sediakan 1 klien (_Alexandra Siregar_) dan 1 proyek aktif (_Menteng Residence - Luxury Kitchen Remodel_ dengan nilai kontrak Rp 650.000.000,00).
  - **Budgets & Items:** 1 RAB berstatus `APPROVED` dengan 2 item anggaran:
    1. _Finishing Kabinet Dapur_ (Plafon Rp 200.000.000,00, Realisasi Rp 50.000.000,00).
    2. _Carrara Marble Countertop_ (Plafon Rp 150.000.000,00, Realisasi Rp 0,00).
  - **Invoices & Client Payments:**
    1. _DP 30%_ (Rp 195.000.000,00, status `PAID` - lunas).
    2. _Termin Progress 50%_ (Rp 200.000.000,00, status `UNPAID` - belum dibayar, untuk diuji di UI).
  - **Vendor Bills & Payments:** 1 tagihan vendor _PT Cahaya Abadi_ senilai Rp 50.000.000,00 berstatus `PAID` (untuk mencocokkan realisasi belanja MEP di atas).
  - **Project Costs (Field Claims) & Approvals:**
    1. _Pengajuan 1_ (Akomodasi PM, Nominal Rp 6.000.000,00, status `APPROVED` - disetujui Owner tapi belum cair. Digunakan untuk menguji tombol **Cairkan** di list expenses).
    2. _Pengajuan 2_ (Bensin Lapangan, Nominal Rp 1.500.000,00, status `SUBMITTED` - menunggu verifikasi).
    3. _Pengajuan 3_ (MEP Tambahan Over Budget, Nominal Rp 8.000.000,00, status `SUBMITTED` dengan `budgetOverrun = true` dan approval record `PENDING`. Digunakan untuk menguji tombol **Approve/Reject** di menu Payments Owner).
  - **Logs & Alerts:** Sediakan masing-masing 1 record untuk `notification`, `auditLog`, dan `aiRun` sebagai data penunjang awal.

---

## Verification Plan

### Automated Tests

- Menjalankan unit test untuk memastikan integrasi modul Drizzle tidak terganggu:
  `bun test`
- Menjalankan build Next.js:
  `bunx tsc --noEmit && bun run build`

### Manual Verification

1. Jalankan script seeding database:
   `bun db:seed`
2. Pastikan logs konsol menampilkan proses pembersihan tabel sukses dan penulisan data minimal selesai tanpa kendala.
3. Masuk ke aplikasi dan verifikasi dasbor Today hanya menampilkan 2 rekening bank, dan daftar persetujuan/pengeluaran hanya menampilkan data minimal yang telah direncanakan di atas.
