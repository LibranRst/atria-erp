# Implementation Plan: TSK-004 Better Auth & Middleware Proteksi Rute

Rencana implementasi ini menjelaskan langkah-langkah untuk memasang Better Auth, menambahkan skema tabel sesi/akun/verifikasi yang dibutuhkan Better Auth ke Drizzle ORM, membuat konfigurasi client-server Better Auth, menyiapkan Route Handler catch-all, serta menyusun Next.js Middleware untuk memproteksi rute halaman keuangan sesuai dengan matriks hak akses.

---

## User Review Required

> [!IMPORTANT]
> **Skema Tabel Otentikasi Baru:** TSK-004 membutuhkan penambahan tiga tabel baru pada skema database (`session`, `account`, dan `verification`) yang secara otomatis dibaca oleh Better Auth adapter Drizzle. Tabel ini mereferensikan tabel `user` dengan aturan `onDelete: "cascade"`.

> [!WARNING]
> **Proteksi Middleware di Sisi Server (Edge Runtime):** Sesi pengguna akan diverifikasi secara langsung menggunakan header HTTP via Better Auth `auth.api.getSession` (bukan data client-side) untuk mencegah pemalsuan identitas PM lapangan atau akses liar ke buku besar keuangan (`/ledger`).

---

## Proposed Changes

### 1. Database Schema

#### [MODIFY] [schema.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/db/schema.ts)

Menambahkan tabel pendukung autentikasi Better Auth: `session`, `account`, dan `verification` lengkap dengan relasi dan indeksnya.

### 2. Authentication Configuration

#### [NEW] [auth.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/lib/auth.ts)

Inisialisasi Better Auth server-side adapter menggunakan instance Drizzle.

#### [NEW] [auth-client.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/lib/auth-client.ts)

Inisialisasi helper autentikasi di sisi client.

### 3. Route Handlers & Middleware

#### [NEW] [route.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/api/auth/[...better-auth]/route.ts)

Catch-all endpoint untuk menangani requests autentikasi (login, logout, session, oauth).

#### [NEW] [middleware.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/middleware.ts)

Middleware global Next.js untuk proteksi rute halaman (`/ledger` dikunci hanya untuk `OWNER` / `finance_admin`, rute lain memerlukan login).

---

## Tasks

### Task 1: Install Better Auth Package

- [ ] **Step 1: Install `better-auth`**
      Jalankan perintah: `bun add better-auth`

### Task 2: Update Database Schema

- [ ] **Step 1: Add authentication tables to `db/schema.ts`**
      Tulis definisi tabel `session`, `account`, dan `verification` pada `db/schema.ts`.
- [ ] **Step 2: Add relations**
      Daftarkan relasi Drizzle Relations API untuk mempermudah loading relasi akun/sesi ke user.
- [ ] **Step 3: Generate and Run Migrations**
      Jalankan `bunx drizzle-kit generate` untuk memperbarui berkas migrasi.

### Task 3: Inisialisasi Server & Client Better Auth

- [ ] **Step 1: Create `lib/auth.ts`**
      Tulis berkas `/lib/auth.ts` yang menginisialisasi `betterAuth` dengan adapter `drizzleAdapter` menggunakan instance `db`.
- [ ] **Step 2: Create `lib/auth-client.ts`**
      Tulis berkas `/lib/auth-client.ts` untuk keperluan client components.

### Task 4: Setup Route Handler catch-all (`app/api/auth/[...better-auth]/route.ts`)

- [ ] **Step 1: Create auth catch-all handler**
      Buat berkas `/app/api/auth/[...better-auth]/route.ts` dan hubungkan requests HTTP GET/POST ke `toNextJsHandler(auth)`.

### Task 5: Proteksi Rute Melalui Middleware (`middleware.ts`)

- [ ] **Step 1: Create Next.js Middleware**
      Buat berkas `middleware.ts` pada direktori root.
- [ ] **Step 2: Implement redirection logic**
      Verifikasi sesi menggunakan `auth.api.getSession`. Jika tidak memiliki sesi, redirect ke `/login`. Jika mencoba memuat `/ledger` tetapi perannya bukan `OWNER` atau `finance_admin`, kembalikan redirect ke `/unauthorized`.

---

## Verification Plan

### Automated Tests

- Menjalankan migrasi Drizzle untuk skema Better Auth:
  `bunx drizzle-kit generate`
  _Outcome:_ Migrasi SQL berhasil digenerate di folder `./drizzle`.
- Kompilasi build Next.js:
  `bun run build`
  _Outcome:_ Build sukses tanpa tipe error TypeScript.

### Manual Verification

- Menjalankan server dev lokal: `bun run dev`
- Melakukan curl ke rute proteksi tanpa cookie session:
  `curl -I http://localhost:3000/ledger`
  _Outcome:_ Server mengembalikan status redirect 307 ke `/login`.
