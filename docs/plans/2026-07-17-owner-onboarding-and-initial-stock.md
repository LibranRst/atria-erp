# Owner Onboarding & Saldo Awal Stok — Implementation Plan

Tanggal: 17 Juli 2026

## Outcome

- Owner pada database kosong diarahkan ke onboarding setelah login pertama.
- Progress dapat dijeda dan dilanjutkan tanpa memalsukan status kesiapan data.
- Fondasi setup mencakup default finansial, tim/vendor, rekening, lokasi, Material Master, Library, dan saldo awal stok.
- Istilah user-facing `Opening Inventory`/`cutover` diganti menjadi `Saldo awal stok`; struktur database internal tetap kompatibel.
- Saldo awal stok diajukan untuk approval dan tidak mengubah stok sebelum Finance Admin atau Owner lain menyetujui.

## Execution Order

1. Tambahkan state onboarding tervalidasi di `app_config`, Server Actions, audit, dan redirect fresh-install.
2. Bangun workspace `/onboarding` yang memakai data dan editor Settings existing, mendukung review, skip, pause, resume, dan finish-with-warning.
3. Tambahkan `Kesiapan setup` ke Settings sebagai titik masuk permanen untuk melanjutkan setup dan saldo awal stok.
4. Rework workflow saldo awal stok: copy Bahasa Indonesia, nomor batch server-side, eligibility berbasis movement, manual rows, CSV preview/commit, riwayat view-only, serta redirect route lama.
5. Tambahkan inventory opening ke Approval Center yang difilter berdasarkan permission dan maker-checker.
6. Perbarui guide empty-database, contoh form, dampak data, role handoff, dan warning.

## Safety Invariants

- Semua mutation membaca session server-side dan divalidasi Zod.
- Perubahan saldo kas/stok tetap transactionally atomic dan menulis `audit_log`.
- Preview CSV tidak menulis data; commit mengulang validasi server-side dan rollback seluruh batch jika satu row gagal.
- `PENDING_APPROVAL` tidak mengubah `material_inventory` atau membuat `stock_movement`.
- Inventory dengan saldo, reservation, atau movement terdahulu tidak eligible untuk saldo awal.
- Self-approval ditolak; emergency override hanya Owner dengan alasan audit minimal 10 karakter.
- Existing installs dengan data operasional tidak dipaksa masuk onboarding ketika config versioned belum ada.

## Acceptance

- Empty DB: setup Owner → login → onboarding → pause/resume → setup parsial/lengkap → CTA project/dashboard.
- Settings dan onboarding memakai source of truth/action yang sama.
- UI stabil tanpa overflow pada 320, 375, 390, dan 430 px; controls minimum 48 px, keyboard/focus/reduced-motion aman.
- Relevant unit/integration/UI tests, lint, TypeScript, production build, dan browser console check lulus.
