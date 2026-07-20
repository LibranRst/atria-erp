# Exclusive Search and Filter Control

## Scope

- Rework kontrol pencarian dan filter pada halaman Projects dan Persetujuan.
- Project Detail tidak diubah karena tidak memiliki pencarian global dan telah dikeluarkan dari scope oleh pengguna.
- Pertahankan sticky surface, URL filter Projects, active-tab spring, data, RBAC, dan seluruh decision workflow.

## Interaction

- Mode awal adalah filter: segmented tabs mengisi sisa lebar, dengan tombol pencarian berbentuk lingkaran 48 px di sisi kanan.
- Search dan filter bersifat eksklusif. Membuka search mengembalikan filter ke `Semua`; memilih filter hanya bekerja dalam mode filter.
- Tombol search bermorfosis menjadi search field selebar baris menggunakan token motion iOS yang tersedia.
- Search otomatis fokus. `Escape` atau tombol tutup menghapus query dan kembali ke mode filter.
- Reduced motion menonaktifkan perpindahan geometris tanpa mengubah fungsi.
- Projects tetap melakukan scroll ke atas ketika pengguna mulai mengetik, sesuai behavior yang sudah disepakati.

## Presentation

- Gunakan satu shared control agar Projects dan Persetujuan memiliki ukuran, motion, focus ring, serta affordance yang sama.
- Segmented tabs tetap horizontal-scroll saat ruang tidak cukup.
- Search field menggunakan surface tenang, ikon search di kiri, dan tombol tutup 48 px efektif di kanan.
- Sticky container yang sudah ada tetap bertanggung jawab atas background, radius, shadow, dan perubahan density.

## State and Data

- Mode filter hanya menjalankan predicate filter; mode search hanya menjalankan predicate query.
- Query tidak digabung dengan filter aktif.
- Empty state dan reset action mengikuti mode aktif.
- Tidak ada perubahan schema, DTO, server action, route, atau business logic.

## Verification

- Tambahkan test shared control untuk filter mode, search mode, accessible labels, dan reduced-motion-safe structure.
- Perbarui presentation test Projects dan Persetujuan.
- Browser-check 320, 390, dan 430 px untuk expansion, autofocus, horizontal tab scrolling, sticky state, dan overflow.
- Jalankan ESLint, TypeScript, test relevan, dan production build bila rangkaian test utama bersih.

## Corrective Polish

- Search trigger dan search field harus menggunakan satu motion surface persisten; surface melebar dari kanan ke kiri, sedangkan konten internal berganti melalui fade.
- Shared `SheetSelect` memakai line-height 16 px dan jarak 2 px untuk pasangan label–deskripsi.
- `MoneyValue` full dan exact values memakai container-relative dynamic sizing serta `nowrap` agar nominal besar tidak pecah menjadi dua baris.
