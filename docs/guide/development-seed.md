# Dataset development lokal

Gunakan profil development untuk melihat UI dengan data proyek interior yang saling terhubung:
Project Budget dan lima kategori, RAP per area/ruangan, paket Tukang/Subcon, RAB klien, procurement,
stok, invoice/payment, ledger, approval, rekonsiliasi, Settings, dan aktivitas pendukung. Angka dan
relasinya diperiksa setelah seed; data ini sintetis untuk development.

Profil ini mempertahankan kondisi yang memang berbeda di dunia nyata: draft, review, approval,
revisi scope, pembayaran parsial/jatuh tempo, shortage material, proyek ditahan, dan proyek selesai.
Proyek cancelled atau proyek yang belum mulai tidak diberi transaksi seolah-olah sudah berjalan.
RAB menggunakan deskripsi dan harga jual yang aman untuk klien; biaya internal berada di RAP.

## Isi baseline yang diverifikasi

Profil development sudah diuji pada PostgreSQL disposable dengan anchor 6 Oktober 2026.
Jumlah berikut menghitung record, termasuk dokumen revisi dan histori yang sengaja dipertahankan.

| Data                     | Jumlah |
| ------------------------ | -----: |
| Proyek                   |      9 |
| Project Budget canonical |      8 |
| Dokumen RAP              |      8 |
| Baris material RAP       |    231 |
| Paket Tukang/Subcon      |     67 |
| Dokumen RAB              |      8 |
| Bundle RAB               |     52 |
| Baris detail RAB         |    326 |
| Item & Price Library     |     20 |
| Vendor bills             |     54 |
| Expense canonical        |     90 |
| Cash transactions        |     86 |
| Stock movements          |    124 |
| Notifikasi               |     25 |
| Percakapan contoh AI     |      5 |

Setiap RAP utama memiliki 6–8 area kerja, BOM material, buffer, dan paket pekerjaan yang sesuai.
Jumlah baris material RAP berbeda dari jumlah Material Master: satu material dapat digunakan di
beberapa ruangan dan proyek. RAB menggabungkan baris sumber ke bundle per area dan memisahkan
jasa spesialis agar biaya atau pekerjaan tidak dihitung dua kali.

| Proyek               | Kondisi awal                                       | Bagian yang diuji dan pengecualian logis                                                          |
| -------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Menteng Villa        | Aktif; RAB R1 disetujui, R2 dibatalkan             | Alur keuangan/material, pembayaran parsial, dan histori revisi RAB                                |
| Sudirman Suites      | Aktif; RAP R2 locked, RAB R2/Change Order menunggu | Bandingkan baseline Rp1,2 miliar dengan revisi Rp1,335 miliar sebelum persetujuan                 |
| Brawijaya Residence  | Aktif; RAP final dan RAB draf                      | Bundle, hidden detail, loose furniture, mobilisasi, dan persetujuan awal RAB; belum ada invoice   |
| Cipete House         | Aktif; RAP pada tahap Review                       | Finalisasi RAP dan generate RAB; RAB/invoice belum dibuat karena tahap perencanaan belum final    |
| Pakubuwono Apartment | Draf; budget menunggu review                       | Gating persetujuan Project Budget; RAP/transaksi belum berjalan                                   |
| Senopati Office      | Aktif; pekerjaan 100%, pembayaran lunas            | Histori material/paket lengkap dan alur Project Closing; status sengaja belum diubah jadi selesai |
| BSD Boutique Cafe    | Selesai; invoice dan pekerjaan lunas               | Referensi histori receipt, usage, vendor payment, paket Tukang/Subcon, dan margin akhir           |
| Kemang Townhouse     | Ditahan; RAP final dan RAB draf                    | Filter on-hold dan rencana siap lanjut; belum ada transaksi operasional aktif                     |
| PIK Shophouse        | Dibatalkan                                         | Filter cancelled; tidak membuat budget atau transaksi fiktif untuk proyek yang dibatalkan         |

## Neon yang dipakai web development

Command membaca `DATABASE_URL` dari `apps/api/.env`, sama dengan API/web development yang
sudah ada. Bun workspace meneruskan command root ke `apps/api`, sehingga env backend tetap
milik API. Neon menggunakan driver `@neondatabase/serverless` yang sudah dipakai aplikasi.
Tidak perlu Docker, memindahkan database, membuat project Neon baru, atau mengganti `.env`.

Database harus sudah mempunyai schema dari migration repo. `db:dev:*` tidak menjalankan migration
atau schema push otomatis. URL Neon biasa dengan `sslmode=require` dan
`channel_binding=require` didukung. `NODE_ENV=production` dan parameter URL yang mengganti host
ditolak sebelum koneksi dibuka.

```sh
# Dari root repo; gunakan DATABASE_URL development yang sudah ada di apps/api/.env.
bun run db:dev:seed
bun run db:dev:verify
```

Jika `DATABASE_URL` sudah diekspor di terminal, nilainya mengalahkan `.env`, seperti command Bun
lainnya. Command mencetak host dan nama database tanpa username/password sebelum bekerja.
Pastikan target tersebut adalah database development yang ingin dipakai.

## Seed, reset, dan verifikasi

```sh
# Seed pada database migrated yang tabel datanya sudah kosong, selain tenant perancah.
bun run db:dev:seed

# Kosongkan seluruh data pada database development terpilih, seed ulang, lalu verifikasi.
bun run db:dev:reset --confirm-reset

# Periksa dataset development tanpa mengubah data.
bun run db:dev:verify
```

Seed biasa menolak database yang sudah berisi data dan tidak membersihkannya otomatis. Reset
menghapus data di database development yang dipilih oleh `DATABASE_URL`, mempertahankan schema dan
metadata migration, lalu mengisi ulang dataset. `--confirm-reset` wajib; jangan gunakan database
development yang berisi pekerjaan yang ingin disimpan. Host dan nama database dicetak tanpa password.

Seluruh insert seed berada dalam transaksi. Kegagalan saat membangun dataset membatalkan insert;
verifikasi setelah seed membaca data yang sudah committed dan keluar dengan status gagal jika
invariant tidak terpenuhi. Pool selalu ditutup pada keberhasilan maupun kegagalan.

`db:dev:verify` memeriksa profil development yang lebih lengkap. `db:demo:verify` memeriksa baseline
walkthrough demo dengan kontrak nominalnya sendiri; gunakan verifier yang sesuai dengan profil.
Jangan mengharapkan fixture yang sudah diedit lewat UI tetap cocok dengan seluruh baseline seed.

Tanggal relatif mengikuti hari seed dalam zona `Asia/Jakarta`. Agar hasil tetap sama untuk
pembandingan, set `ATRIA_DEMO_SEED_DATE=YYYY-MM-DD` sebelum seed. ID dokumen perencanaan dan nomor referensi stabil; ID teknis ledger/audit dapat dibuat ulang.

## Akun dan pemeriksaan visual

Semua akun di bawah memakai password development `password123`.

| Peran           | Nama          | Email                |
| --------------- | ------------- | -------------------- |
| Owner           | Ronald Wijaya | `ronald@dekoria.com` |
| Finance Admin   | Lisa Permata  | `lisa@dekoria.com`   |
| Project Manager | Budi Santoso  | `budi@dekoria.com`   |
| Project Manager | Siti Aminah   | `siti@dekoria.com`   |
| Purchasing      | Agus Pratama  | `agus@dekoria.com`   |

Owner/Finance dapat memeriksa keseluruhan keuangan; PM melihat proyek yang ditugaskan kepadanya.
Purchasing menguji material/procurement sesuai permission. Developer Account Switcher opsional
memerlukan `ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED=true` pada API dan web.

Untuk visual review, buka `/ledger`, `/projects`, detail proyek beserta Budget/RAP/RAB, expenses,
vendor bills, invoice/payment, material/inventory, approvals, notifications, dan Settings. Mulai
dari Menteng dan Sudirman untuk alur operasional/revisi; Brawijaya dan Cipete untuk setup/RAB;
Senopati untuk closing dan BSD untuk histori proyek selesai. Status lain tetap tersedia untuk
filter dan empty states.

Periksa mobile pada 320/360/390/430 px dan desktop pada 1024/1280/1440 px. Login sebagai peran
yang berbeda untuk memeriksa scoping sekaligus tampilan kontrol yang sesuai hak akses.

## Menjalankan web dengan Neon

Gunakan konfigurasi API/web yang sudah ada, lalu dari root:

```sh
bun run dev:web-api
```

Preset menjalankan API dan web; tidak melakukan seed atau reset otomatis. URL dan port mengikuti
[panduan development presets](development-presets.md). Akun seed dapat digunakan setelah
command seed/reset selesai. `API_BRIDGE_SECRET` API dan web harus sama seperti sebelumnya.

## PostgreSQL lokal opsional untuk pengujian terpisah

Pengujian otomatis seed menggunakan PostgreSQL disposable agar tidak mereset database Neon
pengguna. Ini hanya lingkungan QA, bukan perubahan database aplikasi.

Jika sengaja memilih PostgreSQL loopback sendiri, `db:dev:*` juga mendukung `localhost`,
`127.0.0.1`, atau `::1`, dengan `sslmode=disable` opsional. Seed memasang transport TCP `pg`
khusus target lokal. Untuk menjalankan API terhadap target tersebut gunakan `dev:api:local`;
web tetap dijalankan terpisah. Command API biasa tetap memakai driver Neon.

## Menyesuaikan fixture

- [RAP dan RAB per ruangan](../../apps/api/src/backend/db/seed/demo-project-planning.ts): spesifikasi,
  kuantitas, bahan, buffer, biaya internal, harga jual, paket pekerjaan, bundle, dan skenario proyek.
- [Seed dasar dan relasi operasional](../../apps/api/src/backend/db/seed.ts): akun, Settings, proyek,
  expense, invoice/payment, ledger, approval, serta inventory baseline.
- [Pendukung operasional development](../../apps/api/src/backend/db/seed/development-support.ts):
  histori procurement dan pembayaran proyek selesai, price library, stock request/draft,
  notifikasi per peran, serta contoh histori percakapan AI tanpa panggilan provider.
- [Integrasi dataset development](../../apps/api/src/backend/db/seed/development-dataset.ts):
  penyambungan fixture perencanaan dan pendukung di dalam transaksi seed.
- [Kontrak tanggal, ID, dan perhitungan uang](../../apps/api/src/backend/db/seed/demo-contract.ts).
- [Verifier development](../../apps/api/scripts/verify-development-seed.ts): invariant yang harus
  tetap benar setelah fixture diubah.

Setelah mengubah fixture, seed ulang database development terpilih dengan command reset terkonfirmasi,
kemudian jalankan verifier. Ubah quantity/harga dan sumber relasinya bersama; jangan hanya
mengganti total ringkasan agar tampilannya cocok.

Langkah menjalankan server dan mencoba semua skenario ada di [seeded demo walkthrough](seeded_demo_walkthrough.md). Kontrak baseline demo lama berada di [SEED_DATA](../04-data/SEED_DATA.md). Konfigurasi client/API berada
di [mobile-api-development](mobile-api-development.md) dan [development-presets](development-presets.md).
Pembuatan command dan fixture ini tidak menjalankan reset atau seed pada database aktif pengguna;
uji integrasi harus memakai database disposable yang terpisah.
