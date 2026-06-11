# Rencana Implementasi: TSK-012 UI Layar Persetujuan Owner & Dasbor CFO

Rencana ini menjelaskan perancangan dan implementasi Dasbor Finansial CFO, Layar Detail Keuangan Proyek (BoQ), dan Layar Persetujuan Owner (Approvals) dengan standar estetika iOS 26 Solid (kontras tinggi, tanpa liquid glass/blur, tombol tap target besar).

---

## User Review Required

> [!IMPORTANT]
> **Otorisasi Aksi Finansial:**
> Aksi penyetujuan pengeluaran lapangan (`approveFieldRequest`/`payFieldRequest`) dan pembayaran vendor (`approveVendorPayment`/`payVendorBill`) pada Layar Persetujuan hanya dapat dilakukan jika pengguna yang masuk didefinisikan sebagai `OWNER` (atau `FINANCE_ADMIN` untuk pencairan petty cash). Tombol aksi diatur memiliki ukuran minimum **52x52px** untuk kepatuhan target sentuh mobile.

---

## Proposed Changes

### 1. Komponen: Proyek & Detail Anggaran (Projects Module)

#### [MODIFY] [page.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/projects/page.tsx)
*   Mengubah halaman daftar proyek `/projects` untuk memuat seluruh proyek aktif PM yang sedang login (global untuk Owner/Finance Admin).
*   Menampilkan kartu proyek ringkas berisi nama proyek, nama klien, nama PM, status proyek, dan nilai kontrak dalam format Rupiah, yang bertindak sebagai link ke halaman detail `/projects/[id]`.

#### [NEW] [page.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/projects/%5Bid%5D/page.tsx)
*   Membuat rute dinamis detail keuangan proyek `/projects/[id]`.
*   Menampilkan:
    *   Badge status kesehatan finansial (`HEALTHY`, `WARNING`, `CRITICAL`) berdasarkan enum proyek.
    *   RAB BoQ item (`project_budget_item` rows) yang dikelompokkan berdasarkan kategori biaya.
    *   Progress bar alokasi vs realisasi belanja untuk setiap budget item. Jika terjadi overrun, tampilkan sisa plafon negatif dengan teks merah terang.

### 2. Komponen: Dasbor Finansial & Ledger (Ledger Module)

#### [MODIFY] [page.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/ledger/page.tsx)
*   Mengubah halaman `/ledger` menjadi **CFO Dashboard & Ledger**.
*   Menampilkan:
    *   **AI Daily Briefing:** Kotak rangkuman eksekutif harian terbaru dari tabel `ai_run` (CFO briefing naratif Bahasa Indonesia).
    *   **Rekening Kas Bank (Bank Grid):** Daftar rekening bank (BCA Operational, Mandiri, Petty Cash) dalam tata letak kartu solid horizontal yang informatif.
    *   **Persetujuan Pending Banner:** Banner darurat berwarna merah/amber jika terdeteksi ada antrean persetujuan finansial aktif (khusus untuk peran OWNER).
    *   **Peringatan Finansial (Alerts Feed):** Feed notifikasi warning/critical overrun dari tabel `notification`.
    *   **Buku Kas Ledger (Recent Stream):** Menampilkan daftar mutasi transaksi kas besar teraktual dari tabel `cash_transaction`.

### 3. Komponen: Layar Persetujuan Owner (Approvals Module)

#### [NEW] [page.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/approvals/page.tsx)
*   Membuat halaman baru `/approvals` untuk antrean persetujuan Owner.
*   Menampilkan:
    *   Daftar kartu `approval` yang berstatus `PENDING` (gabungan project costs dan vendor payments).
    *   Setiap kartu memuat rincian: nama pengaju, jumlah nominal pengeluaran, perbandingan plafon anggaran item, deskripsi justifikasi, dan foto nota bukti.
    *   Tombol aksi quick-approval: **Approve** (Bulat Hijau Solid, Ikon Centang, 52x52px) dan **Reject** (Bulat Merah Solid, Ikon Silang, 52x52px) yang memicu Server Action secara instan.

---

## Verification Plan

### Automated Tests
*   Membuat unit/integration test baru `lib/finance/dashboard.test.ts` untuk memverifikasi pengambilan statistik dasbor, list approvals pending, dan transisi status approval ketika aksi setuju dipicu.
    `bun test lib/finance/dashboard.test.ts`

### Manual Verification
1. Jalankan server dev (`bun run dev`).
2. Masuk sebagai Owner (`ronald@dekoria.com`).
3. Buka halaman `/ledger` dan periksa visualisasi dasbor, bank card balances, AI briefing text, serta banner link approvals.
4. Ketuk banner approvals untuk membuka `/approvals`, lalu klik tombol hijau setuju (Approve) pada pengajuan biaya marmer PM Budi.
5. Konfirmasi bahwa saldo BCA Operational berkurang secara dinamis dan pengajuan hilang dari antrean.
