# Rework Sistem Form & Drawer iOS-Native Atria ERP

## Tujuan

- Menjadikan seluruh form data-entry dan bottom sheet memakai canvas abu-abu lembut dengan grouped white surfaces yang ringkas dan native-feeling.
- Mempertahankan seluruh field, validasi, RBAC, mutation, transaction, audit log, recovery, nested sheet, serta workflow bisnis yang sudah ada.
- Mengecualikan login, navigation search, dan filter controls dari perubahan presentasi form.

## Implementasi

1. Tambahkan grouped-form presentation context pada shared form primitives. `FormSection` menjadi panel putih dengan divider; standalone controls tetap capsule.
2. Tambahkan layout field eksplisit `stacked` dan `inline`, inline helper/error, serta presentation `grouped` dan `plain` untuk konten non-row.
3. Rework `BottomSheet`, picker sheet, dan selection list agar memakai gray canvas, white circular header controls, white grouped rows, dan motion token yang sudah tersedia.
4. Tambahkan `actionPlacement` kompatibel pada operational form sheet. Footer tetap default; header check hanya diaktifkan secara eksplisit pada CRUD ringan.
5. Selaraskan confirmation/detail surfaces dan audit raw/custom inputs tanpa mengubah behavior atau kontrak data.
6. Perbarui `AGENTS.md`, main surface design language, dan iOS solid design system dengan aturan contextual grouped controls.

## Verifikasi

- Tambahkan presentation tests untuk grouped/standalone controls, layout row, error/helper, picker selection, dan sheet action placement.
- Jalankan TypeScript, ESLint, relevant Bun tests, seluruh test suite, dan production build.
- Browser-check workflow representatif pada 320, 360, 390, dan 430 px termasuk keyboard, nested sheet, safe area, focus, reduced motion, dan horizontal overflow.

## Batasan

- Tidak ada perubahan schema, DTO, server action, calculation, permission, atau business workflow.
- Confirmation modal tetap centered; hanya presentation-nya yang diselaraskan.
- Kalender dan selector tetap memakai nested sheet, bukan inline control baru.
