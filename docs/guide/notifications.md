# Notifikasi operasional

Notifikasi web memisahkan **belum dibaca** dari **aksi belum selesai**. Membaca tidak menyelesaikan persetujuan/pembayaran. Informasi bertahan 30 hari sejak dibaca, aksi selesai 30 hari sejak diselesaikan; ini retensi tampilan, bukan penghapusan database.

## Pengoperasian

1. Terapkan migrasi `0038_notification_hardening.sql`, `0039_notification_sse_cursor.sql`, dan `0040_notification_delivery_outbox.sql` melalui prosedur migrasi instance. Migrasi ini mengisi waktu baca data lama, menambahkan cursor SSE, mengikat subscription baru ke sesi, dan membuat outbox push.
2. Penjadwalan worker bergantung pada paket Vercel yang dipakai:
   - **Pro/Enterprise:** `apps/web/vercel.json` dapat menjadwalkan rekonsiliasi tiap jam dan delivery worker tiap 5 menit. Kembalikan entri `crons` ke dua jadwal tersebut dan isi `CRON_SECRET` pada environment Production.
   - **Hobby:** cron Vercel hanya boleh berjalan sekali sehari, dan Vercel menolak deploy yang memuat jadwal lebih sering. Berkas yang ada sekarang menjalankan `task=all` sekali sehari (00:00 WIB) sebagai jaring pengaman; jadwal 5 menit ditangani penjadwal eksternal di bawah.
   Root Directory proyek Vercel harus `apps/web` agar `vercel.json` terbaca.
3. Scheduler selain Vercel dapat memakai `NOTIFICATION_JOB_SECRET` dan HTTP **POST**. Semua panggilan memakai header `Authorization: Bearer <secret>`; jangan menaruh secret di URL, frontend, atau repository.
4. Endpoint menerima `task=reconcile`, `task=deliveries`, atau `task=all`. Jalankan `reconcile` sekali setelah migrasi untuk membentuk aksi/kondisi yang masih aktif tanpa memutar ulang seluruh event historis.
5. Monitor status HTTP serta ringkasan `reconciliation` dan `deliveries`. HTTP 401 berarti secret salah/tidak terpasang, 400 berarti task tidak dikenal, dan 500 berarti worker gagal serta aman dicoba lagi. Row lock, lease kedaluwarsa, dan unique index mencegah delivery ganda saat proses paralel atau restart.

### Penjadwal eksternal 5 menit (paket Hobby)

`apps/web/workers/notification-scheduler` adalah Cloudflare Worker yang memanggil endpoint worker Atria setiap 5 menit. Ia tidak menduplikasi logika notifikasi, jadi perilakunya sama dengan pemicu Vercel Cron.

```bash
cd apps/web/workers/notification-scheduler
bun install
npx wrangler deploy
npx wrangler secret put NOTIFICATION_JOB_SECRET   # nilai sama dengan environment Production Vercel
```

Opsional: set `ATRIA_APP_URL` (default `https://atria-erp.vercel.app`) bila domain produksinya berbeda. Verifikasi manual:

```bash
curl -X POST "https://atria-notification-scheduler.<subdomain>.workers.dev?task=deliveries"
```

Jadwal `*/5 * * * *` ada di `wrangler.jsonc`. Scheduler eksternal lain (mis. cron-job.org) juga sah selama ia mengirim POST ke `/api/internal/notifications?task=deliveries` dengan bearer secret yang sama.

Tanggal jatuh tempo menggunakan **Asia/Jakarta**: H-3, hari jatuh tempo, terlambat. Pembayaran parsial mempertahankan pengingat selama saldo masih terutang. Perubahan tingkat kondisi menghasilkan notifikasi belum dibaca; kondisi pulih menutup peringatan. Tidak ada pengingat berulang harian untuk kondisi yang sama.

Event mutasi yang sudah tersambung, termasuk request/approve/reject/reversal opening inventory, dicatat dalam transaksi bisnis yang sama. Job melakukan pemulihan aksi dan evaluasi periodik jatuh tempo, kesehatan keuangan proyek, budget kategori, stok minimum, dan kekurangan material RAP. Perubahan kondisi yang tidak melalui sinkronisasi budget akan terdeteksi pada job berikutnya, maksimal satu interval scheduler setelah perubahan.

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
- Client menutup stream saat tab tersembunyi atau offline, lalu langsung
  menyambung dan refresh ketika kembali aktif.
- Invalidation memanggil store refresh yang sudah mendeduplikasi request dan
  mempertahankan pagination yang sedang dibuka.
- Fallback refresh berjalan setiap 2 menit. Kegagalan memakai backoff hingga 5
  menit, sehingga notification center tetap dapat dipakai ketika SSE diputus
  browser, proxy, atau hosting.

Event transaksi biasanya terlihat dalam sekitar 0–5 detik. Event jatuh tempo
tetap bergantung pada job per jam, kemudian dikirim melalui SSE setelah job
commit. Dibanding polling lama, client tidak lagi menjalankan tiga Server Action
setiap 20 detik; fetch summary dan dua daftar hanya terjadi pada initial load,
invalidation, focus/online recovery, atau fallback.

## Push

Setiap notifikasi yang dibuat akan menambahkan satu row `notification_delivery` per subscription aktif di transaksi yang sama. Rollback bisnis juga membatalkan outbox. Worker mengklaim row dengan lock dan lease, lalu memeriksa lagi status pengguna, membership perusahaan, role/permission, scope proyek, serta sesi perangkat sebelum mengirim. Kegagalan sementara memakai exponential backoff terbatas; error terminal tersimpan sebagai `DEAD` dan tidak memblokir transaksi bisnis.

### Web Push

Isi `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, dan `WEB_PUSH_SUBJECT` dengan satu pasangan VAPID stabil per environment. Halaman `/notifications` menyediakan kontrol opt-in; browser tidak meminta izin sampai pengguna menekan **Aktifkan**. Tombol nonaktif mencabut subscription browser dan credential server. Service worker hanya membuka tujuan internal yang lolos allowlist. HTTP 404/410 dari push service menonaktifkan endpoint kedaluwarsa.

### Expo Push

Klien mobile mendaftarkan token setelah login hanya pada development/production build yang memiliki `extra.eas.projectId`. Prompt sistem muncul setelah pilihan eksplisit pengguna di aplikasi. Token refresh didaftarkan ulang, tap notifikasi diarahkan melalui tujuan internal tervalidasi, dan logout berusaha mencabut token; foreign key sesi menjadi pengaman jika perangkat offline saat logout.

Worker mengirim maksimal 100 pesan per request, menyimpan ticket Expo, lalu mengecek receipt setelah 15 menit dalam batch maksimal 1.000. `DeviceNotRegistered` menonaktifkan token; receipt sementara dicoba ulang. APNs/FCM credentials, EAS project ID, dan signing tetap harus dipasang pada proyek Expo. Expo Go bukan environment penerimaan remote push.

## Verifikasi

`bun run test` dari root memakai preload workspace yang benar. Tes notifikasi PostgreSQL memakai PGlite in-memory di child process terpisah, sehingga tidak menyambung atau mengubah database pengguna. Fixture tersebut juga membuka route SSE terautentikasi, memeriksa header/event/cursor, lalu membatalkan stream. Storybook `Features/Notifications` menyediakan data contoh dan kondisi gagal untuk verifikasi UI; bukan data produksi.

Periksa keyboard/fokus pada morph, lebar 320–430px, reduced motion, koneksi putus, pergantian akun, pagination, retensi, dan lifecycle approval sebelum rilis. Test suite memakai provider push tiruan dan tidak mengirim push ke perangkat nyata. Scheduler serta secret production harus diaktifkan pada proses deployment.
