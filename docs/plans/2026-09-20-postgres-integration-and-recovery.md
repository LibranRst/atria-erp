# Verifikasi PostgreSQL dan recovery

Dimulai: 20 September 2026. Diperbarui: 30 September 2026. Status: validasi PostgreSQL, migration production, test pooled, smoke preview, cutover runtime production, dan drill pemulihan historis ke branch terpisah selesai; retensi serta simulasi cutover recovery masih terbuka.

Melanjutkan [hardening izin efektif](2026-09-18-effective-permission-hardening.md) untuk P0-03/P0-04.

## Rencana

1. Identifikasi environment test, tanpa mencetak secret atau memakai database bisnis untuk pengujian mutasi.
2. Siapkan PostgreSQL lokal disposable bila koneksi Neon belum tersedia. Terapkan migration chain asli; pisahkan database kosong dan seeded.
3. Jalankan suite integrasi pada fixture bersih, terpisah jika test mengubah saldo/stock yang diasumsikan suite lain. Catat kegagalan aplikasi, fixture, atau infrastruktur secara terpisah.
4. Tambahkan bukti concurrency pembayaran/locking bila belum tercakup. Gunakan koneksi PostgreSQL nyata; jangan menyamakan PGlite dengan pengujian pooling produksi.
5. Verifikasi metadata retensi/recovery Neon secara read-only bila autentikasi tersedia. Restore atau perubahan paket produksi bukan bagian tindakan otomatis ini.
6. Simpan hasil, environment, perintah reproduksi, dan backlog lanjutan. Referensi seed pada presentasi UI/mobile tetap pekerjaan terpisah.

## Batas keselamatan

- Tidak reset/seed database yang berasal dari `.env` development/production.
- Runner lokal wajib memvalidasi host loopback dan nama database dengan prefix khusus audit, sebelum adapter atau subprocess dibuka.
- Schema/data fixture dihapus hanya pada database/container yang dibuat khusus oleh runner ini.
- Data koneksi test tidak ditulis ke `.env` aplikasi.
- Perubahan workspace yang sudah ada, termasuk UI goods receipt dan page primitives, dipertahankan.

## Temuan awal

- Koneksi plugin Neon sempat menolak permintaan dengan `oauth_token_invalid_grant`. Setelah koneksi ulang melalui ChatGPT app pada 21 September 2026, inspeksi read-only berhasil. Kejadian ini dipertahankan sebagai catatan troubleshooting, bukan blocker aktif.
- Tidak ada `ATRIA_TEST_DATABASE_URL`/`ATRIA_TEST_EMPTY_DATABASE_URL` di file env yang diperiksa. Docker tersedia tetapi daemon awalnya belum aktif; OrbStack diluncurkan untuk test lokal.

## Blocker migration yang direproduksi

PostgreSQL 17 lokal menerima 41 migrasi dan menghasilkan 67 tabel. Seed gagal karena `rab_estimate_item.item_nature` ada di schema TypeScript tetapi belum memiliki migrasi. Perbaikan tambahan yang diperlukan: migrasi aditif sesuai schema existing, lalu ulangi migration chain dari nol dan seed. Tidak memakai schema push untuk menyembunyikan gap release ini.

## Perbaikan yang dihasilkan

1. **Migration gap:** `0041_rab_item_nature.sql` menambahkan kolom `item_nature` dengan default `PRODUCTION` dan index yang sudah dideklarasikan schema. Journal/snapshot Drizzle diperbarui. Seluruh **42 migrasi** dijalankan kembali dari nol sebelum seed.
2. **Validasi ID role bawaan:** `roles.ts` memakai UUID RFC yang menolak ID tetap role sistem. Diganti validasi bentuk UUID PostgreSQL seperti validasi role pada administrasi existing. Empat regression test role sistem gagal sebelum fix, lalu seluruh lima test lulus. Pemeriksaan existence, izin pengelola, anti-eskalasi, dan perlindungan role Owner tetap server-side.
3. **Seed approval snapshot:** migrasi 0032 membekukan `requires_owner_approval` untuk data existing, tetapi seed yang dijalankan sesudahnya belum mengisinya. Fixture Rp5 juta salah menjadi APPROVED setelah verifikasi. Seed kini membekukan keputusan dari nominal seed, overrun, dan riwayat approval; walkthrough verify → approve → pay kembali lulus. Ini perubahan fixture, bukan pelonggaran guard transaksi produksi.
4. **Fixture suite lama:** ID Owner pada suite usulan role diselaraskan dengan seed; suite posting invoice memock boundary cache Next ketika dijalankan di luar request; assertion pembayaran vendor memeriksa flag keputusan approval dan record PENDING, bukan fragmen copy catatan. Assertion hasil aksi menampilkan response lengkap bila gagal.

## Lingkungan dan bukti

- PostgreSQL **17.11**, image `postgres:17-alpine`, container sementara berlabel `atria.purpose=readiness-audit`, bind hanya `127.0.0.1`.
- Pool/transaksi PostgreSQL nyata memakai transport TCP `pg` melalui preload test. Driver Drizzle dan domain actions asli digunakan. Ini **bukan** pengujian WebSocket Neon, pooler cloud, atau latency produksi.
- DB template seeded dan kosong terpisah. Setiap file suite memperoleh clone baru; runner menghapus clone miliknya setelah selesai. Seluruh container audit dibersihkan setelah verifikasi.
- **23 file suite / 132 test lulus / 0 fail / 0 skip** melalui runner lokal. Angka ini termasuk unit cases yang berada di file suite integrasi; tidak dibandingkan satu-banding-satu dengan jumlah skip Bun pada suite default.
- Cakupan: expense/vendor/client payment, approval, mutasi kas, rekonsiliasi dan immutability, walkthrough saldo, draft, material reserve/use/goods receipt/stock count, budget, aktivasi/revisi proyek, page loaders seeded/kosong, dan usulan AI dengan boundary model dimock.
- Test concurrency menahan transaksi pertama ketika request kedua mulai. Dari saldo 1.000, dua penarikan 700 menghasilkan satu sukses, satu insufficient funds, saldo 300, satu ledger outflow, dan audit yang konsisten.
- Test HTTP membuka listener loopback sementara dengan handler Better Auth dan adapter tRPC asli. Login email/password fixture menghasilkan bearer token dan cookie nyata. Tanpa token dan token invalid menghasilkan 401; token maupun cookie valid mencapai domain handler; setelah `pay:cost` dicabut keduanya menghasilkan 403; setelah grant token kembali diterima. Tidak ada perubahan cash ledger. Ini menguji HTTP backend, bukan browser/Next deployment end-to-end.
- `pg_dump -Fc` → database restore terpisah → invariant checker: **6 invariant lulus, 83 baris diperiksa**. Ini logical backup/restore lokal, **bukan PITR cloud**, bukan pembuktian retensi tujuh hari, dan bukan restore lampiran eksternal.

Quality gates pada working tree saat verifikasi: suite default **1.294 pass, 151 skip, 0 fail** (core 296, mobile 5, web 993); lint **0 error, 1 warning existing** pada notification scheduler; production build web dan standalone TypeScript web lulus. Test PostgreSQL di atas dijalankan terpisah dari suite default yang tetap menonaktifkan database eksternal. Perubahan paralel UI di workspace tidak ditimpa.

## Audit cloud read-only — 21 September 2026

Target deployment sudah dapat dibedakan tanpa mencetak credential:

- Vercel Production `atria-erp` memakai database `neondb` pada endpoint `ep-wispy-unit-az0r7nao`, yaitu project Neon **`atria-erp-prod`** (`little-river-44246623`), branch default **`main`** (`br-super-tree-azh1p78r`). Branch dan compute berstatus ready/active.
- `DATABASE_URL` Vercel Production memakai hostname direct/non-pooled. Metadata compute menunjukkan `pooler_enabled=false`, tetapi flag ini saja tidak membuktikan endpoint pooled tidak dapat dipakai: probe read-only tanggal 29 September berhasil mengakses hostname pooled production tanpa perubahan compute. Gunakan bukti koneksi/transaksi, lalu pisahkan pooled runtime URL dari direct migration/backup URL ketika rollout disetujui.
- Vercel Preview dan Development tidak memiliki `DATABASE_URL`. Untuk Preview ini **disengaja** menurut [panduan deploy](../guide/vercel-deployment.md#variabel-lingkungan), agar deployment pratinjau tidak menulis ke database perusahaan. Environment lokal `apps/web/.env` menunjuk project lama **`atria-erp`**, branch **`development`**, database `atria_uat_guard`; file backup lokal sebelum perpindahan menunjuk branch lama `production`.
- Project lama `atria-erp` memiliki branch `production`, `development`, dan arsip `pre-reset-2026-08-28`. Project baru `atria-erp-prod` hanya memiliki `main`. Tidak ada branch yang ditandai protected pada metadata yang dibaca.
- Kedua project berada pada PostgreSQL 18 di Singapore dan paket `free_v3`, dengan history retention **21.600 detik (6 jam)**. Ini masih di bawah target tujuh hari yang dicatat pada restore drill lama.
- Production cloud menjalankan PostgreSQL **18.6**, memiliki **67 public tables** dan **41 migration records**. Kolom `rab_estimate_item.item_nature` belum ada. Working tree lokal sudah memiliki migration ke-42 (`0041_rab_item_nature.sql`), sehingga migration tersebut wajib diuji pada branch terisolasi dan diterapkan sebelum code yang bergantung padanya dirilis.
- Tidak ada query yang berjalan lebih dari lima menit dan tidak ada lock tertahan saat inspeksi. Statistik vacuum menunjukkan dataset masih kecil; temuan ini hanya snapshot, bukan load test atau SLA.
- **0 dari 67 public tables** mengaktifkan RLS. Ini konsisten dengan tenant foundation Fase 0, tetapi tetap memblokir aktivasi tenant kedua.

Audit ini tidak membuat branch, tidak menjalankan migration, tidak mengubah Vercel env, tidak mengubah retensi/paket, dan tidak membaca isi record bisnis.

## Rehearsal migration 0041 pada branch terisolasi — 21 September 2026

- Dibuat branch Neon `audit-0041-rab-item-nature-20260921` (`br-divine-band-azvuqyl9`) dari `atria-erp-prod/main` pada parent LSN `0/912C528`. Branch memakai database `neondb` dan compute terpisah. Upaya awal mengatur interval suspend 300 detik ditolak paket Neon **sebelum branch tercipta**; pembuatan ulang tanpa override berhasil.
- Preflight branch: 41 migration, kolom belum ada, enam invariant tanpa pelanggaran. Hanya invariant alokasi kategori (I3) yang memeriksa data, yaitu 5 baris; bank, stock, ledger, movement, dan pembayaran vendor masing-masing memeriksa 0 baris. `rab_estimate_item` juga berisi 0 baris. Karena itu rehearsal ini membuktikan eksekusi DDL dan kecocokan schema, **belum** membuktikan backfill terhadap RAB lama atau konsistensi ledger/stock yang berisi data produksi.
- Dijalankan **hanya pada branch uji** dalam satu transaksi: dua statement dari `apps/web/drizzle/0041_rab_item_nature.sql`, lalu satu record `drizzle.__drizzle_migrations` dengan SHA-256 SQL `4cbc84b0b46f523dd794b744d2222f2ac4ecb9f2aaa54f73ae0256d34f21c3c5` dan timestamp journal `1789868642872`.
- Postflight: 42 migration; `item_nature` bertipe `varchar(50)`, `NOT NULL`, default `PRODUCTION`; index `rei_item_nature_idx` ada. Schema diff terhadap parent hanya berisi kolom dan index yang diharapkan. Enam invariant tetap tanpa pelanggaran dengan cakupan baris sama. Tidak ada query lebih dari lima menit atau lock tertahan saat diperiksa.
- Pembacaan ulang `main` sesudah rehearsal masih menunjukkan **41 migration dan tanpa `item_nature`**. Branch uji dipertahankan untuk review; belum dihapus atau dipakai sebagai target deployment.

Pada compute branch uji `ep-blue-frog-azgry6vg` saja, pooler diaktifkan (`pooler_enabled=true`). Koneksi TLS ke hostname pooled branch berhasil memakai driver PostgreSQL `pg`; transaksi read-only juga berhasil lewat `@neondatabase/serverless` `Pool`, yaitu driver runtime aplikasi. Checker invariant aplikasi yang dijalankan lewat URL pooled branch lulus **I1–I6, 5 baris diperiksa**. Probe write transaction lewat driver aplikasi menyisipkan satu `inventory_location` sementara, membaca baris itu di dalam transaksi, lalu `ROLLBACK`; pembacaan setelahnya memastikan **0 baris tersisa**. Ini memverifikasi kompatibilitas koneksi dan rollback dasar, bukan benchmark beban atau seluruh mutation finansial lewat pooler. Compute `main` tetap `pooler_enabled=false` dan Vercel Production tetap memakai URL direct.

**Rollout produksi yang disiapkan:** pastikan migration file/journal sudah masuk revisi rilis, freeze target project/branch/database dan verifikasi ulang 41 migration + ketiadaan kolom, catat jumlah baris RAB sebelum eksekusi, lalu jalankan dua statement DDL dan insert journal sebagai satu transaksi via koneksi **direct**. Verifikasi 42 migration, hash, tipe/default/index, schema diff, dan invariant. Karena `CREATE INDEX` biasa dapat menahan write pada tabel selama operasi, jadwalkan saat traffic rendah dan ukur durasinya. Production baru boleh menjalankan code yang bergantung pada `item_nature` setelah verifikasi itu lulus. Jika ada kegagalan sebelum commit, transaksi rollback; setelah commit, pemulihan data harus mengikuti prosedur restore terpisah, bukan `DROP COLUMN` otomatis.

## Rollout migration production — 29 September 2026

Pengguna menyetujui penerapan migration 0041 melalui jawaban `lanjut` atas permintaan persetujuan rollout. Target diperiksa ulang karena rehearsal sudah berumur delapan hari: project `atria-erp-prod` (`little-river-44246623`), branch `main` (`br-super-tree-azh1p78r`), database `neondb`. Environment Vercel Production masih menunjuk endpoint direct yang sama.

- Preflight: 41 migration; seluruh hash SQL dan timestamp journal cocok dengan 41 entry repo; kolom belum ada; tidak ada record migration 0041; tabel item RAB masih kosong. Checker invariant aplikasi lulus 6/6 dengan 5 baris diperiksa.
- Dua statement migration dan insert journal diterapkan sebagai satu transaksi melalui connector Neon, dengan guard atas jumlah/versi migration dan ketiadaan kolom, `lock_timeout=5s`, serta `statement_timeout=30s`. Respons API selesai dalam sekitar 2,9 detik; angka ini termasuk waktu connector/jaringan, bukan pengukuran durasi lock database.
- Postflight: 42 migration, tepat satu record hash/timestamp 0041; kolom `varchar(50)` dengan `NOT NULL` dan default `PRODUCTION`; index `rei_item_nature_idx` berstatus valid/ready. Schema diff terhadap branch rehearsal kosong.
- Checker invariant aplikasi sesudah commit tetap lulus 6/6 dengan 5 baris diperiksa. Pemeriksaan HTTP deployment existing: `/login` menghasilkan 200; endpoint job notifikasi tanpa bearer menghasilkan 401. Ini pemeriksaan ketersediaan dan guard dasar, belum smoke test kandidat release dengan login dan transaksi end-to-end.

Migration production selesai. Tidak ada code deployment, perubahan URL Vercel, peningkatan paket/retensi, atau penghapusan branch pada rollout ini. File migration dan journal lokal masih perlu masuk commit kandidat release; perubahan workspace lain dipertahankan. Keterbatasan dataset kosong pada RAB/ledger/stock tetap berlaku untuk bukti cloud.

## Verifikasi pooled finance/material — 29 September 2026

Status: selesai, **7 suite / 62 pass / 0 fail / 0 skip** pada database fixture di branch audit `br-divine-band-azvuqyl9`, compute `ep-blue-frog-azgry6vg`, PostgreSQL 18.6. Runtime test memakai hostname pooled dan driver `@neondatabase/serverless` asli; preload default hanya mengarahkan URL test dan menetralkan `server-only`. Tidak memakai adapter TCP lokal atau mock database. Server Actions dijalankan dengan sesi fixture dan boundary cache Next dimock sesuai suite; suite bearer/cookie memakai handler HTTP Better Auth/tRPC asli pada loopback.

| Suite                                       | Test lulus | Bukti utama                                                                                                                                  |
| ------------------------------------------- | ---------: | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `demo-walkthrough.integration.test.ts`      |         23 | Verify/approve/pay, vendor/client payment, transfer, rekonsiliasi, immutability, opening stock, reserve/use/return/waste, closing concurrent |
| `balance-concurrency.integration.test.ts`   |          1 | Dua penarikan 700 dari saldo 1.000 menghasilkan satu sukses, satu insufficient funds, saldo 300 serta ledger/audit konsisten                 |
| `actions.test.ts`                           |         12 | Invoice/client payment, project scope, budget legacy guard, dashboard permission                                                             |
| `actions-field.test.ts`                     |         14 | Approval pembayaran, klaim lapangan, vendor, material expense, dan package/category scope                                                    |
| `warehouse-operations.integration.test.ts`  |          8 | Goods receipt, duplicate receipt, transfer, stock count dan adjustment dengan catatan wajib                                                  |
| `cross-project-reserve.integration.test.ts` |          3 | Proyek B tidak dapat mengonsumsi stok yang direservasi proyek A                                                                              |
| `bearer-http.integration.test.ts`           |          1 | Token dan cookie aktif kehilangan izin segera setelah pencabutan; ledger tidak berubah                                                       |

Checker enam invariant lulus pada baseline (**83 baris**), sesudah walkthrough (**99 baris**), sesudah concurrency (**83 baris**), dan sesudah operasi gudang (**88 baris**). TypeScript web, ESLint runner, formatting file yang disentuh, serta `git diff --check` lulus. Ini pengujian fungsional pada compute audit 0,25 CU, belum benchmark p95/load atau smoke test deployment Vercel kandidat.

Probe production tambahan hanya memakai transaksi `BEGIN READ ONLY` terhadap hostname `ep-wispy-unit-az0r7nao-pooler.c-3.ap-southeast-1.aws.neon.tech`; berhasil membaca 42 migration melalui driver aplikasi. Vercel URL dan compute production tidak diubah. Koreksi atas interpretasi awal: `pooler_enabled=false` bukan bukti cukup untuk mewajibkan perubahan setting compute sebelum mencoba endpoint pooled.

Database referensi `atria_audit_pooled_20260929_seed` dibuat khusus pada branch audit. Migration dijalankan melalui hostname direct; scaffold dibersihkan pada database fixture itu sebelum demo seed; seed dan verifikasinya memakai pooled URL. Baseline checker lulus enam invariant dengan 83 baris diperiksa.

Runner [run-neon-pooled-audit.ts](../../apps/web/scripts/run-neon-pooled-audit.ts) membuat database audit baru untuk setiap suite, menjalankan 42 migration melalui koneksi direct, lalu demo seed dan test melalui pooled URL. Cloning dengan `CREATE DATABASE TEMPLATE` ditinggalkan karena backend idle PgBouncer dapat terbuka kembali sebelum cloning. Pada upaya itu hanya sesi idle database seed audit yang ditutup; tidak ada koneksi atau data production yang disentuh. Runner final tidak mematikan koneksi atau menyalin template.

Guard runner sudah diuji menolak URL yang hilang, endpoint production, database biasa (`neondb`), dan `NODE_ENV=production` sebelum akses DB. Runner tidak mengambil URL dari `.env`; `ATRIA_NEON_AUDIT_DATABASE_URL` wajib diberikan eksplisit dan hanya menerima endpoint branch audit yang dipatok. Log dan hasil berada di `/tmp/atria-neon-pooled-20260929.P9a0ND`; credential sementara dihapus setelah subprocess berakhir. File hasil tidak membawa credential.

Cara menjalankan kembali: sediakan URL database referensi seed pada branch audit melalui secret manager sebagai `ATRIA_NEON_AUDIT_DATABASE_URL`, lalu dari `apps/web` jalankan `bun scripts/run-neon-pooled-audit.ts /tmp/atria-neon-pooled-audit`. Setiap pengulangan membuat database baru; database fixture dipertahankan untuk pemeriksaan dan cleanup cloud dilakukan terpisah. Jangan memakai runner ini sebagai perintah deploy.

Database fixture yang dipertahankan: `atria_audit_pooled_20260929_seed` serta `atria_audit_ae878f16757e_0` sampai `_6`, seluruhnya hanya pada branch audit. Semua berisi data demo; bukan target deployment. Runner tidak memakai schema push. Workspace perubahan aplikasi/UI milik pengguna dipertahankan.

## Cara mengulang

Prasyarat: Docker aktif, Bun dan Python 3. Jalankan dari root repo. Semua kredensial di bawah khusus container disposable.

```bash
docker run --rm -d --name atria-audit-local \
  --label atria.purpose=readiness-audit \
  -p 127.0.0.1::5432 \
  -e POSTGRES_PASSWORD=atria-local-audit \
  -e POSTGRES_DB=atria_audit_baseline postgres:17-alpine
docker exec atria-audit-local pg_isready -U postgres
# Tunggu sampai pg_isready menyatakan accepting connections sebelum lanjut.
AUDIT_PORT=$(docker port atria-audit-local 5432 | cut -d: -f2)
export ATRIA_LOCAL_TEST_DATABASE_URL="postgresql://postgres:atria-local-audit@127.0.0.1:${AUDIT_PORT}/atria_audit_baseline"
(
  cd apps/web
  bun --preload ./scripts/local-postgres-preload.ts scripts/provision-instance.ts \
    --name 'Atria Audit' --slug atria-audit
)
docker exec atria-audit-local createdb -U postgres \
  -T atria_audit_baseline atria_audit_empty42
(
  cd apps/web
  bun --preload ./scripts/local-postgres-preload.ts scripts/reset-database.ts --confirm-reset
  bun --preload ./scripts/local-postgres-preload.ts db/seed.ts
  bun --preload ./scripts/local-postgres-preload.ts scripts/verify-demo-seed.ts
)
python3 apps/web/scripts/run-local-postgres-audit.py \
  --container atria-audit-local --logs /tmp/atria-postgres-audit
docker stop atria-audit-local
unset ATRIA_LOCAL_TEST_DATABASE_URL
```

Hentikan urutan bila perintah gagal. Runner menolak container tanpa label audit atau binding selain loopback; preload menolak database tanpa prefix audit, host remote, dan `NODE_ENV=production`. Tidak ada fallback ke `DATABASE_URL` dari `.env`.

Runner menghasilkan `results.json` dan log per suite. Bukti sesi ini berada sementara di `/tmp/atria-postgres-audit-http-final`, `/tmp/atria-pg-provision42.log`, `/tmp/atria-pg-verify-fixed.log`, dan `/tmp/atria-pg-restore-invariants.log`; ringkasan permanen ada di dokumen ini.

## Drill pemulihan historis production — 30 September 2026

Target yang diverifikasi ulang: project Neon `atria-erp-prod` (`little-river-44246623`), branch `main` (`br-super-tree-azh1p78r`), database `neondb`. History retention saat drill masih **21.600 detik / 6 jam**; tidak ada snapshot terjadwal. Sebagai penanda waktu tanpa menulis ke database bisnis, dipakai migrasi 0041 yang sudah diterapkan beberapa jam sebelumnya.

- Snapshot manual `prod-pre-0041-recovery-drill-20260930` (`snap-wild-silence-az8k410t`) dibuat dari `main` pada target **2026-09-29 14:30:00 UTC**. Neon menyelesaikan parent pada **14:29:49 UTC**, LSN `0/B455C30`. Snapshot dibuat **17:48:25 UTC**.
- Snapshot dipulihkan dengan `finalize: false` ke branch baru `recovery-drill-pre-0041-20260930` (`br-green-smoke-azl7gnni`), siap sekitar **17:48:34 UTC**. Tidak ada restore ke branch `main`, pemindahan compute production, atau perubahan URL aplikasi.
- Query read-only pada branch hasil restore menunjukkan **41 migration** dan kolom `rab_estimate_item.item_nature` **tidak ada**. Query yang sama pada `main` menunjukkan **42 migration** dan kolom **ada**. Ini membuktikan branch benar-benar berisi keadaan sebelum migrasi, bukan salinan kondisi terkini.
- Keduanya memiliki **5** baris `project_budget_category` dan **0** pelanggaran alokasi kategori. Tabel bank, cash transaction, inventory, stock movement, dan vendor payment masing-masing masih **0** baris pada kedua branch. Jadi drill ini membuktikan pemulihan schema serta kelima alokasi, tetapi belum membuktikan pemulihan transaksi bisnis nonkosong; enam invariant aplikasi tidak dijalankan langsung pada branch hasil restore.
- Compute khusus branch drill `ep-ancient-cherry-azrptstd` dinonaktifkan setelah verifikasi; statusnya `disabled=true`, `idle`. Snapshot dan branch disimpan sebagai bukti, belum dihapus. Endpoint production `ep-wispy-unit-az0r7nao` tetap terikat ke `main`.

Waktu dari permintaan restore hingga branch siap teramati sekitar **5–10 detik** lewat connector; ini bukan RTO aplikasi, karena perubahan routing/deployment, login, dan lampiran eksternal tidak disimulasikan. Enam jam hanya membuktikan perjalanan waktu dalam jendela pendek. Target operasional tetap minimal **7 hari** untuk satu siklus rekonsiliasi; pilihan paket/retensi, snapshot terjadwal atau backup independen, RPO/RTO, dan prosedur recovery lampiran perlu diputuskan dan diuji tersendiri. Lihat [runbook serta catatan hasil](../guide/restore-drill.md#drill-production-30-september-2026).

## Yang belum ditutup

- **P0-03 produksi:** pemulihan historis dari `main` ke branch terisolasi telah terbukti pada titik sebelum migrasi 0041. Retensi masih enam jam; RPO/RTO, pemulihan data transaksi nonkosong, simulasi cutover aplikasi, dan recovery lampiran eksternal belum terbukti. Jangan menganggap keberhasilan mekanis ini sebagai kelulusan recovery operasional.
- **P0-04 cloud:** suite lokal serta 7 suite/62 test finance/material/auth pada pooled Neon lulus; migration 0041 sudah diterapkan pada `main`. [Cutover source/runtime production](2026-09-29-release-candidate-and-pooled-smoke.md#hasil-cutover-production) selesai: hardening live, URL runtime pooled, dan region Singapore. Pemeriksaan publik serta invariant sesudah cutover lulus. Browser/mobile acceptance dan load/p95 tetap bukti terpisah; production tidak dipakai untuk test posting finansial.
- Sinkronisasi izin presentasi UI/mobile masih backlog terpisah; tidak ada perubahan UI oleh pekerjaan integrasi ini.
