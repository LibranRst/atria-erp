# Pilot web gratis untuk Owner

Disiapkan 4 Oktober 2026. Remediasi dan pemeriksaan lokal tersedia; database cloud pilot sudah diprovision. Web/API belum selesai dideploy dan belum ada persetujuan go-live.

Pilot berlangsung dua minggu untuk satu proyek berjalan, memakai data perusahaan yang disetujui Finance, dengan akun Owner, Finance, PM, dan Purchasing. Pembukuan yang sekarang tetap menjadi sumber pembanding. Laptop dan web di HP sama-sama masuk acceptance check. AI chat dan OCR wajib berfungsi sebelum undangan diberikan.

### Status persiapan aktual

- Neon project `polished-glade-93740595`, branch `br-lucky-heart-b3qmgl34`, database `atria_pilot`: PostgreSQL 17 Singapore, min/max compute 0,25 CU, quota Free 1 GiB. Provision lulus dengan 44 migrations, 67 tabel, empat role sistem, nol user. Belum ada data bisnis perusahaan; jangan menjalankan ulang provision/reset/seed terhadap database ini.
- Netlify site <https://atria-boss-pilot.netlify.app> sudah direservasi pada team Free, dengan environment web terpisah dari DB/AI secrets. Reservasi URL tidak berarti aplikasi sudah melayani request atau login HTTPS sudah diuji.
- Image `atria-pilot-api:local` sudah berhasil dibuild dan berjalan di port lokal 3212; `/health` dan `/ready` merespons 200 memakai database Neon pilot, tanpa mutasi bisnis. Render/web hosted dan cold-start masih harus dibuktikan sesudah deploy.
- Gemini API user masih free. Tetap gunakan `GEMINI_PAID_DATA_POLICY_CONFIRMED=false` dan approved providers kosong sampai keputusan provider yang diizinkan untuk data real selesai. Jangan mengirim nota/mutasi bank/data perusahaan ke provider free untuk melompati gate ini. OCR/chat pada data asli belum siap untuk undangan pilot.

Checklist dan evidence terperinci ada di [rencana/evidence pilot](../plans/2026-10-04-web-audit-boss-pilot.md); hasil lokal sintetis dipisahkan dari gate hosted/data real.

## Hosting dan batas Rp0

| Bagian              | Pilihan                           | Pengaturan                                                                                                            |
| ------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Web                 | Netlify Free, Next.js runtime     | Base repo root, **Package directory `apps/web` di UI**, publish `apps/web/.next`; konfigurasi `apps/web/netlify.toml` |
| API                 | Render Free, Bun Docker           | `render.yaml`, root Docker context, `apps/api/Dockerfile`, region Singapore, deploy manual setelah gate lulus         |
| Database            | Neon Free, project pilot terpisah | Runtime pooled; koneksi direct untuk migration dan backup                                                             |
| Lampiran            | ImageKit                          | Nota, bukti bayar, dan mutasi bank private; URL download singkat setelah pemeriksaan akses                            |
| Recovery notifikasi | Cloudflare Worker existing        | Upstream API langsung; 30 menit delivery recovery dan harian 00.00 WIB                                                |

Netlify mendukung SSR, Server Actions, route handlers, dan streaming melalui runtime Next. Package directory hanya dapat ditetapkan di UI; file TOML menggunakan base root agar Bun workspace dan kontrak API ikut tersedia. [Netlify monorepos](https://docs.netlify.com/build/configure-builds/monorepos/), [Next.js runtime](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/).

Render Free tidur setelah 15 menit tidak aktif, bangun sekitar satu menit, dan filesystem bersifat sementara. Simpan database di Neon dan file di ImageKit. Jangan membuat disk, database Render, atau background worker berbayar dari blueprint ini. Free instance mempunyai batas jam, bandwidth, build, dan outbound traffic; sebagian overage dapat ditagih jika payment method terpasang. Periksa akun Free dan matikan upgrade/overage yang belum disetujui. [Render Free](https://render.com/docs/free), [Render billing FAQ](https://render.com/docs/faq).

Netlify Free mempunyai hard limit kredit bulanan dan dapat menghentikan semua proyek dalam satu team saat kuota habis. Jangan mengaktifkan paket berbayar atau auto recharge. Periksa usage pada awal pilot dan setiap hari kerja; jika kuota 80%, hentikan deploy dan aktivitas tambahan, lalu evaluasi dengan Owner. [Netlify Free limits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [paused projects](https://docs.netlify.com/manage/accounts-and-billing/billing/resume-paused-projects/).

Rp0 hosting tidak berarti AI otomatis gratis. Gunakan hanya layanan/credits yang sudah tersedia dan disetujui. Sebelum real data, catat owner akun, region, quota reset, spend cap, retensi, training policy, dan fallback untuk Neon, ImageKit, gateway chat, serta Gemini OCR. Periksa juga quota/budget GitHub Actions; artifact CI hanya hasil sintetis dengan retensi tujuh hari. Jangan mengganti paket atau provider hanya untuk membuat demo berjalan.

## Urutan persiapan

1. Lulus workflow **Web pilot quality**, pengujian browser dan viewport, serta restore rehearsal. Workflow hanya menggunakan PostgreSQL lokal disposable dan fixture sintetis; tidak mengambil database/AI/storage secret perusahaan.
2. Finance menyetujui cutoff bertanggal: nilai kontrak dan RAB, budget kategori, consumed/pending/paid, utang/piutang, stok/reservasi, dan saldo rekening awal. Catat asal setiap angka serta siapa yang menyetujuinya.
3. Buat Neon project/database pilot yang terpisah dari instance berjalan. Isi secret secara lokal/di provider; jangan menaruh URL credential di chat, Git, screenshot, atau log.
4. Untuk database **kosong** yang identitas host/database-nya sudah diverifikasi, gunakan koneksi direct dalam environment sementara lalu jalankan dari root repo:

   ```sh
   DATABASE_URL="$PILOT_DIRECT_DATABASE_URL" bun run db:provision --name "Dekoria Pilot" --slug dekoria-pilot
   ```

   Operator menolak database berisi data. Jangan menjalankan demo seed/reset terhadap database pilot real data. Buat Owner pertama melalui `/setup`, lalu lengkapi Finance/PM/Purchasing, permissions, project assignment, Settings, dan keputusan saldo awal.

5. Ambil backup sebelum import baseline. Finance memasukkan satu proyek melalui alur aplikasi, kemudian cocokkan angka dengan cutoff. Uji permission dan project scoping memakai akun terpisah; developer account simulation harus mati.
6. Siapkan private ImageKit dan approved AI providers. Verifikasi actual billing/privacy account sebelum membuka AI untuk data real.
7. Buat Render service dari blueprint dan Netlify project. Tetapkan URL final dan environment berikut; deploy API dahulu, lalu web. Tidak ada migration/reset otomatis saat build/deploy.
8. Verifikasi HTTPS, cookie login/logout/password, `/health`, `/ready`, chat stream, OCR, file private, notifikasi, dan pemulihan sesudah backend tidur. Catat commit/deployment ID kedua service.

### Environment API — Render

| Nilai                                                               | Kontrak                                                                                                              |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV=production`, `HOST=0.0.0.0`                               | `PORT` diberikan Render; API membaca port itu                                                                        |
| `API_PUBLIC_URL`, `BETTER_AUTH_URL`                                 | Origin HTTPS API final, tanpa path                                                                                   |
| `WEB_ORIGIN`                                                        | Origin HTTPS web pilot final; jangan wildcard semua preview                                                          |
| `DATABASE_URL`                                                      | Koneksi pooled **pilot**; direct URL cukup di operator/backup, bukan web                                             |
| `BETTER_AUTH_SECRET`, `API_BRIDGE_SECRET`, `ATRIA_BOOTSTRAP_SECRET` | Baru per instance; bridge sama dengan web, minimal 32 karakter; jangan pakai development default                     |
| `IMAGEKIT_PRIVATE_KEY`, `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT`         | Private key hanya API; endpoint harus cocok dengan akun penyimpanan pilot                                            |
| `ATRIA_PILOT_REAL_DATA=true`                                        | Aktifkan policy provider real data                                                                                   |
| `AI_CHAT_PROVIDERS=NINEROUTER`                                      | Default pilot: satu gateway yang telah disetujui; ubah hanya ke ordered chain yang disetujui                         |
| `AI_APPROVED_PROVIDERS`                                             | Daftar provider CSV yang benar-benar disetujui; blueprint kosong sehingga AI tertolak sampai verifikasi selesai      |
| `GEMINI_PAID_DATA_POLICY_CONFIRMED=true`, `GEMINI_API_KEY`          | Wajib untuk OCR/direct Gemini pada real-data pilot setelah kebijakan account diverifikasi; blueprint default `false` |
| `NINEROUTER_API_KEY`, `NINEROUTER_BASE_URL`                         | Gateway approved, tersedia dari internet HTTPS; `localhost:20128` tidak bisa dipakai Render                          |
| `NOTIFICATION_JOB_SECRET`                                           | Sama dengan Worker; VAPID web push di API bila push dipakai                                                          |
| `ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED=false`                          | Akun asli dan permission asli dipakai selama pilot                                                                   |

Menambahkan `GEMINI` ke chat chain membutuhkan approval tersendiri; OCR tidak memberi izin otomatis untuk semua fallback chat. Saat provider belum approved atau kuota habis, tampilkan kegagalan yang jelas dan lanjutkan input manual untuk pembukuan pembanding. Jangan fallback ke layanan gratis yang belum disetujui.

### Environment web — Netlify

Pada Netlify **Free**, site variables memakai seluruh platform scopes: Builds, Functions, Runtime, dan Post processing. Membatasi scope ke Builds/Functions adalah fitur Pro/Enterprise dan ditolak API Free; gunakan satu context **production** tanpa flag `is_secret`/Secrets Controller berbayar. `API_ORIGIN` dan `API_BRIDGE_SECRET` tetap server-only karena kode server dan namanya tidak memakai `NEXT_PUBLIC`; seluruh scopes tidak berarti otomatis tampil pada JavaScript browser. Jangan menaruh bridge secret di TOML. [Netlify variable scopes](https://docs.netlify.com/build/environment-variables/overview/#scopes).

`API_ORIGIN` adalah origin HTTPS API final. Isi `NEXT_PUBLIC_APP_URL` dengan URL web final, `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY` dengan public upload key yang sesuai, dan `ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED=false`. Backend/database/auth/AI private keys tidak masuk web. Matikan auto deploy, branch deploy dan Deploy Preview melalui pengaturan site saat link; jangan memberi preview umum akses API/database pilot real data. Metadata tujuh variables sudah diverifikasi dengan actual account ID: masing-masing satu production context dan semua empat scopes, sesuai konfigurasi private; nilai tidak dicetak.

`NEXT_PUBLIC_ATRIA_PILOT_MODE=true` sudah ada pada build environment TOML pilot. Flag public ini dikompilasi saat build dan menampilkan “Saldo pilot: snapshot awal + transaksi pilot” pada Dashboard/rekening. Environment normal memakai `false`; perubahan flag membutuhkan rebuild.

Gunakan build command dan publish directory dari TOML, pilih Next.js runtime otomatis, serta Bun 1.3.14. Paket runtime Next tidak perlu dipasang atau dipin manual. [Netlify Bun](https://docs.netlify.com/build/configure-builds/available-software-at-build-time/).

Netlify Functions mempunyai batas eksekusi dan payload; nilai Next `maxDuration` tidak memperpanjang limit provider. Current streaming limit 60 detik dan buffered payload 6 MB. File dikirim langsung ke API/storage melalui ticket, bukan Base64 besar dalam Server Action. Uji response chat dan SSE reconnect pada deployment sebenarnya. [Functions configuration](https://docs.netlify.com/build/functions/configuration/), [streaming API](https://docs.netlify.com/build/functions/api/).

### Cold start dan recovery

Sebelum sesi dengan Owner, buka `/health`, lalu pastikan `/ready` merespons siap. Lakukan sekali lagi setelah idle lebih dari 15 menit pada acceptance test. Jangan memasang keep-alive agresif: itu memakan quota dan dapat mencegah database idle. Jika UI gagal saat startup, tunggu kesiapan lalu reload read; jangan otomatis mengulang pembayaran, pengeluaran, atau movement setelah timeout ambigu. Periksa activity/status/audit sebelum tindakan baru.

Worker existing harus memakai `ATRIA_API_URL` final dan secret pilot, bukan upstream instance lama. Jangan mengasumsikan ada cron web; `apps/web/vercel.json` tidak mengatur job pilot ini.

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

Untuk rollback aplikasi, hentikan input pilot sementara dan kembali ke deployment API/web yang sudah dicatat dan kompatibel dengan schema saat ini. Migration additive tidak dibalik dengan menghapus tabel/kolom. Cocokkan transaksi yang sudah commit dengan pembukuan pembanding; timeout bukan bukti transaksi gagal. Restore data dilakukan ke target terpisah, diperiksa, baru diputuskan cutover oleh Owner/Finance.

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
