# Audit pemakaian compute Neon Atria

Tanggal: 30 September 2026. Status: **audit selesai; belum mengubah runtime atau jadwal live**. Mengikuti blocker [backup R2](2026-09-30-free-tier-nightly-backup.md). Project production `atria-erp-prod` (`little-river-44246623`), main `br-super-tree-azh1p78r`; Vercel production masih `dpl_HVGdmeHfuYWBa46c7QHNSvjneGZn` di `sin1`.

## Kesimpulan dan batas bukti

Penyumbang paling kuat yang teridentifikasi adalah **scheduler delivery notifikasi setiap lima menit**. Jadwal itu berimpit dengan autosuspend Neon lima menit dan selalu mencapai query database, termasuk ketika antrean kosong. Source, catatan pemasangan scheduler, serta cadence POST production yang terukur saling cocok. Tab aplikasi yang login dan terlihat juga dapat mempertahankan compute melalui SSE lima detik dan refresh fallback dua menit.

Ini bukan atribusi persentase seluruh **111,49 CU-hours**. Data historis per caller tidak tersedia; compute sedang dipause kuota sehingga uji sebelum/sesudah dengan database aktif belum dilakukan. Log yang tersedia saat audit mencakup sampel sekitar satu jam. [Vercel Hobby menyimpan runtime logs satu jam](https://vercel.com/docs/logs/runtime); meminta `since: 24h` tidak menciptakan log di luar retensi. Identitas pemanggil Cloudflare pada setiap request belum dibuktikan lewat header; yang terbukti live adalah job berotorisasi dengan interval sekitar lima menit pada endpoint yang sama. Akses dashboard Cloudflare tetap diblokir Browser, sehingga konfigurasi worker live tidak dibaca lewat jalur lain.

## Fakta pemakaian

- Console Neon menunjukkan **111,49 CU-hours** untuk project production sejak 1 September, melampaui Free **100 compute hours/project/bulan**. Ini angka project, bukan total organisasi **179,63 CU-hours** yang mencakup tiga project.
- Compute main minimum/maksimum **0,25 CU**; autosuspend sudah **5 menit**. Storage main **37,53 MB**, network transfer **3,37 MB**. Banner menyatakan monthly compute allowance habis, compute SUSPENDED.
- Metadata API periode pemakaian berakhir **1 Oktober 2026 07.00 WIB**. Menunggu periode baru dapat membuka kembali kuota compute; SQL perlu diperiksa setelah itu.
- CU-hours mengukur kapasitas compute dikalikan lama aktif. Query kecil periodik tetap dapat memanjangkan waktu aktif; pooled URL sendiri tidak menghapus aktivitas query. [Neon merekomendasikan mengurangi frekuensi background jobs agar scale-to-zero sempat berlaku](https://neon.com/docs/manage/endpoints/).

## 1. Scheduler notifikasi lima menit — kandidat utama

Source berikut identik dengan kandidat runtime yang dirilis (`git diff ef20abf` pada file audit kosong):

- `apps/web/workers/notification-scheduler/wrangler.jsonc:7`: `*/5 * * * *`.
- `apps/web/workers/notification-scheduler/src/index.ts:25–49`: `scheduled` memanggil POST `/api/internal/notifications?task=deliveries` pada domain production default.
- [Runbook notification](../guide/notifications.md) mencatat worker telah terpasang **11 September 2026**, bernama `atria-notification-scheduler` pada `hyuzin-atria.workers.dev`.
- `apps/web/app/api/internal/notifications/route.ts:20–37`: request tanpa secret ditolak 401 sebelum DB; request valid memanggil `processNotificationDeliveries()`.
- `apps/web/server/services/notification-delivery.ts:121–186,460–492`: delivery job selalu memanggil `claimDeliveries` untuk pengiriman dan receipt. Masing-masing membuka transaksi dan SELECT; antrean kosong tetap menghasilkan aktivitas DB. Tidak ada guard eksternal yang dapat mengetahui antrean kosong tanpa query.

### Bukti runtime Vercel

Connector Vercel `get_runtime_logs`, environment production, query `Notification worker failed`, limit 30, diminta untuk 24 jam. Hasil tersedia **12 request POST** ke `/api/internal/notifications`, semuanya mengandung error kuota Neon. Pesan ini berasal dari catch setelah guard authorization, sehingga berbeda dari probe tanpa secret yang berakhir 401. Log/error dan credential tidak disalin; hanya timestamp/path yang dicatat.

| Tanggal 30 September, WIB | Method/path                        |
| ------------------------- | ---------------------------------- |
| 12:55:48                  | POST `/api/internal/notifications` |
| 13:00:52                  | POST `/api/internal/notifications` |
| 13:05:46                  | POST `/api/internal/notifications` |
| 13:10:45                  | POST `/api/internal/notifications` |
| 13:15:44                  | POST `/api/internal/notifications` |
| 13:20:45                  | POST `/api/internal/notifications` |
| 13:25:47                  | POST `/api/internal/notifications` |
| 13:30:51                  | POST `/api/internal/notifications` |
| 13:35:48                  | POST `/api/internal/notifications` |
| 13:40:46                  | POST `/api/internal/notifications` |
| 13:45:51                  | POST `/api/internal/notifications` |
| 13:50:43                  | POST `/api/internal/notifications` |

Interval rata-rata **299,55 detik**, minimum 292, maksimum 305. Request terakhir menampilkan status 0 pada event log yang belum selesai; event lain menampilkan 500. Semua adalah kegagalan worker akibat kuota, bukan uji posting keuangan oleh audit ini.

Cadence ini memungkinkan compute aktif hampir sepanjang hari: tiap job memakai koneksi/query, lalu jendela idle lima menit dimulai kembali. Pada interval yang sama dengan timeout, jitter dan durasi job dapat menghilangkan atau sangat memperpendek kesempatan suspend. Ini mekanisme yang sangat cocok dengan pemakaian bulanan, tetapi porsi tepatnya tetap memerlukan uji idle setelah kuota pulih.

## 2. Notifikasi pada tab aktif — kontribusi tambahan

- `apps/web/app/api/notifications/stream/route.ts:9,58–84`: SSE melakukan query cursor setiap **5 detik**, stream berputar setelah 25 detik dan meminta reconnect. `getNotificationStreamCursor` membaca notification dan, untuk actor ASSIGNED, daftar proyek.
- `apps/web/features/notifications/hooks/use-notifications.tsx:26–135`: stream hanya aktif ketika ada session, online, dan dokumen visible; offline/hidden menutup stream. Namun tab yang tetap terlihat dan login tetap polling walaupun pengguna tidak berinteraksi.
- `apps/web/features/notifications/hooks/notification-store.ts:30,243–270`: fallback refresh **120 detik** tetap berjalan bersamaan dengan SSE. Satu refresh meminta summary serta dua daftar melalui tiga Server Actions; ada backoff ketika gagal. Refresh menghormati visibility/online, sehingga tidak dibebankan pada setiap tab background.

Source membuktikan mekanisme aktivitas, bukan jumlah jam tab pengguna sepanjang September. Tidak ada log historis yang memadai untuk membagi compute pada setiap session.

## 3. Yang bukan bukti penyebab utama

- **Pool tanpa batas idle:** `apps/web/db/index.ts:9` memang memakai default Pool, tetapi driver terpasang `@neondatabase/serverless` **1.1.0** memberikan `idleTimeoutMillis=10000`, `max=10`. Instansiasi tanpa koneksi menghasilkan `{max:10,idleTimeoutMillis:10000,openedClients:0}`. Tidak ada override `idleTimeoutMillis:0`; keberadaan pool bukan bukti koneksi disimpan selamanya.
- **Vercel Cron utama:** `apps/web/vercel.json:6–7` menjalankan `task=all` sekali sehari, **00.00 WIB**. Ini tidak menjelaskan POST tiap lima menit.
- **Backup harian:** gate GitHub backup masih nonaktif; satu probe R2 tidak membaca Neon. Backup yang belum berjalan tidak menghabiskan compute database.
- **Audit/test:** suite cloud yang pernah dijalankan dapat memakai kuota selama test, tetapi tidak ada bukti bahwa suite berjalan terus. Runner audit menutup koneksi admin di `finally`. Atribusi tepat per branch/test belum tersedia; tidak menyamakan total CU-hours dengan jumlah test atau ukuran database.

## Model kapasitas untuk keputusan Free

Asumsi: satu compute 0,25 CU, tiap cron singkat, autosuspend tepat lima menit setelah aktivitas terakhir, 30 hari, tanpa pengguna atau proses lain. Ini perkiraan mekanisme, bukan tagihan atau benchmark aktual. Frekuensi antar sumber dapat saling tumpang tindih sehingga angka tidak dijumlahkan langsung.

| Interval job  | Perkiraan CU-hours / 30 hari |
| ------------- | ---------------------------: |
| 5 menit       |                mendekati 180 |
| 15 menit      |                           60 |
| 30 menit      |                           30 |
| 60 menit      |                           15 |
| Sekali sehari |                        0,625 |

Free 100 CU-hours setara **400 jam aktif** pada 0,25 CU. Satu compute aktif 24/7 selama 30 hari membutuhkan 180 CU-hours. Mengurangi query per job saja tidak menyelesaikan masalah apabila job tetap membangunkan compute setiap lima menit.

## Prioritas perbaikan dan cara membuktikan

1. Siapkan profil scheduler untuk Neon Free dengan delivery fallback **30 menit** atau jadwal jam kerja; sebelum diterapkan, terima konsekuensi push terjadwal dapat tertunda sampai satu interval. Perubahan source saja tidak mengubah Cloudflare worker yang sudah deployed. Sebaiknya trigger delivery setelah event bisnis/outbox dibuat, lalu jadwal lebih jarang menangani retry/receipt; ini perlu implementasi tersendiri.
2. Kurangi aktivitas notification stream pada session yang tidak berinteraksi, dan hindari fallback refresh penuh ketika SSE sehat. Pertahankan visibility gating, pemulihan koneksi, serta pengecekan sesi/izin server-side; penghematan tidak boleh menyembunyikan pencabutan izin atau pending approval.
3. Setelah kuota pulih, lakukan uji idle terkontrol: tidak ada tab aplikasi aktif, hentikan/ubah scheduler lima menit yang benar, ukur suspend setelah lebih dari lima menit, lalu bandingkan minimal 30–60 menit dengan interval baru. Sampel Vercel harus menunjukkan frekuensi yang sesuai, dan meter Neon harus memiliki waktu idle. Ukur ulang saat satu tab notifikasi aktif untuk memisahkan sumber foreground.
4. Selesaikan role baca dan backup R2 setelah koneksi kembali tersedia. Periksa pemakaian per project/branch dan simpan ringkasan harian agar audit bulan berikutnya tidak bergantung hanya pada retensi log satu jam.

Tidak ada setting Neon, jadwal Cloudflare, kode aplikasi, secret, pembayaran, maupun transaksi production yang diubah dalam audit ini. Hasil disimpan di Markdown; perbaikan serta verifikasi sebelum/sesudah belum dilakukan.
