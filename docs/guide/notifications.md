# Notifikasi operasional

Notifikasi web memisahkan **belum dibaca** dari **aksi belum selesai**. Membaca tidak menyelesaikan persetujuan/pembayaran. Informasi bertahan 30 hari sejak dibaca, aksi selesai 30 hari sejak diselesaikan; ini retensi tampilan, bukan penghapusan database.

## Pengoperasian

1. Terapkan migrasi `0038_notification_hardening.sql`, `0039_notification_sse_cursor.sql`, dan `0040_notification_delivery_outbox.sql` melalui prosedur migrasi instance. Migrasi ini mengisi waktu baca data lama, menambahkan cursor SSE, mengikat subscription baru ke sesi, dan membuat outbox push.
2. Pengiriman awal dipicu dari outbox setelah transaksi bisnis berhasil commit. Scheduler merupakan pemulihan untuk retry/receipt; frekuensinya harus mengikuti anggaran compute Neon, selain batas paket Vercel:
   - **Pro/Enterprise:** Vercel mendukung jadwal lebih sering, tetapi untuk Neon Free gunakan fallback 30 menit agar database sempat suspend. Isi `CRON_SECRET` pada environment Production; interval lebih rapat perlu anggaran compute dan kebutuhan latency yang sesuai.
   - **Hobby:** cron Vercel hanya boleh berjalan sekali sehari, dan Vercel menolak deploy yang memuat jadwal lebih sering. Berkas yang ada sekarang menjalankan `task=all` sekali sehari (00:00 WIB) sebagai jaring pengaman; fallback 30 menit ditangani penjadwal eksternal di bawah.
     Root Directory proyek Vercel harus `apps/web` agar `vercel.json` terbaca.
3. Scheduler selain Vercel dapat memakai `NOTIFICATION_JOB_SECRET` dan HTTP **POST**. Semua panggilan memakai header `Authorization: Bearer <secret>`; jangan menaruh secret di URL, frontend, atau repository.
4. Endpoint menerima `task=reconcile`, `task=deliveries`, atau `task=all`. Jalankan `reconcile` sekali setelah migrasi untuk membentuk aksi/kondisi yang masih aktif tanpa memutar ulang seluruh event historis.
5. Monitor status HTTP serta ringkasan `reconciliation` dan `deliveries`. HTTP 401 berarti secret salah/tidak terpasang, 400 berarti task tidak dikenal, dan 500 berarti worker gagal serta aman dicoba lagi. Row lock, lease kedaluwarsa, dan unique index mencegah klaim paralel/event duplikat. Pengiriman bersifat at-least-once: crash setelah provider menerima pesan tetapi sebelum status tersimpan dapat mengulang pengiriman.

### Penjadwal eksternal 30 menit (profil Neon Free)

`apps/web/workers/notification-scheduler` adalah Cloudflare Worker yang memanggil endpoint worker Atria setiap 30 menit untuk retry dan receipt. Percobaan kirim awal tetap memakai pemicu setelah commit. Ia tidak menduplikasi logika notifikasi, jadi perilakunya sama dengan pemicu Vercel Cron.

```bash
cd apps/web/workers/notification-scheduler
bun install
npx wrangler deploy
npx wrangler secret put NOTIFICATION_JOB_SECRET   # nilai sama dengan environment Production Vercel
```

Opsional: set `ATRIA_APP_URL` (default `https://atria-erp.vercel.app`) bila domain produksinya berbeda. Verifikasi manual:

```bash
curl -X POST "https://atria-notification-scheduler.<subdomain>.workers.dev?task=deliveries" \
  -H "Authorization: Bearer $NOTIFICATION_JOB_SECRET"
```

Jadwal source `*/30 * * * *` ada di `wrangler.jsonc`. Deploy Worker diperlukan untuk menerapkan source/config ini pada runtime yang sudah ada. Scheduler eksternal lain (mis. cron-job.org) juga sah selama ia mengirim POST ke `/api/internal/notifications?task=deliveries` dengan bearer secret yang sama.

**Pemasangan awal (2026-09-11, jadwal lima menit):** worker bernama `atria-notification-scheduler` di akun Cloudflare `hyuzin`, subdomain `hyuzin-atria.workers.dev`. Endpoint:

```
POST https://atria-notification-scheduler.hyuzin-atria.workers.dev?task=deliveries
POST https://atria-notification-scheduler.hyuzin-atria.workers.dev?task=reconcile
```

Source hardening 30 September mewajibkan POST dan bearer secret pada endpoint manual sebelum request diteruskan; GET menghasilkan 405, bearer hilang/salah 401. Status deploy source baru dicatat di [rencana hardening](../plans/2026-09-30-notification-free-tier-hardening.md). Respons yang benar adalah `{"ok":true,"task":"deliveries","upstream":200}`; `task` di luar dua nilai itu dijawab `400`. Bila `curl` lokal melaporkan `SSL alert number 40` atau `status=000`, itu handshake LibreSSL versi lama di mesin pengembang, bukan worker-nya — ulangi, atau verifikasi lewat peramban sebelum menyimpulkan worker mati.

Tanggal jatuh tempo menggunakan **Asia/Jakarta**: H-3, hari jatuh tempo, terlambat. Pembayaran parsial mempertahankan pengingat selama saldo masih terutang. Perubahan tingkat kondisi menghasilkan notifikasi belum dibaca; kondisi pulih menutup peringatan. Tidak ada pengingat berulang harian untuk kondisi yang sama.

Event mutasi yang sudah tersambung, termasuk request/approve/reject/reversal opening inventory, dicatat dalam transaksi bisnis yang sama. Job melakukan pemulihan aksi dan evaluasi periodik jatuh tempo, kesehatan keuangan proyek, budget kategori, stok minimum, dan kekurangan material RAP. Perubahan kondisi yang tidak melalui event bisnis perlu job rekonsiliasi, yang pada konfigurasi Hobby saat ini berjalan harian. Scheduler eksternal default hanya delivery/receipt; jangan menjanjikan semua kondisi budget/material berubah terdeteksi setiap 30 menit.

## Sinkronisasi web

Web memakai satu koneksi **Server-Sent Events (SSE)** untuk setiap sesi pada tab
yang terlihat dan online. SSE dipilih karena browser hanya perlu menerima sinyal
perubahan dari server; tidak ada pesan dua arah yang membutuhkan WebSocket.

- Route: `GET /api/notifications/stream`, cookie sesi wajib valid.
- Server memeriksa cursor perubahan setiap 5 detik melalui indeks
  `(tenant_id, user_id, updated_at, id)` dan hanya mengirim invalidation ketika
  cursor berubah.
- Stream mengirim heartbeat agar proxy tidak melakukan buffering dan diputar
  ulang setiap 25 detik. Reconnect memvalidasi sesi, role, permission, serta
  scope terbaru tanpa mengambil ulang daftar bila cursor tetap sama. Event
  `rotate` membedakan reconnect terjadwal dari gangguan jaringan agar rotasi
  normal tidak memicu refresh penuh.
- Client menutup stream saat tab tersembunyi/offline atau tidak ada interaksi selama lima menit. Interaksi, focus, atau kembali visible menyambung dan refresh segera. Rotasi stream tetap memvalidasi sesi/izin.
- Invalidation memanggil store refresh yang sudah mendeduplikasi request dan
  mempertahankan pagination yang sedang dibuka.
- Fallback refresh penuh berjalan setiap 2 menit ketika stream tidak sehat atau state sedang gagal; stream sehat melewatinya. Timer pada sesi idle tidak memuat data. Kegagalan memakai backoff hingga 5
  menit, sehingga notification center tetap dapat dipakai ketika SSE diputus
  browser, proxy, atau hosting.

Event transaksi biasanya terlihat dalam sekitar 0–5 detik. Event jatuh tempo
bergantung pada job rekonsiliasi (harian pada konfigurasi Hobby saat ini), kemudian dikirim melalui SSE setelah job
commit. Dibanding polling lama, client tidak lagi menjalankan tiga Server Action
setiap 20 detik; fetch summary dan dua daftar hanya terjadi pada initial load,
invalidation, focus/online recovery, atau fallback.

## Push

Setiap notifikasi yang dibuat akan menambahkan satu row `notification_delivery` per subscription aktif di transaksi yang sama. Rollback bisnis juga membatalkan outbox. Worker mengklaim row dengan lock dan lease, lalu memeriksa lagi status pengguna, membership perusahaan, role/permission, scope proyek, serta sesi perangkat sebelum mengirim. Kegagalan sementara memakai exponential backoff terbatas; error terminal tersimpan sebagai `DEAD` dan tidak memblokir transaksi bisnis.

### Web Push

Isi `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, dan `WEB_PUSH_SUBJECT` dengan satu pasangan VAPID stabil per environment. Halaman `/notifications` menyediakan kontrol opt-in; browser tidak meminta izin sampai pengguna menekan **Aktifkan**. Tombol nonaktif mencabut subscription browser dan credential server. Service worker hanya membuka tujuan internal yang lolos allowlist. HTTP 404/410 dari push service menonaktifkan endpoint kedaluwarsa.

**Prasyarat operasional (2026-09-12).** Service worker dan Push API hanya hidup di _secure context_: HTTPS, atau `localhost`/`127.0.0.1`. Alamat LAN pengembangan biasa (`http://192.168.x.x:3000`) tidak akan pernah mendaftarkan service worker, sehingga tombol **Aktifkan** di halaman ini akan gagal di sana — uji push lewat `localhost`, tunnel HTTPS, atau domain produksi. Halaman `/notifications` juga sekarang menampilkan kontrol **Pasang aplikasi** karena iOS Safari hanya mengekspos `PushManager` dan `Notification` setelah aplikasi dipasang ke Layar Utama (Bagikan → Tambahkan ke Layar Utama); di iOS, push tidak dapat diminta dari tab Safari biasa. Setelah dipasang, buka kembali dari ikon Layar Utama sebelum menekan **Aktifkan**. Registrasi service worker seluruh aplikasi tidak pernah meminta izin notifikasi; izin tetap hanya muncul dari klik **Aktifkan**.

**Rekonsiliasi langganan.** Setiap kali halaman `/notifications` dibuka dan izin sudah `granted` serta langganan perangkat masih hidup, klien mendaftarkan ulang langganan itu secara idempoten melalui Server Action yang sama. Ini memperbaiki catatan server yang hilang karena reset basis data, perpindahan tenant, atau POST yang gagal — sebelumnya pengguna melihat keadaan "Aktif" padahal tidak ada baris `user_push_subscription` yang menargetkan perangkatnya. Rekonsiliasi tidak meminta izin dan tidak membuat langganan baru: perangkat yang belum berlangganan tidak menghasilkan panggilan server sama sekali. Bila pencatatan gagal, kontrol menampilkan **Sambung ulang** alih-alih "Aktif".

Urutan matikan juga dikunci: pencabutan di server dijalankan lebih dulu, dan langganan perangkat baru dicabut setelah server mengonfirmasi. Dengan begitu kegagalan jaringan tidak meninggalkan baris server yang masih menargetkan perangkat yang sudah tidak berlangganan.

### Expo Push

Klien mobile mendaftarkan token setelah login hanya pada development/production build yang memiliki `extra.eas.projectId`. Prompt sistem muncul setelah pilihan eksplisit pengguna di aplikasi. Token refresh didaftarkan ulang, tap notifikasi diarahkan melalui tujuan internal tervalidasi, dan logout berusaha mencabut token; foreign key sesi menjadi pengaman jika perangkat offline saat logout.

Syarat platform yang harus ada agar banner benar-benar muncul:

- **Android 13+ (API 33).** Izin runtime `POST_NOTIFICATIONS` wajib. `apps/mobile/app.json` mendeklarasikannya pada `android.permissions`; `expo-notifications` meminta izin itu saat `requestPermissionsAsync`, jadi prompt hanya muncul setelah pengguna memilih **Aktifkan**.
- **Kanal notifikasi Android.** Sejak Android 8, banner heads-up hanya muncul dari kanal ber-importance tinggi. Aplikasi membuat kanal `operasional` (`AndroidImportance.HIGH`, suara default) sebelum meminta izin, dan worker mengirim `channelId: "operasional"` pada setiap pesan Expo Android. Tanpa `channelId` yang sama, Android memakai kanal cadangan bawaan library sehingga nama dan prioritas kanal kita hilang. Konstanta ini dipakai bersama dari `ANDROID_NOTIFICATION_CHANNEL_ID` di `@atria/core/notifications/types`.
- **iOS.** `requestPermissionsAsync` meminta izin visible notification; plugin `expo-notifications` menambahkan entitlement `aps-environment` (mode `development` secara default). Buka `apps/mobile/app.json` → plugin `expo-notifications` untuk mengubah `color`/`defaultChannel`.
- **Console build.** Remote push SDK 53+ tidak didukung di Expo Go; diperlukan development build atau production build, plus credentials APNs/FCM dan perangkat nyata. Ini tidak dapat diverifikasi di mesin pengembangan tanpa perangkat.
- **Rute tap notifikasi.** `notification.data.url` (keluaran `notificationDestination` yang sama dengan web) dipetakan ulang oleh `apps/mobile/src/lib/notification-route.ts` ke rute native yang benar-benar ada: tab proyek (`?tab=...`) dibuang, `/reconciliation` jatuh ke Dashboard finance, dan rute tanpa padanan native memakai tab pertama sesuai peran.

Worker mengirim maksimal 100 pesan per request, menyimpan ticket Expo, lalu mengecek receipt setelah 15 menit dalam batch maksimal 1.000. `DeviceNotRegistered` menonaktifkan token; receipt sementara dicoba ulang. APNs/FCM credentials, EAS project ID, dan signing tetap harus dipasang pada proyek Expo. Expo Go bukan environment penerimaan remote push.

### Tujuan notifikasi

`notificationDestination` (`packages/core/src/notifications/types.ts`) adalah satu-satunya sumber URL notifikasi, dipakai jalur web (payload Web Push) maupun Expo. Keluarannya hanya memuat rute di dalam allowlist service worker `/^\/(approvals|projects|materials|expenses|ledger|notifications|reconciliation)([/?#]|$)/`. Kesepakatan ini dijaga tes `apps/web/features/notifications/destination-allowlist.test.ts`, yang meng-enumerasi setiap `actionUrl` di kode aplikasi × setiap `NotificationReferenceType` × ada/tidaknya `projectId`, lalu memastikan setiap tujuan (a) lolos allowlist service worker dan (b) cocok dengan `page.tsx` nyata di `apps/web/app/`. Menambah rute notifikasi baru cukup menambah literal `actionUrl`; test akan menangkap tujuan yang 404 atau ditolak service worker tanpa perlu memperbarui daftar manual.

## Verifikasi

`bun run test` dari root memakai preload workspace yang benar. Tes notifikasi PostgreSQL memakai PGlite in-memory di child process terpisah, sehingga tidak menyambung atau mengubah database pengguna. Fixture tersebut juga membuka route SSE terautentikasi, memeriksa header/event/cursor, lalu membatalkan stream. Storybook `Features/Notifications` menyediakan data contoh dan kondisi gagal untuk verifikasi UI; bukan data produksi.

Tes yang menjaga jalur banner: `features/notifications/utils/push-state.test.ts` (pemetaan kondisi perangkat → salinan, termasuk iOS belum terpasang), `features/notifications/utils/push-sync.test.ts` (rekonsiliasi idempoten dan tidak ada penulisan server tanpa langganan/izin), `features/notifications/destination-allowlist.test.ts` (allowlist service worker dan rute Next.js nyata), `apps/mobile/src/lib/notification-route.test.ts` (tujuan → rute native), dan `notification-database.test.ts` (payload Expo per platform, termasuk `channelId` Android).

Periksa keyboard/fokus pada morph, lebar 320–430px, reduced motion, koneksi putus, pergantian akun, pagination, retensi, dan lifecycle approval sebelum rilis. Test suite memakai provider push tiruan dan tidak mengirim push ke perangkat nyata. Scheduler serta secret production harus diaktifkan pada proses deployment. Banner OS di Android/iOS hanya bisa dipastikan pada perangkat nyata dengan build development/production.
