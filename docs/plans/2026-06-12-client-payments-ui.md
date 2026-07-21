# Rencana Implementasi: Pencatatan Pembayaran Klien (Client Payments & Invoicing UI)

Rencana ini menjelaskan penambahan antarmuka untuk menampilkan daftar tagihan klien (Client Invoices) dan mencatat penerimaan kas masuk termin dari klien (Client Payments) pada Layar Detail Proyek. Fitur ini memungkinkan Owner atau Finance Admin untuk menambahkan saldo kas bank perusahaan secara langsung melalui aplikasi (misal ketika klien melunasi tagihan proyek).

---

## User Review Required

> [!IMPORTANT]
> **Penerimaan Kas Masuk (DEBIT) Rekening Bank:**
> Pencatatan pembayaran termin klien akan memicu helper `mutateBalance` dengan jenis `DEBIT`. Ini akan **menambah saldo rekening bank** yang dipilih secara real-time dan mencatat mutasi kas masuk ke ledger utama, serta memperbarui profitabilitas laba bersih riil proyek tersebut. Fitur pencatatan pembayaran ini dibatasi hanya untuk pengguna dengan peran `OWNER` atau `FINANCE_ADMIN`.

---

## Proposed Changes

### Komponen: Tampilan Detail Proyek (Server-Side)

#### [MODIFY] [page.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/projects/%5Bid%5D/page.tsx)

- Mengambil seluruh daftar rekening bank (`bankAccount`) yang tersedia dari database.
- Menyisipkan komponen Client Component baru `<ProjectInvoices invoices={proj.clientInvoices} bankAccounts={bankAccounts} userRole={roleName} />` di bagian bawah rincian RAB (BoQ).

---

### Komponen: Antarmuka Invoice & Pencatatan Pembayaran (Fitur Baru)

#### [NEW] [project-invoices.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/project/project-invoices.tsx)

- Membuat Client Component baru untuk merender bagian Invoice & Pembayaran Klien:
  - Desain mengikuti standar **iOS 26 Solid** (off-white, premium cards, JetBrains Mono font untuk angka tabular, min-height touch targets 44px).
  - Menampilkan list invoice klien (`clientInvoice`) beserta nominal, status (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`), dan riwayat pembayaran termin yang sudah diterima.
  - Menampilkan tombol **Catat Pembayaran (Record Payment)** jika status invoice belum lunas (`UNPAID` / `PARTIALLY_PAID`) dan peran pengguna aktif adalah `OWNER` atau `FINANCE_ADMIN`.
  - **Dialog Pencatatan Pembayaran:**
    - Menyediakan form pop-up dialog yang bersih untuk menginput:
      - Nominal pembayaran (default terisi sisa nilai invoice yang belum dibayar).
      - Rekening bank tujuan penerimaan dana.
      - Nomor referensi transfer bank dari klien.
      - Tanggal pembayaran.
    - Tombol simpan pembayaran memanggil Server Action `recordClientPayment`.
    - Menyediakan umpan balik sukses/gagal secara dinamis dan memicu `router.refresh()` setelah transaksi sukses untuk memperbarui status kas bank global dan laporan laba bersih riil proyek.

---

## Verification Plan

### Automated Tests

- Memastikan semua unit test saat ini tetap lulus (33/33 pass):
  `bun test`
- Memastikan tidak ada kesalahan kompilasi tipe atau build Next.js:
  `bunx tsc --noEmit && bun run build`

### Manual Verification

1. Masuk sebagai Owner (`ronald@dekoria.com`), buka detail proyek aktif (misalnya _Apartemen Sudirman Suite_).
2. Lihat daftar **Tagihan Klien (Invoices)** di bagian bawah.
3. Cari invoice berstatus `UNPAID` atau `PARTIALLY_PAID`, ketuk **Catat Pembayaran**.
4. Pilih rekening penerima **BCA Operational**, masukkan nominal (misal: Rp 50.000.000), isi nomor referensi (misal: `DEP-9923`), pilih tanggal hari ini, lalu ketuk **Simpan Pembayaran**.
5. Pastikan status invoice diperbarui secara instan, saldo BCA Operational bertambah sebesar Rp 50.000.000 di dashboard Today, laba bersih riil proyek meningkat, dan ledger mencatat entri `DEBIT` kas masuk termin.
