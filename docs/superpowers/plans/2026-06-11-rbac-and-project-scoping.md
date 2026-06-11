# Rencana Implementasi: TSK-005 Penegakan Keamanan RBAC & Scoping Proyek

Rencana ini memaparkan langkah-langkah detail untuk merancang dan mengimplementasikan modul otorisasi berbasis peran (*Role-Based Access Control* / RBAC) serta mekanisme pembatasan data (*data scoping*) proyek pada tingkat query database untuk memastikan Project Manager (PM) dan desainer hanya dapat berinteraksi dengan data proyek yang ditugaskan secara eksplisit kepada mereka.

---

## User Review Required

> [!IMPORTANT]
> **Pencocokan Peran melalui `roleId` Better Auth:**
> Di dalam Next.js Server Actions dan API endpoints, sesi pengguna diperoleh melalui Better Auth yang hanya menyimpan `roleId` (UUID) pada tabel/objek `user`. Oleh karena itu, helper keamanan akan memetakan `roleId` secara statis ke nama peran (`owner`, `finance_admin`, `project_manager`) demi performa (tanpa kueri database tambahan). Jika `roleId` tidak ditemukan di dalam pemetaan statis, sistem akan melakukan kueri fallback ke tabel `role`.

> [!WARNING]
> **Scoping Proyek pada Server Actions:**
> Seluruh Server Actions yang menyentuh data anggaran (`project_budget`), pengeluaran lapangan (`project_cost`), tagihan vendor (`vendor_bill`), dan termin invoice (`client_invoice`) wajib memanggil helper `assertProjectAccess` untuk memvalidasi kepemilikan/penugasan proyek guna mencegah kebocoran margin finansial antar PM.

---

## Proposed Changes

### Komponen: Keamanan & Otorisasi (Security & Auth)

#### [NEW] [permissions.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/lib/auth/permissions.ts)
*   Mendefinisikan tipe data `PermissionKey` yang mencakup seluruh izin finansial sesuai dengan matriks keamanan:
    *   `manage:bank_account`
    *   `reconcile:ledger`
    *   `approve:budget`
    *   `create:budget`
    *   `request:cost`
    *   `approve:cost`
    *   `pay:cost`
    *   `create:vendor_bill`
    *   `pay:vendor_bill`
    *   `create:client_invoice`
    *   `view:profitability`
*   Menyusun pemetaan hak akses `ROLE_PERMISSIONS` untuk setiap peran.
*   Menyediakan fungsi pemetaan `ROLE_ID_TO_NAME` untuk mengonversi UUID peran (seperti `00000000-0000-0000-0000-000000000001` ke `"OWNER"`).
*   Menyediakan fungsi helper `assertPermission(user: { id: string; roleId: string }, permission: PermissionKey)` yang mengecek hak akses secara sinkron (atau asinkron dengan fallback database kueri jika peran tidak terdaftar) dan melemparkan kesalahan `FORBIDDEN` jika pengguna tidak memiliki izin.

#### [NEW] [scoping.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/lib/auth/scoping.ts)
*   Menyediakan fungsi `scopeProjectQuery(userId: string, roleName: string)` yang mengembalikan kondisi filter Drizzle ORM (kondisi kueri `eq(project.projectManagerId, userId)` jika peran PM, atau `undefined` jika peran OWNER/Admin) untuk membatasi pemuatan daftar proyek.
*   Menyediakan fungsi helper `assertProjectAccess(projectId: string, userId: string, roleName: string)` untuk memverifikasi apakah PM memiliki penugasan aktif pada `projectId` tertentu. Fungsi ini akan melempar error `UNAUTHORIZED` jika akses ditolak.

#### [NEW] [permissions.test.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/lib/auth/permissions.test.ts)
*   Membuat unit test terisolasi menggunakan Bun Test untuk memastikan:
    1.  `OWNER` dan `FINANCE_ADMIN` mendapatkan akses yang sesuai.
    2.  `PROJECT_MANAGER` ditolak saat mengakses ledger (`reconcile:ledger`) atau menyetujui anggaran (`approve:budget`).
    3.  `assertPermission` melempar error secara konsisten ketika hak akses tidak terpenuhi.
    4.  Fungsi scoping menghasilkan filter query yang tepat.

---

## Verification Plan

### Automated Tests
*   Menjalankan unit test menggunakan Bun Test runner:
    `bun test lib/auth/permissions.test.ts`
    *Outcome:* Semua pengujian unit berhasil lolos 100%.
*   Kompilasi TypeScript dan build Next.js:
    `bun run build`
    *Outcome:* Proyek berhasil dikompilasi tanpa adanya tipe error.

### Manual Verification
*   Verifikasi database seeding: memastikan role default (`owner`, `finance_admin`, `project_manager`) dan user seed default sudah masuk ke database dengan UUID yang tepat.
