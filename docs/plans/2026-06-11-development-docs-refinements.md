# Implementation Plan: Development Docs Refinements

Rencana ini memaparkan langkah-langkah penyempurnaan dokumen rencana pengembangan (`docs/07-development/ROADMAP.md`, `docs/07-development/TASK_BREAKDOWN.md`, dan `docs/07-development/IMPLEMENTATION_ORDER.md`) sesuai dengan instruksi perbaikan dari peninjau.

---

## 🎯 1. Target & Objektif Perbaikan

### 1.1 Penambahan Terminology Mapping

Menambahkan bagian khusus di bagian atas `TASK_BREAKDOWN.md` untuk memetakan penamaan entitas di diagram alur (_flows_) dengan tabel database riil:

- `client_payment_milestone` (Flows) $\rightarrow$ `client_invoice` (Database)
- `field_request` (Flows) $\rightarrow$ `project_cost` (Database)

### 1.2 Ekspansi Server Actions Anggaran Proyek (TSK-007)

Memperluas TSK-007 untuk mencakup implementasi Server Actions manajemen anggaran proyek:

- `createProjectBudget` (membuat draf anggaran proyek)
- `submitBudgetForApproval` (mengajukan anggaran untuk disetujui)
- `approveBudget` (menyetujui anggaran oleh Owner/Admin)
- `rejectBudget` (menolak anggaran dengan catatan)
- `createBudgetItem` (menambah item anggaran, dibatasi hanya untuk status `DRAFT` atau `REJECTED`)

### 1.3 Ekspansi Server Actions Biaya Lapangan (TSK-008)

Memperluas TSK-008 untuk mencakup implementasi Server Actions biaya lapangan / project costs (field claims) dan persetujuannya:

- `verifyFieldRequest` (verifikasi oleh Admin/PM Senior)
- `approveFieldRequest` (persetujuan oleh Owner jika di atas limit atau budget overrun)
- `payFieldRequest` (melakukan pembayaran riil dari kas kecil/bank, merubah status ke `PAID`, dan mencatat `cash_transaction` lunas)

### 1.4 Dinamisasi Limit & Deteksi Persetujuan

Mengklarifikasi di TSK-008 bahwa limit approval (Rp 5.000.000 atau budget overrun) dideteksi secara dinamis ketika pembayaran/penjadwalan diajukan. Status persetujuan disimpan secara transaksional di tabel `approval` tanpa perlu membuat kolom redundan pada tabel `vendor_payment` atau `project_cost`.

### 1.5 Perbaikan Presisi Perintah Uji (Test Notes)

Mengganti instruksi uji umum dengan perintah konkret yang presisi, seperti:

- `bun run db/seed.ts`
- `bun test scratch/test-transaction-locking.ts`
- `bun test scratch/test-budget-actions.ts`
- `bun test scratch/test-field-approvals.ts`
- `curl -H "Authorization: Bearer local-cron-token" http://localhost:3000/api/cron/daily-briefing`

---

## 📂 2. Perubahan pada Berkas Dokumentasi

### 2.1 `docs/07-development/TASK_BREAKDOWN.md`

- Menambahkan tabel/seksi **Terminology Mapping** di bagian atas sebelum tugas atomik.
- Memperluas deskripsi, kriteria penerimaan, dan test notes pada **TSK-007** (Project Budgeting & Client Payments).
- Memperluas deskripsi, kriteria penerimaan, dan test notes pada **TSK-008** (Vendor Bills, Project Costs & Approvals).
- Memperbaiki seluruh bagian **Test Notes** pada TSK-001 hingga TSK-012 agar menggunakan perintah konkret (misal: `bun run`, `bun test`, atau perintah `curl` spesifik).

### 2.2 `docs/07-development/ROADMAP.md`

- Menyelaraskan deskripsi **Phase 4 (Project Budgeting, Scoping & RAB Management)** dengan penambahan Server Actions anggaran proyek (`createProjectBudget`, `submitBudgetForApproval`, `approveBudget`, `rejectBudget`, `createBudgetItem`).
- Menyelaraskan deskripsi **Phase 5 (Field Expense Claims, Approvals & Disbursement Flow)** dengan penambahan Server Actions biaya lapangan (`verifyFieldRequest`, `approveFieldRequest`, `payFieldRequest`) dan pendeteksian limit secara dinamis melalui tabel `approval`.

### 2.3 `docs/07-development/IMPLEMENTATION_ORDER.md`

- Menambahkan rincian Server Actions anggaran proyek dan biaya lapangan pada **Langkah 4 (Server Actions & Zod Validations)**.
- Memperbarui panduan verifikasi pada **Langkah 4** untuk menyertakan instruksi verifikasi terhadap Server Actions yang baru ditambahkan.

---

## 🛠️ 3. Alur Verifikasi & Pengujian

1. Memastikan file ditulis dalam format Markdown yang valid.
2. Memastikan tidak ada placeholder, `TODO`, atau `TBD`.
3. Memastikan semua penjelasan produk dalam Bahasa Indonesia dan istilah teknis dalam English.
4. Menjalankan verifikasi sintaksis dan membaca isi dokumen sebelum commit.
