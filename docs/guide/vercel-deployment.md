# Deploy ke Vercel

> Historical deployment record: this guide describes the full-stack Vercel instance before backend extraction on 1 October 2026. Do not use its environment/cron instructions for the independent API. Current web owns only the API origin/bridge and public client settings; database/auth/AI/storage/job secrets and scheduling belong to the API. For the agreed free Netlify + Render pilot, use [free boss pilot](free-boss-pilot.md); for local development use [independent API development](mobile-api-development.md). No deployment was performed during extraction.

**Diperbarui:** 2026-09-29
**Terkait:** `docs/guide/notifications.md`, `docs/guide/provision-instance.md`

Instance produksi: **https://atria-erp.vercel.app**
Proyek Vercel: `atria-erp` (team `hyuzins-projects`), Root Directory `apps/web`, region fungsi `sin1`.
Database: Neon project `atria-erp-prod` (branch `main`, `aws-ap-southeast-1`).

Cutover 29 September: deployment live `dpl_HVGdmeHfuYWBa46c7QHNSvjneGZn`, pooled
runtime `DATABASE_URL`, direct `DATABASE_URL_UNPOOLED`, dan fungsi `sin1` sudah
diverifikasi. Secret production existing dipertahankan. Source release berada di
managed checkout/branch lokal `codex/readiness-pooled-release`; integrasi ke working
branch dikerjakan 30 September dengan mempertahankan kebutuhan linker Metro mobile.

## Bentuk deployment

Repo ini **monorepo Bun workspace**: aplikasi Next.js ada di `apps/web/`, sementara
`packages/core` dan `packages/tokens` di-consume lewat `workspace:*`. Dua konsekuensi
yang tidak boleh dilupakan:

1. **Root Directory proyek Vercel harus `apps/web`.** `apps/web/vercel.json` hanya
   terbaca bila root directory menunjuk ke sana, jadi jadwal cron dan region
   fungsi ikut hilang bila nilai ini berubah.
2. **Perintah Vercel CLI harus dijalankan dari root repo, bukan dari `apps/web`.**
   Vercel menafsirkan `rootDirectory` relatif terhadap berkas yang diunggah; mengunggah
   `apps/web/` membuat path `apps/web` tidak ada di dalamnya dan build gagal dengan
   `The specified Root Directory "apps/web" does not exist`.

## `.vercelignore` wajib ada

Vercel CLI **tidak membaca `.gitignore`** ketika menyusun konteks deployment. Tanpa
`.vercelignore`, `node_modules/` (159 ribu berkas), worktree agen, dan berkas `.env`
lokal ikut terunggah; deployment pertama gagal dengan
`files should NOT have more than 15000 items, received 24430`, dan arsip 767 MB
berikutnya gagal karena symlink `node_modules/.bin` serta berisiko membocorkan
kredensial pengembangan. Dengan daftar saat ini konteksnya sekitar 1.300 berkas.

Daftar itu hanya membuang yang tidak pernah disentuh `next build`. `packages/`,
`tsconfig.base.json`, `bun.lock`, dan seluruh `apps/web` tetap ikut; pengujian,
Storybook, `docs/`, dan `apps/mobile` tidak.

## Variabel lingkungan

Wajib diisi pada environment **Production**:

| Variabel                                                                                                               | Catatan                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                                                         | Hanya Production. Preview sengaja tanpa nilai agar deployment pratinjau tidak pernah menulis ke database perusahaan yang sedang berjalan.                                                                           |
| `BETTER_AUTH_SECRET`                                                                                                   | Baru per instance. Menyalinnya antar instance membuat sesi satu perusahaan sah di perusahaan lain.                                                                                                                  |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`                                                                               | Harus origin produksi (`https://atria-erp.vercel.app`). `lib/auth.ts` memakai keduanya sebagai trusted origin; nilai `localhost` membuat login ditolak `403`.                                                       |
| `ATRIA_BOOTSTRAP_SECRET`                                                                                               | Minimal 16 karakter; tanpa ini `/setup` selalu `FORBIDDEN`.                                                                                                                                                         |
| `CRON_SECRET`, `NOTIFICATION_JOB_SECRET`                                                                               | Bearer secret worker notifikasi.                                                                                                                                                                                    |
| `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`                                          | Satu pasangan VAPID stabil per environment.                                                                                                                                                                         |
| `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`                                                                                   | Rantai cadangan model AI.                                                                                                                                                                                           |
| `NINEROUTER_API_KEY`, `NINEROUTER_BASE_URL`, `NINEROUTER_MODEL_ID`, `NINEROUTER_REASONING_EFFORT`                      | Hanya bila gateway 9Router dapat dijangkau dari internet. Nilai bawaan `http://localhost:20128/v1` tidak bisa dipakai dari fungsi serverless; tanpa key/URL yang sah rantai otomatis jatuh ke DeepSeek lalu Gemini. |
| `IMAGEKIT_PRIVATE_KEY`, `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY`, `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT`, `IMAGEKIT_FOLDER_BASE` | Unggahan nota, cover proyek, foto profil.                                                                                                                                                                           |

`ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED` harus `false` di produksi.

Cutover 29 September 2026 mengalihkan `DATABASE_URL` Production ke endpoint
pooled dan menyimpan koneksi direct sebagai `DATABASE_URL_UNPOOLED`. Sebanyak 62 test finance/material/auth sudah lulus melalui endpoint pooled
pada database fixture branch audit. Probe read-only ke endpoint pooled production
juga berhasil meski metadata `pooler_enabled=false`; flag itu sendiri bukan bukti
endpoint tidak tersedia. Kandidat dan guard HTTP production sesudah cutover sudah
diverifikasi; koneksi direct tetap untuk migration/backup. Preview umum tetap tanpa
`DATABASE_URL` sampai tersedia database preview terisolasi dan aturan data/akses
yang jelas. Beban representatif/p95 belum diukur.

## Database instance baru

```bash
npx neonctl auth
npx neonctl projects create --name atria-erp-prod --region-id aws-ap-southeast-1

DATABASE_URL="$(npx neonctl connection-string --project-id <id>)" \
  bun run db:provision --name "Dekoria" --slug dekoria
```

`db:provision` menolak database yang sudah berisi data, menjalankan seluruh migrasi,
menamai instance, lalu memeriksa empat hal (tabel, cakupan peran sistem, belum ada
pengguna, baris pertama bisa ditulis). Setelah deployment hidup, buat Owner pertama
di `/setup`, lalu jalankan `bun run db:check-invariants` terhadap database itu.

## Deploy

Migration `0041_rab_item_nature` telah diterapkan ke `atria-erp-prod/main/neondb`
pada 29 September 2026. Production memiliki 42 migration; kolom/default/index dan
invariant sesudah commit sudah diverifikasi. Ini rollout schema saja; release code
tetap harus membawa file migration dan journal yang sama. Bukti lengkap ada di
[catatan rollout](../plans/2026-09-20-postgres-integration-and-recovery.md#rollout-migration-production--29-september-2026).

```bash
# dari root repo
npx vercel deploy --prod --yes --local-config apps/web/vercel.json --regions sin1
```

Repo sudah terhubung ke GitHub (`vercel git connect`), tapi integrasi itu belum
menggantikan perintah di atas: **production branch proyek ini masih `main`**,
sedangkan seluruh pekerjaan berjalan di `development` (branch default repo).
Akibatnya push ke `development` hanya menghasilkan _preview deployment_, bukan
rilis produksi, sampai salah satu dari dua hal dilakukan:

1. Ubah production branch ke `development` — **Dashboard → Project → Settings →
   Git → Production Branch** (tidak tersedia lewat CLI maupun REST API; hanya
   dashboard), **atau**
2. Deploy produksi lewat CLI seperti perintah di atas setiap kali rilis.

Sampai salah satunya dipilih, `https://atria-erp.vercel.app` adalah hasil deploy
CLI terakhir, dan hostname preview `atria-*.vercel.app` memuat commit terbaru.
Jangan menunjuk production branch ke `main`: `main` tertinggal jauh di belakang
`development`, sehingga rilis dari sana akan meregresi fitur yang sudah berjalan.

Validasi CLI 61 pada 29 September: preview yang dijalankan dari root tanpa
`--local-config`/`--regions` memakai `iad1`, meskipun file aplikasi menyebut `sin1`.
Sebutkan konfigurasi aplikasi dan region secara eksplisit pada CLI deployment.
Verifikasi metadata deployment serta header respons API setelah deploy; lokasi
build remote sendiri bukan bukti region eksekusi fungsi. Preview audit memakai
database fixture, sehingga jangan langsung mempromosikannya ke production.

## Penjadwalan worker notifikasi

Paket Hobby hanya mengizinkan cron Vercel sekali sehari, dan Vercel menolak deploy
yang memuat jadwal lebih sering. Karena itu:

- `apps/web/vercel.json` menjalankan `task=all` sekali sehari sebagai jaring pengaman.
- `apps/api/workers/notification-scheduler` (Cloudflare Worker, cron `*/30 * * * *`)
  menangani jadwal 5 menit. Lihat `docs/guide/notifications.md`.

Setelah pindah ke paket Pro, kembalikan `crons` di `apps/web/vercel.json` ke jadwal
per jam dan per 5 menit, lalu penjadwal eksternal tidak lagi diperlukan.

## Prasyarat PWA dan push

Manifest, ikon, halaman offline, dan service worker dilayani sebagai berkas biasa
dari `apps/web/public/**` dan `app/manifest.ts`, jadi tidak ada variabel
lingkungan tambahan yang perlu dipasang. Yang perlu dipastikan hanyalah:

1. **Origin produksi harus HTTPS.** Service worker dan Push API hanya hidup di
   _secure context_. `https://atria-erp.vercel.app` sudah memenuhi syarat;
   sebaliknya alamat LAN pengembangan (`http://192.168.x.x:3000`) tidak akan
   pernah mendaftarkan service worker, sehingga halaman `/offline` dan tombol
   **Aktifkan** di `/notifications` sama-sama tidak berfungsi di sana. Untuk uji
   push terhadap server pengembangan, pakai `localhost` atau tunnel HTTPS.
2. **`apps/web/next.config.ts` mengirim header untuk `/notification-sw.js`**
   (`Cache-Control: public, max-age=0, must-revalidate` dan
   `Service-Worker-Allowed: /`). Ini yang mencegah CDN menyematkan worker lama,
   sehingga perbaikan penangan push tidak tertahan di tepi jaringan. Setelah
   deploy, pastikan header itu masih ada pada respons sungguhan:

   ```bash
   curl -sI https://atria-erp.vercel.app/notification-sw.js | grep -i "cache-control\|service-worker-allowed"
   curl -s https://atria-erp.vercel.app/manifest.webmanifest | head -c 200
   ```

3. **`proxy.ts` mengecualikan berkas PWA dari gerbang login.** Worker, manifest,
   ikon, dan `/offline` memang harus dapat diambil tanpa cookie sesi; kalau tidak,
   pemeriksaan pembaruan worker gagal dan halaman offline tersimpan sebagai
   halaman login.
4. **iOS memerlukan pemasangan ke Layar Utama.** Safari iOS tidak mengekspos
   `PushManager` sebelum aplikasi dipasang (Bagikan → Tambahkan ke Layar Utama).
   Halaman `/notifications` menampilkan kontrol **Pasang aplikasi** justru karena
   itu; jangan menghapusnya tanpa mengganti jalur pemasangannya.
5. **VAPID tetap wajib.** `WEB_PUSH_VAPID_PUBLIC_KEY`,
   `WEB_PUSH_VAPID_PRIVATE_KEY`, dan `WEB_PUSH_SUBJECT` harus terpasang di
   environment Production; tanpa ketiganya tombol **Aktifkan** melaporkan
   VAPID key belum tersedia.

## Verifikasi setelah deploy

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://atria-erp.vercel.app/login        # 200
curl -s -o /dev/null -w "%{http_code}\n" https://atria-erp.vercel.app/setup        # 200 saat belum ada Owner
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://atria-erp.vercel.app/api/internal/notifications?task=deliveries"        # 401 tanpa bearer
```

Login harus mendarat di `/onboarding` atau `/ledger`, bukan kembali ke `/login`.
`proxy.ts` memakai `getSessionCookie()` dari `better-auth/cookies` justru karena
Better Auth memasang prefiks `__Secure-` di atas HTTPS; pemeriksaan nama cookie
yang ditulis manual membuat setiap halaman dipantulkan ke `/login` di produksi.

## Catatan paket

Team ini masih **Hobby**: satu region fungsi (dipakai `sin1` agar sekolokasi dengan
database `aws-ap-southeast-1`), cron harian, dan paket Hobby Vercel tidak ditujukan
untuk penggunaan komersial. Sebelum instance ini dipakai perusahaan sungguhan,
naikkan ke Pro.
