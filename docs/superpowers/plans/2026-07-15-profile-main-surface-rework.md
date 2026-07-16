# Rework Profile dengan Design Language Atria

## Tujuan

Menyelaraskan `/profile` dengan hierarchy, density, grouped surfaces, state, dan motion Dashboard/Expenses tanpa menambah mutation akun, schema, atau permission baru.

## Eksekusi

1. Ganti KPI dan accordion generik dengan identity focal surface, grouped account rows, dan daftar modul akses yang membuka detail lewat bottom sheet.
2. Gunakan avatar sesi bila tersedia dengan fallback inisial, Bahasa Indonesia konsisten, serta hitung hanya enam modul ERP aktif tanpa AI CFO/AI Brief.
3. Ubah logout menjadi destructive row dengan confirmation sheet, pending state, serta error recovery yang mempertahankan pengguna di halaman.
4. Tambahkan skeleton route-specific, error surface, dan presentation tests untuk role visibility, module counts, avatar fallback, serta logout confirmation.
5. Verifikasi 320–430 px, focus, reduced motion, safe area, TypeScript, ESLint, Bun tests, dan production build.

## Batasan

- Better Auth, session, RBAC, route, dan shell global tetap dipertahankan.
- Tidak ada edit nama/avatar, perubahan password, atau pengelolaan sesi/perangkat.
- Permission legacy `view:ai_brief` tetap ada untuk kompatibilitas, tetapi tidak ditampilkan atau dihitung di Profile aktif.
