# Settings Drawer Visual Polish

## Tujuan

Menyelaraskan drawer Kategori, Library Harga, dan Material Master dengan sistem form iOS-native Atria tanpa mengubah data, validasi, RBAC, server action, atau workflow.

## Langkah

1. Ringankan drawer kategori dengan menyatukan identitas terlindungi, nama, dan deskripsi ke satu grouped surface serta menghapus notice besar yang berulang.
2. Rapikan drawer Library Harga menjadi tiga kelompok fungsional tanpa nomor langkah dekoratif; tampilkan komponen biaya sebagai satu grouped list dengan divider dan disclosure tambahan yang compact.
3. Rapikan drawer Material dengan action kategori yang compact, disclosure detail compact, serta grouping default inventori yang konsisten.
4. Rework Detail Material menjadi identity summary, grouped facts/default inventory, dan action hierarchy yang jelas tanpa ruang kosong berlebihan.
5. Tambahkan/ubah presentation tests yang relevan, lalu jalankan TypeScript, ESLint, test Settings, dan browser-check pada viewport mobile.

## Batasan

- Tidak mengubah schema, query, DTO, Server Action, permission, atau audit behavior.
- Tidak menambah field, dummy data, atau mutation baru.
- Semua sheet tetap memakai shared motion token, safe area, dan action placement yang sudah ada.
