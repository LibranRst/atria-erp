# Rework Pengaturan ERP dengan Design Language Atria

## Ringkasan

- Rework seluruh workspace Pengaturan ERP tanpa mengubah schema, RBAC, server action, calculation, transaction, atau audit behavior.
- Pertahankan header global, shell `max-w-md`, bottom navigation, FAB, safe area, URL query tab, dan route kompatibilitas lama.
- Gunakan header halaman tetap, tab sticky, satu focal configuration surface, grouped rows, compact contextual actions, serta structural loading/error states.

## Implementasi

1. Bangun primitives Settings, header tetap, sticky tab navigation, route skeleton, dan error surface yang mengikuti Dashboard/Expenses.
2. Ubah Ringkasan menjadi default-project posture dan Alokasi Budget menjadi workflow simulasi, formula, kategori, serta dirty save dock.
3. Ubah Kategori, Library Harga, dan Material Master menjadi grouped rows dengan progressive disclosure melalui sheet.
4. Gunakan exclusive search/filter pada Library dan Material; filter lanjutan berada di bottom sheet dan tidak berjalan bersamaan dengan pencarian.
5. Pertahankan semua field, validation, confirmation, pending/success/error recovery, mutation, permission, transaction, dan audit log yang sudah tersedia.

## Verifikasi

- Tambahkan presentation tests untuk navigation, focal summary, grouped rows, filter/search, read-only, dirty state, loading, dan empty state.
- Browser-check Owner, Finance Admin, dan Purchasing pada 320, 360, 390, dan 430 px.
- Jalankan TypeScript, ESLint, relevant tests, seluruh Bun tests, production build, serta console check.

