# Task Breakdown - Atria ERP

Dokumen ini memecah seluruh siklus pengembangan Atria ERP menjadi **12 tugas atomik & konkret** (TSK-001 hingga TSK-012) yang siap dikerjakan oleh AI coding agents. Penjelasan produk disajikan dalam Bahasa Indonesia, sementara istilah teknis menggunakan English untuk presisi penulisan kode.

---

## Pemetaan Terminologi (Terminology Mapping)

Untuk menyinkronkan penamaan entitas dalam diagram alur (*workflow flows*) dengan nama tabel database riil pada codebase agar tidak membingungkan coding agent:

- **`client_payment_milestone`** (Workflows/Flows) $\rightarrow$ **`client_invoice`** (Database)
- **`field_request`** (Workflows/Flows) $\rightarrow$ **`project_cost`** (Database)

---

## Daftar Tugas Utama (Task List Overview)

| Task ID | Task Title | Target Core | Dependencies |
| :--- | :--- | :--- | :--- |
| **TSK-001** | Proyek Inisialisasi & Lingkungan Framework | Next.js App Shell, Bun, & CSS Global | None |
| **TSK-002** | Desain Skema Database Drizzle ORM | 20 Tabel Inti Keuangan & Indeks | TSK-001 |
| **TSK-003** | Skrip Seeding & Mock Data Keuangan | Database Seeder | TSK-002 |
| **TSK-004** | Integrasi Better Auth & Middleware Proteksi Rute | Authentication & Middleware Route Protection | TSK-002 |
| **TSK-005** | Penegakan Keamanan RBAC & Scoping Proyek | assertPermission Helper & PM Scoping | TSK-004 |
| **TSK-006** | Engine Mutasi Saldo Kas & Option A Ledger | Transactional Locking Helper (`mutateBalance`) | TSK-003, TSK-005 |
| **TSK-007** | Server Actions Anggaran Proyek & Penerimaan Klien | Budget Management & Client Payments | TSK-006 |
| **TSK-008** | Server Actions Pengelolaan Biaya Lapangan, Tagihan & Pembayaran Vendor | Field Claims, Vendor Bills & Approvals | TSK-007 |
| **TSK-009** | Integrasi Gemini AI OCR Nota & Daily Briefing Cron | Gemini SDK Pipeline & Daily Briefing Cron | TSK-008 |
| **TSK-010** | App Shell & iOS 26 Solid UI Core Components | Bottom Navigation & Core Components | TSK-001 |
| **TSK-011** | UI Form Pengeluaran Lapangan & Integrasi OCR PM | Expense Form & OCR Loader | TSK-009, TSK-010 |
| **TSK-012** | UI Layar Persetujuan Owner & Dasbor CFO | Dashboard CFO & Swipe Actions | TSK-010, TSK-011 |

---

## Detil Tugas Atomik (Atomic Task Details)

### TSK-001: Proyek Inisialisasi & Lingkungan Framework
*   **Goal (Tujuan):** Menyiapkan kerangka kerja dasar proyek menggunakan Bun + Next.js App Router, menetapkan aturan TypeScript ketat (*strict mode*), serta mendaftarkan token warna HSL **iOS 26 Solid** pada CSS Global.
*   **Files likely touched (File yang tersentuh):**
    *   `/package.json`
    *   `/tsconfig.json`
    *   `/app/globals.css`
    *   `/lib/types/action-response.ts`
*   **Acceptance Criteria (Kriteria Penerimaan):**
    *   TypeScript dikonfigurasi dengan `strict: true` dan pelarangan ketat tipe `any` (aktifkan rule ESLint `@typescript-eslint/no-explicit-any`: `"error"`).
    *   CSS Global mendefinisikan seluruh variabel warna HSL seperti `--color-bg-deep`, `--color-bg-surface`, `--color-border`, `--color-primary`, dan status colors (emerald, amber, coral) sesuai spesifikasi `IOS26_SOLID_DESIGN_SYSTEM.md`.
    *   File `lib/types/action-response.ts` mengekspor generic type `ActionResponse<T>` dengan pemetaan error codes yang lengkap secara benar.
*   **Dependencies (Ketergantungan):** None.
*   **Test Notes (Catatan Pengujian):**
    *   *Command:* `bun run build`
    *   *Outcome:* Kompilasi Next.js berhasil tanpa ada warning eslint atau kesalahan tipe TypeScript.

---

### TSK-002: Desain Skema Database Drizzle ORM
*   **Goal (Tujuan):** Mendefinisikan struktur database PostgreSQL menggunakan sintaks Drizzle ORM untuk 20 tabel inti keuangan sesuai spesifikasi `DATABASE_SCHEMA.md`.
*   **Files likely touched (File yang tersentuh):**
    *   `/db/schema.ts`
    *   `/db/index.ts`
    *   `/drizzle.config.ts`
*   **Acceptance Criteria (Kriteria Penerimaan):**
    *   Menerapkan database driver Neon serverless pada `/db/index.ts`.
    *   Semua foreign keys transaksional keuangan wajib menyertakan aturan `.references(() => table.id, { onDelete: "restrict" })` guna menghindari penghapusan data gantung.
    *   Menambahkan indeks eksplisit pada kolom pencarian utama (seperti `user_role_id_idx` pada tabel `user` dan `ct_reference_idx` pada tabel `cash_transaction`).
    *   Zero raw SQL strings di dalam skema database.
*   **Dependencies (Ketergantungan):** TSK-001.
*   **Test Notes (Catatan Pengujian):**
    *   *Command:* `bunx drizzle-kit generate`
    *   *Outcome:* File migrasi SQL berhasil dibuat di folder `/drizzle` dan memuat definisi tabel yang cocok dengan model Drizzle.

---

### TSK-003: Skrip Seeding & Mock Data Keuangan
*   **Goal (Tujuan):** Membuat skrip seeder untuk mengisi database awal dengan peran otorisasi, kategori anggaran proyek, serta akun kas bank fiktif perusahaan untuk keperluan simulasi awal.
*   **Files likely touched (File yang tersentuh):**
    *   `/db/seed.ts`
*   **Acceptance Criteria (Kriteria Penerimaan):**
    *   Mengisi tabel `role` dengan 3 peran master: `OWNER`, `FINANCE_ADMIN`, dan `PROJECT_MANAGER`.
    *   Mengisi tabel `project_cost_category` dengan kategori default: `MATERIAL`, `SUBCONTRACTOR`, `OPERATIONAL`, dan `OTHER`.
    *   Mengisi tabel `bank_account` dengan rekening awal BCA Operational, Mandiri Project, dan Petty Cash Office lengkap dengan saldo awal di atas Rp 10.000.000,00.
*   **Dependencies (Ketergantungan):** TSK-002.
*   **Test Notes (Catatan Pengujian):**
    *   *Command:* `bun run db/seed.ts`
    *   *Outcome:* Database terisi record baru tanpa error foreign key mismatch. Lakukan verifikasi baris tabel via neon console atau db management tool.

---

### TSK-004: Integrasi Better Auth & Middleware Proteksi Rute
*   **Goal (Tujuan):** Mengonfigurasi engine Better Auth dengan adapter Drizzle untuk autentikasi pengguna dan mengamankan akses rute halaman dasbor keuangan di tingkat middleware.
*   **Files likely touched (File yang tersentuh):**
    *   `/lib/auth.ts`
    *   `/app/api/auth/[...better-auth]/route.ts`
    *   `/middleware.ts`
*   **Acceptance Criteria (Kriteria Penerimaan):**
    *   Better Auth dikonfigurasi menggunakan sesi di database dan terikat dengan tabel `user` & `role`.
    *   Middleware mendeteksi session server-side. Rute `/dashboard/ledger` dan `/dashboard/finance` hanya dapat dimuat jika peran pengguna adalah `OWNER` atau `FINANCE_ADMIN`.
    *   Rute `/dashboard/settings/bank-accounts` dikunci khusus untuk peran `OWNER` saja.
*   **Dependencies (Ketergantungan):** TSK-002.
*   **Test Notes (Catatan Pengujian):**
    *   *Command:* Jalankan server dev dengan `bun run dev` lalu panggil `curl -I http://localhost:3000/dashboard/ledger` tanpa cookie session.
    *   *Outcome:* Server mengembalikan status redirect 302 ke rute `/login`.

---

### TSK-005: Penegakan Keamanan RBAC & Scoping Proyek
*   **Goal (Tujuan):** Membuat helper keamanan `assertPermission` untuk memvalidasi otorisasi di dalam Server Actions dan menyusun fungsi scoping query database agar PM hanya dapat mengakses proyek mereka sendiri.
*   **Files likely touched (File yang tersentuh):**
    *   `/lib/auth/permissions.ts`
    *   `/lib/auth/scoping.ts`
*   **Acceptance Criteria (Kriteria Penerimaan):**
    *   Fungsi `assertPermission(user, permission)` membandingkan string permission (seperti `reconcile:ledger` atau `pay:vendor_bill`) dengan role user. Jika tidak memiliki hak, lempar error `FORBIDDEN` secara eksplisit.
    *   Fungsi `scopeProjectQuery(userId, role)` mengembalikan query modifier atau filter database yang membatasi relasi proyek PM hanya pada baris di mana `project.projectManagerId = userId`.
*   **Dependencies (Ketergantungan):** TSK-004.
*   **Test Notes (Catatan Pengujian):**
    *   *Command:* `bun test lib/auth/permissions.test.ts`
    *   *Outcome:* Memanggil `assertPermission` dengan peran `PROJECT_MANAGER` untuk permission `reconcile:ledger` terbukti sukses melempar error `FORBIDDEN`.

---

### TSK-006: Engine Mutasi Saldo Kas & Option A Ledger
*   **Goal (Tujuan):** Membuat fungsi helper transaksional internal `mutateBalance` untuk melakukan mutasi kas secara aman dengan penegakan Option A transaksional ledger.
*   **Files likely touched (File yang tersentuh):**
    *   `/lib/finance/balance-mutation.ts`
*   **Acceptance Criteria (Kriteria Penerimaan):**
    *   Seluruh operasi berjalan di dalam blok database transaction (`db.transaction`).
    *   Mengunci baris data akun bank target menggunakan PostgreSQL pessimistic locking (`.for('update')`).
    *   Melakukan verifikasi sisa saldo sebelum melakukan mutasi kas keluar (`CREDIT`). Jika saldo tidak mencukupi, lempar error `INSUFFICIENT_FUNDS` untuk memicu rollback otomatis.
    *   Menghitung saldo baru, menulis perubahan saldo, memverifikasi record terupdate tepat 1 baris, menulis entri kas baru ke `cash_transaction` dengan status `reconciled = true`, dan menulis data history ke `audit_log`.
*   **Dependencies (Ketergantungan):** TSK-003, TSK-005.
*   **Test Notes (Catatan Pengujian):**
    *   *Command:* `bun test scratch/test-transaction-locking.ts`
    *   *Outcome:* Pengujian menyisipkan mutasi kas secara konkuren dan membuktikan saldo akhir BCA Operational terpotong dengan akurat tanpa adanya race condition atau saldo minus.

---

### TSK-007: Server Actions Anggaran Proyek & Penerimaan Klien
*   **Goal (Tujuan):** Mengimplementasikan Server Actions manajemen anggaran proyek (`createProjectBudget`, `submitBudgetForApproval`, `approveBudget`, `rejectBudget`, `createBudgetItem`) serta pencatatan pembayaran termin klien (`recordClientPayment`) dan dasbor stats (`getDashboardStats`).
*   **Files likely touched (File yang tersentuh):**
    *   `/app/actions/project/budget.ts`
    *   `/app/actions/finance/record-client-payment.ts`
    *   `/app/actions/finance/get-dashboard-stats.ts`
    *   `/lib/validations/budget.ts`
*   **Acceptance Criteria (Kriteria Penerimaan):**
    *   Semua Server Actions diawali dengan perintah `"use server"` dan memanggil session check server-side menggunakan Better Auth.
    *   `createProjectBudget` menerima `projectId` dan membuat draf awal `project_budget` dengan status default `DRAFT`.
    *   `submitBudgetForApproval` mengubah status anggaran proyek menjadi `PENDING_APPROVAL` jika draf sudah lengkap.
    *   `approveBudget` hanya boleh dipanggil oleh `OWNER` atau `FINANCE_ADMIN` untuk menyetujui anggaran proyek dan mengubah statusnya menjadi `APPROVED`.
    *   `rejectBudget` mengubah status anggaran proyek menjadi `REJECTED` atau mengembalikan ke `DRAFT` disertai dengan catatan penolakan (`notes`).
    *   `createBudgetItem` menerima parameter item anggaran (`project_budget_item`), dan hanya diizinkan untuk menambahkan item jika status anggaran proyek tersebut adalah `DRAFT` atau `REJECTED`. Jika status sudah `APPROVED`, throw error `FORBIDDEN`.
    *   `recordClientPayment` menerima input data tervalidasi menggunakan skema Zod (`recordClientPaymentSchema`), memotong sisa tagihan pada `client_invoice` secara aman di bawah `db.transaction`, mengubah status invoice menjadi `PAID` atau `PARTIALLY_PAID`, dan menambah saldo bank menggunakan helper `mutateBalance` (`DEBIT`).
*   **Dependencies (Ketergantungan):** TSK-006.
*   **Test Notes (Catatan Pengujian):**
    *   *Command:* `bun test scratch/test-budget-actions.ts`
    *   *Outcome:* Pengujian membuktikan alur status transisi anggaran proyek berjalan lancar, dan penambahan item anggaran pada proyek yang anggarannya sudah berstatus `APPROVED` diblokir dengan error `FORBIDDEN`.

---

### TSK-008: Server Actions Pengelolaan Biaya Lapangan, Tagihan & Pembayaran Vendor
*   **Goal (Tujuan):** Mengembangkan Server Actions pendukung Accounts Payable dan biaya lapangan (field claims): input tagihan vendor (`submitVendorBill`), penjadwalan pembayaran (`scheduleVendorBillPayment`), pencatatan realisasi bayar vendor (`payVendorBill`), verifikasi pengajuan lapangan (`verifyFieldRequest`), persetujuan pengajuan lapangan oleh Owner (`approveFieldRequest`), serta pelunasan biaya lapangan (`payFieldRequest`).
*   **Files likely touched (File yang tersentuh):**
    *   `/app/actions/finance/submit-vendor-bill.ts`
    *   `/app/actions/finance/schedule-vendor-bill.ts`
    *   `/app/actions/finance/pay-vendor-bill.ts`
    *   `/app/actions/finance/field-requests.ts`
    *   `/lib/validations/finance.ts`
*   **Acceptance Criteria (Kriteria Penerimaan):**
    *   `submitVendorBill` melakukan scoping check agar PM hanya dapat mencatat tagihan ke proyek milik mereka.
    *   Pengajuan klaim biaya lapangan baru oleh PM disimpan ke tabel `project_cost` dengan status default `SUBMITTED`.
    *   `verifyFieldRequest` dijalankan oleh Admin atau PM Senior untuk merubah status biaya lapangan dari `SUBMITTED` menjadi `VERIFIED`.
    *   Mekanisme limit persetujuan (approval limit) dideteksi secara dinamis saat penjadwalan (`scheduleVendorBillPayment`) atau pembayaran diajukan: jika nominal transaksi $\ge$ Rp 5.000.000 atau status anggaran proyek mengalami pembengkakan (`budget_overrun = true` hasil perbandingan totalspent + proposed terhadap plafon `project_budget_item`), sistem akan menyisipkan record persetujuan baru di tabel `approval` dengan status `PENDING` secara transaksional tanpa memerlukan kolom redundan di tabel `vendor_payment` atau `project_cost`.
    *   `approveFieldRequest` dijalankan oleh Owner/Admin untuk merubah status `approval` menjadi `APPROVED`.
    *   `payFieldRequest` melakukan pencairan dana tunai riil (menggunakan helper `mutateBalance` dengan `CREDIT` dari kas kecil/petty cash bank), merubah status `project_cost` menjadi `PAID`, serta mencatat transaksi lunas di `cash_transaction`.
    *   `payVendorBill` melakukan pembayaran riil pada tagihan vendor setelah memeriksa keberadaan record `approval` berstatus `APPROVED` untuk tagihan tersebut jika melampaui limit Rp 5.000.000 atau budget overrun.
*   **Dependencies (Ketergantungan):** TSK-007.
*   **Test Notes (Catatan Pengujian):**
    *   *Command:* `bun test scratch/test-field-approvals.ts`
    *   *Outcome:* Pengajuan di atas Rp 5.000.000 sukses memicu pembuatan baris baru di tabel `approval` dengan status `PENDING`. Pencairan dana (`payFieldRequest`) terblokir dan melempar error `FORBIDDEN` sebelum status `approval` diubah oleh Owner menjadi `APPROVED`.

---

### TSK-009: Integrasi Gemini AI OCR Nota & Daily Briefing Cron
*   **Goal (Tujuan):** Mengintegrasikan Google Gen AI SDK untuk membaca foto struk belanja PM lapangan secara asinkron dan menyusun pipa terjadwal (*cron job*) pembuatan taklimat CFO harian untuk Owner.
*   **Files likely touched (File yang tersentuh):**
    *   `/lib/ai/gemini.ts`
    *   `/app/actions/ai/process-receipt.ts`
    *   `/app/api/cron/daily-briefing/route.ts`
*   **Acceptance Criteria (Kriteria Penerimaan):**
    *   Parser OCR menggunakan model Gemini 1.5 Flash dengan konfigurasi SDK `responseMimeType: "application/json"` dan menyertakan OpenAPI schema lengkap pada properti `responseSchema` agar output terstruktur bersih.
    *   Hasil pemrosesan nota disimpan sementara sebagai draf proposal read-only di database dan dicatat di tabel `ai_run` untuk audit token.
    *   Endpoint cron `/app/api/cron/daily-briefing/route.ts` mengumpulkan statistik mutasi 24 jam terakhir dan memicu Gemini 1.5 Pro untuk menulis narasi briefing CFO Bahasa Indonesia ke tabel `ai_run`.
*   **Dependencies (Ketergantungan):** TSK-008.
*   **Test Notes (Catatan Pengujian):**
    *   *Command:* `curl -X POST -H "Authorization: Bearer local-cron-token" http://localhost:3000/api/cron/daily-briefing`
    *   *Outcome:* Response sukses (status 200 OK) dan entri briefing finansial baru tersimpan di tabel `ai_run` dengan format JSON yang sesuai.

---

### TSK-010: App Shell & iOS 26 Solid UI Core Components
*   **Goal (Tujuan):** Membangun layout kerangka kerja antarmuka (*App Shell*) dengan navigasi bawah yang menetap (*sticky bottom nav*) dan mendesain elemen-elemen UI dasar bebas dari filter CSS blur sesuai spesifikasi iOS 26 Solid.
*   **Files likely touched (File yang tersentuh):**
    *   `/app/layout.tsx`
    *   `/components/ui/bottom-nav.tsx`
    *   `/components/ui/card.tsx`
    *   `/components/ui/badge.tsx`
*   **Acceptance Criteria (Kriteria Penerimaan):**
    *   Bottom Nav Bar memiliki tinggi tetap 64px, berada di atas safe area mobile, dengan touch target area tap per tab minimal **48x48px**.
    *   Seluruh kartu UI menggunakan latar belakang solid (`color-bg-surface` atau `color-bg-elevated`) dengan border mikro 1px solid (`color-border`) dan drop-shadow tipis. Beban rendering GPU dioptimalkan dengan zero CSS backdrop-blur.
    *   Lencana status (*status badges*) menerapkan warna teks pekat dengan opacity latar belakang redup sebesar 15% (contoh: status PAID memiliki teks emerald green dan background emerald dengan opacity 15%).
*   **Dependencies (Ketergantungan):** TSK-001.
*   **Test Notes (Catatan Pengujian):**
    *   *Command:* Kompilasi proyek dengan `bun run build`, jalankan server lokal `bun run dev`, lalu gunakan browser devtools mobile emulator untuk memeriksa elemen CSS.
    *   *Outcome:* Bounding box sentuh Bottom Nav bernilai $\ge$ 48px, dan badge status memuat properti `color` pekat dan `background-color` dengan nilai alfa opacity `0.15` (misal HSL atau RGBA).

---

### TSK-011: UI Form Pengeluaran Lapangan & Integrasi OCR PM
*   **Goal (Tujuan):** Membuat halaman input pengeluaran lapangan PM ramah satu tangan dilengkapi kamera trigger, ImageKit upload CDN, dan status pemrosesan OCR asinkron.
*   **Files likely touched (File yang tersentuh):**
    *   `/app/expense/new/page.tsx`
    *   `/components/expense/expense-form.tsx`
    *   `/app/actions/media/sign-imagekit.ts`
*   **Acceptance Criteria (Kriteria Penerimaan):**
    *   Formulir diposisikan di tengah bawah viewport mobile untuk memudahkan pengisian satu tangan. Tombol mengambang aksi simpan berukuran **56x56px**.
    *   Mengintegrasikan unggahan foto nota ke ImageKit CDN menggunakan tanda tangan URL aman dari server.
    *   Saat foto berhasil diunggah, memicu Server Action `processReceipt` dan menampilkan skeleton shimmer loader pada kolom input biaya, deskripsi, dan nama toko. Kolom terisi otomatis setelah parser Gemini selesai merespon.
*   **Dependencies (Ketergantungan):** TSK-009, TSK-010.
*   **Test Notes (Catatan Pengujian):**
    *   *Command:* `bun test scratch/test-ocr-form-integration.ts`
    *   *Outcome:* Skrip pengujian memicu form simulator, mengaktifkan skeleton loader saat proses OCR berjalan, dan sukses mengisi nilai nominal Rp 720.000 secara otomatis setelah data dari model Gemini kembali.

---

### TSK-012: UI Layar Persetujuan Owner & Dasbor CFO
*   **Goal (Tujuan):** Membangun layar utama dasbor keuangan CFO Owner untuk monitoring kesehatan saldo kas bank (swipeable grid), feed peringatan dini overrun, log audit terbaru, dan layar approval bertingkat.
*   **Files likely touched (File yang tersentuh):**
    *   `/app/dashboard/page.tsx`
    *   `/app/approvals/page.tsx`
    *   `/components/dashboard/bank-grid.tsx`
    *   `/components/approvals/approval-list.tsx`
*   **Acceptance Criteria (Kriteria Penerimaan):**
    *   Kartu rekening bank disajikan dalam grid horizontal yang dapat digeser (*swipeable*) dengan representasi saldo BCA/Mandiri menggunakan format Rupiah dengan font tabular numbers (`font-variant-numeric: tabular-nums`).
    *   Menampilkan ringkasan teks naratif CFO briefing harian dari tabel `ai_run` di bagian atas dasbor.
    *   Layar approvals menampilkan antrean biaya di atas 5M atau budget overrun, dengan detail komparatif plafon RAB vs realisasi, tombol quick action setujui/tolak berukuran **52x52px**, dan gesture geser untuk approve/reject.
*   **Dependencies (Ketergantungan):** TSK-010, TSK-011.
*   **Test Notes (Catatan Pengujian):**
    *   *Command:* `bun test scratch/test-owner-dashboard-flow.ts`
    *   *Outcome:* Menyuplai gesture swipe kanan memicu `approveFieldRequest` / `payFieldRequest`, merubah status `project_cost` menjadi `APPROVED` atau `PAID` secara instan, memotong saldo kas bank BCA Operational, dan mencatat histori log audit baru.
