# Rencana Implementasi: TSK-004 Halaman Login & Autentikasi Pengguna

Rencana ini menjelaskan implementasi Halaman Login `/login` untuk sistem autentikasi Better Auth di Atria ERP. Halaman ini dirancang menggunakan standar estetika iOS 26 Solid (kontras tinggi, tanpa liquid glass/blur, touch target $\ge$ 48px).

---

## User Review Required

> [!IMPORTANT]
> **Kredensial Default Uji Coba:**
> Akun pengguna hasil seeding (seperti `ronald@dekoria.com`, `lisa@dekoria.com`, `budi@dekoria.com`) kini telah dikonfigurasi dengan kata sandi default `"password123"` di dalam database lewat skrip seeder `scratch/seed-accounts.ts`.

---

## Proposed Changes

### Komponen: Rute & Halaman Login (Authentication Module)

#### [NEW] [page.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/login/page.tsx)

- Membuat rute `/login` yang bertindak sebagai gerbang masuk pengguna.
- Menyediakan form login client-side (`"use client"`) dengan input Email dan Password.
- Touch target area tap (tombol & input) diatur berukuran minimal **48px** untuk ramah penggunaan mobile satu tangan.
- Mengintegrasikan login credentials menggunakan `authClient.signIn.email({ email, password })`.
- Menyertakan feedback error visual yang kontras ketika login gagal (misal: kredensial salah, error jaringan).
- Menampilkan state loading (spinners/disabled) untuk menghindari submit berulang.
- Redirect ke halaman utama `/` setelah autentikasi berhasil.

---

## Verification Plan

### Manual Verification

1. Jalankan server dev (`bun run dev`).
2. Akses halaman `/ledger` atau `/projects` tanpa login. Sistem harus mengarahkan (redirect 302) secara otomatis ke `/login`.
3. Coba lakukan login menggunakan kredensial salah (misal: `test@salah.com` / `password`). Pastikan muncul pesan error yang jelas dan mudah dibaca.
4. Lakukan login menggunakan kredensial yang valid (misal: `ronald@dekoria.com` dengan password `password123`).
5. Pastikan login sukses dan pengguna dialihkan ke halaman utama `/` atau dasbor ledger.
