# Pilot web gratis untuk Owner

Snapshot hosting terverifikasi, 4 Oktober 2026 pukul 09:15 UTC: [web production](https://atria-boss-pilot.netlify.app) public, Deploy Previews private, dan [API Railway](https://atria-pilot-api-production.up.railway.app) aktif. Deployment web yang benar adalah `6ac20cc355a894774f00a5a4`; deployment API terverifikasi `d7db48e7-421f-4c86-a603-32cba4fd8b10` memakai source `e302b882`. Health/readiness API dan login HTTPS Owner sudah dibuktikan. Login pertama mencapai welcome dengan cookie Secure/HttpOnly/Lax; sesudah flag temporary, audit dan pencabutan sesi, login berikutnya diarahkan ke `/profile/password`. User belum mengganti password personal. UAT bisnis hosted dan go-live data asli tetap belum disetujui.

Pilot berlangsung dua minggu untuk satu proyek berjalan, memakai data perusahaan yang disetujui Finance, dengan akun Owner, Finance, PM, dan Purchasing. Pembukuan yang sekarang tetap menjadi sumber pembanding. Laptop dan web di HP sama-sama masuk acceptance check. AI chat dan OCR wajib berfungsi sebelum undangan diberikan.

### Status persiapan aktual

- Neon project `polished-glade-93740595`, branch `br-lucky-heart-b3qmgl34`, database `atria_pilot`: PostgreSQL 17 Singapore, min/max compute 0,25 CU, quota Free 1 GiB. Provision awal lulus dengan 44 migrations, 67 tabel, empat role sistem dan nol user; satu temporary Owner sudah dibuat sesudahnya. Belum ada baseline/transaksi bisnis perusahaan; jangan menjalankan ulang provision/reset/seed terhadap database ini.
- Netlify production <https://atria-boss-pilot.netlify.app> melayani artifact transform `apps/web/.netlify/static` pada deployment `6ac20cc355a894774f00a5a4`, dengan preview private. `/login` dan script JavaScript terbukti melayani request; anonymous `/ledger`, `/admin` dan `/projects` diarahkan ke `/login`. Field Base kosong/repository root, Package `apps/web`, serta configured publish `apps/web/.next` tetap untuk build plugin normal; deploy manual setelah standalone build memakai directory transform tersebut. Deployment raw-artifact yang buruk `6ac1fed28e544d47da3b4274` sudah dihapus dengan persetujuan user dan diverifikasi 404.
- API Railway aktif pada deployment `d7db48e7-421f-4c86-a603-32cba4fd8b10`, source `e302b882`, satu replica di US West; HTTPS `/health` dan `/ready` telah merespons 200 memakai Neon pilot. Sleep/wake aktual lulus satu kali: kartu Architecture menunjukkan Sleeping sesudah lebih dari 10 menit tanpa request API, lalu first GET /ready pada `2026-10-04T09:13:00Z` merespons 200/ready dalam 2.858 s dan /health berikutnya 200/ok dalam 0.242 s. Ini bukan jaminan latency. Build/run lokal port 3212 adalah evidence historis sebelum deployment cloud, bukan status hosting saat ini.
- Railway project `9c8944bb-9dff-43a6-816e-73dac641d371`, environment `72e54b77-9adb-4691-856c-087d112bdbea`, dan service API `217d3e44-824c-46d6-af53-fab21ca28407` memakai source root kosong/repo root dan port 3001. Import variables diotorisasi user, tanpa AI keys. Readiness membuktikan koneksi Neon; popup Trial pada 09:15 UTC menampilkan sisa 30 hari dan US$5.00 kredit, tanpa tindakan kartu/upgrade. Architecture kembali Online setelah wake. Nilai UI yang dibulatkan tidak membuktikan kecukupan kuota ke depan; peak usage, credit exhaustion, Free sesudah trial dan delivery provider yang disetujui tetap pending. UI trial saat setup menampilkan maksimum dua vCPU/1 GB RAM dengan slider nonaktif, sehingga cap 512 MB/satu vCPU tidak diklaim sudah diterapkan. Render tidak dipilih karena hold verifikasi kartu US$1 ditolak user; `render.yaml` hanya opsi historis.
- Verified docs/source [`e302b882`](https://github.com/LibranRst/atria-erp/commit/e302b882), setelah app release `ce6276aa`, lulus quality dan PostgreSQL disposable pada [GitHub CI run 37190352488](https://github.com/LibranRst/atria-erp/actions/runs/37190352488). Source awal `b0e7815` dan CI `37181391341` adalah evidence historis, dengan [draft PR #2](https://github.com/LibranRst/atria-erp/pull/2) tetap tersedia.
- ImageKit synthetic private upload/metadata sukses; file QA sudah dihapus dan removal dibuktikan. Delivery bytes masih tertahan certificate CDN yang kedaluwarsa. Scheduler pilot terpisah sudah dideploy dan manual authorized reconcile 200/upstream 200, tetapi actual Cron firing/delivery belum diuji.
- Gemini API user masih free. Tetap gunakan `GEMINI_PAID_DATA_POLICY_CONFIRMED=false` dan approved providers kosong sampai keputusan provider yang diizinkan untuk data real selesai. Jangan mengirim nota/mutasi bank/data perusahaan ke provider free untuk melompati gate ini. OCR/chat pada data asli belum siap untuk undangan pilot.
- Backup konfigurasi awal sebelum data bisnis sudah direstore secara lokal dari login read-only pilot: seluruh count/fingerprint 68 tabel cocok, 44 migrations dan satu temporary Owner. Target disposable terisolasi sudah dihapus. Capture `2026-10-04T09:10:54Z` bukan cutoff Finance dan tidak memeriksa invariant bisnis/keuangan atau byte lampiran; credential tidak dikirim ke GitHub/R2.
- Remaining gates: password personal Owner dan akun individual Finance/PM/Purchasing, UAT bisnis hosted lengkap, cutoff/baseline Finance, delivery/restore lampiran, backup R2/nightly/restore data bisnis, approved real-data AI, Cron scheduler, quota exhaustion serta AI stream/timeout/business retry behaviour. Belum ada baseline bisnis yang diimport.

Checklist dan evidence terperinci ada di [rencana/evidence pilot](../plans/2026-10-04-web-audit-boss-pilot.md); hasil lokal sintetis dipisahkan dari gate hosted/data real.

## Hosting dan batas Rp0

| Bagian              | Pilihan                           | Pengaturan                                                                                                                                                                                                            |
| ------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web                 | Netlify Free, Next.js runtime     | Field Base kosong (repo root), **Package directory `apps/web` di UI**, publish `apps/web/.next`; konfigurasi `apps/web/netlify.toml`, deploy CLI manual                                                               |
| API                 | Railway Trial/Free, Bun Docker    | Satu service/satu replica, root Docker context, `RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile`, Serverless; UI trial max dua vCPU/1 GB, batas Free sesudah trial 512 MB/satu vCPU; Singapore hanya trial jika tersedia |
| Database            | Neon Free, project pilot terpisah | Runtime pooled; koneksi direct untuk migration dan backup                                                                                                                                                             |
| Lampiran            | ImageKit                          | Nota, bukti bayar, dan mutasi bank private; URL download singkat setelah pemeriksaan akses                                                                                                                            |
| Recovery notifikasi | Cloudflare Worker pilot terpisah  | Upstream API pilot; manual reconcile sukses; actual Cron 30 menit recovery dan harian 00.00 WIB masih pending                                                                                                         |

Netlify mendukung SSR, Server Actions, route handlers, dan streaming melalui runtime Next. Package directory hanya dapat ditetapkan di UI; file TOML menggunakan base root agar Bun workspace dan kontrak API ikut tersedia. [Netlify monorepos](https://docs.netlify.com/build/configure-builds/monorepos/), [Next.js runtime](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/).

Railway tidak memerlukan kartu untuk Trial/Free: trial memberi US$5 selama maksimal 30 hari; sesudah waktu atau kredit habis, Free menyediakan US$1 per bulan tanpa rollover. Verifikasi GitHub otomatis menentukan Full Trial dengan outbound network penuh atau Limited Trial dengan pembatasan outbound. Login saja belum membuktikan API dapat mengakses Neon, storage, dan AI; buktikan dari service yang sebenarnya. Jangan menambahkan kartu, top-up, Hobby/Pro, atau layanan berbayar untuk melewati gate. [Railway pricing](https://railway.com/pricing), [Free Trial](https://docs.railway.com/pricing/free-trial).

Gunakan hanya satu service API/satu replica; jangan membuat Railway database, volume, Redis, atau worker tambahan. UI akun trial saat setup menunjukkan maksimum dua vCPU/1 GB RAM dan slider resource nonaktif; jangan mencatat batas RAM 512 MB/satu vCPU sebagai setting yang sudah diterapkan. Batas Free sesudah trial adalah RAM 512 MB/satu vCPU, sehingga ukur peak resource dan periksa transisi sebelum melanjutkan pilot. Gunakan repository GitHub private yang diotorisasi, bukan registry Docker private yang membutuhkan Pro. Singapore (`asia-southeast1-eqsg3a`) dapat dipilih pada trial bila akun mengizinkan; pricing menandai global regions tidak tersedia sesudah berpindah ke Free, sehingga lokasi Singapore tidak dijamin berlanjut. [Plan resources](https://docs.railway.com/pricing/plans), [Private registries](https://docs.railway.com/builds/private-registries), [Regions](https://docs.railway.com/deployments/regions).

Kredit adalah batas operasional: saat Free allowance habis, service dapat berhenti hingga siklus berikutnya. Usage-limit resmi mempunyai minimum hard limit US$10 dan alert US$5; jangan mengklaim ada hard cap US$1 yang dikonfigurasi. Pertahankan akun tanpa payment method/upgrade dan periksa usage setiap hari kerja. Review pada hari ke-14 serta sebelum tanggal trial/kredit berakhir; pada 80% allowance, hentikan aktivitas tambahan, export delta pilot dan backup, lalu putuskan kelanjutan bersama Owner. Neon tetap disimpan terpisah; berakhirnya runtime bukan alasan menghapus database. [Usage controls](https://docs.railway.com/cli/usage), [Free allowance exhaustion](https://station.railway.com/billing/free-plan-credits-don-t-work-25e9814f).

Netlify Free mempunyai hard limit kredit bulanan dan dapat menghentikan semua proyek dalam satu team saat kuota habis. Jangan mengaktifkan paket berbayar atau auto recharge. Periksa usage pada awal pilot dan setiap hari kerja; jika kuota 80%, hentikan deploy dan aktivitas tambahan, lalu evaluasi dengan Owner. [Netlify Free limits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [paused projects](https://docs.netlify.com/manage/accounts-and-billing/billing/resume-paused-projects/).

Rp0 hosting tidak berarti AI otomatis gratis. Gunakan hanya layanan/credits yang sudah tersedia dan disetujui. Sebelum real data, catat owner akun, region, quota reset, spend cap, retensi, training policy, dan fallback untuk Neon, ImageKit, gateway chat, serta Gemini OCR. Periksa juga quota/budget GitHub Actions; artifact CI hanya hasil sintetis dengan retensi tujuh hari. Jangan mengganti paket atau provider hanya untuk membuat demo berjalan.

## Urutan persiapan

1. Pertahankan source candidate yang lulus [workflow Web pilot quality terbaru](https://github.com/LibranRst/atria-erp/actions/runs/37190352488), pengujian browser dan viewport, serta restore rehearsal. Workflow hanya menggunakan PostgreSQL disposable dan fixture sintetis; tidak mengambil database/AI/storage secret perusahaan.
2. Finance menyetujui cutoff bertanggal: nilai kontrak dan RAB, budget kategori, consumed/pending/paid, utang/piutang, stok/reservasi, dan saldo rekening awal. Catat asal setiap angka serta siapa yang menyetujuinya.
3. Buat Neon project/database pilot yang terpisah dari instance berjalan. Isi secret secara lokal/di provider; jangan menaruh URL credential di chat, Git, screenshot, atau log.
4. Untuk database **kosong** yang identitas host/database-nya sudah diverifikasi, gunakan koneksi direct dalam environment sementara lalu jalankan dari root repo:

   ```sh
   DATABASE_URL="$PILOT_DIRECT_DATABASE_URL" bun run db:provision --name "Dekoria Pilot" --slug dekoria-pilot
   ```

   Operator menolak database berisi data. Jangan menjalankan demo seed/reset terhadap database pilot real data. Pada instance pilot sekarang, temporary Owner sudah dibuat melalui bootstrap yang diotorisasi; jangan membuat ulang. User menyelesaikan `/profile/password`, lalu lengkapi akun individual Finance/PM/Purchasing, permissions, project assignment, Settings, dan keputusan saldo awal.

5. Ambil backup sebelum import baseline. Finance memasukkan satu proyek melalui alur aplikasi, kemudian cocokkan angka dengan cutoff. Uji permission dan project scoping memakai akun terpisah; developer account simulation harus mati.
6. Siapkan private ImageKit dan approved AI providers. Verifikasi actual billing/privacy account sebelum membuka AI untuk data real.
7. Selesaikan approval repository private pada Railway dan periksa Full Trial. Buat hanya satu service API sesuai pengaturan di bawah. Tetapkan URL final dan environment; deploy API dahulu, lalu web secara manual. Tidak ada migration/reset otomatis saat build/deploy.
8. Verifikasi HTTPS, cookie login/logout/password, `/health`, `/ready`, chat stream, OCR, file private, notifikasi, dan pemulihan sesudah backend tidur. Catat commit/deployment ID kedua service.

### Environment API — Railway

| Nilai                                                               | Kontrak                                                                                                                |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3001`                  | API dan target public domain/healthcheck memakai port yang sama; Railway membaca `PORT` untuk healthcheck              |
| `API_PUBLIC_URL`, `BETTER_AUTH_URL`                                 | Origin HTTPS API final, tanpa path                                                                                     |
| `WEB_ORIGIN`                                                        | Origin HTTPS web pilot final; jangan wildcard semua preview                                                            |
| `DATABASE_URL`                                                      | Koneksi pooled **pilot**; direct URL cukup di operator/backup, bukan web                                               |
| `BETTER_AUTH_SECRET`, `API_BRIDGE_SECRET`, `ATRIA_BOOTSTRAP_SECRET` | Baru per instance; bridge sama dengan web, minimal 32 karakter; jangan pakai development default                       |
| `IMAGEKIT_PRIVATE_KEY`, `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT`         | Private key hanya API; endpoint harus cocok dengan akun penyimpanan pilot                                              |
| `ATRIA_PILOT_REAL_DATA=true`                                        | Aktifkan policy provider real data                                                                                     |
| `AI_CHAT_PROVIDERS=NINEROUTER`                                      | Default pilot: satu gateway yang telah disetujui; ubah hanya ke ordered chain yang disetujui                           |
| `AI_APPROVED_PROVIDERS`                                             | Daftar provider CSV yang benar-benar disetujui; tetap kosong sehingga AI tertolak sampai verifikasi selesai            |
| `GEMINI_PAID_DATA_POLICY_CONFIRMED=false`, `GEMINI_API_KEY`         | Tetap `false` selama Gemini API free; OCR/direct Gemini real data memerlukan policy akun yang disetujui sebelum `true` |
| `NINEROUTER_API_KEY`, `NINEROUTER_BASE_URL`                         | Gateway approved, tersedia dari internet HTTPS; `localhost:20128` tidak bisa dipakai host cloud                        |
| `NOTIFICATION_JOB_SECRET`                                           | Sama dengan Worker; VAPID web push di API bila push dipakai                                                            |
| `ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED=false`                          | Akun asli dan permission asli dipakai selama pilot                                                                     |

Menambahkan `GEMINI` ke chat chain membutuhkan approval tersendiri; OCR tidak memberi izin otomatis untuk semua fallback chat. Saat provider belum approved atau kuota habis, tampilkan kegagalan yang jelas dan lanjutkan input manual untuk pembukuan pembanding. Jangan fallback ke layanan gratis yang belum disetujui.

### Pengaturan service Railway

Gunakan dashboard settings untuk project baru. `railway.json`/`railway.toml` Config as Code sudah deprecated, tidak digunakan untuk project baru sejak 28 Agustus 2026, dan legacy berakhir 1 Desember 2026; jangan menambahkan file konfigurasi lama untuk pilot ini. IaC baru boleh disiapkan tersendiri setelah host terverifikasi. [Config as Code](https://docs.railway.com/config-as-code/reference), [changelog resmi](https://railway.com/changelog/2026-08-20-railway-anon).

1. Hubungkan repository private dan source candidate yang lulus CI; buat hanya service API, bukan semua package monorepo. Root directory tetap repository root agar workspace/core/patches tersedia.
2. Set `RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile`. Gunakan Docker CMD yang ada; jangan menambahkan build/start command yang menggantikannya. Secret runtime tidak menjadi Docker build ARG. [Dockerfiles](https://docs.railway.com/builds/dockerfiles), [monorepo](https://docs.railway.com/deployments/monorepo).
3. Gunakan satu replica, tanpa database/volume/layanan tambahan. Catat batas resource aktual: slider trial nonaktif pada max dua vCPU/1 GB, sedangkan batas Free sesudah trial 512 MB/satu vCPU. Jangan mengklaim cap yang tidak bisa diterapkan. Set healthcheck deployment ke `/ready`, dengan timeout startup 300 detik. `/health` adalah liveness; `/ready` membuktikan akses database. Healthcheck Railway hanya menghalangi routing deployment yang belum siap, bukan continuous monitor. [Healthchecks](https://docs.railway.com/deployments/healthchecks).
4. Enable Serverless sebelum deploy/redeploy. Referensi saat ini menyatakan service tidur sekitar 5–10 menit sesudah outbound packet terakhir, bukan semata-mata tiadanya request masuk. Mengubah setting pada container yang sudah berjalan baru berlaku setelah deployment berikutnya. Pada pemeriksaan aktual, Architecture menunjukkan Sleeping sesudah lebih dari 10 menit tanpa request API dan wake/readiness lulus satu kali; catat perubahan deployment bila acceptance ini perlu diulang. API memakai Neon Pool yang kompatibel pg; constructor paket terpasang diperiksa tanpa koneksi database dan menunjukkan default `idleTimeoutMillis=10000`, `min=0`. Belum ada override idle eksplisit, tetapi default sudah menutup client yang dilepas setelah idle 10 detik; default ini sendiri bukan bukti tidur; evidence hosted aktual adalah status Sleeping dan hasil wake yang dicatat di dokumen ini. `allowExitOnIdle` tidak menutup socket, dan opsi postgres-js `idle_timeout` tidak berlaku untuk driver ini. Jangan memasang polling/keep-alive tambahan untuk mengakali tidur. [Serverless](https://docs.railway.com/deployments/serverless), [Pool API](https://node-postgres.com/apis/pool).
5. Generate domain HTTPS Railway dengan target port 3001. Simpan origin itu di `API_PUBLIC_URL`/`BETTER_AUTH_URL`, isi `WEB_ORIGIN` dengan web Netlify final, dan update Netlify `API_ORIGIN`; bridge sama di kedua service. Verifikasi readiness/outbound sebelum web dibuild. [Public networking](https://docs.railway.com/networking/public-networking).
6. Catat deployment ID, source commit, plan/status verifikasi, credit expiry/reset, region aktual, quota dan hasil sleep/wake. Jangan menganggap URL yang dihasilkan sudah membuktikan login atau workflow aplikasi.

### Environment web — Netlify

Pada Netlify **Free**, site variables memakai seluruh platform scopes: Builds, Functions, Runtime, dan Post processing. Membatasi scope ke Builds/Functions adalah fitur Pro/Enterprise dan ditolak API Free; gunakan satu context **production** tanpa flag `is_secret`/Secrets Controller berbayar. `API_ORIGIN` dan `API_BRIDGE_SECRET` tetap server-only karena kode server dan namanya tidak memakai `NEXT_PUBLIC`; seluruh scopes tidak berarti otomatis tampil pada JavaScript browser. Jangan menaruh bridge secret di TOML. [Netlify variable scopes](https://docs.netlify.com/build/environment-variables/overview/#scopes).

`API_ORIGIN` adalah origin HTTPS API final. Isi `NEXT_PUBLIC_APP_URL` dengan URL web final, `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY` dengan public upload key yang sesuai, dan `ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED=false`. Backend/database/auth/AI private keys tidak masuk web. Matikan auto deploy, branch deploy dan Deploy Preview melalui pengaturan site saat link; jangan memberi preview umum akses API/database pilot real data. Metadata tujuh variables sudah diverifikasi dengan actual account ID: masing-masing satu production context dan semua empat scopes, sesuai konfigurasi private; nilai tidak dicetak.

`NEXT_PUBLIC_ATRIA_PILOT_MODE=true` sudah ada pada build environment TOML pilot. Flag public ini dikompilasi saat build dan menampilkan “Saldo pilot: snapshot awal + transaksi pilot” pada Dashboard/rekening. Environment normal memakai `false`; perubahan flag membutuhkan rebuild.

Gunakan build command dan configured publish directory dari TOML, field Base kosong (repo root), Package directory `apps/web`, runtime Next.js otomatis, serta Bun 1.3.14. Builds otomatis dihentikan; production public dan preview private. Setelah standalone `netlify build`, no-build CLI deploy memakai `apps/web/.netlify/static` sesuai command yang telah diuji di bawah. Jangan upload raw `.next` yang dipulihkan sesudah plugin selesai. Paket runtime Next tidak perlu dipasang atau dipin manual. [Netlify Bun](https://docs.netlify.com/build/configure-builds/available-software-at-build-time/).

Netlify Functions mempunyai batas eksekusi dan payload; nilai Next `maxDuration` tidak memperpanjang limit provider. Current streaming limit 60 detik dan buffered payload 6 MB. File dikirim langsung ke API/storage melalui ticket, bukan Base64 besar dalam Server Action. Uji response chat dan SSE reconnect pada deployment sebenarnya. [Functions configuration](https://docs.netlify.com/build/functions/configuration/), [streaming API](https://docs.netlify.com/build/functions/api/).

### Cold start dan recovery

Evidence aktual `2026-10-04T09:13:00Z`: kartu Railway Architecture menunjukkan Sleeping sesudah lebih dari 10 menit tanpa request API; screenshot disimpan. First anonymous GET `/ready` sukses pada percobaan pertama, 200/ready dalam 2.858 s; `/health` berikutnya 200/ok dalam 0.242 s. API bangun dan koneksi Neon siap pada satu kasus ini. Tidak ada jaminan latency dan tidak ada proof quota exhaustion, AI stream/timeout atau retry transaksi bisnis dari pemeriksaan ini.

Sebelum sesi dengan Owner, buka `/health`, lalu pastikan `/ready` merespons siap. Pada acceptance test, enable Serverless lalu redeploy, tutup web/SSE dan tunggu lebih dari 10 menit tanpa outbound; periksa service benar-benar tidur sebelum menguji wake. Koneksi pool/telemetry/job recovery dapat mencegah tidur, jadi toggle saja belum membuktikan penghematan kredit. Cold wake dapat memberi 502 pertama; tunggu kesiapan lalu reload read. Jangan otomatis mengulang pembayaran, pengeluaran, atau movement setelah timeout ambigu. Periksa activity/status/audit sebelum tindakan baru. [Sleep/wake tradeoff](https://docs.railway.com/guides/cut-idle-costs-serverless).

Worker pilot terpisah sudah memakai `ATRIA_API_URL` pilot dan secret baru; config scheduler existing dipertahankan. Manual authorized reconcile sukses, sementara actual Cron firing/recovery dan delivery tetap acceptance gate. Jangan mengasumsikan ada cron web; `apps/web/vercel.json` tidak mengatur job pilot ini.

## Backup, restore, dan rollback

Finance bertanggung jawab atas backup cutoff, setiap akhir hari kerja, dan sebelum migration/import. Target awal pilot: kehilangan data paling banyak satu hari kerja ketika backup sehat; ukur waktu restore dan sepakati target pemulihan sebelum undangan. Pembukuan pembanding dan export delta tetap tersedia jika hosting/quota berhenti.

Gunakan credential backup read-only pada koneksi direct, disimpan sebagai PostgreSQL service/passfile mode 600. `PILOT_PG_SERVICE` menunjuk **database pilot yang diverifikasi**, dan `PILOT_BACKUP_PATH` menunjuk storage lokal terenkripsi/private. Contoh operator setelah service file disiapkan:

```sh
pg_dump --dbname="service=$PILOT_PG_SERVICE" --format=custom --no-owner --no-acl --file="$PILOT_BACKUP_PATH"
pg_restore --file=/dev/null "$PILOT_BACKUP_PATH"
shasum -a 256 "$PILOT_BACKUP_PATH"
```

Simpan archive, checksum, migration version, commit API/web, cutoff, dan waktu selesai selama pilot ditambah 30 hari, dalam batas quota. Backup workflow production existing mempunyai host guard khusus instance lama; jangan mengganti guard-nya atau menggunakannya untuk pilot tanpa workflow/credential terpisah. Jangan mengupload dump ke artifact GitHub publik.

Workflow **Pilot database backup** terpisah tersedia pada `.github/workflows/pilot-db-backup.yml`, dengan manual trigger dan jadwal 02.47 WIB. Default gate `ATRIA_PILOT_BACKUP_ENABLED` tidak aktif sehingga tidak ada akses database/cloud. Script `scripts/backup-pilot-db.sh` memeriksa host/database/user pilot secara eksplisit, menolak endpoint production lama, pooled endpoint, TLS tidak aman, routing override, role yang dapat menulis, serta schema yang berubah selama dump. Archive dan manifest diverifikasi dengan download ulang/SHA-256; manifest memuat actual migration identity, cutoff Finance, commit deployment API/web, dan commit workflow. Dump/lampiran tidak dikirim sebagai artifact CI.

Setelah akun R2 private, lifecycle/lock, quota Rp0, dan role read-only **`atria_pilot_backup`** disetujui, isi pengaturan berikut tanpa menyalin credential production:

| GitHub setting                                                                   | Jenis                                                                |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `ATRIA_PILOT_BACKUP_DATABASE_URL`                                                | Secret, direct pilot URL dengan TLS dan user `atria_pilot_backup`    |
| `ATRIA_PILOT_BACKUP_EXPECTED_HOST`, `ATRIA_PILOT_BACKUP_EXPECTED_DATABASE`       | Variables, identitas source yang diverifikasi                        |
| `ATRIA_PILOT_BACKUP_R2_ACCOUNT_ID`, `ATRIA_PILOT_BACKUP_R2_BUCKET`               | Variables, destination private yang disetujui                        |
| `ATRIA_PILOT_BACKUP_R2_ACCESS_KEY_ID`, `ATRIA_PILOT_BACKUP_R2_SECRET_ACCESS_KEY` | Secrets terbatas pada bucket backup pilot                            |
| `ATRIA_PILOT_CUTOFF_ISO`                                                         | Variable, timestamp cutoff dengan timezone, disetujui Finance        |
| `ATRIA_PILOT_API_RELEASE_COMMIT`, `ATRIA_PILOT_WEB_RELEASE_COMMIT`               | Variables, commit yang benar-benar dideploy; update setelah release  |
| `ATRIA_PILOT_BACKUP_ENABLED`                                                     | Variable, set `true` terakhir setelah seluruh prerequisite diperiksa |

Role backup hanya mendapat CONNECT, USAGE pada schema `public`/`drizzle`, SELECT tabel/sekuens yang diperlukan, dan default privileges SELECT untuk tabel baru. Jangan memberikan ownership/INSERT/UPDATE/DELETE/TRUNCATE. Jalankan workflow manual setelah gate diaktifkan, buktikan archive+manifest remote serta restore terisolasi, lalu periksa run nightly berikutnya. Kegagalan harus ditangani Finance; schedule GitHub dapat terlambat dan bukan jaminan RPO 24 jam. Backup lampiran ImageKit tetap pekerjaan terpisah yang wajib terbukti sebelum real-data pilot.

Restore rehearsal memakai database kosong yang terpisah, bukan branch/current database pilot in place. Verifikasi source archive/checksum serta identitas target; gunakan `PILOT_RESTORE_PG_SERVICE` yang tidak sama dengan service pilot:

```sh
pg_restore --exit-on-error --no-owner --no-acl --dbname="service=$PILOT_RESTORE_PG_SERVICE" "$PILOT_BACKUP_PATH"
```

Kemudian jalankan `bun run db:check-invariants` dengan URL **restore target** di environment sementara, cocokkan baseline plus pilot deltas, dan lakukan login serta satu alur finance/material di preview terisolasi. Catat durasi, hasil, dan siapa yang memeriksa. Dump PostgreSQL tidak berisi byte file ImageKit: cadangkan lampiran pilot private beserta file ID/checksum dan buktikan pemulihan satu nota. Neon history window saja tidak menggantikan backup harian. Jangan menganggap private URL yang kedaluwarsa sebagai file yang hilang.

Untuk rollback aplikasi, hentikan input pilot sementara dan kembali ke deployment API/web yang sudah dicatat dan kompatibel dengan schema saat ini. Railway Trial/Free menyimpan image deployment yang dihapus selama 24 jam; sesudah itu gunakan redeploy source commit yang diketahui, jangan mengandalkan image history permanen. Migration additive tidak dibalik dengan menghapus tabel/kolom. Cocokkan transaksi yang sudah commit dengan pembukuan pembanding; timeout bukan bukti transaksi gagal. Restore data dilakukan ke target terpisah, diperiksa, baru diputuskan cutover oleh Owner/Finance. [Image retention](https://docs.railway.com/pricing/plans#image-retention-policy).

## Walkthrough Owner — 15 menit

| Waktu       | Hasil yang ditunjukkan                                                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–3 menit   | Owner membuka proyek: nilai kontrak/RAB, budget, consumed/paid/remaining, lima kategori, dan risiko margin; jelaskan cutoff                                       |
| 3–7 menit   | PM memasukkan nota yang benar-benar disetujui Finance, OCR mengisi draft, manusia memeriksa kategori/jumlah; Owner approve, Finance mencatat pembayaran eksplisit |
| 7–10 menit  | Purchasing menunjukkan penerimaan/reservasi/pemakaian/return yang relevan; quantity dan movement audit sesuai; cash impact tetap melalui finance                  |
| 10–12 menit | Buka/export RAB client-safe dan periksa bahwa internal cost/markup/vendor notes tidak muncul                                                                      |
| 12–15 menit | Akun lain refresh melihat status terbaru; cocokkan delta kategori/stock/bank, tunjukkan activity/audit dan catat feedback                                         |

Rehearsal transaksi buatan dilakukan di sandbox sintetis. Jangan membuat pembayaran/stok fiktif pada database real pilot untuk membuat demo menarik. Bos menguji workflow menggunakan akun dan izin sebenarnya, tanpa developer simulation.

Validasi rekening terbatas pada **saldo snapshot saat cutoff + delta transaksi pilot**. Itu bukan bukti bahwa seluruh mutasi bank perusahaan sudah dimigrasikan atau direkonsiliasi. Mismatch dicatat dan diperiksa Finance sebelum angka dipercaya.

Undangan dikirim setelah acceptance checklist di `docs/plans/2026-10-04-web-audit-boss-pilot.md` lengkap, cutoff ditandatangani Finance, backup/restore terbukti, quota/account Rp0 diverifikasi, serta privacy/provider approval dicatat. Catat URL final dan laporan pemeriksaan di evidence log plan; tidak ada secret di sana.

## Mengulang PostgreSQL test lokal/CI dengan aman

Gunakan container PostgreSQL disposable dengan label `atria.purpose=readiness-audit` dan port loopback. `ATRIA_LOCAL_TEST_DATABASE_URL` harus menunjuk database **baru** dengan prefix `atria_audit_*`; operator menolak target berisi tabel, remote host, query-routing parameter, atau production environment. Jangan menyalin `DATABASE_URL` development.

```sh
# Dari apps/api; environment hanya memuat URL container disposable yang diverifikasi.
bun scripts/prepare-disposable-postgres.ts atria_audit_empty
# Dari root repo, setiap suite mendapat clone tersendiri dan clone itu dihapus.
python3 apps/api/scripts/run-local-postgres-audit.py --container "$PILOT_TEST_CONTAINER" --logs output/postgres-integration
```

CLI preparation menggunakan SQL operator dan seed sintetis pada fresh database saja. Runtime aplikasi tetap memakai Neon; adapter TCP lokal hanya dipakai pengujian/operator. Workflow GitHub menjalankan proses yang sama tanpa production secret. Hapus container dan task-local credential setelah seluruh pemeriksaan/E2E selesai.

Restore drill sintetis yang tidak memakai cloud:

```sh
python3 apps/api/scripts/pilot-backup-local-drill.py --container "$PILOT_TEST_CONTAINER" --directory "$PILOT_PRIVATE_DRILL_DIRECTORY" --cutoff "$PILOT_SYNTHETIC_CUTOFF_ISO"
```

Program memeriksa container label/port/source, membuat target `atria_audit_restore_*` baru, melakukan dump/readback/restore, lalu menjalankan actual finance/material invariants. Target restore dihapus setelah pemeriksaan; archive/manifest/log hanya ada di direktori private yang ditentukan. Ini membuktikan mekanisme pada fixture sintetis, tidak membuktikan backup akun pilot remote atau recovery byte lampiran.

Pengujian PWA outage lokal yang sudah mempunyai env fixture terisolasi, dari `apps/web`:

```sh
ATRIA_E2E_ENV_FILE="$PILOT_PRIVATE_E2E_ENV_FILE" NEXT_PUBLIC_ATRIA_PILOT_MODE=true bun --no-env-file e2e/pwa-outage-controller.ts
```

Controller hanya boleh mengelola proses web miliknya dan menolak server yang sudah berjalan. Ini memeriksa putus koneksi nyata, offline fallback anonymous, serta tidak adanya queue/retry POST; jangan menjalankannya terhadap instance pilot real-data. Hentikan proses controller milik test dengan Ctrl+C sesudahnya.

### Backup konfigurasi awal dan restore lokal — 4 Oktober 2026

Timestamp capture `2026-10-04T09:10:54Z` adalah snapshot konfigurasi sebelum data bisnis, bukan cutoff Finance. Operator memeriksa exact fresh source Neon `ep-damp-resonance-b36gzzjo.c-4.ap-southeast-1.aws.neon.tech`, database `atria_pilot` dan owner `atria_pilot_owner`, lalu membuat `atria_pilot_backup` dengan CONNECT/USAGE/SELECT serta owner default SELECT saja. Hasil effective checks: transaction_read_only on, canWrite false, ownedTables 0, privileged false, memberships 0. Credential tetap lokal, tanpa pengiriman ke GitHub/R2.

Custom dump PostgreSQL 17 memakai login read-only itu dan direstore ke target disposable baru berlabel serta loopback-only. Seluruh count/fingerprint 68 tabel cocok, termasuk auth/config/audit, dengan 44 migrations dan satu temporary Owner. Target kemudian dihapus. Archive 306.483 bytes; SHA-256 `abe5a4ee07a426812021895e917ba7946cfc838add23d10e613aa75e9085c2f1`. Direktori private memakai 0700 dan file 0600; isi row auth tidak dicetak. Path private/credential dan password tidak dicatat di dokumen ini.

Hasil ini membuktikan pemulihan konfigurasi awal saja. Ia tidak mencakup data bisnis perusahaan, invariant bisnis/keuangan, byte lampiran, R2 atau nightly backup. Restore sintetis sebelumnya dengan enam invariant atas 83 row tetap evidence terpisah. Cutoff/baseline Finance, R2/nightly serta recovery data bisnis/lampiran tetap gate yang belum selesai.

### Private storage runtime check — release gate

A live synthetic ImageKit upload and metadata request returned 200 with `isPrivateFile=true`; the exact QA files were deleted (204, followed by metadata 404). Disposable HTTP checks returned upload-ticket 200 for a legacy PostgreSQL UUID-shaped project, anonymous download 401 and foreign-project PM denial. Owner authorization reached delivery, which failed certificate validation. The CDN `ik.imagekit.io` presented a certificate valid from 6 March to 4 June 2026; Bun, system curl and OpenSSL rejected it on 4 October. No TLS checks were disabled. Unsigned denial and signed exact-byte delivery remain unverified; real-data attachment/OCR pilot stays blocked until a valid configured delivery endpoint is verified.

The two project-ID upload schemas now accept PostgreSQL UUID-shaped legacy IDs with `z.guid()` while preserving permission/scope checks. Nine focused cases with 49 assertions, API TypeScript and focused ESLint passed.

### Hosted API release dan historical first web attempt — 4 Oktober 2026

Current API deployment `d7db48e7-421f-4c86-a603-32cba4fd8b10` is active in US West with one replica from source `e302b882`, with [quality and PostgreSQL CI success](https://github.com/LibranRst/atria-erp/actions/runs/37190352488). Runtime business code is unchanged from prior app release `ce6276aa510c90489216d4d230f36db28dd5e61b` ([its CI](https://github.com/LibranRst/atria-erp/actions/runs/37185289687)); the old `7bbb22fb-9146-4567-876d-54751decc94b` deployment was removed during normal rollforward. HTTPS [API](https://atria-pilot-api-production.up.railway.app) returned `/health` 200 and `/ready` 200, proving the pilot Neon connection. No AI keys or original database credentials were copied. Actual sleep/wake also passed once: Architecture showed Sleeping after more than 10 minutes without API requests; at `2026-10-04T09:13:00Z`, first anonymous /ready returned 200/ready in 2.858 s, followed by /health 200/ok in 0.242 s. This proves one API wake with Neon readiness, not guaranteed latency, credit exhaustion or business retry behaviour.

Historical first web attempt: Netlify `6ac1fed28e544d47da3b4274` used the raw artifact from a local build and produced JavaScript 404s. Production was then behind Netlify team access, which intercepted login before Atria. That deployment is no longer published: it was deleted with explicit user approval and verified 404. Current production is corrected deployment `6ac20cc355a894774f00a5a4`, public with private previews, and actual Owner login/password-gate evidence follows below. Provider `commit_ref` is unset for the manual artifact upload; the release identity is recorded through the clean source checkout and deployment title.

### Pilot notification scheduler

The separate `atria-pilot-notification-scheduler` Cloudflare Worker is deployed using `apps/api/workers/notification-scheduler/wrangler.pilot.jsonc`; the existing scheduler config is preserved. It binds only the pilot API URL and a fresh notification job secret. Cron schedules are every 30 minutes plus 17:00 UTC daily. Manual HTTPS checks with the explicit Atria readiness user agent returned anonymous 401 and authorized reconcile 200/upstream 200; the default Python user agent was rejected by the edge with 1010 before reaching the Worker. No edge protection was disabled. Actual Cron firing/recovery and delivery of real pilot notifications remain acceptance checks.

### Final web artifact and temporary Owner

Corrected production deployment: `6ac20cc355a894774f00a5a4`. Manual `netlify build` restores raw `.next` after the Next plugin runs; a subsequent no-build deploy must publish `apps/web/.netlify/static`, retaining the internal SSR/edge cache. Normal plugin builds still use configured publish `apps/web/.next`. The earlier raw-artifact deployment `6ac1fed28e544d47da3b4274` produced JavaScript 404s and was deleted with explicit user approval; metadata now returns Not Found. A required application chunk changed from 404 to 200/JavaScript with 304,125 bytes after the corrected upload.

Current production visibility is Public with Deploy Previews Private, approved by the user. No auth code was changed to bypass the historical edge-access layer. User-authorized bootstrap created one temporary Owner without business transactions. HTTPS browser login issued a Secure/HttpOnly/Lax session and reached welcome onboarding. A guarded authenticated operator transaction marked the password temporary, wrote an audit and revoked sessions; the next login redirected to `/profile/password`. The user has not changed the personal password; replacement is required before real business use. No password or secret values are recorded here.

### Manual Netlify artifact command and password gate proof

Build from the clean release checkout with production environment variables:

```sh
bunx netlify-cli build --filter @atria/web --context production
bunx netlify-cli deploy --filter @atria/web --dir apps/web/.netlify/static --no-build --site c316f6d9-328f-4702-b5ea-dfc8c75c4ce3 --prod
```

Do not combine `--context` with `--no-build` in the tested CLI version. Do not upload raw `.next` after a standalone build: its layout differs from the transformed static artifact and includes server artifacts. Production login is publicly reachable (200); anonymous `/ledger`, `/admin`, and `/projects` returned 307 to `/login`. A fresh temporary-Owner sign-in was redirected to `/profile/password`, proving the password-change gate. No project, balance, stock, vendor/client transaction or real attachment has been imported into the pilot.

Ulangi verifier deployment anonymous dari root repository:

```sh
bun run verify:pilot --web https://atria-boss-pilot.netlify.app --api https://atria-pilot-api-production.up.railway.app
```

Verifier memeriksa JSON health/readiness, public login HTML beserta script/font asset terbaru, redirect anonymous pada route terproteksi, dan penolakan server artifact. Ia tidak login, mengubah password, membaca data bisnis, memverifikasi Cron scheduler, atau menjalankan workflow finance/material. Hasil lulus tidak menggantikan hosted business UAT.
