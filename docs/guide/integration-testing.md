# Pengujian integrasi PostgreSQL terisolasi

Dari root repo:

```sh
bun run test:integration
```

Prasyarat: Bun, Python 3, dan Docker dengan daemon lokal yang sudah aktif. Docker Desktop atau OrbStack dapat digunakan. Perintah tidak menjalankan aplikasi Docker secara otomatis. Eksekusi pertama dapat mengunduh image `postgres:17-alpine`.

Perintah ini membuat container PostgreSQL baru dengan port acak yang hanya terikat ke `127.0.0.1`, tanpa memakai volume existing atau bind mount direktori aplikasi. PostgreSQL memakai storage anonim baru milik container tersebut, yang ikut dibuang oleh `--rm`. Password dibuat untuk satu eksekusi, dikirim melalui environment proses anak, dan tidak ditulis ke `.env` atau ditampilkan pada terminal. Environment aplikasi, database, cloud, dan provider AI tidak diwariskan ke proses test.

Schema disiapkan dari seluruh migrasi repository. Template berisi seed sintetis dan template kosong dipisahkan. Setiap file suite mendapat clone database sendiri; suite dengan profil development juga disiapkan pada clone kosong sendiri. Mutasi saldo, stok, dan izin dalam test tidak menyentuh database yang dipakai dev app.

Container milik eksekusi tersebut dihentikan setelah selesai, gagal, atau menerima Ctrl+C; Docker menghapusnya lewat `--rm`. Cleanup hanya memakai ID container yang baru saja dibuat, setelah label kepemilikannya diverifikasi ulang. Container lain tidak dihentikan. Jika daemon mati atau verifikasi cleanup gagal, perintah keluar dengan status gagal; periksa identitas eksekusi di laporan sebelum melakukan cleanup manual.

Hasil disimpan pada direktori privat `output/test-integration/<run-id>/`:

- `run.json`: status, jumlah test, hash source, kesamaan file environment sebelum/sesudah, dan hasil cleanup.
- `prepare.log`: hasil migrasi dan persiapan fixture sintetis.
- `runner.log` serta `suites/results.json`: hasil tiap suite dan log detailnya.

Direktori hasil hanya dapat diakses pemilik akun lokal. Jangan mempublikasikan log mentah: fixture dapat mencatat payload sintetis internal. `run.json` tidak memuat URL database, password, maupun isi file environment. Perubahan source atau environment selama eksekusi membuat hasil gagal sehingga dapat diulang pada checkout yang stabil.

`bun run test` tetap menjalankan suite workspace dengan guard database default. Test PostgreSQL dijalankan lewat perintah terpisah di atas. Jangan mengekspor URL database development sebagai `ATRIA_TEST_DATABASE_URL`, dan jangan menjalankan seluruh suite pada satu database seeded yang sama.

Jumlah skip Bun tidak selalu sama dengan jumlah test saat suite diaktifkan: Bun 1.3.14 juga menghitung `beforeAll`/`afterAll` pada suite skipped sebagai `(unnamed)`. Pada verifikasi 17 Oktober 2026, 560 skip terdiri dari 472 test integrasi bernama dan 88 placeholder hook. Seluruh 472 test tersebut lulus; total eksekusi 478 pass mencakup enam unit test yang berada pada file suite yang sama. Tidak ada test bernama yang hilang dari perbandingan hasil.

Pengujian ini memakai PostgreSQL dan transaksi nyata melalui adapter TCP lokal `pg`. Koneksi WebSocket/pooler Neon, performa cloud, dan browser end-to-end memiliki verifikasi terpisah.

Tes guard runner tanpa Docker atau koneksi database:

```sh
python3 scripts/test-test-integration.py
python3 apps/api/scripts/test-local-postgres-audit.py
```

## CI pada setiap push dan pull request

Workflow `.github/workflows/web-pilot-quality.yml` menjalankan dua job pada setiap push, pull request biasa, dan pemanggilan manual, tanpa filter branch atau path:

- `quality`: menginstal Chromium beserta dependensi sistemnya, menjalankan `bun run test` untuk semua workspace serta script repository, dan menguji guard backup/isolasi database. Pemeriksaan styles, tokens, security, TypeScript, lint, dan build API/web tetap berjalan.
- `postgres-integration`: menjalankan `bun run test:integration` dengan Docker milik hosted runner Ubuntu. Setiap eksekusi membuat PostgreSQL disposable baru dan clone per suite melalui runner yang sama dengan pengujian lokal.

Job test tidak menerima secret, URL database aplikasi, environment deployment, atau kredensial cloud. Checkout hanya memakai izin baca dan tidak menyimpan kredensial Git. Chromium digunakan oleh fixture test terisolasi, tanpa memakai profil browser pengguna. Kegagalan unit test atau integrasi menggagalkan job; skip pada suite integrasi juga dianggap gagal.

Artifact CI hanya berisi `output/test-integration/*/suites/results.json` yang telah disanitasi, disimpan selama tujuh hari. Log mentah dan hash file environment tidak diunggah. Upload artifact bersifat tambahan; kegagalan upload tidak menyembunyikan kegagalan test.

Nama workflow `Web pilot quality` serta ID job `quality` dan `postgres-integration` dipertahankan. Konfigurasi baru berlaku setelah workflow, runner, dan dependensinya di-commit serta di-push. Validasi lokal tidak membuktikan remote Actions sudah lulus; pengaturan required checks/branch protection berada di repository GitHub dan tidak diubah oleh setup ini.
