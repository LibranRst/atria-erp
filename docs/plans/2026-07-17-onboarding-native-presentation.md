# Onboarding-Native Presentation Rework

## Objective

Menghilangkan rasa “Settings ditempel ke onboarding” tanpa menduplikasi business logic. Onboarding harus terasa seperti guided setup: satu tujuan utama, status singkat, satu action kontekstual, lalu data pendukung seperlunya.

## Changes

1. Tambahkan primitive visual khusus onboarding untuk lead/status, toolbar action, grouped rows, empty state, dan guidance.
2. Aktifkan contract `presentation="onboarding"` pada shared managers:
   - hilangkan module header Settings;
   - hilangkan search/filter yang tidak perlu saat setup awal;
   - tampilkan action create/import secara langsung dan ringkas;
   - pertahankan drawer/form, validation, permission, dan Server Action existing.
3. Sederhanakan setiap step menjadi:
   - konteks/tujuan singkat;
   - readiness atau jumlah data;
   - satu grouped list atau keputusan;
   - primary action kontekstual;
   - tombol `Lanjut` tetap terpisah di bawah.
4. Default finansial hanya menampilkan hubungan budget, alokasi, dan buffer; simulasi Settings tidak ditampilkan pada presentation onboarding.
5. Saldo awal stok menggunakan pilihan keputusan yang eksplisit dan riwayat ringkas, bukan workspace operasional.
6. Pastikan Settings tetap memakai presentation default tanpa perubahan layout.

## Verification

- TypeScript, ESLint, targeted presentation tests, dan production build.
- Tidak ada link setup onboarding ke Settings/Material/Ledger.
- Tidak ada horizontal overflow pada 320–430 px.
- Drawer tetap memakai shared motion, safe area, focus restoration, dan unsaved confirmation.
