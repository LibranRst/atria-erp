# Hardening notifikasi untuk Neon Free

Tanggal: 30 September 2026. Pengguna menyetujui rekomendasi setelah [audit compute](2026-09-30-neon-compute-consumption-audit.md) dan grilling keputusan produk.

## Keputusan yang disetujui

- Neon tetap Free. Percobaan kirim pertama ditargetkan ≤1 menit setelah transaksi berhasil pada kondisi normal; retry/pemulihan terjadwal boleh tertunda sampai 30 menit, dengan backlog/provider sebagai batas tambahan.
- Tab yang terlihat tetapi tidak menerima interaksi selama lima menit boleh berhenti polling; kembali berinteraksi/focus/visible menyegarkan data segera.
- Endpoint manual scheduler harus berotorisasi. Tidak ada perubahan aturan saldo, stock movement, approval, audit log, atau izin mutasi bisnis.

## Implementasi

1. Tambahkan pengelolaan efek setelah commit pada boundary `db.transaction`, lalu daftarkan pemicu push sekali per transaksi setelah outbox tercatat. Efek tidak dijalankan saat rollback atau commit gagal; kegagalan efek setelah commit tidak boleh mengubah hasil transaksi bisnis. Pertahankan outbox durable, lease, dedup, dan eligibility checks; `after` hanya jalur cepat best-effort.
2. Scheduler Cloudflare fallback menjadi 30 menit. Jalur HTTP manual hanya POST dengan bearer secret yang benar sebelum ada fetch ke backend. Jadwal harian Vercel untuk rekonsiliasi tetap berlaku.
3. Tambahkan idle activity controller pada provider notifikasi existing. Ketika idle lima menit, SSE ditutup dan store tidak memuat data; aktivitas kembali membuka stream serta refresh. Fallback penuh dua menit dilewati jika stream sehat dan state tidak sedang gagal. Rotasi stream/cek actor tetap dipertahankan agar perubahan izin tidak tersimpan lama.
4. Tambahkan regression tests untuk rollback/commit, dedup efek, error setelah commit, Worker tanpa/invalid auth tanpa fetch, idle/resume/cleanup, dan fallback stream sehat/gagal. Lanjutkan test database lokal disposable bila runtime tersedia, typecheck/lint/build sesuai cakupan, dan validasi browser tanpa data production.

## Batas verifikasi dan release

- Production Neon saat ini dipause karena compute quota; tidak dipakai untuk test posting atau pembuktian penghematan sebelum/sesudah.
- Edit UI pengguna yang sudah ada di workspace dipertahankan. Tidak membuat UI primitive baru atau mengganti tampilan notification center; perubahan adalah lifecycle polling pada provider/store existing.
- Source/config tidak otomatis mengubah Worker yang telah deployed. Akses Browser Cloudflare sebelumnya diblokir oleh user permission; jangan menggunakan CLI/API untuk melewati blokir itu. Siapkan hasil yang dapat direview dan catat deploy Worker sebagai langkah terpisah jika akses masih belum tersedia.
- Jangan menganggap target push ≤1 menit sebagai jaminan waktu tampil OS. Bukti penghematan CU-hours membutuhkan SQL aktif, cadence live yang baru, dan monitoring sesudah rilis.

## Hasil implementasi dan verifikasi

Source implementasi selesai pada 30 September; **belum dirilis ke runtime production**.

- `db.transaction` mempertahankan native Drizzle transaction/config, mengumpulkan efek per transaksi, dan baru melepasnya setelah native COMMIT berhasil. Outbox tetap ditulis bersama transaksi bisnis. Satu kick cukup untuk transaksi dengan beberapa event karena sender existing mengklaim seluruh outbox yang sudah due, bukan hanya ID event pertama. Transaksi fixture/CLI yang tidak memakai boundary ini tetap mengandalkan outbox durable dan scheduler.
- Worker source memakai `*/30 * * * *`; endpoint manual menolak method selain POST dan bearer salah/hilang sebelum fetch backend. Secret existing dipertahankan; tidak membuat credential atau akses baru.
- Provider/store existing memakai idle lima menit dan stream-health gating. Session rotation, server authorization, hidden/offline gating, serta refresh setelah invalidation/perubahan signature tetap berlaku. Tidak ada primitive atau tampilan UI baru.
- Regression terfokus: **22 lulus** (commit/rollback/config/error setelah commit, store, activity, browser environment, dan auth scheduler).
- Checkout validasi terpisah dari base `1b0adb1` dengan hanya perubahan task ini: **1.302 lulus, 151 skip, 0 gagal** pada root test (core 296, mobile 5, web 1.001). Skip database pada root suite dilengkapi audit PostgreSQL native disposable berikut.
- PostgreSQL 17 lokal disposable: **23 suite, 132 lulus, 0 gagal, 0 skip**; seed verification **6 invariant, 83 baris, 0 pelanggaran**. Container sudah dihentikan dan dihapus. Tidak memakai Neon production.
- TypeScript web dan Worker lulus. ESLint file perubahan lulus tanpa warning/error. Root lint terakhir lulus seluruh workspace tanpa error atau warning.
- Next.js production build lulus di checkout validasi dengan secret auth acak khusus build dan URL localhost. Artifact build tersebut **tidak boleh digunakan untuk deployment**. Worker dry-run compile lulus tanpa menghubungi/mengubah akun Cloudflare.
- Browser native menjalankan source environment/store dengan transport fixture lokal: initial refresh satu kali, fallback tidak menambah refresh saat SSE sehat, idle menutup stream, interaksi melakukan refresh kedua dan membuka stream, lalu idle kembali tanpa fetch tambahan. Timer fixture dipercepat 100×; tes deterministic menjaga nilai produksi lima menit. Tidak mengirim notifikasi atau transaksi nyata.

### Batas workspace bersama

Root test pada workspace utama menghasilkan satu kegagalan kontrak `administration.test.ts`: perubahan mobile terpisah menambahkan prosedur capabilities dengan guard berbeda sementara tes existing mengasumsikan semua prosedur operasional memakai `activeProcedure`. File di luar task ini dipertahankan. Fresh install dengan linker hoisted di checkout sementara juga memunculkan duplicate React; validasi terisolasi memakai `--linker isolated` hanya di checkout tersebut. Konfigurasi linker workspace utama tidak diubah karena Metro mobile memerlukannya.

## Rollout yang masih diperlukan

1. Deploy Cloudflare Worker source baru dan pastikan Cron Trigger **`*/30 * * * *`**, secret existing `NOTIFICATION_JOB_SECRET`, serta domain backend production benar. Bila memakai dashboard manual, buka Worker existing → Edit code, masukkan bundle hasil dry-run, lalu Save and deploy; atur cron di Settings/Triggers sesuai tampilan dashboard. Bundle lokal tersedia di `/tmp/atria-notification-worker-build/index.js`; bukan build Next.js yang memakai secret fixture.
2. Deploy aplikasi Vercel dari commit perubahan ini dengan environment production existing. Jangan deploy artifact build validasi yang memakai fixture auth secret. Worker dan web harus sama-sama selesai sebelum menilai perilaku baru.
3. Setelah periode Neon baru **1 Oktober 2026 07.00 WIB**, verifikasi SQL aktif, jalur login, outbox setelah commit dan retry. Penerimaan banner OS tetap memerlukan perangkat terdaftar nyata; target ≤1 menit adalah target percobaan kirim pada kondisi normal, bukan SLA OS.
4. Uji idle terkontrol tanpa tab aplikasi aktif selama 30–60 menit. Pastikan log fallback mendekati interval 30 menit dan compute mendapat waktu suspend. Kemudian ukur satu tab aktif dan tab idle untuk memisahkan aktivitas foreground. Bandingkan meter CU-hours; model perkiraan 30 CU-hours/bulan untuk cron saja belum merupakan pengukuran.
5. Lanjutkan pembuatan role backup baca dan backup R2 setelah database tersedia. Penghematan notifikasi tidak menggantikan validasi backup/restore.

Akses Browser Cloudflare masih ditolak oleh permission yang tersimpan. Deployment Worker tidak dicoba lewat CLI/API sebagai pengganti akses yang ditolak. Tidak ada perubahan plan berbayar atau biaya baru dalam task ini.
