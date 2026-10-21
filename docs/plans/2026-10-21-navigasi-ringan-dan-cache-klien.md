# Navigasi ringan, cache klien, dan loader paralel

Tanggal: 21 Oktober 2026. Status: **diimplementasikan di branch `development`; verifikasi manual pada data seed tercatat di bagian akhir**.

## Masalah

Setiap halaman terautentikasi adalah Server Component `force-dynamic`. Next 16 menyimpan payload halaman dinamis di client cache selama **0 detik** (`staleTimes.dynamic` default), sehingga setiap kunjungan ulang ke tab bawah, termasuk tab yang baru dibuka beberapa detik sebelumnya, mengulang tiga round-trip berurutan ke API (proxy `get-session`, `resolveActor`, loader halaman) dan selalu menampilkan `loading.tsx` penuh.

Temuan pendukung:

- `resolveActor()` dipanggil dua kali pada render penuh (root layout dan page) tanpa dedupe per request.
- Tautan "Lihat semua" di Ringkasan `/ledger` (`/ledger?tab=…`) memakai navigasi router penuh, padahal tab dashboard sendiri hanya membaca query di klien. Hasilnya skeleton dashboard penuh, scroll ke atas, dan satu loader dashboard tambahan untuk data yang sudah ada di layar.
- Membuka/menutup aksi gudang di `/materials` (`?action=…`) memakai `router.replace`, sehingga terjadi round-trip dan skeleton yang sama.
- Loader API `getExpensesPageData` (sekitar 11 query) dan `getProjectDetailData` (sekitar 15 query) menjalankan query independen satu per satu.

## Keputusan

1. **`experimental.staleTimes.dynamic = 30`.** Halaman yang dikunjungi kurang dari 30 detik lalu dipakai ulang dari memori tanpa skeleton dan tanpa request. Ini nilai default Next 14 sebelum diturunkan ke 0. Kesegaran tetap dijaga karena:
   - Data halaman dinamis disimpan di BFCache router (`segment-cache/bfcache.js`, kedaluwarsa menurut `dynamicStaleAt`). Setiap Server Action yang memanggil `revalidatePath` (seluruh mutasi finance/stock melalui `callBackend`) memanggil `invalidateBfCache()` dan `invalidateEntirePrefetchCache()` (`server-action-reducer.js`).
   - `router.refresh()` memanggil `invalidateBfCache()` dan menaikkan versi segment cache secara global (`refresh-reducer.js`), sehingga cache halaman lain ikut terbuang.
   - Perubahan oleh pengguna lain paling lama 30 detik terlambat terlihat pada kunjungan ulang. Data uang yang menentukan keputusan tetap divalidasi ulang di server saat mutasi, dan stream notifikasi tetap memberi tahu pending approval secara terpisah.
   - `static` tidak diubah (5 menit, hanya untuk loading boundary hasil prefetch).
2. **`resolveActor` dibungkus `React.cache`.** Root layout dan page berbagi satu RPC per request. Ini tidak berpengaruh pada Server Action karena `resolveActor` hanya dipanggil dari Server Component.
3. **Navigasi query dangkal untuk route yang membaca query hanya di klien.** `WorkspaceLink` mendeteksi target yang pathname-nya sama dengan halaman saat ini, lalu memperbarui riwayat lewat `history.pushState` (seperti `SegmentedTabs`), tanpa round-trip. Daftar route tercatat di `workspace-routes.ts`; `/settings`, `/onboarding`, `/` dan `/admin` tidak termasuk karena page-nya membaca `searchParams` di server. Klik dengan modifier, `target`, dan tautan lintas route tetap memakai perilaku Next.
4. **Aksi gudang membuka/menutup lewat URL dangkal.** Jalur sukses tetap memanggil `router.refresh()` secara eksplisit.
5. **Loader API paralel.** Query yang tidak saling bergantung dijalankan dengan `Promise.all`. Rantai yang memang bergantung (proyek PM → tagihan → pembayaran → approval) tetap berurutan. Pool Neon serverless (`max=10`) mengantrekan koneksi berlebih; jumlah query dan compute tidak bertambah.

## Tidak dikerjakan sekarang (rekomendasi)

- **Cookie cache sesi.** `readBackendSession` memakai `disableCookieCache=true` di proxy, sehingga setiap request, prefetch, dan Server Action membaca sesi dari database. Mengaktifkan cookie cache Better Auth (misalnya 60 detik) memangkas satu hop per navigasi, tetapi penonaktifan pengguna dan `mustChangePassword` baru berlaku setelah cache habis. Ini keputusan keamanan Owner.
- **`router.refresh()` ganda setelah aksi yang sudah merevalidasi** (sekitar 90 pemanggilan). Respons Server Action yang merevalidasi sudah membawa RSC baru untuk halaman aktif, jadi refresh tambahan merender ulang layout dan page sekali lagi. Perbaikannya per alur, karena beberapa alur bergantung pada urutan reset state.
- **Panduan peran diminta ulang di setiap perubahan pathname.** Hasilnya hanya bergantung pada actor dan status quick-start, bukan route, tetapi status quick-start bisa berubah di tengah sesi. Perlu sinyal invalidasi eksplisit sebelum permintaan per-route dihapus.
- **Biaya prefetch otomatis.** Di produksi, setiap tautan navigasi yang terlihat mem-prefetch layout sampai `loading.tsx`. Pada uji, lima tautan menghasilkan sepuluh request `_rsc`, dan tiap request melewati proxy sesi dan `resolveActor` di root layout. Manfaatnya: skeleton muncul seketika saat tab ditekan. Biayanya: sekitar sepuluh hop API per halaman per lima menit (`staleTimes.static`). Bila kuota Neon kembali ketat, ganti ke prefetch saat hover/sentuh (`prefetch={false}` sampai ada niat), jangan matikan total.
- **Pagination server.** Daftar biaya, tagihan vendor, pembayaran, detail proyek, inventori, dan tab desktop dashboard dimuat utuh lalu dipotong di klien. Untuk volume saat ini aman; ketika jumlah baris tumbuh, pindahkan ke cursor `(createdAt, id)` seperti mutasi material dan notifikasi.
- **Skeleton tidak sesuai:** `/expenses/new` memakai skeleton daftar biaya, `/profile/password` memakai skeleton profil, `/materials/opening` hanya redirect tetapi memunculkan skeleton sendiri, dan `/ai` tanpa `loading.tsx`.

## Verifikasi

Hasil 21 Oktober 2026, build produksi lokal (`next start`) dengan database seed development:

- `/ledger` → `/expenses` → `/ledger` dalam 30 detik: kembali ke `/ledger` tanpa request `_rsc` dan tanpa skeleton halaman. Setelah lebih dari 30 detik, `/expenses` kembali memuat data dan menampilkan skeleton.
- Mobile 375 px, "Lihat semua" pada Jatuh tempo terdekat: URL menjadi `?tab=cash`, tidak ada request `_rsc` atau skeleton, scroll kembali ke atas, dan Back browser kembali ke Ringkasan di dokumen yang sama.
- `/materials`, membuka lalu menutup Stock Opname: `?action=COUNT` ditambah lalu dihapus tanpa request `_rsc` untuk `/materials`.
- Halaman `/expenses` dan `/projects/[id]` (termasuk tab Keuangan: tagihan, pembayaran, persetujuan) tampil lengkap dengan loader paralel; log API tanpa error.
- Belum diuji di browser: invalidasi setelah mutasi. Alasannya, uji ini mengubah data seed. Bukti yang dipakai adalah source Next yang dikutip di atas.

Perintah:

- `bun run lint`, `bun run test`, typecheck API/web, dan `bun run build:web`.
- Manual (build produksi, karena prefetch otomatis hanya aktif di production): buka `/ledger` → `/expenses` → `/ledger` dalam 30 detik, maka `/ledger` muncul tanpa skeleton dan tanpa request `_rsc` baru. Setelah 30 detik, skeleton muncul lagi. Setelah mutasi (misalnya catat transaksi), kunjungan ke halaman lain memuat data baru. "Lihat semua" di Ringkasan mengganti tab tanpa skeleton.
