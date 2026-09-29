# Kandidat release hardening dan smoke test pooled

Tanggal: 29 September 2026. Status: cutover production selesai dan verifikasi sesudah pengalihan lulus.

Melanjutkan [62 test pooled Neon](2026-09-20-postgres-integration-and-recovery.md#verifikasi-pooled-financematerial--29-september-2026). Production sudah memiliki migration 0041. Kandidat ini membawa hardening izin efektif serta migration/test/docs pendukung, dengan UI dari commit `031112a1a82fc60b14936ff94b66c41998e32190`. Perubahan UI working tree tidak ikut kandidat.

## Rencana dan batas

1. Gunakan managed checkout `/Users/librandev/.codex/worktrees/readiness-release/atria-erp`. Salin hanya perubahan backend/auth/domain beserta test dan migration yang terkait. Simpan daftar file dan hash source untuk review; jangan mengubah checkout utama.
2. Jalankan test, lint, TypeScript, dan build pada kandidat. Jika fixture typecheck existing perlu diperbaiki, batasi perubahan ke fixture kandidat dan catat terpisah.
3. Siapkan database audit baru yang migrated/seeded pada branch Neon audit, menggunakan pooled URL. Preview memakai secret Better Auth/bootstrapping/job yang baru, origin preview sendiri, dan integrasi eksternal dimatikan untuk smoke test.
4. Deploy sebagai preview Vercel dengan protection tetap aktif. Verifikasi login, cookie/bearer, loader keuangan/material, pencabutan izin setelah login, dan guard posting melalui HTTP deployment sesungguhnya. Catat URL dan hasil invariant fixture.
5. Siapkan kandidat source dan konfigurasi produksi untuk review akhir. Preview menggunakan database fixture dan **tidak boleh langsung dipromosikan ke domain production**. Rollout production memerlukan build/deployment dengan konfigurasi production dan persetujuan cutover setelah hasil konkret tersedia.

Scope ini tidak menaikkan paket/retensi, tidak menghapus branch audit, dan tidak memakai database production untuk transaksi smoke test. Perubahan UI user tetap di checkout utama.

## Temuan checkout bersih dan perbaikan

- Install hoisted memisahkan React web 19.2.4 dari React 19.2.3 yang dibaca dependency root. Satu test rendering mereproduksi invalid hook call; `bun install --linker isolated --frozen-lockfile` pada checkout **release web** membuat Framer Motion dan renderer resolve ke React 19.2.4 yang sama, lalu 10 test terkait lulus. Checkout release web mematok isolated tanpa mengubah versi dependency/lockfile. Workspace utama tetap memakai hoisted yang dibutuhkan Metro mobile; konfigurasi root release web tidak boleh di-merge ke workflow mobile tanpa verifikasi native atau strategi dependency terpisah.
- Test auth child process diberi origin/secret test eksplisit; signature ImageKit memakai key test sementara dan mengembalikan environment setelah test. Keduanya tidak lagi bergantung pada `.env` lokal.
- Fixture RAB kandidat diselaraskan dengan `RabEstimateView`/`RabItemView` actual, tanpa perubahan tampilan. Type import Storybook memakai dependency langsung `@storybook/nextjs` agar valid pada install isolated.
- Kandidat lulus 1.286 test (core 296, mobile 5, web 985), 151 integration skip yang memerlukan DB terpisah, lint 0 error/1 warning scheduler existing, TypeScript web, dan production build. Bukti pooled 62 test tetap terpisah dari suite default.
- Dry run upload Vercel mendeteksi Next.js dan 1.263 file non-directory, sekitar 15 MB. Tidak ada file env berisi secret, dependency lokal, `.git`, `.vercel`, atau fixture CSV yang ikut upload.
- Database smoke khusus: `atria_audit_candidate_20260929` pada branch audit. Migration/seed/verify dan baseline enam invariant lulus. Secret auth/job baru dan origin preview `https://atria-readiness-001d0681.vercel.app` dipersiapkan; integrasi AI/upload/push dimatikan pada environment preview ini.

## Kandidat yang diverifikasi

- Checkout: `/Users/librandev/.codex/worktrees/readiness-release/atria-erp`; branch lokal `codex/readiness-pooled-release`.
- Commit source runtime: `ef20abf66bdabb162362c02e37974d32299ecf2e`, berbasis `031112a`. Manifest file/hash berada di `docs/plans/2026-09-29-candidate-manifest.json` pada checkout kandidat. Scope awal menyalin 80 file backend/test/migration/docs dan mengecualikan 42 perubahan UI working tree; penyesuaian clean-install/test di atas dicatat terpisah. Tidak ada push atau merge ke branch pengguna.
- Preview final: [atria-readiness-001d0681.vercel.app](https://atria-readiness-001d0681.vercel.app), deployment `dpl_Hu6fr6H7Tmy5xuv7Qq5swPuojULx` (`atria-5wh4ffw27-hyuzins-projects.vercel.app`). Status READY, region fungsi `sin1`, protection Vercel Authentication tetap aktif.
- Preview awal `dpl_AJpkag9mg6t7QJr5c1dEPy85Rtoy` lulus fungsi tetapi memakai `iad1`. Deploy ulang dengan `--local-config apps/web/vercel.json --regions sin1` memperbaiki region tanpa mengubah source aplikasi. Metadata deployment, daftar lambda pada CLI inspect, dan header semua request tRPC (`sin1::sin1::...`) memverifikasi region final. Fixture audit dikembalikan ke seed sebelum pengulangan smoke.

## Hasil smoke HTTP deployment

Semua enam kelompok pemeriksaan lulus pada preview final:

1. Login page 200; job internal tanpa bearer 401; API pembayaran tanpa sesi atau dengan token invalid 401.
2. Login fixture Finance/Owner/PM menghasilkan token dan cookie nyata. Loader ledger via bearer berstatus ready; halaman ledger Finance dan materials Owner via cookie menghasilkan 200.
3. PM Budi memperoleh overview Menteng yang ditugaskan kepadanya; overview Sudirman milik PM lain restricted.
4. Mencabut `pay:cost` membuat token dan cookie Finance yang sama ditolak 403. Ledger tidak berubah selama penolakan. Setelah grant kembali, token yang sama diterima. Perubahan izin dilakukan melalui use-case role asli pada database fixture; yang diverifikasi melalui deployment adalah enforcement pada request berikutnya, bukan interaksi layar Settings.
5. Pembayaran fixture biaya Rp1.050.000 berhasil melalui HTTP tRPC, saldo Kas Budi menjadi Rp13.100.000, tepat satu ledger entry dibuat. Request duplikat ditolak dan tidak menghasilkan posting kedua.
6. Sesudah smoke, enam invariant lulus dengan **84 baris diperiksa**; izin Finance dipulihkan ke daftar awal.

Ini smoke HTTP/backend dan server-rendered route availability. Belum merupakan browser acceptance visual 320–430 px, native device verification, benchmark beban/p95, atau recovery drill. Tidak ada transaksi bisnis production atau perubahan env production pada tahap ini.

Bukti lokal: `/tmp/atria-release-candidate.Vw6sHE/smoke-results.json`, build/inspect/deploy logs yang disanitasi, dan `/tmp/atria-candidate-20260929-{tests-final,lint-final,tsc-final}.log`. File credential dan respons/header HTTP mentah dibersihkan sesudah verifikasi; ringkasan ini merupakan bukti permanen, sementara `/tmp` bukan arsip.

## Cutover production yang disiapkan

Pengguna menyetujui cutover melalui `oke lanjut` setelah penjelasan pooled connection. Preflight terbaru memastikan checkout kandidat bersih, source aplikasi identik dengan commit runtime yang diuji, deployment live masih `dpl_77LwXaSgbJ7FxMQxzCXBK95zDgok`, serta production memiliki 42 migration dan tepat satu record hash 0041. Eksekusi dilakukan pada checkout kandidat, memakai environment production existing dengan override hanya URL database; secret preview tidak dipakai.

Setelah persetujuan pengguna, gunakan source runtime yang sama, pertahankan secret auth/origin/integrasi production existing, ubah runtime `DATABASE_URL` ke hostname pooled **production** `ep-wispy-unit-az0r7nao-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb`, dan simpan URL direct sebagai `DATABASE_URL_UNPOOLED`. Jangan menyalin secret atau database preview.

Bangun deployment production dengan `--local-config apps/web/vercel.json --regions sin1 --prod --skip-domain`, periksa region/schema/invariant dan guard HTTP read-only, lalu lakukan cutover domain production setelah pemeriksaan lulus. Preview fixture ini tidak boleh langsung dipromosikan. Simpan identity deployment production sebelumnya untuk rollback aplikasi; migration 0041 bersifat aditif dan tidak dihapus ketika rollback. Retensi/PITR dan tenant kedua tetap mengikuti backlog terpisah.

Baseline rollback diperiksa ulang: `atria-erp.vercel.app` masih menunjuk `dpl_77LwXaSgbJ7FxMQxzCXBK95zDgok` (`atria-l34alm2b3-hyuzins-projects.vercel.app`), commit `65cb27eb97fcb26a8a003f8ceaa47a257c09383d`, region `iad1`. Verifikasi kembali identity ini tepat sebelum cutover; jangan menggulung balik deployment lain yang mungkin diterbitkan sesudah catatan ini.

## Hasil cutover production

- Domain [atria-erp.vercel.app](https://atria-erp.vercel.app) sekarang menunjuk deployment **`dpl_HVGdmeHfuYWBa46c7QHNSvjneGZn`** (`atria-5oq5er988-hyuzins-projects.vercel.app`), target production, status READY, region fungsi **`sin1`**. Checkout source saat deploy adalah commit `307a85478e0e3ea9e5898d604b2539dd21ffa05c`; source aplikasi identik dengan runtime `ef20abf` yang diverifikasi pada preview.
- Deployment dibuat menggunakan env production existing dengan override URL database saja. Pemeriksaan deployment staging lulus sebelum domain utama dipromosikan. Var project **Production** `DATABASE_URL` kini memakai hostname pooled main/neondb; `DATABASE_URL_UNPOOLED` ditambahkan dengan hostname direct main/neondb. Env Preview/Development umum tidak diubah.
- Secret/origin auth, bootstrap, job dan integrasi existing yang diperiksa tetap sama; secret fixture preview tidak disalin. Tidak melakukan transaksi pembayaran, perubahan role, seeding/reset, atau stock mutation pada database production selama cutover.
- Pemeriksaan HTTP domain publik: login 200; session tanpa cookie 200/null; ledger tanpa sesi 307; job tanpa bearer 401; pembayaran tanpa sesi/token invalid 401. Header request API menunjukkan `sin1::sin1::...`.
- Checker production sebelum/sesudah lulus **6 invariant / 5 baris diperiksa**. Schema tetap 42 migration dengan hash 0041 yang sesuai. Data production masih tipis; bukti transaksi nonkosong berasal dari fixture pooled dan preview terisolasi.
- Deployment lama `dpl_77LwXaSgbJ7FxMQxzCXBK95zDgok` disimpan sebagai referensi rollback. Retensi Neon masih enam jam; P0-03 recovery/PITR dan aktivasi tenant kedua tetap belum ditutup.

Bukti tambahan sementara berada pada `/tmp/atria-production-cutover.kzYGJd`: `deployment.json`, `stage-checks.json`, `public-postflight.json`, invariant logs, env update logs dan promotion log yang disanitasi. Credential snapshot dan payload/header sementara dibersihkan setelah verifikasi. Branch lokal `codex/readiness-pooled-release` tetap menyimpan snapshot deployment; integrasi source ke `development` dicatat di bawah.

## Integrasi source ke development — 30 September 2026

Pemeriksaan byte-per-byte atas 84 file berbeda pada branch release: **81 sudah identik** di working tree `development`; `docs/plans/2026-09-29-candidate-manifest.json` disalin sebagai bukti. Dua file berbeda sengaja dipertahankan dari working tree utama: fixture RAB membawa edit UI yang lebih baru dan valid secara TypeScript, sedangkan `bunfig.toml` tetap `hoisted` karena Metro mobile membutuhkannya. Hanya file release yang cocok serta dokumen hasil integrasi yang masuk commit source di `development`; edit UI lain tetap tidak distage.

Checkout web release memakai linker isolated untuk verifikasi SSR React pada install bersih. Konfigurasi itu khusus snapshot release web dan tidak dipindah ke root workspace utama. Native Metro tetap memakai hoisted; bila kelak menjalankan QA web dari install bersih, gunakan checkout web dengan `bun install --linker isolated --frozen-lockfile` atau selesaikan strategi satu React untuk semua workspace secara terpisah.
