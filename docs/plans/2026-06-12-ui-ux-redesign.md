# Rencana Implementasi: Redesign UI/UX Premium Seluler (iOS 26 Solid)

Rencana ini menjelaskan perombakan total UI/UX Atria ERP agar benar-benar menyerupai aplikasi mobile premium (iOS WebView) dengan pembungkus bingkai perangkat (_device mockup chassis_) di desktop, simulasi status bar, home indicator, serta tipografi premium Outfit & Inter.

---

## User Review Required

> [!IMPORTANT]
> **Penerapan Bingkai Perangkat (Device Chassis Mockup):**
> Pada layar lebar (desktop), aplikasi akan ditampilkan di dalam bingkai iPhone 15 Pro yang realistis (dengan Dynamic Island, bezel lengkung, status bar aktif, dan home indicator). Pada layar ponsel asli, bingkai ini akan menghilang secara responsif sehingga aplikasi memenuhi 100% tinggi layar secara native.

---

## Proposed Changes

### Komponen: Kerangka App Shell (Layout & Navigation Module)

#### [MODIFY] [layout.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/layout.tsx)

- Mengganti font Geist dengan **Inter** (untuk body, form, & list) dan **Outfit** (untuk judul besar & angka finansial) dari Google Fonts.
- Memasang CSS class variabel font pada tag `html`.

#### [MODIFY] [globals.css](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/globals.css)

- Menghubungkan variabel `@theme` Tailwind v4 ke `--font-inter` dan `--font-outfit`.
- Menambahkan helper class `.financial-amount` untuk tabular numbers (`font-variant-numeric: tabular-nums`).
- Menambahkan custom global reset scrollbar agar aplikasi terkesan bersih dari scrollbar bawaan browser.

#### [MODIFY] [mobile-shell.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/layout/mobile-shell.tsx)

- Membungkus konten utama di dalam visualisasi chassis mobile di layar desktop.
- Menambahkan status bar iOS di bagian atas (Waktu: 09:41, sinyal seluler, WiFi, persentase baterai).
- Menambahkan Dynamic Island di bagian atas (hanya tampil di desktop).
- Menambahkan iOS Home Indicator di bagian bawah tab bar.

#### [MODIFY] [bottom-nav.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/layout/bottom-nav.tsx)

- Memperindah visual tab bar: tombol aktif memiliki background pill membulat dengan warna HSL indigo redup, ikon lebih tebal, dan teks lebih kontras.
- Menyesuaikan margin bawah agar serasi dengan visual Home Indicator.

---

### Komponen: Desain Halaman Utama (Views Module)

#### [MODIFY] [page.tsx (Login)](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/login/page.tsx)

- Mengatur tata letak agar form login tampak mengambang di tengah layar mobile, dengan logo Atria ERP berpendar solid.

#### [MODIFY] [page.tsx (Ledger/CFO Dashboard)](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/ledger/page.tsx)

- Mendesain ulang kartu saldo bank horizontal agar memiliki visual yang memukau (warna pekat solid dengan kontras teks tebal).
- Merancang stream ledger kas menjadi list rows bergaya iOS (lingkaran ikon status, deskripsi transaksi, dan nominal Rupiah tabular numbers).

#### [MODIFY] [page.tsx (Projects)](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/projects/page.tsx)

- Mengubah tampilan kartu proyek dengan progress alokasi anggaran visual melingkar/horizontal, badge kontras, dan tap feedback.

#### [MODIFY] [page.tsx (Project Detail)](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/projects/%5Bid%5D/page.tsx)

- Menampilkan ringkasan BoQ dengan progress bar berwarna dinamis (biru untuk aman, amber $\ge 90\%$, merah $\ge 100\%$ untuk overrun).

#### [MODIFY] [page.tsx (Approvals)](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/approvals/page.tsx)

- Mempercantik antrean persetujuan dengan kartu tindakan solid, review nota belanja yang tajam, dan tombol aksi 52x52px yang sangat responsif.

#### [MODIFY] [page.tsx (Profile)](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/profile/page.tsx)

- Merapikan kartu sesi pengguna, menata daftar izin RBAC menjadi list rows vertikal teratur dengan pemisah tipis.

---

## Verification Plan

### Manual Verification

1. Buka browser di desktop: pastikan aplikasi terbungkus di dalam mockup ponsel iPhone dengan Dynamic Island dan Status Bar di atas.
2. Simulasikan viewport ponsel: pastikan frame mockup menghilang dan aplikasi menyesuaikan penuh ke seluruh layar.
3. Periksa tipografi: pastikan angka nominal kas BCA/Mandiri menggunakan Outfit font dengan format tabular numbers (sejajar vertikal).
4. Verifikasi seluruh navigasi bawah: pastikan transisi lancar dan navigasi tersembunyi pada halaman `/login`.
