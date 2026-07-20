# Rencana Implementasi: TSK-008 Server Actions Pengelolaan Biaya Lapangan, Tagihan & Pembayaran Vendor

Rencana ini menjelaskan struktur, skema validasi, dan logika bisnis Server Actions Next.js untuk mendukung siklus **Accounts Payable (Tagihan & Pembayaran Vendor)** dan **Field Claims (Pengeluaran Lapangan & Otorisasi)** secara aman dan transaksional.

---

## User Review Required

> [!IMPORTANT]
> **Dinamisasi Limit Persetujuan & Budget Overrun:**
> Limit persetujuan Rp 5.000.000 atau kondisi pembengkakan anggaran (`budget_overrun = true`) akan dideteksi secara dinamis saat dokumen pengeluaran lapangan (`project_cost`) dibuat atau saat pembayaran vendor dijadwalkan (`scheduleVendorBillPayment`). Sistem akan menyisipkan record persetujuan baru di tabel `approval` dengan status `PENDING` tanpa membutuhkan kolom redundan. Pembayaran riil hanya dapat dieksekusi jika record `approval` berstatus `APPROVED`.

---

## Proposed Changes

### Komponen: Validasi & Skema Zod (Validations)

#### [NEW] [finance.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/lib/validations/finance.ts)
*   Mendefinisikan skema validasi Zod untuk masukan tagihan, pembayaran vendor, dan biaya lapangan:
    *   `submitVendorBillSchema`: Validasi data tagihan vendor baru (`vendorId`, `projectId`, `projectBudgetItemId`, `billNumber`, `amount` harus positif, `dueDate`, `notes` opsional).
    *   `schedulePaymentSchema`: Validasi penjadwalan pembayaran (`vendorBillId`, `bankAccountId`, `paymentDate`, `amountPaid` harus positif).
    *   `payVendorBillSchema`: Validasi pembayaran vendor (`vendorPaymentId`, `referenceNumber`).
    *   `submitFieldRequestSchema`: Validasi pengajuan pengeluaran lapangan oleh PM (`projectId`, `projectBudgetItemId`, `amount` harus positif, `description`, `receiptImageUrl` opsional).
    *   `approveFieldRequestSchema`: Validasi keputusan Owner untuk klaim lapangan (`projectCostId`, `status` berupa `APPROVED` atau `REJECTED`, `notes` opsional).

### Komponen: Server Actions Tagihan & Pembayaran Vendor (Accounts Payable)

#### [NEW] [submit-vendor-bill.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/actions/finance/submit-vendor-bill.ts)
*   **`submitVendorBill(input)`**:
    *   Memverifikasi sesi dan izin `create:vendor_bill`.
    *   Melakukan scoping check agar PM hanya dapat mencatat tagihan ke proyek yang ditugaskan kepada mereka.
    *   Menyimpan tagihan ke tabel `vendor_bill` dengan status default `UNPAID`.

#### [NEW] [schedule-vendor-bill.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/actions/finance/schedule-vendor-bill.ts)
*   **`scheduleVendorBillPayment(input)`**:
    *   Memverifikasi sesi dan izin `pay:vendor_bill`.
    *   Menghitung secara transaksional apakah nominal pembayaran $\ge$ Rp 5.000.000 atau status anggaran proyek mengalami pembengkakan (`actualSpent` + `amountPaid` > `allocatedAmount` pada `project_budget_item`).
    *   Jika salah satu kondisi terpenuhi, menyisipkan entri baru di tabel `approval` berstatus `PENDING` yang merujuk secara polimorfik ke pembayaran vendor (`referenceType = 'vendor_payment'`).
    *   Menyisipkan entri ke tabel `vendor_payment` dengan status `PENDING`.

#### [NEW] [pay-vendor-bill.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/actions/finance/pay-vendor-bill.ts)
*   **`payVendorBill(input)`**:
    *   Memverifikasi sesi dan izin `pay:vendor_bill`.
    *   Menjalankan transaksi database (Option A):
        1. Mengambil dan mengunci baris `vendor_payment` dan `bank_account` (`for('update')`).
        2. Jika pembayaran memerlukan persetujuan (nominal $\ge$ Rp 5.000.000 atau budget overrun), memverifikasi keberadaan record `approval` berstatus `APPROVED`.
        3. Memotong saldo bank dan memverifikasi baris terupdate tepat satu baris.
        4. Menyisipkan rekaman `cash_transaction` (`CREDIT`).
        5. Mengubah status `vendor_payment` menjadi `COMPLETED` and memperbarui status `vendor_bill` menjadi `PAID` atau `PARTIALLY_PAID`.
        6. Mengakumulasikan pemakaian anggaran proyek pada `project_budget_item.actualSpent`.
        7. Mencatatkan riwayat ke tabel `audit_log`.

### Komponen: Server Actions Biaya Lapangan & Persetujuan (Field Claims & Approvals)

#### [NEW] [field-requests.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/actions/finance/field-requests.ts)
*   **`submitFieldRequest(input)`**:
    *   Memverifikasi sesi dan izin `create:cost`.
    *   Melakukan scoping check agar PM hanya dapat mengajukan pengeluaran pada proyek milik mereka.
    *   Memeriksa secara dinamis apakah pengajuan menyebabkan budget overrun (`actualSpent` + `amount` > `allocatedAmount`).
    *   Menyimpan pengajuan ke tabel `project_cost` dengan status `SUBMITTED` dan `budgetOverrun` diisi sesuai hasil perhitungan.
    *   Jika nominal $\ge$ Rp 5.000.000 atau `budgetOverrun` adalah `true`, menyisipkan record di tabel `approval` dengan status `PENDING`.
*   **`verifyFieldRequest(projectCostId)`**:
    *   Memverifikasi sesi dan izin `update:cost` (Admin / PM Senior).
    *   Mengubah status `project_cost` menjadi `VERIFIED`.
*   **`approveFieldRequest(input)`**:
    *   Hanya untuk peran `OWNER` (memiliki izin `approve:cost`).
    *   Mengubah status `project_cost` menjadi `APPROVED` atau `REJECTED` serta menyelaraskan status pada entri `approval` terkait.
*   **`payFieldRequest(projectCostId, bankAccountId, referenceNumber)`**:
    *   Memverifikasi sesi dan izin `pay:cost` (Finance Admin & Owner).
    *   Menjalankan transaksi database (Option A):
        1. Mengambil dan mengunci baris `project_cost` dan `bank_account` (`for('update')`).
        2. Memverifikasi status pengajuan adalah `APPROVED` (atau jika membutuhkan persetujuan, entri `approval` berstatus `APPROVED`).
        3. Mendebit nominal saldo kas menggunakan helper `mutateBalance` (`CREDIT`) dari kas kecil.
        4. Mengubah status `project_cost` menjadi `PAID`, mencatat `cashTransactionId`, `paidById`, dan `paidAt`.
        5. Menambahkan nominal pengeluaran ke `project_budget_item.actualSpent`.
        6. Menulis log audit ke tabel `audit_log`.

---

## Verification Plan

### Automated Tests
*   Membuat berkas unit test baru `lib/finance/actions-field.test.ts` untuk menguji:
    1. Pengajuan tagihan vendor baru oleh PM pada proyek milik mereka vs proyek milik orang lain.
    2. Deteksi otomatis pengajuan biaya lapangan di atas Rp 5.000.000 atau budget overrun yang memicu status `PENDING` pada antrean `approval`.
    3. Pelunasan biaya lapangan dan vendor bill yang berhasil memotong kas bank, mencatatkan ledger `cash_transaction` (CREDIT), memperbarui saldo, dan memperbarui status tagihan.
    4. Pencegahan pencairan biaya lapangan yang belum disetujui (status `PENDING` di `approval`).
    `bun test lib/finance/actions-field.test.ts`
*   Kompilasi TypeScript dan build Next.js:
    `bunx tsc --noEmit && bun run build`
