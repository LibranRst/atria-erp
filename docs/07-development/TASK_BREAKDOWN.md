# Task Breakdown - Atria ERP

Dokumen ini memecah seluruh siklus pengembangan Atria ERP menjadi **12 tugas atomik & konkret** (TSK-001 hingga TSK-012) yang siap dikerjakan oleh AI coding agents. Penjelasan produk disajikan dalam Bahasa Indonesia, sementara istilah teknis menggunakan English untuk presisi penulisan kode.

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
| **TSK-007** | Server Action Pembayaran Klien & Dasbor Stats | recordClientPayment & getDashboardStats | TSK-006 |
| **TSK-008** | Server Actions Pengelolaan Tagihan & Pembayaran Vendor | submitVendorBill, schedule & pay actions | TSK-007 |
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
    *   Mengisi tabel `bank_account` dengan rekening awal BCA Operational, Mandiri Project, dan Petty Cash Office lengkap dengan saldo saldo awal di atas Rp 10.000.000,00.
*   **Dependencies (Ketergantungan):** TSK-002.
*   **Test Notes (Catatan Pengujian):**
    *   *Command:* `bun run db/seed` (atau command yang dipetakan di package.json)
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
    *   *Command:* Jalankan server dev (`bun run dev`) dan lakukan HTTP request mock ke `/dashboard/ledger` menggunakan curl tanpa menyertakan auth cookies.
    *   *Outcome:* Server mengembalikan redirect 302 ke rute `/login`.

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
    *   *Command:* Jalankan unit test di `/lib/auth/permissions.test.ts` (menggunakan Bun test).
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
    *   *Command:* Jalankan skrip pengujian integrasi transaksional keuangan di `/scratch/test-transaction-locking.ts`.
    *   *Outcome:* Pengujian menyisipkan mutasi kas secara konkuren dan membuktikan saldo akhir BCA Operational terpotong dengan akurat tanpa adanya race condition atau saldo minus.

---

### TSK-007: Server Action Pembayaran Klien & Dasbor Stats
*   **Goal (Tujuan):** Membuat Next.js Server Actions untuk pencatatan pembayaran invoice klien (`recordClientPayment`) dan pengambilan data statistik dasbor keuangan (`getDashboardStats`).
*   **Files likely touched (File yang tersentuh):**
    *   `/app/actions/finance/record-client-payment.ts`
    *   `/app/actions/finance/get-dashboard-stats.ts`
*   **Acceptance Criteria (Kriteria Penerimaan):**
    *   Kedua Server Actions diawali dengan perintah `"use server"` dan memanggil session check server-side menggunakan Better Auth.
    *   `recordClientPayment` menerima input data tervalidasi menggunakan skema Zod (`recordClientPaymentSchema`).
    *   Menggunakan helper `mutateBalance` untuk menambah saldo bank (`DEBIT`), memperbarui status `client_invoice` menjadi `PAID` atau `PARTIALLY_PAID`, dan mengembalikan response bertipe `ActionResponse`.
*   **Dependencies (Ketergantungan):** TSK-006.
*   **Test Notes (Catatan Pengujian):**
    *   *Command:* Jalankan skrip test di `/scratch/test-dashboard-queries.ts`.
    *   *Outcome:* Response dari `getDashboardStats` mengembalikan objek JSON berisi total saldo kas, total receivables, total payables, dan active projects count dengan struktur format data yang bersih.

---

### TSK-008: Server Actions Pengelolaan Tagihan & Pembayaran Vendor
*   **Goal (Tujuan):** Mengembangkan 3 Server Actions pendukung transaksi Accounts Payable: menginput tagihan vendor (`submitVendorBill`), menjadwalkan pembayaran (`scheduleVendorBillPayment`), dan mencatat realisasi transfer dana keluar (`payVendorBill`).
*   **Files likely touched (File yang tersentuh):**
    *   `/app/actions/finance/submit-vendor-bill.ts`
    *   `/app/actions/finance/schedule-vendor-bill.ts`
    *   `/app/actions/finance/pay-vendor-bill.ts`
*   **Acceptance Criteria (Kriteria Penerimaan):**
    *   `submitVendorBill` melakukan scoping check agar PM hanya dapat mencatat tagihan ke proyek milik mereka.
    *   `scheduleVendorBillPayment` membuat record `vendor_payment` dengan status `PENDING`. Jika nominal pembayaran $\ge$ Rp 5.000.000 atau status alokasi anggaran proyek mengalami pembengkakan (`budget_overrun = true`), set flag otorisasi agar memerlukan approval Owner.
    *   `payVendorBill` memanggil helper `mutateBalance` (`CREDIT`), memperbarui actual spent pada `project_budget_item`, serta mengubah status tagihan menjadi `PAID`.
*   **Dependencies (Ketergantungan):** TSK-007.
*   **Test Notes (Catatan Pengujian):**
    *   *Command:* Daftarkan tagihan vendor Rp 6.000.000,00, jadwalkan pembayaran, lalu panggil `payVendorBill` tanpa approval Owner terdaftar di database.
    *   *Outcome:* Server Action mengembalikan error status `FORBIDDEN` dengan deskripsi pembayaran bernilai besar membutuhkan otorisasi Owner.

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
    *   *Command:* Panggil endpoint cron local `/api/cron/daily-briefing` menggunakan API client dengan access header lokal.
    *   *Outcome:* Response sukses dan entri briefing finansial baru tersimpan di tabel `ai_run` dengan format JSON yang sesuai.

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
    *   *Command:* Tampilkan halaman di browser simulator seluler, periksa CSS classes pada badges dan cards via element inspector.
    *   *Outcome:* Badge status memuat properti `color` pekat dan `background-color` dengan nilai alfa opacity `0.15` (HSL atau RGBA).

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
    *   *Command:* Simulasikan pengambilan gambar nota belanja semen pada browser emulator.
    *   *Outcome:* Skeleton loader aktif berkedip saat OCR berjalan, kemudian mengisi nilai nominal Rp 720.000,00 dan deskripsi toko bangunan secara akurat pada form.

---

### TSK-012: UI Layar Persetujuan Owner & Dasbor CFO
*   **Goal (Tujuan):** Membangun layar utama dasbor keuangan CFO Owner untuk monitoring kesehatan saldo kas bank (swipeable grid), feed peringatan dini overrun, log audit terbaru, dan layar approval bertingkat.
*   **Files likely touched (File yang tersentuh):**
    *   `/app/dashboard/page.tsx`
    *   `/app/approvals/page.tsx`
    *   `/components/dashboard/bank-grid.tsx`
    *   `/components/approvals/approval-list.tsx`
*   **Acceptance Criteria (Kriteria Penerimaan):**
    *   Kartu rekening bank disajikan dalam grid horizontal yang dapat digeser (*swipeable*) dengan representasi saldo BCA/Mandiri menggunakan format Rupiah tabular numbers.
    *   Menampilkan ringkasan teks naratif CFO briefing harian dari tabel `ai_run` di bagian atas dasbor.
    *   Layar approvals menampilkan antrean biaya di atas 5M atau budget overrun, dengan detail komparatif plafon RAB vs realisasi, tombol quick action setujui/tolak berukuran **52x52px**, dan gesture geser untuk approve/reject.
*   **Dependencies (Ketergantungan):** TSK-010, TSK-011.
*   **Test Notes (Catatan Pengujian):**
    *   *Command:* Lakukan gesture swipe ke kanan pada salah satu kartu antrean persetujuan klaim operasional di ponsel emulator.
    *   *Outcome:* Status pengajuan berubah seketika di database menjadi `APPROVED`/`PAID`, memicu pemotongan saldo BCA Operational, dan mencatat log mutasi baru pada audit stream.
