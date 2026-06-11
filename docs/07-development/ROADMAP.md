# Development Roadmap - Atria ERP

Dokumen ini memaparkan peta jalan pengembangan (*development roadmap*) Atria ERP dari **Phase 0** hingga **Phase 8**. Peta jalan ini dirancang secara berurutan untuk memastikan sistem berjalan dengan prinsip **finance-first** di setiap tahap pengembangannya. Semua penjelasan produk disajikan dalam Bahasa Indonesia, sementara istilah teknis tetap menggunakan bahasa Inggris (*English*) untuk menjaga keakuratan implementasi.

---

## Ringkasan Fase Peta Jalan (Roadmap Summary)

```mermaid
gantt
    title Peta Jalan Pengembangan Atria ERP
    dateFormat  YYYY-MM-DD
    section Backend & Core
    Phase 0: Environment Setup         :a0, 2026-06-11, 3d
    Phase 1: DB Schema & Drizzle       :a1, after a0, 5d
    Phase 2: Auth, RBAC & Middleware   :a2, after a1, 5d
    Phase 3: Core Ledger & Bank Mut    :a3, after a2, 7d
    Phase 4: Budget & Cost Scoping     :a4, after a3, 7d
    Phase 5: Field Claims & Approvals  :a5, after a4, 8d
    section AI & Integrations
    Phase 6: Gemini AI OCR Pipeline    :a6, after a5, 6d
    section UI/UX Layer
    Phase 7: iOS 26 Solid UI Components:a7, after a6, 10d
    section Verification
    Phase 8: Audit & Prod Release      :a8, after a7, 5d
```

---

## Detil Fase Pengembangan (Phased Development Details)

### Phase 0: Project Initialization & Environment Setup (Inisialisasi Proyek & Pengaturan Lingkungan)
Fase awal untuk membangun fondasi repositori, konfigurasi proyek, dan standardisasi kode agar pengembangan berjalan lancar tanpa hambatan di kemudian hari.

*   **Objektif Utama:**
    *   Menyiapkan repositori kode (*code repository*) dengan Bun runtime environment dan Next.js App Router.
    *   Menetapkan aturan ketat TypeScript dan ESLint untuk menolak penggunaan tipe `any`.
    *   Mengonfigurasi struktur folder standar proyek untuk menampung validasi skema Zod dan Server Actions.
*   **Fitur & Deliverables Utama:**
    *   File konfigurasi proyek: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `.gitignore`.
    *   Struktur direktori: `/db`, `/app/actions`, `/lib/validations`, `/components/ui`.
    *   Definisi file tipe respons global `ActionResponse<T>` di `lib/types/action-response.ts`.
*   **Fokus Finance-First:**
    *   Menyediakan kerangka kerja validasi data masukan (*input validation*) sejak awal di tingkat Server Actions menggunakan format `ActionResponse` guna mencegah kegagalan data transaksional yang berantakan.
*   **Milestone & Tolok Ukur Keberhasilan:**
    *   Proyek dapat dikompilasi dengan sukses (`bun run build`) tanpa kesalahan linting atau ketidakcocokan tipe data TypeScript.

---

### Phase 1: Database Layer & Drizzle ORM Schema Setup (Desain Skema Database & Drizzle ORM)
Membangun struktur data relasional PostgreSQL (Neon) yang aman, terdokumentasi, dan dioptimalkan dengan indeks pencarian cepat.

*   **Objektif Utama:**
    *   Menulis skema Drizzle ORM untuk 20 tabel inti keuangan sesuai dengan dokumen `DATABASE_SCHEMA.md`.
    *   Menegakkan integritas data dengan foreign key constraints menggunakan aturan `onDelete: "restrict"` pada tabel relasi mutasi kas.
    *   Mengonfigurasi skema database branching Neon yang terintegrasi dengan GitHub Actions.
*   **Fitur & Deliverables Utama:**
    *   Definisi skema Drizzle di `/db/schema.ts` dan ekspor instance koneksi database di `/db/index.ts`.
    *   Script migrasi database menggunakan `drizzle-kit generate` dan `drizzle-kit migrate`.
    *   Script seed data awal di `/db/seed.ts` untuk mengisi peran master (`role`), kategori biaya (`project_cost_category`), dan data rekening bank awal (`bank_account`).
*   **Fokus Finance-First:**
    *   Menerapkan constraint relational yang ketat untuk mencegah terhapusnya transaksi historis secara sengaja atau tidak sengaja (menerapkan `restrict` di seluruh foreign key utama).
*   **Milestone & Tolok Ukur Keberhasilan:**
    *   Migrasi database berhasil dijalankan di Neon PostgreSQL local dan production, serta data seeding terisi lengkap tanpa kegagalan constraint.

---

### Phase 2: Authentication, Authorization (RBAC) & Route Protection (Autentikasi, Otorisasi (RBAC) & Proteksi Rute)
Mengamankan seluruh akses aplikasi dengan membatasi tindakan operasional berdasarkan peran pengguna yang terverifikasi.

*   **Objektif Utama:**
    *   Mengintegrasikan Better Auth dengan PostgreSQL adapter untuk manajemen sesi pengguna di sisi server.
    *   Menerapkan helper otorisasi `assertPermission` pada Server Actions untuk melakukan validasi peran (*role checks*).
    *   Membangun Route Middleware untuk mencegah pemuatan halaman sensitif oleh pengguna yang tidak berhak.
*   **Fitur & Deliverables Utama:**
    *   Konfigurasi Better Auth server di `lib/auth.ts` dan client instance di `lib/auth-client.ts`.
    *   Helper otorisasi `/lib/auth/permissions.ts` berisi daftar pemetaan izin 7 peran sistem.
    *   Next.js Middleware `middleware.ts` untuk proteksi rute halaman `/dashboard/ledger`, `/dashboard/settings/*`, dan `/login`.
*   **Fokus Finance-First:**
    *   Pembacaan sesi (*session reading*) wajib dieksekusi langsung di server-side guna menghindari manipulasi ID pengguna dari browser client saat memicu mutasi keuangan.
*   **Milestone & Tolok Ukur Keberhasilan:**
    *   Pengujian pengalihan rute (*route redirects*) berjalan 100% (pengguna tanpa login terlempar ke `/login`, PM yang mencoba membuka `/dashboard/ledger` diblokir dan dialihkan ke `/unauthorized`).

---

### Phase 3: Core Ledger & Bank Account Mutations (Buku Besar Utama & Mutasi Rekening Kas/Bank)
Membangun jantung dari sistem pencatatan keuangan internal yang menjamin akurasi mutasi kas perusahaan.

*   **Objektif Utama:**
    *   Mengimplementasikan model mutasi kas **Option A (Transaction Block Model)** di dalam satu transaksi database (`db.transaction`).
    *   Mencegah *race condition* pada pembaruan saldo rekening bank menggunakan Pessimistic Locking (`.for('update')`).
    *   Menyusun Server Action untuk pencatatan kas masuk termin klien (`recordClientPayment`) dan dasbor statistik finansial global (`getDashboardStats`).
*   **Fitur & Deliverables Utama:**
    *   Fungsi internal helper `mutateBalance` di `/lib/finance/balance-mutation.ts` yang menangani locking, verifikasi saldo kas keluar, update rekening, dan audit logs.
    *   Server Action `/app/actions/finance/record-client-payment.ts` dan `/app/actions/finance/get-dashboard-stats.ts`.
    *   Penerapan aturan immutable ledger: transaksi dengan flag `reconciled = true` dikunci dari modifikasi (update/delete).
*   **Fokus Finance-First:**
    *   Menjamin rumus matematis balance-check berjalan sempurna:
        $$\text{New Balance} = \text{Old Balance} \pm \text{Transaction Amount}$$
        Dan melakukan rollback transaksi penuh jika ada satu langkah penulisan yang gagal.
*   **Milestone & Tolok Ukur Keberhasilan:**
    *   Pengujian konkuren (*concurrent transaction test*) berhasil membuktikan bahwa dua request penarikan kas serentak tidak merusak perhitungan sisa saldo rekening.

---

### Phase 4: Project Budgeting, Scoping & RAB Management (Penganggaran Proyek, Pembatasan Akses PM & Manajemen RAB)
Mengaitkan mutasi finansial dengan proyek riil serta menjaga kerahasiaan data margin antar manajer proyek.

*   **Objektif Utama:**
    *   Mengembangkan fitur penyusunan Rencana Anggaran Biaya (RAB) per proyek berdasarkan kategori biaya (`project_budget_item`).
    *   Menegakkan aturan Strict Project Scoping agar PM hanya dapat mengakses data proyek yang ditugaskan kepada mereka.
    *   Menyusun Server Action `createBudgetItem` yang terkunci statusnya jika anggaran proyek telah disetujui (`APPROVED`).
*   **Fitur & Deliverables Utama:**
    *   Server Action `/app/actions/project/create-budget-item.ts` dengan scoping penugasan PM.
    *   Fungsi scoping query `/lib/auth/scoping.ts` untuk menyaring data proyek berdasarkan hak akses user session.
    *   Siklus perubahan status anggaran (`project_budget` state transition: `DRAFT` -> `PENDING_APPROVAL` -> `APPROVED` -> `REJECTED`).
*   **Fokus Finance-First:**
    *   PM dibatasi untuk tidak dapat merubah alokasi anggaran proyek ketika statusnya sudah beralih dari draf, guna mencegah perubahan target anggaran di luar sepengetahuan Owner.
*   **Milestone & Tolok Ukur Keberhasilan:**
    *   Query database PM terbukti hanya mengembalikan data proyek di mana user ID mereka tercatat sebagai `projectManagerId`. Request ke ID proyek lain mengembalikan respon `FORBIDDEN`.

---

### Phase 5: Field Expense Claims, Approvals & Disbursement Flow (Pengajuan Dana Lapangan, Alur Approval & Pembayaran)
Membangun birokrasi digital untuk pengeluaran uang kas lapangan dan pelunasan tagihan suplier material.

*   **Objektif Utama:**
    *   Mengimplementasikan alur verifikasi bertingkat untuk biaya lapangan (`project_cost`) dan tagihan vendor (`vendor_bill`).
    *   Menegakkan batasan nominal persetujuan (pembayaran $\ge$ Rp 5.000.000 wajib disetujui Owner).
    *   Mendeteksi pembengkakan biaya (*budget overrun*) secara real-time dan memblokir pencairan dana secara otomatis sebelum ada override approval dari Owner.
*   **Fitur & Deliverables Utama:**
    *   Server Action `/app/actions/finance/submit-vendor-bill.ts`, `scheduleVendorBillPayment`, dan `payVendorBill`.
    *   Logika verifikasi *budget overrun* pada penulisan `actual_spent` di item anggaran proyek.
    *   Pemicu notifikasi status peringatan finansial (`notification` creation: `WARNING` atau `CRITICAL` berdasarkan persentase pemakaian budget).
*   **Fokus Finance-First:**
    *   Mencegah pengeluaran liar di lapangan dengan validasi budget ceiling secara real-time pada setiap input pengajuan PM.
*   **Milestone & Tolok Ukur Keberhasilan:**
    *   Pengajuan di atas Rp 5.000.000 atau status `budget_overrun = true` sukses terblokir dalam antrean `PENDING` dan hanya dapat diproses setelah record `approval` disisipkan oleh Owner.

---

### Phase 6: Multimodal OCR Receipt Processing & Gemini AI Pipeline (Pemrosesan Nota OCR Multimodal & Pipa Gemini AI)
Menyediakan fitur otomatisasi pintar untuk menghemat waktu input PM lapangan dan menyajikan taklimat CFO harian bagi Owner.

*   **Objektif Utama:**
    *   Membangun pipeline tanda tangan unggah berkas langsung (*direct signed URL upload*) dari client ke ImageKit CDN.
    *   Mengintegrasikan Google Gen AI SDK untuk membaca gambar nota belanja dan mengekstraksi data ke format JSON secara terstruktur.
    *   Menyusun pipa terjadwal (*scheduled cron job*) untuk pengumpulan data agregasi keuangan harian dan pemicu prompt Gemini untuk financial briefing.
*   **Fitur & Deliverables Utama:**
    *   Server Action penandatanganan unggah ImageKit di `/app/actions/media/sign-imagekit.ts`.
    *   Pipeline parser Gemini OCR dengan parameter `responseMimeType: "application/json"` dan `responseSchema` OpenAPI di `/lib/ai/gemini.ts`.
    *   Endpoint Cron Job `/app/api/cron/daily-briefing/route.ts` untuk pembuatan draf laporan CFO harian.
*   **Fokus Finance-First:**
    *   Menerapkan aturan **AI Read-Only**: hasil parsing AI diposisikan sebagai proposal draf read-only yang membutuhkan review dan persetujuan eksplisit manusia (*human-in-the-loop*) sebelum dicatat ke ledger kas.
*   **Milestone & Tolok Ukur Keberhasilan:**
    *   Gemini API berhasil mengekstrak nominal kuitansi secara konsisten dalam bentuk string JSON bersih dan tervalidasi oleh skema parser Zod tanpa ada kegagalan format token.

---

### Phase 7: Mobile-First iOS 26 Solid UI Components & Views (Antarmuka iOS 26 Solid & Tampilan Seluler)
Mengembangkan antarmuka visual premium yang responsif, andal di lapangan, dan konsisten dengan tata letak iOS.

*   **Objektif Utama:**
    *   Menghindari penggunaan efek CSS blur (`backdrop-blur`) yang berat demi kestabilan rendering WebView pada kecepatan 60fps di ponsel lapangan.
    *   Mengatur kelengkungan sudut standar (`rounded-lg` 8px, `rounded-2xl` 16px, `rounded-t-3xl` 24px) dan area tap sentuh minimal **48x48px**.
    *   Menerapkan format tabular numbers pada penyajian angka uang Rupiah untuk ketepatan audit visual.
*   **Fitur & Deliverables Utama:**
    *   App Shell Layout dengan sticky bottom navigation bar setinggi 64px.
    *   Dashboard Keuangan (kartu rekening BCA/Mandiri swipeable, feed notifikasi, dan riwayat audit log).
    *   Layar input pengeluaran PM ramah satu tangan dilengkapi skeleton shimmer loader saat Gemini memproses nota.
    *   Layar persetujuan Owner dengan tombol quick actions dan gesture geser (*swipe gesture*).
    *   Sidebar Navigation responsive untuk layar desktop/tablet.
*   **Fokus Finance-First:**
    *   Menyajikan visualisasi status warning anggaran (90% amber) dan critical (100% merah) secara kontras tinggi agar PM tidak kecolongan budget di tengah lokasi proyek.
*   **Milestone & Tolok Ukur Keberhasilan:**
    *   Pemuatan halaman dashboard utama di jaringan seluler 4G di bawah **2.5 detik**. Ukuran touch target tombol actions diverifikasi di browser inspector tepat $\ge$ 48px.

---

### Phase 8: End-to-End Financial Auditing, Testing & Production Release (Audit Keuangan End-to-End, Pengujian & Rilis Produksi)
Fase akhir untuk menguji keandalan sistem terhadap kegagalan transaksi, celah keamanan, dan verifikasi akhir sebelum deployment.

*   **Objektif Utama:**
    *   Melakukan audit kode codebase menyeluruh untuk memastikan 0% query raw SQL digunakan.
    *   Menjalankan integration tests terhadap seluruh alur mutasi kas (happy path & fail cases).
    *   Melakukan load testing untuk verifikasi performa serverless functions Next.js saat menampung concurrent requests.
*   **Fitur & Deliverables Utama:**
    *   File laporan pengujian integrasi finansial.
    *   Konfigurasi pipeline GitHub Actions untuk deployment otomatis ke Vercel production.
    *   Pencatatan log audit final untuk pengujian serah terima aplikasi.
*   **Fokus Finance-First:**
    *   Memastikan tidak ada celah pembocoran saldo kas, balance checking mismatch, atau status transaksi reconciled yang bisa dimodifikasi.
*   **Milestone & Tolok Ukur Keberhasilan:**
    *   Selisih nominal saldo antara buku besar sistem (`cash_transaction`) dan rekening bank riil setelah serangkaian uji coba mutasi bernilai tepat **0%**.
