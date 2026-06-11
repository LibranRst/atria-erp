# Rencana Implementasi: TSK-007 Server Actions Anggaran Proyek & Penerimaan Klien

Rencana ini menjelaskan struktur dan langkah-langkah implementasi untuk Server Actions Next.js yang menangani modul anggaran proyek (Rencana Anggaran Biaya / RAB), pencatatan penerimaan pembayaran termin klien, serta pengambilan statistik untuk dasbor finansial CFO.

---

## User Review Required

> [!IMPORTANT]
> **Integrasi Engine `mutateBalance`:**
> Server Action `recordClientPayment` akan memanfaatkan helper `mutateBalance` yang telah dibuat pada TSK-006 untuk memproses penambahan saldo bank secara aman. Ini menjamin penguncian pesimistis, presisi bigint sen, pencatatan otomatis di buku besar, dan penyimpanan riwayat audit dijalankan secara seragam dalam satu transaksi.

> [!WARNING]
> **Scoping Hak Akses PM:**
> Project Manager (PM) lapangan hanya diizinkan untuk membuat draf anggaran (`createProjectBudget`), menambahkan item anggaran (`createBudgetItem`), dan mengajukan persetujuan (`submitBudgetForApproval`) pada proyek yang ditugaskan kepada mereka secara khusus (`project.projectManagerId = userId`). Pemeriksaan ini akan diintegrasikan menggunakan helper `assertProjectAccess` dari TSK-005.

---

## Proposed Changes

### Komponen: Validasi & Skema Zod (Validations)

#### [NEW] [budget.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/lib/validations/budget.ts)
*   Mendefinisikan skema validasi Zod untuk data masukan anggaran:
    *   `createBudgetItemSchema`: validasi untuk menambahkan item Rencana Anggaran Biaya (RAB) BoQ (allocatedAmount harus positif, projectBudgetId, costCategoryId, dan name wajib diisi).
    *   `recordClientPaymentSchema`: validasi untuk pembayaran klien (clientInvoiceId, bankAccountId, amountPaid harus positif, paymentDate, referenceNumber wajib diisi).

### Komponen: Server Actions Anggaran Proyek (Project Budget Actions)

#### [NEW] [budget.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/actions/project/budget.ts)
*   **`createProjectBudget(projectId: string)`**:
    *   Memverifikasi sesi pengguna dan izin `create:budget`.
    *   Memvalidasi keberadaan proyek. Jika peran adalah PM, memverifikasi kepemilikan proyek.
    *   Menyisipkan draf awal `project_budget` dengan status `DRAFT`.
*   **`createBudgetItem(input)`**:
    *   Memvalidasi input menggunakan `createBudgetItemSchema`.
    *   Memverifikasi sesi dan izin `create:budget`.
    *   Memverifikasi bahwa status anggaran proyek induk masih `DRAFT` atau `REJECTED` (jika status `APPROVED`, kueri ditolak).
    *   Menyisipkan `project_budget_item`.
*   **`submitBudgetForApproval(projectBudgetId: string)`**:
    *   Mengubah status `project_budget` dari `DRAFT` atau `REJECTED` menjadi `PENDING_APPROVAL`.
*   **`approveBudget(projectBudgetId: string)`**:
    *   Hanya untuk peran `OWNER` / `FINANCE_ADMIN` (memeriksa izin `approve:budget`).
    *   Mengubah status `project_budget` menjadi `APPROVED` serta merekam `approvedById` dan `approvedAt`.
*   **`rejectBudget(projectBudgetId: string, notes: string)`**:
    *   Mengubah status `project_budget` menjadi `REJECTED` dan menambahkan catatan alasan penolakan (`notes`).

### Komponen: Server Actions Finansial (Finance Actions)

#### [NEW] [record-client-payment.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/actions/finance/record-client-payment.ts)
*   **`recordClientPayment(input)`**:
    *   Memvalidasi input menggunakan `recordClientPaymentSchema`.
    *   Memverifikasi sesi dan izin `reconcile:ledger` (Finance Admin & Owner).
    *   Menjalankan transaksi database:
        1. Pre-generate ID pembayaran menggunakan `crypto.randomUUID()`.
        2. Memanggil `mutateBalance` (`DEBIT`) dengan ID pembayaran yang di-pregenerate sebagai `referenceId`.
        3. Menyisipkan rekaman pembayaran ke tabel `client_payment`.
        4. Memperbarui status `client_invoice` menjadi `PAID` (jika nominal pembayaran lunas) atau `PARTIALLY_PAID` (jika bayar sebagian).

#### [NEW] [get-dashboard-stats.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/actions/finance/get-dashboard-stats.ts)
*   **`getDashboardStats()`**:
    *   Memverifikasi sesi dan izin membaca profitabilitas (`view:profitability`).
    *   Melakukan kalkulasi agregasi:
        1. Total saldo kas riil lintas seluruh rekening bank (`bank_account`).
        2. Total piutang aktif (*receivables*) dari `client_invoice` berstatus `UNPAID` atau `PARTIALLY_PAID`.
        3. Total utang aktif (*payables*) dari `vendor_bill` berstatus `UNPAID` or `PARTIALLY_PAID`.
        4. Jumlah proyek aktif (`status = 'ACTIVE'`).

---

## Verification Plan

### Automated Tests
*   Membuat berkas unit test baru `lib/finance/actions.test.ts` untuk menguji:
    1. Pembuatan item anggaran hanya diizinkan pada status DRAFT.
    2. Pencatatan pembayaran klien mengubah status invoice secara akurat (PAID / PARTIALLY_PAID) dan menambah saldo bank.
    3. Penghitungan statistik dasbor finansial mengembalikan nominal yang tepat sesuai dengan seed data.
    `bun test lib/finance/actions.test.ts`
*   Kompilasi TypeScript dan build Next.js:
    `bun run build`

### Manual Verification
*   Menjalankan Next.js local server dan memverifikasi bahwa kueri dashboard stats mengembalikan total nominal IDR yang logis sesuai data seed.
