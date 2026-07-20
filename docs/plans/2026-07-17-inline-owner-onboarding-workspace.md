# Inline Owner Onboarding Workspace — Executable Plan

## Goal

Mengubah `/onboarding` menjadi workspace setup lengkap. Owner dapat menambah dan mengedit data setup melalui drawer pada step aktif tanpa berpindah route. Settings tetap memakai form, validasi, dan Server Action yang sama.

## Constraints

- Tidak ada perubahan schema atau migration.
- Mutation setup tetap memakai Server Action dan validasi Zod existing.
- Save menutup drawer dan me-refresh data/readiness, tetapi tidak menandai step reviewed dan tidak memindahkan step.
- Approval saldo awal stok tetap dilakukan di Approval Center.
- Operasi kas, rekonsiliasi, transfer, stock movement, dan approval tidak dibawa ke onboarding.
- Mobile 320–430 px menjadi acceptance baseline.

## Work Packages

### 1. Centralized workspace loader

- Tambahkan `OwnerOnboardingWorkspaceData` sebagai payload terpusat.
- Muat overview, Settings overview, tim/vendor, rekening setup, library, kandidat saldo awal, dan riwayat batch secara paralel.
- Isolasi kegagalan per sumber agar satu step dapat menampilkan retry tanpa merusak seluruh onboarding.

### 2. Shared presentation contracts

- Tambahkan contract opsional `presentation: "settings" | "onboarding"` dan `onMutationComplete` pada manager yang dipakai bersama.
- Pertahankan presentation Settings sebagai default agar layout existing tidak berubah.
- Gunakan callback bersama untuk refresh readiness dan data server setelah mutation.

### 3. Inline step workspaces

- Default finansial: summary dan segmented view Budget/Kategori; editor dibuka dalam drawer.
- Tim & Vendor: list, add, edit, role, dan password sementara pada step yang sama.
- Rekening: manager setup-only yang hanya menyediakan create/edit dan review saldo awal.
- Lokasi & Material: segmented view; lokasi wajib dibuat sebelum drawer material dapat dibuka.
- Library: list dan drawer add/edit existing.
- Saldo awal stok: keputusan tetap inline, composer manual/CSV dalam drawer, riwayat/pending inline.
- Ringkasan: seluruh row menavigasi step internal, bukan Settings.

### 4. Navigation and mutation behavior

- Hapus CTA ke Settings, Ledger, dan Materials dari onboarding.
- Mutation sukses memperbarui list dan readiness tanpa mengubah URL, scroll, atau current step.
- Step hanya maju setelah pengguna menekan `Lanjut`.
- Step yang belum lengkap menyediakan `Lewati untuk sekarang` dengan warning yang tidak memalsukan readiness.

### 5. Documentation and verification

- Selaraskan `docs/guide/financial_workflow_guide.md` dengan workflow inline.
- Tambahkan targeted tests untuk route stability, setup-only account actions, internal step navigation, prerequisite lokasi, dan refresh behavior.
- Jalankan TypeScript, lint, targeted tests, production build, lalu browser QA pada 320, 360, 390, dan 430 px termasuk console, focus, safe area, dan reduced motion.

## Completion Criteria

- Fresh database dapat menyelesaikan seluruh setup tanpa meninggalkan `/onboarding`.
- Semua mutation menggunakan logic existing dan hasilnya langsung terlihat di step aktif.
- Save tidak auto-advance.
- Readiness hanya berubah berdasarkan data aktual.
- Settings dan onboarding membaca/menulis data yang sama.
- Tidak ada operasi modul ledger/material operasional yang bocor ke onboarding.
