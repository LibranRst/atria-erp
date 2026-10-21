# Rollout Atria ke Paduna dan pengelolaan brand

## Keputusan dan cakupan tahap ini

Paduna dipilih sebagai brand utama pada 17 Oktober 2026. Status sementara sebelumnya digantikan keputusan ini. Simbol Temu, Manrope, ink/terracotta, dan arsitektur Paduna Build / Paduna Office dipertahankan.

Fondasi v1 menyelesaikan strategi, standar, dokumentasi, naming map, dan aset. Pada rollout web berikutnya, nama dan visual Paduna Build telah diterapkan pada kode web dan diperiksa secara lokal di desktop/mobile. Git remote, project Codex, service cloud, domain, akun sosial, app store, package dan aplikasi native tetap pekerjaan terpisah. Tidak ada repo/folder/layanan aktif yang diganti pada rollout web ini.

## Urutan penerapan yang disiapkan

| Tahap                    | Pekerjaan                                                                                           | Kriteria selesai                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1. Fondasi               | Brand book, sumber canonical, master, metadata, dan arsip Atria                                     | Paket versi 1.0 lengkap dan dapat direproduksi.                                              |
| 2. Nama yang terlihat    | Web title/manifest, login, help, loading, native display name, permission copy, notifikasi dan aset | Tidak ada label Atria yang tidak disengaja pada permukaan target; cakupan fitur tetap benar. |
| 3. Project dan workspace | Repo display, checkout, project Codex, package namespace, scripts, imports, lockfile dan tooling    | References konsisten; lint/typecheck/build serta verifikasi transport lolos.                 |
| 4. Identitas integrasi   | Origin, native schemes, auth redirect, callback, cookie/session, env, storage keys, PWA identity    | Link/install/session yang masih didukung tetap bekerja; fallback/rollback jelas.             |
| 5. Distribusi            | Metadata deploy/store, domain dan sosial yang sudah dimiliki, announcement                          | Kepemilikan dan target terverifikasi; native build/preview diuji sebelum rilis.              |

Bagian web pada tahap 2 sudah diterapkan di source; bagian native dan tahap 3-5 belum dijalankan. Tahap-tahap ini boleh digabung jika dependensinya dipahami, tetapi penggantian teks menyeluruh bukan strategi migrasi.

## Inventaris dan nama target

Lihat `naming-map.json` dan `rollout-inventory.csv`. Inventaris memuat titik masuk yang telah diperiksa pada repository, bukan daftar lengkap setiap occurrence Atria maupun bukti konfigurasi cloud yang aktif. Sebelum implementasi, jalankan pencarian menyeluruh terbaru dan periksa semua consumer.

Nama repo target untuk produk ini **paduna-build**. Nama Office nanti **paduna-office**. Root workspace target **paduna-build-workspace**; label publik produk **Paduna Build**. Admin terpisah tetap aplikasi transisi dan bukan produk pemasaran baru.

Bundle identifier/Android ID/EAS project ID tidak diubah untuk sekadar mengganti display name. Jika identitas aplikasi sudah digunakan dalam distribusi, perubahan identifier perlu diperlakukan sebagai migrasi identitas aplikasi. Ketersediaan domain/merek/namespace publik belum dikonfirmasi oleh dokumen ini.

## Verifikasi saat penerapan

- Web metadata, manifest, favicon, share image, install/PWA dan cache ditinjau bersama; `id`, `start_url`, dan `scope` tidak berubah tanpa kebutuhan migrasi.
- Deep link `atria://` dan trusted origins dipetakan sebelum menambah `padunabuild`; redirect dan session diuji.
- iOS Icon Composer project tetap digunakan atau diganti secara sengaja, dengan native build untuk melihat ikon/splash terpasang. Android foreground/background/monochrome diperiksa di launcher.
- Uji login, peran, scope proyek, catatan transaksi, stok, dan RAB untuk memastikan branding tidak mengubah perilaku domain atau identitas tenant.
- Nilai enum, ledger, database, audit history, ID, nama proyek pelanggan, dan arsip transaksi tidak ditulis ulang demi branding.
- Jalankan quality gates yang sesuai repo dan permukaan yang disentuh. Catat perubahan dan rollback per batch.

## Pengelolaan versi

`docs/brand/paduna/brand-system.json` adalah sumber keputusan terstruktur. Panduan dalam folder yang sama menjelaskan penggunaannya. PRODUCT.md memegang cakupan produk; DESIGN.md dan sidecar memegang kontrak UI. Jika terjadi konflik, perbaiki sumber tersebut sebelum mengekspor paket baru.

Perubahan logo, nama produk, warna utama, tagline, atau klaim produk harus dicatat dalam decision log. Pembaruan konten rutin boleh mengikuti template tanpa menciptakan varian identitas baru. Setiap rilis paket mencantumkan versi, tanggal, manifest aset, dan checksums.

Arsip Atria dan Paduna provisional disimpan sebagai sejarah. Keduanya tidak dipakai sebagai sumber brand terkini. Pengguna telah memilih nama Paduna; jangan meminta persetujuan ulang untuk keputusan yang sama.
