# Rencana Implementasi: UI Layar Profil Pengguna & Aksi Logout

Rencana ini menjelaskan implementasi Halaman Profil `/profile` dan tombol Logout yang terintegrasi dengan Better Auth, mematuhi standar estetika iOS 26 Solid (kontras tinggi, touch target $\ge$ 48px, tanpa frosted/liquid glass).

## 2026-07-03 Redesign Polish

Halaman profil akan dipoles agar mengikuti hierarchy halaman Dashboard dan Settings: header ringkas, kartu profil premium, ringkasan session/account, dan akses per modul. Permission tetap transparan, tetapi pengalaman utama berubah dari daftar izin panjang menjadi module access cards dengan detail native `<details>` yang mudah discan. Scope tetap visual/UX; tidak ada perubahan auth, RBAC, schema, route publik, atau flow logout.

---

## User Review Required

> [!NOTE]
> **Tampilan Hak Akses (RBAC Permissions):**
> Halaman ini akan secara dinamis menampilkan daftar kemampuan izin finansial (seperti _menyetujui anggaran_, _merekonsiliasi kas_, dll.) yang dimiliki oleh peran pengguna aktif di sistem, sehingga pengguna memiliki transparansi penuh atas hak akses mereka.

---

## Proposed Changes

### Komponen: Modul Profil Pengguna (Profile Module)

#### [MODIFY] [page.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/profile/page.tsx)

- Mengubah halaman `/profile` menjadi Server Component dinamis yang memuat data sesi aktif menggunakan `auth.api.getSession`.
- Jika pengguna belum masuk, secara otomatis akan dialihkan ke `/login`.
- Menampilkan kartu informasi pengguna berisi Nama Lengkap, Email, Peran (Badge warna kontras), dan Status Akun.
- Menampilkan daftar perincian izin finansial (Permission Matrix) yang dimiliki pengguna berdasarkan peran mereka (`ROLE_PERMISSIONS`).
- Menyertakan tombol Logout (Client Component) untuk membersihkan sesi secara aman.

#### [NEW] [logout-button.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/profile/logout-button.tsx)

- Membuat tombol Logout client-side dengan ikon dan ukuran sentuh **48px**.
- Memicu pembersihan cookie sesi lewat `authClient.signOut()`.
- Mengalihkan pengguna kembali ke `/login` setelah keluar berhasil.
- Menampilkan status loading saat proses pembersihan sesi berlangsung.

---

## Verification Plan

### Manual Verification

1. Jalankan server dev (`bun run dev`).
2. Masuk menggunakan akun `ronald@dekoria.com` (Owner) dan buka halaman `/profile`. Pastikan nama, email, badge peran "OWNER" berwarna sukses/indigo, dan semua matriks izin tampil penuh.
3. Ketuk tombol **Keluar Sistem**. Pastikan Anda keluar dan dialihkan kembali ke `/login`.
4. Masuk menggunakan akun `budi@dekoria.com` (PM) dan buka `/profile`. Pastikan hanya daftar izin yang relevan dengan Project Manager yang tampil (tidak ada izin kelola akun bank, persetujuan biaya besar, dll).
