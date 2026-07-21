# Implementation Plan: TSK-002 Desain Skema Database Drizzle ORM & Global Setup

Rencana implementasi ini menjelaskan langkah-langkah untuk menginstal dependensi database, mendefinisikan tipe respons global Server Actions, merancang skema Drizzle ORM untuk 23 tabel keuangan sesuai spesifikasi data, menyusun koneksi database Neon PostgreSQL, serta memverifikasi pembuatan file migrasi.

---

## User Review Required

> [!IMPORTANT]
> **Integritas Referensi Finansial:** Semua foreign key pada tabel yang memengaruhi pencatatan kas/ledger (`cash_transaction`, `bank_account`, `project_cost`, dll) dikonfigurasi dengan aturan `onDelete: "restrict"`. Hal ini untuk memastikan tidak ada penghapusan data transaksi historis yang tidak disengaja.

> [!WARNING]
> **Penggunaan Tipe Data Angka (Numeric):** Kolom desimal keuangan didefinisikan menggunakan tipe `numeric(15, 2)` untuk menghindari isu pembulatan desimal JavaScript floating point. Selama manipulasi data di sisi server, nilai uang harus diperlakukan secara hati-hati (misal disimpan sebagai string numerik yang valid atau dikonversi dengan presisi tinggi).

---

## Proposed Changes

### 1. Global Setup (Residu TSK-001)

#### [NEW] [action-response.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/lib/types/action-response.ts)

Mendefinisikan generic type `ActionResponse<T>` untuk standardisasi format return value Server Actions.

### 2. Database Layer Configuration

#### [NEW] [index.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/db/index.ts)

Menginisialisasi koneksi Neon serverless client ke PostgreSQL dan mengekspor instance database `db`.

#### [NEW] [schema.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/db/schema.ts)

Mendefinisikan 23 tabel database relasional beserta relasi dan indeksnya.

#### [NEW] [drizzle.config.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/drizzle.config.ts)

Berkas konfigurasi Drizzle Kit untuk manajemen migrasi database.

---

## Tasks

### Task 1: Global Setup & Action Response

- **Goal:** Menyediakan format respons standar Server Actions agar komunikasi client-server seragam.
- **Langkah-langkah:**
  1.  Buat direktori `/lib/types/` jika belum ada.
  2.  Tulis file `lib/types/action-response.ts` yang mendefinisikan tipe data:
      - `ActionResponseSuccess<T>`
      - `ActionResponseError`
      - `ActionResponse<T>` (Union type)
      - Enum `ActionErrorCode` (seperti `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INSUFFICIENT_FUNDS`, `INTERNAL_ERROR`).

### Task 2: Install Database Dependencies

- **Goal:** Menambahkan paket library Drizzle ORM, Neon PostgreSQL serverless adapter, dan tooling migrasi Drizzle Kit.
- **Langkah-langkah:**
  1.  Jalankan perintah instalasi runtime dependencies:
      `bun add drizzle-orm @neondatabase/serverless`
  2.  Jalankan perintah instalasi devDependencies:
      `bun add -d drizzle-kit @types/pg pg`

### Task 3: Inisialisasi Koneksi Database (`db/index.ts`)

- **Goal:** Mengekspor instance `db` terhubung ke Neon PostgreSQL menggunakan variabel lingkungan.
- **Langkah-langkah:**
  1.  Buat folder `/db` pada direktori root.
  2.  Tulis berkas `db/index.ts` untuk mengimpor `@neondatabase/serverless` dan `drizzle-orm/neon-serverless`.
  3.  Baca `process.env.DATABASE_URL` untuk menginisialisasi pool client dan mengekspor instance `db` dengan melampirkan skema relasional (`schema`).

### Task 4: Definisi Skema Database ORM (`db/schema.ts`)

- **Goal:** Mendefinisikan seluruh tabel, indeks, foreign keys, status enums, dan relasi Drizzle (Drizzle Relations API).
- **Langkah-langkah:**
  1.  Tulis berkas `db/schema.ts`.
  2.  Daftarkan status string enums berikut:
      - `projectStatus`: `DRAFT`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED`
      - `financialHealth`: `HEALTHY`, `WARNING`, `CRITICAL`
      - `invoiceStatus`/`payableStatus`: `UNPAID`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `VOID`
      - `clientPaymentStage`: `DP`, `PROGRESS_1`, `PROGRESS_2`, `PELUNASAN`, `RETENTION`, `AD_HOC`
      - `vendorPaymentStatus`: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`
      - `budgetStatus`: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`
      - `costApprovalStatus`: `SUBMITTED`, `VERIFIED`, `APPROVED`, `PAID`, `REJECTED`
      - `cashTransactionType`: `DEBIT`, `CREDIT`
      - `cashTransactionCategory`: `client_payment`, `vendor_payment`, `petty_cash_refill`, `office_rent`, `utilities`, `salary`, `cash_advance`, `reimbursement`, `other`
      - `alertSeverity`: `INFO`, `WARNING`, `CRITICAL`
  3.  Tulis definisi ke-23 tabel database sesuai dengan dokumen `DATABASE_SCHEMA.md`:
      1.  `role`
      2.  `user`
      3.  `client`
      4.  `project`
      5.  `project_budget`
      6.  `project_cost_category`
      7.  `project_budget_item`
      8.  `bank_account`
      9.  `cash_transaction`
      10. `project_cost`
      11. `client_invoice`
      12. `client_payment`
      13. `vendor`
      14. `vendor_bill`
      15. `vendor_payment`
      16. `attachment`
      17. `approval`
      18. `ai_run`
      19. `notification`
      20. `audit_log`
      21. `app_config`
      22. `bank_statement_import`
      23. `bank_statement_row`
  4.  Tambahkan relasi eksplisit Drizzle (`relations(...)`) untuk mempermudah loading data asosiasi menggunakan Drizzle Relational Queries (`db.query.tableName.findMany(...)`).

### Task 5: Konfigurasi Drizzle Kit (`drizzle.config.ts`)

- **Goal:** Menyusun konfigurasi untuk sinkronisasi skema ke PostgreSQL.
- **Langkah-langkah:**
  1.  Tulis berkas `drizzle.config.ts` pada direktori root.
  2.  Arahkan skema ke `./db/schema.ts`, folder output migrasi ke `./drizzle`, dan gunakan dialek `postgresql` dengan driver `neon`.

---

## Verification Plan

### Automated Tests

- Menjalankan perintah pembentukan migrasi:
  `bunx drizzle-kit generate`
  _Outcome:_ Berhasil menciptakan berkas SQL migrasi di folder `./drizzle` tanpa error.
- Menjalankan TypeScript compiler check untuk memastikan tidak ada kesalahan tipe data:
  `bun run build`
  _Outcome:_ Aplikasi Next.js dapat dikompilasi dengan sukses tanpa kesalahan kompilasi.

### Manual Verification

- Memeriksa file SQL migrasi yang dihasilkan untuk memverifikasi foreign key `onDelete: "restrict"` telah terpasang secara tepat pada tabel transaksional keuangan.
- Memeriksa kesesuaian indeks pencarian kunci agar queries database optimal.
