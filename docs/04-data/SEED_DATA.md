# Seed Data - Atria ERP

Dokumen ini mendokumentasikan data awal (_seed data_) realistis yang mencerminkan operasional bisnis kontraktor interior dan desain build skala menengah-atas (PT Dekoria Desain Estetika). Data ini memiliki nominal ratusan juta hingga miliaran rupiah untuk memvalidasi performa agregasi laba/rugi, pengujian batas saldo rekening kas/bank, alur persetujuan (_approval flows_), serta sistem peringatan dini (_warning alerts_) jika anggaran membengkak.

Bagian ini menyertakan:

1. Skenario Bisnis Seed Data.
2. Contoh Perintah `INSERT INTO` SQL mentah.
3. Kode script TypeScript menggunakan **Drizzle ORM** (`db.insert`).

---

## 1. Skenario Bisnis Seed Data

Untuk pengujian komprehensif, kami memodelkan entitas bisnis dengan rincian sebagai berikut:

### Akun Bank Perusahaan (Awal):

- **BCA Operational:** Saldo Awal Rp 750.000.000 (Akun utama perusahaan untuk terima tagihan klien & bayar vendor PO besar).
- **Mandiri Project:** Saldo Awal Rp 350.000.000 (Akun cadangan khusus proyek besar).
- **Petty Cash Office:** Saldo Awal Rp 50.000.000 (Kas kecil yang dipegang admin untuk reimbursement PM lapangan).

### Proyek 1: Menteng Residence - Luxury Kitchen Remodel

- **Klien:** Ibu Alexandra Siregar
- **Project Manager:** Budi Santoso (PM1)
- **Nilai Kontrak:** Rp 650.000.000
- **Anggaran Proyek (RAB):** Rp 600.000.000 (Target Margin Kotor: Rp 50.000.000)
  - _Kategori Material:_ Rp 400.000.000 (Detail: Finishing Kabinet Rp 220 juta, Marble Countertop Rp 180 juta).
  - _Kategori Subkontraktor:_ Rp 160.000.000 (Detail: MEP Dapur Rp 70 juta, Sipil Rp 90 juta).
  - _Kategori Operasional Lapangan:_ Rp 40.000.000 (Detail: Transport & Makan Lapangan Rp 40 juta).
- **Status Keuangan Terkini (Simulasi WARNING & CRITICAL):**
  - Invoice Termin 1 (DP 30% = Rp 195.000.000) terbit dan **LUNAS** (`PAID`) masuk ke BCA Operational. (Saldo BCA menjadi Rp 945.000.000).
  - Realisasi Material Kabinet: Tagihan Vendor PT Cahaya Abadi Material sebesar Rp 210.000.000 terbit dan **LUNAS** (`PAID`) dari BCA Operational. (Saldo BCA menjadi Rp 735.000.000).
  - Realisasi MEP Lapangan: PM Budi mengajukan klaim reimbursement belanja kabel MEP sebesar Rp 65.000.000 (Budget Rp 70 juta, pemakaian 92.8%). Status: **LUNAS** (`PAID`) dari Petty Cash. **(Memicu WARNING Alert karena pemakaian budget kategori MEP > 90%)**. (Saldo Petty Cash menjadi Rp 35.000.000).
  - Realisasi Operasional: PM Budi mengajukan reimbursement bensin & makan tukang sebesar Rp 42.000.000. Karena melebihi budget Rp 40.000.000, status sempat ditahan, lalu disetujui Owner via override, status **LUNAS** (`PAID`) dari Petty Cash. **(Memicu CRITICAL Alert karena pemakaian budget kategori Operasional > 100%)**. (Saldo Petty Cash menjadi Rp 10.000.000? Tidak, saldonya tersisa Rp 8.000.000).
  - Invoice Termin 2 (Progress 50% = Rp 325.000.000) terbit dan **BELUM DIBAYAR** (`UNPAID`).
  - Tagihan Vendor CV Kayu Jati Luhur (Marble Carrara) sebesar Rp 175.000.000 terbit dan **BELUM DIBAYAR** (`UNPAID`).

### Proyek 2: Sudirman Suites - Penthouse Fit-Out

- **Klien:** Bapak Haryanto Wijaya
- **Project Manager:** Siti Aminah (PM2)
- **Nilai Kontrak:** Rp 1.200.000.000
- **Anggaran Proyek (RAB):** Rp 1.050.000.000 (Target Margin Kotor: Rp 150.000.000)
  - _Kategori Material:_ Rp 750.000.000 (Detail: Partisi Dinding Rp 350 juta, Wardrobe Custom Rp 400 juta).
  - _Kategori Subkontraktor:_ Rp 250.000.000 (Detail: MEP Penthouse Rp 100 juta, Sipil & Finishing Rp 150 juta).
  - _Kategori Operasional Lapangan:_ Rp 50.000.000 (Detail: Koordinasi & Perizinan Rp 50 juta).
- **Status Keuangan Terkini (Simulasi HEALTHY):**
  - Invoice Termin 1 (DP 30% = Rp 360.000.000) terbit dan **LUNAS** (`PAID`) masuk ke Mandiri Project. (Saldo Mandiri Project menjadi Rp 710.000.000).
  - Belum ada pengeluaran riil tercatat (Proyek baru berjalan fisik).

---

## 2. UUID Konstan untuk Referensi Silang

Untuk konsistensi antara SQL Inserts dan Drizzle ORM, UUID konstan berikut digunakan:

| Nama Konstanta    | Nilai UUID                             |
| :---------------- | :------------------------------------- |
| `ROLE_OWNER`      | `00000000-0000-0000-0000-000000000001` |
| `ROLE_ADMIN`      | `00000000-0000-0000-0000-000000000002` |
| `ROLE_PM`         | `00000000-0000-0000-0000-000000000003` |
| `USER_OWNER`      | `11111111-1111-1111-1111-111111111111` |
| `USER_ADMIN`      | `22222222-2222-2222-2222-222222222222` |
| `USER_PM1`        | `33333333-3333-3333-3333-333333333331` |
| `USER_PM2`        | `33333333-3333-3333-3333-333333333332` |
| `CLIENT1`         | `44444444-4444-4444-4444-444444444441` |
| `CLIENT2`         | `44444444-4444-4444-4444-444444444442` |
| `VENDOR1`         | `55555555-5555-5555-5555-555555555551` |
| `VENDOR2`         | `55555555-5555-5555-5555-555555555552` |
| `VENDOR3`         | `55555555-5555-5555-5555-555555555553` |
| `BANK_BCA`        | `66666666-6666-6666-6666-666666666661` |
| `BANK_MANDIRI`    | `66666666-6666-6666-6666-666666666662` |
| `BANK_PETTY`      | `66666666-6666-6666-6666-666666666663` |
| `PROJ_MENTENG`    | `77777777-7777-7777-7777-777777777771` |
| `PROJ_SUDIRMAN`   | `77777777-7777-7777-7777-777777777772` |
| `BUDGET_MENTENG`  | `88888888-8888-8888-8888-888888888881` |
| `BUDGET_SUDIRMAN` | `88888888-8888-8888-8888-888888888882` |
| `CAT_MATERIAL`    | `99999999-9999-9999-9999-999999999991` |
| `CAT_SUB`         | `99999999-9999-9999-9999-999999999992` |
| `CAT_OPERATIONAL` | `99999999-9999-9999-9999-999999999993` |
| `CAT_OTHER`       | `99999999-9999-9999-9999-999999999994` |

---

## 3. SQL Insert Scripts

Gunakan script SQL berikut untuk melakukan seeding langsung ke database PostgreSQL (misal via Drizzle Studio atau PgAdmin):

```sql
-- 1. Insert Roles
INSERT INTO role (id, name, description, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'owner', 'Pemilik Perusahaan (Full Access & Approver)', NOW()),
('00000000-0000-0000-0000-000000000002', 'admin', 'Finance & Bookkeeper (Verifikator & Rekonsiliasi)', NOW()),
('00000000-0000-0000-0000-000000000003', 'project_manager', 'Manajer Proyek Lapangan (Pengaju Biaya & Operator)', NOW());

-- 2. Insert Users
INSERT INTO "user" (id, name, email, email_verified, image, role_id, created_at, updated_at) VALUES
('11111111-1111-1111-1111-111111111111', 'Ronald Wijaya', 'ronald@dekoria.com', true, NULL, '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
('22222222-2222-2222-2222-222222222222', 'Lisa Permata', 'lisa@dekoria.com', true, NULL, '00000000-0000-0000-0000-000000000002', NOW(), NOW()),
('33333333-3333-3333-3333-333333333331', 'Budi Santoso', 'budi@dekoria.com', true, NULL, '00000000-0000-0000-0000-000000000003', NOW(), NOW()),
('33333333-3333-3333-3333-333333333332', 'Siti Aminah', 'siti@dekoria.com', true, NULL, '00000000-0000-0000-0000-000000000003', NOW(), NOW());

-- 3. Insert Clients
INSERT INTO client (id, name, company_name, email, phone, address, created_at, updated_at) VALUES
('44444444-4444-4444-4444-444444444441', 'Alexandra Siregar', NULL, 'alexandra@siregar.com', '081122334455', 'Jl. Teuku Umar No. 12, Menteng, Jakarta Pusat', NOW(), NOW()),
('44444444-4444-4444-4444-444444444442', 'Haryanto Wijaya', 'PT Sinar Sejahtera', 'haryanto@wijaya.com', '081234567890', 'Sudirman Suites Penthouse A, Jakarta Selatan', NOW(), NOW());

-- 4. Insert Vendors
INSERT INTO vendor (id, name, email, phone, address, bank_name, bank_account_number, bank_account_holder, created_at, updated_at) VALUES
('55555555-5555-5555-5555-555555555551', 'PT Cahaya Abadi Material', 'sales@cahayaabadi.com', '021-5551234', 'Kawasan Industri Pulogadung Blok C, Jakarta Timur', 'BCA', '1234567890', 'PT Cahaya Abadi Material', NOW(), NOW()),
('55555555-5555-5555-5555-555555555552', 'CV Kayu Jati Luhur', 'cvkayujati@gmail.com', '081199887766', 'Jl. Raya Jepara No. 45, Jepara, Jawa Tengah', 'Mandiri', '0987654321', 'CV Kayu Jati Luhur', NOW(), NOW()),
('55555555-5555-5555-5555-555555555553', 'Jasa MEP Pak Slamet', 'slametmep@gmail.com', '081333444555', 'Kp. Melayu RT 04/05, Jakarta Selatan', 'BCA', '5554443322', 'Slamet Prasetyo', NOW(), NOW());

-- 5. Insert Bank Accounts
-- Catatan: Saldo BCA = 750jt + 195jt (DP Menteng) - 210jt (Material Menteng) = 735jt
-- Catatan: Saldo Mandiri = 350jt + 360jt (DP Sudirman) = 710jt
-- Catatan: Saldo Petty = 50jt - 65jt (MEP Menteng) - 42jt (Operasional Menteng) = -57jt?
-- Agar saldo awal realistis tidak minus, diset saldo awal Petty Cash = 120jt, dipotong 65jt & 42jt, sisa saldo = 13jt.
INSERT INTO bank_account (id, name, account_number, bank_name, holder_name, balance, created_at, updated_at) VALUES
('66666666-6666-6666-6666-666666666661', 'BCA Operational', '8889991122', 'BCA', 'PT Dekoria Desain Estetika', 735000000.00, NOW(), NOW()),
('66666666-6666-6666-6666-666666666662', 'Mandiri Project', '11122233344', 'Mandiri', 'PT Dekoria Desain Estetika', 710000000.00, NOW(), NOW()),
('66666666-6666-6666-6666-666666666663', 'Petty Cash Office', '9990001112', 'BCA', 'Lisa Permata (Cashier)', 13000000.00, NOW(), NOW());

-- 6. Insert Cost Categories
INSERT INTO project_cost_category (id, name, description, created_at) VALUES
('99999999-9999-9999-9999-999999999991', 'MATERIAL', 'Pembelian bahan bangunan & material finishing interior', NOW()),
('99999999-9999-9999-9999-999999999992', 'SUBCONTRACTOR', 'Jasa instalasi khusus & upah tukang subkon luar', NOW()),
('99999999-9999-9999-9999-999999999993', 'OPERATIONAL', 'Biaya operasional lapangan, bensin, konsumsi, dan koordinasi', NOW()),
('99999999-9999-9999-9999-999999999994', 'OTHER', 'Biaya tak terduga non-rutin', NOW());

-- 7. Insert Projects
INSERT INTO project (id, name, client_id, project_manager_id, status, financial_health, total_contract_value, start_date, end_date, created_at, updated_at) VALUES
('77777777-7777-7777-7777-777777777771', 'Menteng Residence - Luxury Kitchen Remodel', '44444444-4444-4444-4444-444444444441', '33333333-3333-3333-3333-333333333331', 'ACTIVE', 'CRITICAL', 650000000.00, '2026-05-15 00:00:00', '2026-08-15 00:00:00', NOW(), NOW()),
('77777777-7777-7777-7777-777777777772', 'Sudirman Suites - Penthouse Fit-Out', '44444444-4444-4444-4444-444444444442', '33333333-3333-3333-3333-333333333332', 'ACTIVE', 'HEALTHY', 1200000000.00, '2026-06-01 00:00:00', '2026-10-01 00:00:00', NOW(), NOW());

-- 8. Insert Budgets (RAB Header)
INSERT INTO project_budget (id, project_id, status, approved_by_id, approved_at, notes, created_at, updated_at) VALUES
('88888888-8888-8888-8888-888888888881', '77777777-7777-7777-7777-777777777771', 'APPROVED', '11111111-1111-1111-1111-111111111111', '2026-05-14 10:00:00', 'RAB disetujui Owner dengan target margin 7.6%', NOW(), NOW()),
('88888888-8888-8888-8888-888888888882', '77777777-7777-7777-7777-777777777772', 'APPROVED', '11111111-1111-1111-1111-111111111111', '2026-05-28 14:00:00', 'RAB Sudirman Suites disetujui, target margin 12.5%', NOW(), NOW());

-- 9. Insert Budget Items (RAB Detail)
-- Realisasi Menteng: Item1 = 210jt, Item2 = 0jt (belum bayar bill), Item3 = 65jt, Item4 = 0jt, Item5 = 42jt (overrun). Total actual = 317jt.
INSERT INTO project_budget_item (id, project_budget_id, cost_category_id, name, allocated_amount, actual_spent, created_at, updated_at) VALUES
-- Proyek Menteng
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '88888888-8888-8888-8888-888888888881', '99999999-9999-9999-9999-999999999991', 'Finishing Kabinet Dapur (HPL & Duco)', 220000000.00, 210000000.00, NOW(), NOW()),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '88888888-8888-8888-8888-888888888881', '99999999-9999-9999-9999-999999999991', 'Carrara Marble Countertop & Backsplash', 180000000.00, 0.00, NOW(), NOW()),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '88888888-8888-8888-8888-888888888881', '99999999-9999-9999-9999-999999999992', 'Pekerjaan MEP & Kelistrikan Dapur', 70000000.00, 65000000.00, NOW(), NOW()), -- (WARNING: Pemakaian 92.8%)
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', '88888888-8888-8888-8888-888888888881', '99999999-9999-9999-9999-999999999992', 'Upah Pertukangan Sipil Lapangan', 90000000.00, 0.00, NOW(), NOW()),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', '88888888-8888-8888-8888-888888888881', '99999999-9999-9999-9999-999999999993', 'Transportasi & Operasional Lapangan PM', 40000000.00, 42000000.00, NOW(), NOW()), -- (CRITICAL: Pemakaian 105%)
-- Proyek Sudirman
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '88888888-8888-8888-8888-888888888882', '99999999-9999-9999-9999-999999999991', 'Partisi Dinding Gypsum & Plafon Penthouse', 350000000.00, 0.00, NOW(), NOW()),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '88888888-8888-8888-8888-888888888882', '99999999-9999-9999-9999-999999999991', 'Custom Wardrobe Master Bedroom', 40000000.00, 0.00, NOW(), NOW()),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', '88888888-8888-8888-8888-888888888882', '99999999-9999-9999-9999-999999999992', 'Pekerjaan MEP & Penerangan Penthouse', 150000000.00, 0.00, NOW(), NOW()),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '88888888-8888-8888-8888-888888888882', '99999999-9999-9999-9999-999999999992', 'Upah Tenaga Kerja & Tukang', 200000000.00, 0.00, NOW(), NOW()),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', '88888888-8888-8888-8888-888888888882', '99999999-9999-9999-9999-999999999993', 'Perizinan & Koordinasi Gedung', 50000000.00, 0.00, NOW(), NOW());

-- 10. Insert Client Invoices
INSERT INTO client_invoice (id, project_id, invoice_number, amount, status, stage, due_date, notes, created_at, updated_at) VALUES
('01010101-0101-0101-0101-010101010101', '77777777-7777-7777-7777-777777777771', 'INV/2026/001', 195000000.00, 'PAID', 'DP', '2026-06-01 23:59:59', 'DP 30% Klien Alexandra Menteng', NOW(), NOW()),
('01010101-0101-0101-0101-010101010102', '77777777-7777-7777-7777-777777777771', 'INV/2026/002', 325000000.00, 'UNPAID', 'PROGRESS_1', '2026-06-25 23:59:59', 'Termin Progress 50% Lapangan', NOW(), NOW()),
('01010101-0101-0101-0101-010101010103', '77777777-7777-7777-7777-777777777772', 'INV/2026/003', 360000000.00, 'PAID', 'DP', '2026-06-05 23:59:59', 'DP 30% Sudirman Suites Penthouse', NOW(), NOW());

-- 11. Insert Cash Ledger (DEBIT dari Pembayaran Termin Klien)
-- BCA Operational Awal: 750.000.000 + 195.000.000 (DP Menteng) = 945.000.000
-- Mandiri Awal: 350.000.000 + 360.000.000 (DP Sudirman) = 710.000.000
INSERT INTO cash_transaction (id, bank_account_id, type, category, amount, description, reconciled, reconciliation_date, reconciled_by_id, reference_type, reference_id, created_at, updated_at) VALUES
('cccccccc-cccc-cccc-cccc-cccccccccc01', '66666666-6666-6666-6666-666666666661', 'DEBIT', 'client_payment', 195000000.00, 'Pembayaran Lunas DP 30% - Ibu Alexandra Menteng', true, '2026-06-01 11:00:00', '22222222-2222-2222-2222-222222222222', 'client_payment', '02020202-0202-0202-0202-020202020201', NOW(), NOW()),
('cccccccc-cccc-cccc-cccc-cccccccccc02', '66666666-6666-6666-6666-666666666662', 'DEBIT', 'client_payment', 360000000.00, 'Pembayaran Lunas DP 30% - Bpk Haryanto Sudirman', true, '2026-06-05 14:30:00', '22222222-2222-2222-2222-222222222222', 'client_payment', '02020202-0202-0202-0202-020202020202', NOW(), NOW());

-- 12. Insert Client Payments
INSERT INTO client_payment (id, client_invoice_id, bank_account_id, cash_transaction_id, amount_paid, payment_date, received_by_id, reference_number, created_at) VALUES
('02020202-0202-0202-0202-020202020201', '01010101-0101-0101-0101-010101010101', '66666666-6666-6666-6666-666666666661', 'cccccccc-cccc-cccc-cccc-cccccccccc01', 195000000.00, '2026-06-01 10:30:00', '22222222-2222-2222-2222-222222222222', 'TRF-BCA-9831', NOW()),
('02020202-0202-0202-0202-020202020202', '01010101-0101-0101-0101-010101010103', '66666666-6666-6666-6666-666666666662', 'cccccccc-cccc-cccc-cccc-cccccccccc02', 360000000.00, '2026-06-05 13:00:00', '22222222-2222-2222-2222-222222222222', 'TRF-MND-4412', NOW());

-- 13. Insert Vendor Bills
INSERT INTO vendor_bill (id, vendor_id, project_id, project_budget_item_id, bill_number, amount, status, due_date, notes, created_at, updated_at) VALUES
-- Bill 1: Bahan Cabinet Dapur Menteng - PAID (Memicu actual_spent pada Item 1)
('33033303-3303-3303-3303-330333033301', '55555555-5555-5555-5555-555555555551', '77777777-7777-7777-7777-777777777771', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'BILL-2026-049', 210000000.00, 'PAID', '2026-06-10 23:59:59', 'Material multipleks finishing HPL untuk dapur Menteng', NOW(), NOW()),
-- Bill 2: Marble Carrara Countertop Menteng - UNPAID (Belum memotong kas riil)
('33033303-3303-3303-3303-330333033302', '55555555-5555-5555-5555-555555555552', '77777777-7777-7777-7777-777777777771', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'BILL-2026-057', 175000000.00, 'UNPAID', '2026-06-25 23:59:59', 'Marmer alam Carrara Italia impor slab utuh', NOW(), NOW());

-- 14. Insert Cash Ledger (CREDIT dari Pengeluaran Vendor Bill 1)
-- Saldo BCA: 945.000.000 - 210.000.000 = 735.000.000
INSERT INTO cash_transaction (id, bank_account_id, type, category, amount, description, reconciled, reconciliation_date, reconciled_by_id, reference_type, reference_id, created_at, updated_at) VALUES
('cccccccc-cccc-cccc-cccc-cccccccccc03', '66666666-6666-6666-6666-666666666661', 'CREDIT', 'vendor_payment', 210000000.00, 'Pembayaran Tagihan Material Kabinet - PT Cahaya Abadi', true, '2026-06-10 16:00:00', '22222222-2222-2222-2222-222222222222', 'vendor_payment', '03030303-0303-0303-0303-030303030301', NOW(), NOW());

-- 15. Insert Vendor Payments
INSERT INTO vendor_payment (id, vendor_bill_id, bank_account_id, cash_transaction_id, amount_paid, status, payment_date, paid_by_id, reference_number, created_at) VALUES
('03030303-0303-0303-0303-030303030301', '33033303-3303-3303-3303-330333033301', '66666666-6666-6666-6666-666666666661', 'cccccccc-cccc-cccc-cccc-cccccccccc03', 210000000.00, 'COMPLETED', '2026-06-10 15:30:00', '22222222-2222-2222-2222-222222222222', 'LLG-BCA-0012', NOW());

-- 16. Insert Project Costs (Petty Cash Field requests PM)
-- Request 1: MEP Wires - Budget 70jt, realisasi 65jt (92.8% WARNING)
-- Request 2: Transport & Meals - Budget 40jt, realisasi 42jt (105% OVERRUN -> CRITICAL)
INSERT INTO project_cost (id, project_id, project_budget_item_id, requested_by_id, amount, description, receipt_image_url, status, budget_overrun, bank_account_id, cash_transaction_id, verified_by_id, verified_at, approved_by_id, approved_at, paid_by_id, paid_at, created_at, updated_at) VALUES
('f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f001', '77777777-7777-7777-7777-777777777771', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '33333333-3333-3333-3333-333333333331', 65000000.00, 'Belanja kabel Eterna, MCB Schneider, & conduit PVC', 'https://storage.googleapis.com/atria-receipts/rec-09123.jpg', 'PAID', false, '66666666-6666-6666-6666-666666666663', 'cccccccc-cccc-cccc-cccc-cccccccccc04', '22222222-2222-2222-2222-222222222222', '2026-06-03 09:00:00', '11111111-1111-1111-1111-111111111111', '2026-06-03 12:00:00', '22222222-2222-2222-2222-222222222222', '2026-06-03 14:00:00', NOW(), NOW()),
('f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f002', '77777777-7777-7777-7777-777777777771', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', '33333333-3333-3333-3333-333333333331', 42000000.00, 'Klaim akomodasi, sewa scaffolding, & konsumsi lembur tukang', 'https://storage.googleapis.com/atria-receipts/rec-09124.jpg', 'PAID', true, '66666666-6666-6666-6666-666666666663', 'cccccccc-cccc-cccc-cccc-cccccccccc05', '22222222-2222-2222-2222-222222222222', '2026-06-07 10:00:00', '11111111-1111-1111-1111-111111111111', '2026-06-08 09:00:00', '22222222-2222-2222-2222-222222222222', '2026-06-08 11:00:00', NOW(), NOW());

-- 17. Insert Cash Ledger (CREDIT dari Petty Cash untuk field requests PM)
-- Saldo Petty Cash: 120.000.000 - 65.000.000 = 55.000.000 - 42.000.000 = 13.000.000
INSERT INTO cash_transaction (id, bank_account_id, type, category, amount, description, reconciled, reconciliation_date, reconciled_by_id, reference_type, reference_id, created_at, updated_at) VALUES
('cccccccc-cccc-cccc-cccc-cccccccccc04', '66666666-6666-6666-6666-666666666663', 'CREDIT', 'reimbursement', 65000000.00, 'Pelunasan Dana Reimbursement PM Budi - MEP Kabel Eterna', true, '2026-06-03 14:00:00', '22222222-2222-2222-2222-222222222222', 'project_cost', 'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f001', NOW(), NOW()),
('cccccccc-cccc-cccc-cccc-cccccccccc05', '66666666-6666-6666-6666-666666666663', 'CREDIT', 'reimbursement', 42000000.00, 'Pelunasan Dana Akomodasi Scaffolding - Over Budget Approved', true, '2026-06-08 11:00:00', '22222222-2222-2222-2222-222222222222', 'project_cost', 'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f002', NOW(), NOW());

-- 18. Insert Approvals
INSERT INTO approval (id, approver_id, reference_type, reference_id, status, notes, created_at) VALUES
('e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e001', '11111111-1111-1111-1111-111111111111', 'project_cost', 'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f001', 'APPROVED', 'Disetujui, sesuai nota pembelian material MEP.', NOW()),
('e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e002', '11111111-1111-1111-1111-111111111111', 'project_cost', 'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f002', 'APPROVED', 'Override anggaran disetujui. PM wajib memastikan tidak ada penambahan operasional lagi.', NOW());

-- 19. Insert AI Run OCR & Briefing
INSERT INTO ai_run (id, run_type, run_by_id, status, payload, result, error_message, tokens_used, created_at) VALUES
('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a001', 'OCR_RECEIPT', '33333333-3333-3333-3333-333333333331', 'COMPLETED', '{"imageUrl": "https://storage.googleapis.com/atria-receipts/rec-09123.jpg"}', '{"vendorName": "Toko Listrik Jaya", "transactionDate": "2026-06-03", "totalAmount": 65000000, "items": [{"name": "Kabel Eterna", "qty": 10, "price": 6500000}]}', NULL, 1200, NOW());

-- 20. Insert Notifications (Alerts Warnings & Critical)
INSERT INTO notification (id, user_id, title, message, read, severity, reference_type, reference_id, created_at) VALUES
('dddddddd-dddd-dddd-dddd-dddddddddd01', '11111111-1111-1111-1111-111111111111', 'WARNING: Budget Limit 90% Terlampaui', 'Anggaran MEP Proyek Menteng telah terpakai Rp 65.000.000 dari alokasi Rp 70.000.000 (92.8%).', false, 'WARNING', 'project_budget_item', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', NOW()),
('dddddddd-dddd-dddd-dddd-dddddddddd02', '11111111-1111-1111-1111-111111111111', 'CRITICAL: Anggaran Proyek Jebol!', 'Anggaran Operasional PM Proyek Menteng telah melampaui batas sebesar Rp 42.000.000 dari alokasi Rp 40.000.000 (105.0%).', false, 'CRITICAL', 'project_budget_item', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', NOW());

-- 21. Insert Audit Logs
INSERT INTO audit_log (id, user_id, action, target_table, target_id, original_state, new_state, ip_address, user_agent, created_at) VALUES
('99099909-9909-9909-9909-990999099901', '22222222-2222-2222-2222-222222222222', 'RECORD_CLIENT_PAYMENT', 'client_invoice', '01010101-0101-0101-0101-010101010101', '{"status": "UNPAID"}', '{"status": "PAID"}', '192.168.1.10', 'Mozilla/5.0 (iPhone; CPU iPhone OS 26)', NOW()),
('99099909-9909-9909-9909-990999099902', '22222222-2222-2222-2222-222222222222', 'PAY_FIELD_REQUEST', 'project_cost', 'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f002', '{"status": "APPROVED", "actual_spent": "0.00"}', '{"status": "PAID", "actual_spent": "42000000.00"}', '192.168.1.10', 'Mozilla/5.0 (iPhone; CPU iPhone OS 26)', NOW());
```

---

## 4. TypeScript Drizzle Seed Code

Berikut adalah kode sumber TypeScript untuk dijalankan dalam script `bun run db:seed`. File ini menggunakan Drizzle ORM query builder secara penuh untuk memastikan type-safety sesuai dengan pedoman **AGENTS.md**:

```typescript
import { db } from "../lib/db"; // Sesuaikan path koneksi database Anda
import {
  role,
  user,
  client,
  vendor,
  bankAccount,
  projectCostCategory,
  project,
  projectBudget,
  projectBudgetItem,
  clientInvoice,
  cashTransaction,
  clientPayment,
  vendorBill,
  vendorPayment,
  projectCost,
  approval,
  aiRun,
  notification,
  auditLog,
} from "../lib/schema"; // Sesuaikan path file skema Drizzle Anda
import { eq } from "drizzle-orm";

async function main(): Promise<void> {
  console.log("Starting database seeding...");

  // Jalankan seeding di dalam Transaksi Database untuk menjamin keamanan penulisan
  await db.transaction(async (tx) => {
    // 1. Seed Roles
    console.log("Seeding roles...");
    await tx
      .insert(role)
      .values([
        {
          id: "00000000-0000-0000-0000-000000000001",
          name: "owner",
          description: "Pemilik Perusahaan (Full Access & Approver)",
        },
        {
          id: "00000000-0000-0000-0000-000000000002",
          name: "admin",
          description: "Finance & Bookkeeper (Verifikator & Rekonsiliasi)",
        },
        {
          id: "00000000-0000-0000-0000-000000000003",
          name: "project_manager",
          description: "Manajer Proyek Lapangan (Pengaju Biaya & Operator)",
        },
      ])
      .onConflictDoNothing();

    // 2. Seed Users
    console.log("Seeding users...");
    await tx
      .insert(user)
      .values([
        {
          id: "11111111-1111-1111-1111-111111111111",
          name: "Ronald Wijaya",
          email: "ronald@dekoria.com",
          emailVerified: true,
          roleId: "00000000-0000-0000-0000-000000000001",
        },
        {
          id: "22222222-2222-2222-2222-222222222222",
          name: "Lisa Permata",
          email: "lisa@dekoria.com",
          emailVerified: true,
          roleId: "00000000-0000-0000-0000-000000000002",
        },
        {
          id: "33333333-3333-3333-3333-333333333331",
          name: "Budi Santoso",
          email: "budi@dekoria.com",
          emailVerified: true,
          roleId: "00000000-0000-0000-0000-000000000003",
        },
        {
          id: "33333333-3333-3333-3333-333333333332",
          name: "Siti Aminah",
          email: "siti@dekoria.com",
          emailVerified: true,
          roleId: "00000000-0000-0000-0000-000000000003",
        },
      ])
      .onConflictDoNothing();

    // 3. Seed Clients
    console.log("Seeding clients...");
    await tx
      .insert(client)
      .values([
        {
          id: "44444444-4444-4444-4444-444444444441",
          name: "Alexandra Siregar",
          email: "alexandra@siregar.com",
          phone: "081122334455",
          address: "Jl. Teuku Umar No. 12, Menteng, Jakarta Pusat",
        },
        {
          id: "44444444-4444-4444-4444-444444444442",
          name: "Haryanto Wijaya",
          companyName: "PT Sinar Sejahtera",
          email: "haryanto@wijaya.com",
          phone: "081234567890",
          address: "Sudirman Suites Penthouse A, Jakarta Selatan",
        },
      ])
      .onConflictDoNothing();

    // 4. Seed Vendors
    console.log("Seeding vendors...");
    await tx
      .insert(vendor)
      .values([
        {
          id: "55555555-5555-5555-5555-555555555551",
          name: "PT Cahaya Abadi Material",
          email: "sales@cahayaabadi.com",
          phone: "021-5551234",
          address: "Kawasan Industri Pulogadung Blok C, Jakarta Timur",
          bankName: "BCA",
          bankAccountNumber: "1234567890",
          bankAccountHolder: "PT Cahaya Abadi Material",
        },
        {
          id: "55555555-5555-5555-5555-555555555552",
          name: "CV Kayu Jati Luhur",
          email: "cvkayujati@gmail.com",
          phone: "081199887766",
          address: "Jl. Raya Jepara No. 45, Jepara, Jawa Tengah",
          bankName: "Mandiri",
          bankAccountNumber: "0987654321",
          bankAccountHolder: "CV Kayu Jati Luhur",
        },
        {
          id: "55555555-5555-5555-5555-555555555553",
          name: "Jasa MEP Pak Slamet",
          email: "slametmep@gmail.com",
          phone: "081333444555",
          address: "Kp. Melayu RT 04/05, Jakarta Selatan",
          bankName: "BCA",
          bankAccountNumber: "5554443322",
          bankAccountHolder: "Slamet Prasetyo",
        },
      ])
      .onConflictDoNothing();

    // 5. Seed Bank Accounts
    console.log("Seeding bank accounts...");
    await tx
      .insert(bankAccount)
      .values([
        {
          id: "66666666-6666-6666-6666-666666666661",
          name: "BCA Operational",
          accountNumber: "8889991122",
          bankName: "BCA",
          holderName: "PT Dekoria Desain Estetika",
          balance: "735000000.00",
        },
        {
          id: "66666666-6666-6666-6666-666666666662",
          name: "Mandiri Project",
          accountNumber: "11122233344",
          bankName: "Mandiri",
          holderName: "PT Dekoria Desain Estetika",
          balance: "710000000.00",
        },
        {
          id: "66666666-6666-6666-6666-666666666663",
          name: "Petty Cash Office",
          accountNumber: "9990001112",
          bankName: "BCA",
          holderName: "Lisa Permata (Cashier)",
          balance: "13000000.00",
        },
      ])
      .onConflictDoNothing();

    // 6. Seed Cost Categories
    console.log("Seeding project cost categories...");
    await tx
      .insert(projectCostCategory)
      .values([
        {
          id: "99999999-9999-9999-9999-999999999991",
          name: "MATERIAL",
          description: "Pembelian bahan bangunan & material finishing interior",
        },
        {
          id: "99999999-9999-9999-9999-999999999992",
          name: "SUBCONTRACTOR",
          description: "Jasa instalasi khusus & upah tukang subkon luar",
        },
        {
          id: "99999999-9999-9999-9999-999999999993",
          name: "OPERATIONAL",
          description: "Biaya operasional lapangan, bensin, konsumsi, dan koordinasi",
        },
        {
          id: "99999999-9999-9999-9999-999999999994",
          name: "OTHER",
          description: "Biaya tak terduga non-rutin",
        },
      ])
      .onConflictDoNothing();

    // 7. Seed Projects
    console.log("Seeding projects...");
    await tx
      .insert(project)
      .values([
        {
          id: "77777777-7777-7777-7777-777777777771",
          name: "Menteng Residence - Luxury Kitchen Remodel",
          clientId: "44444444-4444-4444-4444-444444444441",
          projectManagerId: "33333333-3333-3333-3333-333333333331",
          status: "ACTIVE",
          financialHealth: "CRITICAL",
          totalContractValue: "650000000.00",
          startDate: new Date("2026-05-15"),
          endDate: new Date("2026-08-15"),
        },
        {
          id: "77777777-7777-7777-7777-777777777772",
          name: "Sudirman Suites - Penthouse Fit-Out",
          clientId: "44444444-4444-4444-4444-444444444442",
          projectManagerId: "33333333-3333-3333-3333-333333333332",
          status: "ACTIVE",
          financialHealth: "HEALTHY",
          totalContractValue: "1200000000.00",
          startDate: new Date("2026-06-01"),
          endDate: new Date("2026-10-01"),
        },
      ])
      .onConflictDoNothing();

    // 8. Seed Budgets
    console.log("Seeding budgets...");
    await tx
      .insert(projectBudget)
      .values([
        {
          id: "88888888-8888-8888-8888-888888888881",
          projectId: "77777777-7777-7777-7777-777777777771",
          status: "APPROVED",
          approvedById: "11111111-1111-1111-1111-111111111111",
          approvedAt: new Date("2026-05-14T10:00:00Z"),
          notes: "RAB disetujui Owner dengan target margin 7.6%",
        },
        {
          id: "88888888-8888-8888-8888-888888888882",
          projectId: "77777777-7777-7777-7777-777777777772",
          status: "APPROVED",
          approvedById: "11111111-1111-1111-1111-111111111111",
          approvedAt: new Date("2026-05-28T14:00:00Z"),
          notes: "RAB Sudirman Suites disetujui, target margin 12.5%",
        },
      ])
      .onConflictDoNothing();

    // 9. Seed Budget Items
    console.log("Seeding budget items...");
    await tx
      .insert(projectBudgetItem)
      .values([
        // Proyek Menteng
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
          projectBudgetId: "88888888-8888-8888-8888-888888888881",
          costCategoryId: "99999999-9999-9999-9999-999999999991",
          name: "Finishing Kabinet Dapur (HPL & Duco)",
          allocatedAmount: "220000000.00",
          actualSpent: "210000000.00",
        },
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
          projectBudgetId: "88888888-8888-8888-8888-888888888881",
          costCategoryId: "99999999-9999-9999-9999-999999999991",
          name: "Carrara Marble Countertop & Backsplash",
          allocatedAmount: "180000000.00",
          actualSpent: "0.00",
        },
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
          projectBudgetId: "88888888-8888-8888-8888-888888888881",
          costCategoryId: "99999999-9999-9999-9999-999999999992",
          name: "Pekerjaan MEP & Kelistrikan Dapur",
          allocatedAmount: "70000000.00",
          actualSpent: "65000000.00",
        },
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4",
          projectBudgetId: "88888888-8888-8888-8888-888888888881",
          costCategoryId: "99999999-9999-9999-9999-999999999992",
          name: "Upah Pertukangan Sipil Lapangan",
          allocatedAmount: "90000000.00",
          actualSpent: "0.00",
        },
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5",
          projectBudgetId: "88888888-8888-8888-8888-888888888881",
          costCategoryId: "99999999-9999-9999-9999-999999999993",
          name: "Transportasi & Operasional Lapangan PM",
          allocatedAmount: "40000000.00",
          actualSpent: "42000000.00",
        },
        // Proyek Sudirman
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
          projectBudgetId: "88888888-8888-8888-8888-888888888882",
          costCategoryId: "99999999-9999-9999-9999-999999999991",
          name: "Partisi Dinding Gypsum & Plafon Penthouse",
          allocatedAmount: "350000000.00",
          actualSpent: "0.00",
        },
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
          projectBudgetId: "88888888-8888-8888-8888-888888888882",
          costCategoryId: "99999999-9999-9999-9999-999999999991",
          name: "Custom Wardrobe Master Bedroom",
          allocatedAmount: "400000000.00",
          actualSpent: "0.00",
        },
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3",
          projectBudgetId: "88888888-8888-8888-8888-888888888882",
          costCategoryId: "99999999-9999-9999-9999-999999999992",
          name: "Pekerjaan MEP & Penerangan Penthouse",
          allocatedAmount: "150000000.00",
          actualSpent: "0.00",
        },
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4",
          projectBudgetId: "88888888-8888-8888-8888-888888888882",
          costCategoryId: "99999999-9999-9999-9999-999999999992",
          name: "Upah Tenaga Kerja & Tukang",
          allocatedAmount: "200000000.00",
          actualSpent: "0.00",
        },
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5",
          projectBudgetId: "88888888-8888-8888-8888-888888888882",
          costCategoryId: "99999999-9999-9999-9999-999999999993",
          name: "Perizinan & Koordinasi Gedung",
          allocatedAmount: "50000000.00",
          actualSpent: "0.00",
        },
      ])
      .onConflictDoNothing();

    // 10. Seed Client Invoices
    console.log("Seeding client invoices...");
    await tx
      .insert(clientInvoice)
      .values([
        {
          id: "01010101-0101-0101-0101-010101010101",
          projectId: "77777777-7777-7777-7777-777777777771",
          invoiceNumber: "INV/2026/001",
          amount: "195000000.00",
          status: "PAID",
          stage: "DP",
          dueDate: new Date("2026-06-01T23:59:59Z"),
          notes: "DP 30% Klien Alexandra Menteng",
        },
        {
          id: "01010101-0101-0101-0101-010101010102",
          projectId: "77777777-7777-7777-7777-777777777771",
          invoiceNumber: "INV/2026/002",
          amount: "325000000.00",
          status: "UNPAID",
          stage: "PROGRESS_1",
          dueDate: new Date("2026-06-25T23:59:59Z"),
          notes: "Termin Progress 50% Lapangan",
        },
        {
          id: "01010101-0101-0101-0101-010101010103",
          projectId: "77777777-7777-7777-7777-777777777772",
          invoiceNumber: "INV/2026/003",
          amount: "360000000.00",
          status: "PAID",
          stage: "DP",
          dueDate: new Date("2026-06-05T23:59:59Z"),
          notes: "DP 30% Sudirman Suites Penthouse",
        },
      ])
      .onConflictDoNothing();

    // 11. Seed Cash Transactions (Ledger Entries)
    console.log("Seeding ledger cash transactions...");
    await tx
      .insert(cashTransaction)
      .values([
        // Client Inflows
        {
          id: "cccccccc-cccc-cccc-cccc-cccccccccc01",
          bankAccountId: "66666666-6666-6666-6666-666666666661",
          type: "DEBIT",
          category: "client_payment",
          amount: "195000000.00",
          description: "Pembayaran Lunas DP 30% - Ibu Alexandra Menteng",
          reconciled: true,
          reconciliationDate: new Date("2026-06-01T11:00:00Z"),
          reconciledById: "22222222-2222-2222-2222-222222222222",
          referenceType: "client_payment",
          referenceId: "02020202-0202-0202-0202-020202020201",
        },
        {
          id: "cccccccc-cccc-cccc-cccc-cccccccccc02",
          bankAccountId: "66666666-6666-6666-6666-666666666662",
          type: "DEBIT",
          category: "client_payment",
          amount: "360000000.00",
          description: "Pembayaran Lunas DP 30% - Bpk Haryanto Sudirman",
          reconciled: true,
          reconciliationDate: new Date("2026-06-05T14:30:00Z"),
          reconciledById: "22222222-2222-2222-2222-222222222222",
          referenceType: "client_payment",
          referenceId: "02020202-0202-0202-0202-020202020202",
        },
        // Vendor Outflow (Bill 1)
        {
          id: "cccccccc-cccc-cccc-cccc-cccccccccc03",
          bankAccountId: "66666666-6666-6666-6666-666666666661",
          type: "CREDIT",
          category: "vendor_payment",
          amount: "210000000.00",
          description: "Pembayaran Tagihan Material Kabinet - PT Cahaya Abadi",
          reconciled: true,
          reconciliationDate: new Date("2026-06-10T16:00:00Z"),
          reconciledById: "22222222-2222-2222-2222-222222222222",
          referenceType: "vendor_payment",
          referenceId: "03030303-0303-0303-0303-030303030301",
        },
        // Petty Cash Outflows (Field requests PM)
        {
          id: "cccccccc-cccc-cccc-cccc-cccccccccc04",
          bankAccountId: "66666666-6666-6666-6666-666666666663",
          type: "CREDIT",
          category: "reimbursement",
          amount: "65000000.00",
          description: "Pelunasan Dana Reimbursement PM Budi - MEP Kabel Eterna",
          reconciled: true,
          reconciliationDate: new Date("2026-06-03T14:00:00Z"),
          reconciledById: "22222222-2222-2222-2222-222222222222",
          referenceType: "project_cost",
          referenceId: "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f001",
        },
        {
          id: "cccccccc-cccc-cccc-cccc-cccccccccc05",
          bankAccountId: "66666666-6666-6666-6666-666666666663",
          type: "CREDIT",
          category: "reimbursement",
          amount: "42000000.00",
          description: "Pelunasan Dana Akomodasi Scaffolding - Over Budget Approved",
          reconciled: true,
          reconciliationDate: new Date("2026-06-08T11:00:00Z"),
          reconciledById: "22222222-2222-2222-2222-222222222222",
          referenceType: "project_cost",
          referenceId: "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f002",
        },
      ])
      .onConflictDoNothing();

    // 12. Seed Client Payments
    console.log("Seeding client payments...");
    await tx
      .insert(clientPayment)
      .values([
        {
          id: "02020202-0202-0202-0202-020202020201",
          clientInvoiceId: "01010101-0101-0101-0101-010101010101",
          bankAccountId: "66666666-6666-6666-6666-666666666661",
          cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc01",
          amountPaid: "195000000.00",
          paymentDate: new Date("2026-06-01T10:30:00Z"),
          receivedById: "22222222-2222-2222-2222-222222222222",
          referenceNumber: "TRF-BCA-9831",
        },
        {
          id: "02020202-0202-0202-0202-020202020202",
          clientInvoiceId: "01010101-0101-0101-0101-010101010103",
          bankAccountId: "66666666-6666-6666-6666-666666666662",
          cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc02",
          amountPaid: "360000000.00",
          paymentDate: new Date("2026-06-05T13:00:00Z"),
          receivedById: "22222222-2222-2222-2222-222222222222",
          referenceNumber: "TRF-MND-4412",
        },
      ])
      .onConflictDoNothing();

    // 13. Seed Vendor Bills
    console.log("Seeding vendor bills...");
    await tx
      .insert(vendorBill)
      .values([
        {
          id: "33033303-3303-3303-3303-330333033301",
          vendorId: "55555555-5555-5555-5555-555555555551",
          projectId: "77777777-7777-7777-7777-777777777771",
          projectBudgetItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
          billNumber: "BILL-2026-049",
          amount: "210000000.00",
          status: "PAID",
          dueDate: new Date("2026-06-10T23:59:59Z"),
          notes: "Material multipleks finishing HPL untuk dapur Menteng",
        },
        {
          id: "33033303-3303-3303-3303-330333033302",
          vendorId: "55555555-5555-5555-5555-555555555552",
          projectId: "77777777-7777-7777-7777-777777777771",
          projectBudgetItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
          billNumber: "BILL-2026-057",
          amount: "175000000.00",
          status: "UNPAID",
          dueDate: new Date("2026-06-25T23:59:59Z"),
          notes: "Marmer alam Carrara Italia impor slab utuh",
        },
      ])
      .onConflictDoNothing();

    // 14. Seed Vendor Payments
    console.log("Seeding vendor payments...");
    await tx
      .insert(vendorPayment)
      .values([
        {
          id: "03030303-0303-0303-0303-030303030301",
          vendorBillId: "33033303-3303-3303-3303-330333033301",
          bankAccountId: "66666666-6666-6666-6666-666666666661",
          cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc03",
          amountPaid: "210000000.00",
          status: "COMPLETED",
          paymentDate: new Date("2026-06-10T15:30:00Z"),
          paidById: "22222222-2222-2222-2222-222222222222",
          referenceNumber: "LLG-BCA-0012",
        },
      ])
      .onConflictDoNothing();

    // 15. Seed Project Costs
    console.log("Seeding project field costs...");
    await tx
      .insert(projectCost)
      .values([
        {
          id: "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f001",
          projectId: "77777777-7777-7777-7777-777777777771",
          projectBudgetItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
          requestedById: "33333333-3333-3333-3333-333333333331",
          amount: "65000000.00",
          description: "Belanja kabel Eterna, MCB Schneider, & conduit PVC",
          receiptImageUrl: "https://storage.googleapis.com/atria-receipts/rec-09123.jpg",
          status: "PAID",
          budgetOverrun: false,
          bankAccountId: "66666666-6666-6666-6666-666666666663",
          cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc04",
          verifiedById: "22222222-2222-2222-2222-222222222222",
          verifiedAt: new Date("2026-06-03T09:00:00Z"),
          approvedById: "11111111-1111-1111-1111-111111111111",
          approvedAt: new Date("2026-06-03T12:00:00Z"),
          paidById: "22222222-2222-2222-2222-222222222222",
          paidAt: new Date("2026-06-03T14:00:00Z"),
        },
        {
          id: "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f002",
          projectId: "77777777-7777-7777-7777-777777777771",
          projectBudgetItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5",
          requestedById: "33333333-3333-3333-3333-333333333331",
          amount: "42000000.00",
          description: "Klaim akomodasi, sewa scaffolding, & konsumsi lembur tukang",
          receiptImageUrl: "https://storage.googleapis.com/atria-receipts/rec-09124.jpg",
          status: "PAID",
          budgetOverrun: true,
          bankAccountId: "66666666-6666-6666-6666-666666666663",
          cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc05",
          verifiedById: "22222222-2222-2222-2222-222222222222",
          verifiedAt: new Date("2026-06-07T10:00:00Z"),
          approvedById: "11111111-1111-1111-1111-111111111111",
          approvedAt: new Date("2026-06-08T09:00:00Z"),
          paidById: "22222222-2222-2222-2222-222222222222",
          paidAt: new Date("2026-06-08T11:00:00Z"),
        },
      ])
      .onConflictDoNothing();

    // 16. Seed Approvals
    console.log("Seeding transaction approvals...");
    await tx
      .insert(approval)
      .values([
        {
          id: "e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e001",
          approverId: "11111111-1111-1111-1111-111111111111",
          referenceType: "project_cost",
          referenceId: "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f001",
          status: "APPROVED",
          notes: "Disetujui, sesuai nota pembelian material MEP.",
        },
        {
          id: "e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e002",
          approverId: "11111111-1111-1111-1111-111111111111",
          referenceType: "project_cost",
          referenceId: "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f002",
          status: "APPROVED",
          notes:
            "Override anggaran disetujui. PM wajib memastikan tidak ada penambahan operasional lagi.",
        },
      ])
      .onConflictDoNothing();

    // 17. Seed AI Runs
    console.log("Seeding AI run logs...");
    await tx
      .insert(aiRun)
      .values([
        {
          id: "a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a001",
          runType: "OCR_RECEIPT",
          runById: "33333333-3333-3333-3333-333333333331",
          status: "COMPLETED",
          payload: '{"imageUrl": "https://storage.googleapis.com/atria-receipts/rec-09123.jpg"}',
          result:
            '{"vendorName": "Toko Listrik Jaya", "transactionDate": "2026-06-03", "totalAmount": 65000000, "items": [{"name": "Kabel Eterna", "qty": 10, "price": 6500000}]}',
          tokensUsed: 1200,
        },
      ])
      .onConflictDoNothing();

    // 18. Seed Notifications (Warning & Critical alerts)
    console.log("Seeding notifications and budget alerts...");
    await tx
      .insert(notification)
      .values([
        {
          id: "dddddddd-dddd-dddd-dddd-dddddddddd01",
          userId: "11111111-1111-1111-1111-111111111111",
          title: "WARNING: Budget Limit 90% Terlampaui",
          message:
            "Anggaran MEP Proyek Menteng telah terpakai Rp 65.000.000 dari alokasi Rp 70.000.000 (92.8%).",
          read: false,
          severity: "WARNING",
          referenceType: "project_budget_item",
          referenceId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
        },
        {
          id: "dddddddd-dddd-dddd-dddd-dddddddddd02",
          userId: "11111111-1111-1111-1111-111111111111",
          title: "CRITICAL: Anggaran Proyek Jebol!",
          message:
            "Anggaran Operasional PM Proyek Menteng telah melampaui batas sebesar Rp 42.000.000 dari alokasi Rp 40.000.000 (105.0%).",
          read: false,
          severity: "CRITICAL",
          referenceType: "project_budget_item",
          referenceId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5",
        },
      ])
      .onConflictDoNothing();

    // 19. Seed Audit Logs
    console.log("Seeding audit logs...");
    await tx
      .insert(auditLog)
      .values([
        {
          id: "99099909-9909-9909-9909-990999099901",
          userId: "22222222-2222-2222-2222-222222222222",
          action: "RECORD_CLIENT_PAYMENT",
          targetTable: "client_invoice",
          targetId: "01010101-0101-0101-0101-010101010101",
          originalState: '{"status": "UNPAID"}',
          newState: '{"status": "PAID"}',
          ipAddress: "192.168.1.10",
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26)",
        },
        {
          id: "99099909-9909-9909-9909-990999099902",
          userId: "22222222-2222-2222-2222-222222222222",
          action: "PAY_FIELD_REQUEST",
          targetTable: "project_cost",
          targetId: "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f002",
          originalState: '{"status": "APPROVED", "actual_spent": "0.00"}',
          newState: '{"status": "PAID", "actual_spent": "42000000.00"}',
          ipAddress: "192.168.1.10",
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26)",
        },
      ])
      .onConflictDoNothing();
  });

  console.log("Database seeding completed successfully!");
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
```
