# Implementation Plan: TSK-003 Skrip Seeding & Mock Data Keuangan

Rencana implementasi ini mendefinisikan langkah-langkah untuk menulis berkas seeder database `/db/seed.ts` menggunakan Drizzle ORM query builder. Seeder ini akan memasukkan data operasional realistis berskala ratusan juta rupiah untuk menyimulasikan transaksi keuangan riil dari proyek renovasi interior dan desain-build PT Dekoria Desain Estetika.

---

## User Review Required

> [!NOTE]
> **Data Finansial Realistis:** Data seed dirancang agar menyimulasikan skenario warning limit (rasio pengeluaran > 90% pada budget kelistrikan Menteng) dan status critical overrun (> 100% pada kategori operasional Menteng) untuk memvalidasi algoritma notifikasi/alerting di masa mendatang.

---

## Proposed Changes

### 1. Database Seeder Configuration

#### [NEW] [seed.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/db/seed.ts)

Berkas skrip utama untuk mengisi data dummy awal ke PostgreSQL Neon.

#### [MODIFY] [package.json](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/package.json)

Menambahkan skrip dev `"db:seed": "bun db/seed.ts"` agar seeder dapat dijalankan secara instan dengan `bun run db:seed`.

---

## Tasks

### Task 1: Create Database Seeder Script

- [ ] **Step 1: Write `db/seed.ts`**
      Tulis berkas `db/seed.ts` dengan mengimpor `db` dari `./index` dan skema tabel dari `./schema`.
- [ ] **Step 2: Add seed transaction logic**
      Tulis logika transaksional seeder (`db.transaction(async (tx) => { ... })`) untuk menyisipkan data:
  1.  `role` (owner, admin, project_manager)
  2.  `user` (Ronald Wijaya, Lisa Permata, Budi Santoso, Siti Aminah)
  3.  `client` (Alexandra Siregar, Haryanto Wijaya)
  4.  `vendor` (PT Cahaya Abadi Material, CV Kayu Jati Luhur, Jasa MEP Pak Slamet)
  5.  `bank_account` (BCA Operational, Mandiri Project, Petty Cash Office)
  6.  `project_cost_category` (MATERIAL, SUBCONTRACTOR, OPERATIONAL, OTHER)
  7.  `project` (Menteng Residence, Sudirman Suites)
  8.  `project_budget` (RAB Menteng & Sudirman)
  9.  `project_budget_item` (Rincian BoQ masing-masing proyek)
  10. `client_invoice` (Invoices DP & termin progress)
  11. `cash_transaction` (Ledger entries kas masuk/keluar)
  12. `client_payment` (Realisasi dana termin masuk)
  13. `vendor_bill` (Hutang material vendor)
  14. `vendor_payment` (Pelunasan tagihan vendor)
  15. `project_cost` (Panjar/reimbursement PM lapangan)
  16. `approval` (Log otorisasi Owner)
  17. `ai_run` (Log model Gemini OCR)
  18. `notification` (Warning/critical budget notifications)
  19. `audit_log` (Audit trail log)
- [ ] **Step 3: Add `db:seed` script in `package.json`**
      Daftarkan `"db:seed": "bun db/seed.ts"` pada bagian `"scripts"` di `package.json`.

---

## Verification Plan

### Automated Tests

- Menjalankan pengeksekusian seeder database secara lokal (memerlukan local database connection atau mock environment):
  `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/atria_erp_mock" bun run db:seed`
  _Outcome:_ Seeder berjalan sukses, mencetak logs seeding untuk setiap entitas, dan diakhiri dengan log "Database seeding completed successfully!" tanpa error type atau foreign key constraints.

### Manual Verification

- Memverifikasi keberadaan data pada database lokal atau Neon console pasca eksekusi seeder.
