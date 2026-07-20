# Material Surface Alignment Polish

## Tujuan

Menarik `/materials` lebih dekat ke bahasa visual Projects dan Persetujuan tanpa menghilangkan pola domain-specific untuk stock posture, shortage, dan audit material.

## Perubahan

- Pertahankan data, query tab, permission, mutation, transaction, audit log, sheet, serta seluruh calculation material.
- Pertahankan focal stock posture, shortage per project, inventory metrics, dan activity ledger sebagai pola khusus material.
- Hilangkan outer control card Inventori yang membuat filter/search terasa seperti control panel terpisah; gunakan control flow yang sama dengan Projects/Approvals.
- Ringankan filter Aktivitas menjadi grouped filter surface yang lebih compact, tanpa eyebrow dekoratif atau icon `tune` yang tidak menambah keputusan.
- Samakan section rhythm, grouped surface radius, shadow, divider, icon tile, dan metadata density dengan main-surface language aktif.
- Pertahankan sticky controls dalam keadaan nonaktif melalui `WORKSPACE_STICKY_CONTROLS_ENABLED`.
- Tidak menambah chart, operasi stock inline, dummy data, schema, DTO, query, atau business workflow baru.

## Verifikasi

- Uji Ringkasan, Inventori, Kebutuhan, dan Aktivitas pada 320–430 px.
- Pastikan filter/search tetap bekerja, location/status tetap terbaca, dan tidak ada horizontal overflow.
- Verifikasi grouped rows, empty state, nominal, quantity, active tab, dan bottom-nav clearance.
- Jalankan ESLint, TypeScript, presentation tests, serta browser-check seluruh tab Material.
