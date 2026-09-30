# Baseline readiness Atria dan backlog P0/P1

Tanggal audit: 18 September 2026

Status: baseline lokal selesai; belum merupakan persetujuan release produksi.

Arah produk/bisnis: [strategi Atria](2026-09-18-product-business-and-readiness-strategy.md).

**Tindak lanjut 19 September 2026:** perbaikan backend P0-01/P0-02 sudah diimplementasikan dan diverifikasi lokal. Lihat [hasil hardening izin efektif](2026-09-18-effective-permission-hardening.md). Temuan, nomor baris, dan reproduksi di bawah merupakan snapshot **sebelum perbaikan**, dipertahankan sebagai bukti audit. P0-03/P0-04, validasi deployment, serta sinkronisasi affordance klien belum selesai.

**Tindak lanjut 20 September 2026:** [validasi PostgreSQL lokal](2026-09-20-postgres-integration-and-recovery.md) lulus 23 file/132 test, termasuk HTTP bearer nyata, concurrency, dan dump/restore dengan enam invariant. Migration gap, validasi ID role sistem, dan seed approval snapshot diperbaiki. P0-03 produksi masih membutuhkan autentikasi ulang Neon; P0-04 lokal sudah terbukti, smoke test deployment cloud masih terbuka.

**Tindak lanjut 21 September 2026:** autentikasi Neon pulih dan [audit cloud read-only](2026-09-20-postgres-integration-and-recovery.md#audit-cloud-read-only--21-september-2026) memetakan Vercel Production ke `atria-erp-prod/main/neondb`. Retensi production masih enam jam. Cloud memiliki 41 migration records dan belum memiliki `rab_estimate_item.item_nature`, sedangkan working tree sudah menambahkan migration ke-42. Koneksi runtime production masih direct/non-pooled; Preview/Development Vercel belum memiliki `DATABASE_URL`. Tidak ada konfigurasi atau data cloud yang diubah.

**Tindak lanjut rehearsal 21 September 2026:** [migration 0041 berhasil dijalankan pada branch uji](2026-09-20-postgres-integration-and-recovery.md#rehearsal-migration-0041-pada-branch-terisolasi--21-september-2026) yang diklon dari `atria-erp-prod/main`. Hasil schema diff tepat kolom dan index yang direncanakan; `main` tetap 41 migration. Dataset cloud tidak memiliki baris RAB atau ledger/stock untuk menguji backfill dan sebagian besar invariant, jadi bukti local seeded tetap diperlukan. Metadata compute menunjukkan pooler belum aktif; Preview tanpa DB adalah keputusan keamanan yang terdokumentasi, bukan konfigurasi yang perlu diisi otomatis.

**Tindak lanjut pooler 21 September 2026:** pooler diaktifkan hanya pada compute branch uji; koneksi pooled PostgreSQL serta transaksi `@neondatabase/serverless` read-only dan write-rollback berhasil. Checker invariant aplikasi lulus 6/6 dengan 5 baris diperiksa. Pooler `main` dan Vercel Production belum diubah; mutation finansial/material dan beban representatif lewat pooler masih perlu diuji sebelum rollout runtime.

## Kesimpulan

**Tindak lanjut 29 September 2026:** [rollout migration 0041 production selesai](2026-09-20-postgres-integration-and-recovery.md#rollout-migration-production--29-september-2026). Sebelum eksekusi, 41 hash/timestamp migration cloud cocok dengan repo. Production sekarang memiliki 42 migration, kolom/default/index yang valid, serta schema diff kosong terhadap rehearsal. Invariant aplikasi sebelum/sesudah lulus 6/6 dengan 5 baris diperiksa. Tidak ada code deployment atau perubahan URL runtime dalam rollout ini.

**Tindak lanjut pooled 29 September 2026:** [7 suite/62 test finance, material, dan auth](2026-09-20-postgres-integration-and-recovery.md#verifikasi-pooled-financematerial--29-september-2026) lulus di database fixture terpisah pada branch audit menggunakan transport Neon asli. Enam invariant lulus pada baseline (83 baris), walkthrough (99), concurrency (83), dan gudang (88). Endpoint pooled production juga berhasil diakses read-only meski metadata `pooler_enabled=false`; jangan menganggap flag itu membuktikan endpoint terblokir. Belum ada perubahan URL runtime atau code deployment.

**Tindak lanjut kandidat 29 September 2026:** [kandidat release backend](2026-09-29-release-candidate-and-pooled-smoke.md) dibuat pada checkout terpisah dan preview protected. Clean-install gates lulus 1.286 test/151 skip, lint, TypeScript dan build. Smoke HTTP preview Singapore memverifikasi sesi, scope PM, revocation efektif, pembayaran sekali, penolakan duplikasi, dan enam invariant atas 84 baris. Domain serta environment production belum dialihkan.

**Tindak lanjut cutover 29 September 2026:** [deployment production baru](2026-09-29-release-candidate-and-pooled-smoke.md#hasil-cutover-production) sudah melayani domain utama dari `sin1`, membawa hardening P0-01/P0-02 dan pooled runtime URL. URL direct dipisahkan untuk migrasi; secret auth/integrasi existing dipertahankan. Guard HTTP publik dan invariant sebelum/sesudah lulus (6 invariant, 5 baris production). Recovery enam jam masih gap P0-03; source release belum diintegrasikan ke working branch pengguna, dan linker hoisted mobile tetap dipertahankan pada workspace utama.

**Tindak lanjut 30 September 2026:** [integrasi source release](2026-09-29-release-candidate-and-pooled-smoke.md#integrasi-source-ke-development--30-september-2026) dilakukan dengan memilih file backend yang identik, mempertahankan edit UI pengguna, dan menjaga linker hoisted yang dibutuhkan Metro mobile. Recovery P0-03 tetap terbuka.

**Drill recovery 30 September 2026:** [snapshot production pada titik sebelum migrasi 0041 dipulihkan ke branch Neon terpisah](2026-09-20-postgres-integration-and-recovery.md#drill-pemulihan-historis-production--30-september-2026). Branch hasil restore memiliki 41 migrasi/tanpa kolom baru, sedangkan `main` tetap 42 migrasi/dengan kolom baru. Lima alokasi kategori valid. Retensi enam jam, data transaksi nonkosong, RPO/RTO, cutover aplikasi, dan lampiran eksternal masih gap P0-03.

**Keputusan recovery 30 September 2026:** [usulan RPO/RTO, pilihan biaya, dan urutan penerapan](2026-09-30-production-recovery-decision.md) disiapkan. Rekomendasi untuk pilot transaksi nyata adalah Launch dengan history tujuh hari dan snapshot terjadwal; upgrade organisasi memerlukan keputusan biaya Owner/Finance. Slot satu snapshot manual paket Free saat ini terpakai bukti drill.

**Pilihan pengguna 30 September 2026:** Neon tetap Free. [Workflow dump harian ke S3](2026-09-30-free-tier-nightly-backup.md) dan [runbook aktivasi/restore](../guide/free-tier-s3-backup.md) telah disiapkan dengan guard production, IAM OIDC, validasi archive, dan retensi bucket 30 hari. Backup terjadwal **belum aktif** sampai bucket/role AWS, role baca Neon, secret GitHub, dan uji run manual tersedia. RPO efektif dump harian dapat mendekati 24 jam; usulan satu jam belum tercapai.

Baseline otomatis lulus untuk test tanpa database, lint, dan production build web. Audit menemukan **dua cacat otorisasi P0 yang direproduksi secara lokal**. Keduanya harus ditutup sebelum otorisasi dari Settings dapat dipercaya. Bukti integration/recovery terkini belum lengkap. Tenant kedua belum boleh diaktifkan berdasarkan kesiapan yang terbukti pada audit ini.

Tidak ada perubahan runtime, migrasi, reset/seed database, deploy, atau transaksi bisnis dalam audit ini. Tiga perubahan UI milik workspace yang sudah ada sebelum audit tetap dipertahankan. Hasil di bawah berlaku pada working tree saat pemeriksaan, bukan klaim terhadap deployment tertentu.

## Metode dan batas pemeriksaan

- Orientasi lewat Graft, dokumen produk/tenant/readiness, dan runbook finance/material/QA.
- Pemeriksaan sumber terarah: Actor, sumber izin efektif, middleware tRPC, payment use-case, pengelolaan role, helper mutasi saldo, reservasi stock, tenant architecture tests, dan benchmark loader.
- Test workspace dengan dua variabel database integrasi sengaja dikosongkan. Preload mengarahkan koneksi yang tidak sengaja ke endpoint buntu; tidak memakai database bisnis.
- Reproduksi terisolasi memakai implementasi asli `getRoleAccess` dan `activeProcedure`, dengan query role dan session resolver dimock. Tidak melakukan HTTP exploit atau pembayaran nyata.
- Lint, formatting check, dan production build web.
- Belum dilakukan: pemeriksaan deployment/cloud terkini, integration DB, concurrency PostgreSQL nyata, audit semua endpoint/upload/export, pentest, dependency advisory scan, native build/device verification, browser acceptance, atau load test.

Temuan diklasifikasikan sebagai **terkonfirmasi**, **bukti operasional belum tersedia**, atau **prasyarat tahap SaaS**. Tidak adanya bukti di repo tidak membuktikan layanan eksternal belum dikonfigurasi.

## Hasil quality gates

| Pemeriksaan                                                                | Hasil aktual                                             | Arti dan keterbatasan                                                                                                                                             |
| -------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ATRIA_TEST_DATABASE_URL='' ATRIA_TEST_EMPTY_DATABASE_URL='' bun run test` | **1.273 pass, 148 skip, 0 fail**                         | Core 291 pass; mobile 5 pass; web 977 pass dan 148 skip. Test finansial/material yang membutuhkan DB tidak menjadi bukti lulus                                    |
| Reproduksi RBAC terisolasi                                                 | **3 skenario mereproduksi perilaku bermasalah**          | Assertions menegaskan bug saat ini; bukan regression tests yang menegaskan perilaku aman                                                                          |
| `bun run lint`                                                             | **0 error, 1 warning**                                   | Warning `import/no-anonymous-default-export` pada `apps/web/workers/notification-scheduler/src/index.ts:45`                                                       |
| `bun run build`                                                            | **Lulus pada pengulangan**                               | Percobaan sandbox gagal mengunduh Manrope/JetBrains Mono; pengulangan dengan izin jaringan lulus, termasuk TypeScript web. Ini bukan kegagalan kompilasi aplikasi |
| `bun run format:check`                                                     | **Gagal: 151 file dilaporkan pada snapshot pemeriksaan** | Tidak dilakukan mass formatting. Dokumen baru diformat terpisah sebelum handoff; jumlah ini bukan hitungan ulang setelah penambahan seluruh dokumen audit         |
| Native typecheck/build dan UI nyata                                        | **Belum dijalankan**                                     | `bun run build` root hanya membangun web                                                                                                                          |
| Invariant DB dan restore terkini                                           | **Belum dijalankan**                                     | Bukti 27–28 Agustus tetap historis                                                                                                                                |
| p50/p95 dan load test                                                      | **Belum diukur**                                         | Tidak ada klaim aplikasi lambat/cepat dari audit ini                                                                                                              |

Log lengkap lokal sementara: `/tmp/atria-readiness-2026-09-18-{tests,lint,build,build-retry,format}.log`. Log `/tmp` bukan arsip permanen; hasil dan resep reproduksi dicatat di dokumen ini.

## P0-01 — Pencabutan izin tidak konsisten di API dan use-case

**Status:** terkonfirmasi dari sumber dan reproduksi middleware.

**Dampak:** pengguna dengan nama role bawaan dapat melewati guard berdasarkan izin seed, walaupun izin efektifnya sudah dicabut. Role kustom dengan izin sah justru dapat ditolak.

**Gerbang:** sebelum rilis operasional yang mengandalkan izin dari Settings.

**Penanggung jawab yang diusulkan:** backend/auth.

Bukti:

- [Sumber izin efektif](../../apps/web/lib/auth/role-access.ts), `getRoleAccess`, baris 41–65, membaca tabel role/permission.
- [Actor](../../apps/web/server/actor.ts), baris 16–90, membawa `permissions` dan `dataScope`.
- [Middleware](../../apps/web/server/trpc/procedures.ts), baris 22–37, memeriksa `actorHasPermission(ctx.actor.roleName, meta.permission)`.
- [Helper seed](../../packages/core/src/auth/permissions.ts), baris 321–327, hanya membaca `ROLE_PERMISSIONS[roleName]`.
- [Pembayaran biaya](../../apps/web/server/usecases/finance/pay-field-request.ts), baris 31–45, memakai helper seed yang sama. [Server Action](../../apps/web/app/actions/finance/field-request-payment.ts), baris 15–45, memvalidasi sesi/input lalu mendelegasikan ke use-case tersebut.
- Pencarian `graft grep "actorHasPermission"` menghasilkan 114 hit di 44 file pada snapshot audit. Ini inventory referensi, **bukan 114 kerentanan**; sebagian adalah import, UI, seed, atau jalur dengan guard tambahan.

Reproduksi aman yang dijalankan:

1. Buat router diagnostik lokal dengan implementasi asli `activeProcedure.meta({ permission: "pay:cost" }).query(() => "REACHED")`.
2. Panggil `createCaller` dengan Actor `roleName: "FINANCE_ADMIN"`, `permissions: ["view:cost"]`, `mustChangePassword: false`.
3. Hasil aktual **`REACHED`**; hasil yang seharusnya **FORBIDDEN**.
4. Ulangi dengan role `AUDIT_CUSTOM`, `permissions: ["pay:cost"]`, scope global.
5. Hasil aktual **FORBIDDEN**; guard permission seharusnya meloloskan ke handler diagnostik.

Reproduksi ini membuktikan middleware mengabaikan izin efektif, bukan membuktikan pembayaran nyata berhasil dilakukan. Jalur pembayaran memiliki defect guard yang sama berdasarkan inspeksi sumber; pengujian integrasi mutation tetap diperlukan.

Acceptance criteria:

- Semua guard runtime menggunakan izin efektif server-side, dengan fail-closed saat lookup gagal; matriks kode hanya untuk seed/migrasi yang eksplisit.
- Mencabut `pay:cost` dari role bawaan menolak Server Action dan bearer API, tanpa satu perubahan saldo, ledger, stock, atau audit bisnis.
- Role kustom dengan izin yang sah bekerja sesuai data scope. Pemberian izin tidak otomatis memberi akses semua proyek.
- Uji user nonaktif, perubahan izin antar-request, scope ASSIGNED/NONE, session lama, dan kedua transport.
- Inventory seluruh referensi helper lama diselesaikan dan regression guard mencegah drift berikutnya.

## P0-02 — Mengosongkan izin mengaktifkan kembali izin bawaan

**Status:** terkonfirmasi dari sumber dan reproduksi helper.

**Dampak:** pencabutan semua izin role bawaan tidak menghasilkan akses kosong.

**Gerbang:** sebelum pengelolaan role dianggap aman.

**Penanggung jawab yang diusulkan:** backend/auth; dikerjakan bersama P0-01.

Bukti: [role-access.ts](../../apps/web/lib/auth/role-access.ts), baris 55–57, memilih izin seed ketika `record.permissions.length === 0`. [updateRolePermissionsUseCase](../../apps/web/server/usecases/administration/roles.ts), baris 206–279, menghapus baris izin yang dicabut. Role tanpa baris permission setelah revocation tidak bisa dibedakan dari kondisi migrasi lama oleh kondisi tersebut.

Reproduksi: mock hasil query role menjadi `{ id: "audit-role", name: "finance_admin", dataScope: "GLOBAL", permissions: [] }`, lalu jalankan implementasi asli `getRoleAccess("audit-role")`. Hasil aktual `permissions.includes("pay:cost") === true`. Hasil yang diharapkan setelah revoke-all adalah `false` dan daftar izin kosong.

Acceptance criteria:

- Role existing dengan nol permission tetap nol; tidak ada privilege resurrection.
- Backfill izin legacy dilakukan melalui proses migrasi/provisioning eksplisit, bukan dugaan dari array kosong saat request.
- Regression tests mencakup revoke satu izin, revoke seluruh izin, role baru kosong, role kustom, role hilang, dan error lookup DB.
- UI/read model dan enforcement menghasilkan izin efektif yang sama.

## P0-03 — Bukti recovery produksi perlu diperbarui

**Status:** target/retensi cloud terverifikasi; pemulihan historis ke branch terpisah lulus 30 September 2026. Bukti recovery operasional masih terbuka.

**Gerbang:** sebelum menyatakan data proyek nyata terlindungi.

**Penanggung jawab yang diusulkan:** operator infra bersama Owner/Finance.

[Restore drill 28 Agustus](../guide/restore-drill.md) lulus mekanis dengan retensi enam jam dan 82 baris diperiksa pada database lama. [Drill production 30 September](2026-09-20-postgres-integration-and-recovery.md#drill-pemulihan-historis-production--30-september-2026) membuktikan pemulihan historis `atria-erp-prod/main/neondb` ke branch terisolasi tanpa mengubah `main`, tetapi data transaksi production masih kosong. Target minimal satu siklus rekonsiliasi penuh (tujuh hari), RPO/RTO dan cutover aplikasi belum terpenuhi.

Acceptance criteria:

- Rekam target environment, retensi aktual, RPO/RTO yang disepakati, dan penanggung jawab insiden.
- Restore ke environment terpisah, validasi invariant atas data nonkosong, ukur durasi, dan simulasikan cutover secara terkontrol.
- Verifikasi bukti/lampiran tetap tersedia dan otorisasinya benar; restore DB saja tidak membuktikan recovery object storage.
- Untuk shared DB kelak, tentukan pemulihan satu tenant tanpa menggulung balik transaksi tenant lain.

## P0-04 — Bukti integrasi finansial/material terbaru belum lengkap

**Status:** gap verifikasi; 148 skip bukan kegagalan aplikasi.

**Gerbang:** sebelum persetujuan financial posting produksi pada revisi yang akan dirilis.

**Penanggung jawab yang diusulkan:** backend + QA/Finance.

Gerbang integrasi ada di [integration-db.ts](../../apps/web/lib/testing/integration-db.ts), baris 1–39, dan [test-preload.ts](../../apps/web/scripts/test-preload.ts), baris 12–34. Suite intentionally dipisah antara DB seeded dan DB kosong.

Acceptance criteria:

- Siapkan DB test disposable yang teridentifikasi; seeded suite dan empty-DB suite berjalan terpisah.
- Jalankan payment/approval/reversal/reconciliation, duplicate reference, concurrent retry, insufficient funds, reserve/use/return/waste, receipt reversal, dan perubahan kategori.
- Buktikan kedua request concurrent tidak menyebabkan double posting/overspending; uji perilaku sesudah commit sukses tetapi respons terputus.
- Invariant sebelum/sesudah lulus pada data nonkosong; catat test yang tetap skip dan alasannya.
- Lakukan satu walkthrough per peran dari budget sampai closing; pastikan RAB export tidak membawa data RAP internal.

## Backlog P1

| ID    | Item dan status bukti                                             | Acceptance criteria                                                                                                                                                                                  | Dependensi / pemilik usulan                 |
| ----- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| P1-01 | Baseline performance representatif belum tersedia dari audit ini  | Ukur p50/p95 endpoint/loader, query count, payload, cold/warm, volume per tabel, concurrency, dan jaringan lapangan. Profilkan sebelum optimasi; ukur ulang dengan dataset sama                      | P0 auth stabil; backend/performance         |
| P1-02 | Bukti monitoring invariant terjadwal dan alert belum diverifikasi | Job membaca invariant, alarm pada pelanggaran/kegagalan/stale run, log run berhasil, routing ke operator, dan latihan respons. Bedakan monitoring delivery notifikasi dari invariant keuangan        | Target environment teridentifikasi; infra   |
| P1-03 | Release gates dan portability belum sepenuhnya terbukti           | CI atau release runner menjalankan test, web build, native typecheck/build sesuai target rilis, integration DB terisolasi, migration checks, dan dependency advisory review; simpan bukti per revisi | P0-04; platform/QA                          |
| P1-04 | Drift dokumentasi dan formatting                                  | Sinkronkan PRODUCT/platform, handoff mobile, aturan peran, dan status audit; triase formatting bertahap tanpa menimpa pekerjaan lain                                                                 | Backend/product; tidak menunda perbaikan P0 |

Catatan performance: [perf-loaders.ts](../../apps/web/scripts/perf-loaders.ts), baris 48–59 dan 124–137, melakukan satu warmup + tiga pengukuran dan mengembalikan median. Itu alat screening, belum benchmark p95/load. Komentar file juga menyebut keterbatasan loader yang bergantung request scope. Batas 500 baris merupakan heuristik skrip, bukan bukti workload representatif. Jangan menjalankan benchmark dan menyebut angka tersebut SLA tanpa metodologi/dataset yang sesuai.

Catatan operasional: `.github/` tidak ditemukan pada checkout ini; [vercel.json](../../apps/web/vercel.json) mengatur cron notifikasi. Hal tersebut **tidak membuktikan** CI atau scheduled invariant check di provider lain tidak ada. Periksa konfigurasi deployment dan log run sebelum menyimpulkan.

## SaaS-01 — Blocker sebelum tenant kedua

**Status:** prasyarat tahap SaaS yang belum terbukti, bukan blocker tersendiri untuk satu tenant Dekoria.

Bukti lokal: [tenant-boundaries.test.ts](../../apps/web/lib/architecture/tenant-boundaries.test.ts) menjaga kolom/default/constraint scaffolding, bukan isolasi runtime. `Actor` belum membawa tenant context. Pencarian pada schema dan migration lokal tidak menemukan `ROW LEVEL SECURITY`, `CREATE POLICY`, `enableRLS`, atau `pgPolicy`. Ini sesuai Fase 0 [rencana tenant](2026-08-27-tenant-foundation.md); kondisi DB live belum diinspeksi.

Acceptance criteria:

- Tenant aktif berasal dari membership server yang tervalidasi; pergantian tenant tidak memakai ID client tanpa pemeriksaan.
- RLS dan role DB runtime terbatas; konteks transaksi tidak bocor melalui connection pooling. Request tanpa tenant gagal tertutup.
- Foreign keys/constraint, document numbering, idempotency keys, storage, cache, export, worker, notifikasi, dan audit menjaga batas tenant.
- Tenant A/B diuji read/write/list/search/export, referensi silang, concurrent requests, background jobs, dan akses file.
- Role/permission dan status subscription/read-only ditegakkan sesuai membership/perusahaan.
- Kolaborasi memakai grant eksplisit dengan field yang boleh dibagikan; data biaya/margin internal vendor tetap privat.

## Fondasi yang sudah terlihat baik

- [mutateBalance](../../apps/web/lib/finance/balance-mutation.ts), baris 75–189, mengunci rekening, menghitung uang dalam bigint cents, menolak saldo negatif/rekening nonaktif, dan menulis ledger + audit menggunakan transaction handle.
- [payFieldRequestUseCase](../../apps/web/server/usecases/finance/pay-field-request.ts), baris 47–165, membungkus payment dalam transaksi, mengunci cost, menolak status PAID/non-APPROVED, mengecek approval dan duplicate reference. Defect izin di atas tidak menghapus keberadaan kontrol-kontrol ini.
- [reserveMaterialForProject](../../apps/web/app/actions/material/inventory-movements.ts), baris 119–190, memvalidasi input, menggunakan transaksi dan [findLockedInventory](../../apps/web/app/actions/material/inventory-utils.ts), baris 126–147, membatasi available stock, serta menulis movement + audit tanpa cash mutation.

Temuan positif ini berasal dari inspeksi jalur tertentu, bukan sertifikasi seluruh mutation. Pertahankan kontrol yang ada saat memperbaiki otorisasi.

## Urutan eksekusi berikutnya

1. Rencanakan dan perbaiki P0-01 + P0-02 sebagai satu pekerjaan otorisasi; tambahkan regression tests yang mengharapkan perilaku aman, bukan perilaku bug.
2. Migration ke-42 sudah diterapkan dan diverifikasi pada `main` tanggal 29 September; masukkan file migration/journal ke commit kandidat release dan pertahankan pemeriksaan schema pada release berikutnya.
3. Cutover hardening/pooled production dan integrasi source sudah selesai; tutup affordance izin klien. Pertahankan direct URL untuk migration serta kebutuhan hoisted Metro mobile. Preview umum tetap tanpa DB; database audit hanya override per-deployment. Beban representatif/p95 tetap pekerjaan P1 terpisah.
4. Selesaikan P0-03 dengan keputusan retensi/RPO/RTO dan drill PITR tanpa memundurkan branch production.
5. Ukur performance dan monitoring P1 pada kondisi representatif.
6. Lanjutkan tahap tenant kedua hanya setelah SaaS-01 terbukti.

Audit baseline selesai ketika temuan, batas bukti, dan acceptance criteria tercatat—bukan ketika semua perbaikannya selesai. Dokumen ini tidak menutup P0 atau menyatakan produk aman hanya karena unit tests/build lulus.

## Lampiran: reproduksi RBAC tanpa database

Simpan kode berikut sebagai `/tmp/atria-readiness-rbac.test.ts`, lalu jalankan dari root repo:

```bash
bun test --tsconfig-override apps/web/tsconfig.json /tmp/atria-readiness-rbac.test.ts
```

Hasil audit: **3 pass, 0 fail** untuk assertions yang sengaja mengharapkan perilaku bug. Bun 1.3.14 juga mencetak diagnostik `directory mismatch` terkait tsconfig override, tetapi menyelesaikan ketiga test dengan exit code 0. Probe ini bukan acceptance gate; setelah perbaikan, assertions harus dibalik menjadi ekspektasi aman dalam suite regression resmi. Mock mengganti query role dan session resolver; middleware dan pembacaan izin memakai kode asli. Tidak ada koneksi database atau mutation bisnis.

```typescript
import { expect, mock, test } from "bun:test";
import { resolve } from "node:path";

const web = resolve(process.cwd(), "apps/web");
mock.module("server-only", () => ({}));
mock.module(resolve(web, "db/index.ts"), () => ({
  db: {
    query: {
      role: {
        findFirst: async () => ({
          id: "audit-role",
          name: "finance_admin",
          dataScope: "GLOBAL",
          permissions: [],
        }),
      },
    },
  },
}));
mock.module(resolve(web, "server/actor.ts"), () => ({
  resolveActorFromHeaders: async () => null,
}));

const { getRoleAccess } = await import(resolve(web, "lib/auth/role-access.ts"));
const { createTRPCRouter } = await import(resolve(web, "server/trpc/init.ts"));
const { activeProcedure } = await import(resolve(web, "server/trpc/procedures.ts"));

test("diagnostic: empty stored finance permissions restore seeded pay permission", async () => {
  const access = await getRoleAccess("audit-role");
  expect(access?.permissions.includes("pay:cost")).toBe(true);
});

test("diagnostic: real activeProcedure accepts revoked pay permission", async () => {
  const router = createTRPCRouter({
    probe: activeProcedure.meta({ permission: "pay:cost" }).query(() => "REACHED"),
  });
  const caller = router.createCaller({
    actor: {
      userId: "audit-user",
      roleId: "audit-role",
      roleName: "FINANCE_ADMIN",
      permissions: ["view:cost"],
      dataScope: "GLOBAL",
      name: "audit",
      email: "audit@example.invalid",
      isActive: true,
      mustChangePassword: false,
      sessionId: "audit-session",
      developerActorUserId: null,
    },
    headers: new Headers(),
  });
  expect(await caller.probe()).toBe("REACHED");
});

test("diagnostic: real activeProcedure rejects custom role with granted pay permission", async () => {
  const router = createTRPCRouter({
    probe: activeProcedure.meta({ permission: "pay:cost" }).query(() => "REACHED"),
  });
  const caller = router.createCaller({
    actor: {
      userId: "audit-user",
      roleId: "audit-custom",
      roleName: "AUDIT_CUSTOM",
      permissions: ["pay:cost"],
      dataScope: "GLOBAL",
      name: "audit",
      email: "audit@example.invalid",
      isActive: true,
      mustChangePassword: false,
      sessionId: "audit-session",
      developerActorUserId: null,
    },
    headers: new Headers(),
  });
  await expect(caller.probe()).rejects.toMatchObject({ code: "FORBIDDEN" });
});
```

## Update destination backup — 30 September 2026

Pengguna memilih **Cloudflare R2 Standard**. Workflow transport dan [runbook R2](../guide/free-tier-r2-backup.md) menggantikan setup AWS S3 awal. Backup masih nonaktif sampai aktivasi langganan, bucket private, lock/lifecycle, token bucket, role baca Neon, secret GitHub, dan run manual/restore diverifikasi. AWS IAM/OIDC tidak dipakai pada workflow aktif.

### Verifikasi R2 dan blocker Neon — 30 September 2026

Bucket/secrets manual telah terbukti bekerja melalui [run check-storage 36672683964](https://github.com/LibranRst/atria-erp/actions/runs/36672683964), dengan upload/download dan SHA-256 sama. Ini belum backup DB. Neon menolak SQL main/neondb dengan HTTP 402 quota exceeded; jenis kuota belum diketahui. Periode pemakaian berakhir 1 Oktober 2026 07.00 WIB, tetapi waktu pulih belum dijamin. Gate backup tetap nonaktif, role baca/secret DB belum dibuat, dan P0-03 tetap terbuka.

### Jenis quota terkonfirmasi lewat Browser

Console Neon mengonfirmasi kuota **compute bulanan** untuk `atria-erp-prod`: **111,49 CU-hours** terpakai, dengan batas **100 compute hours/project** pada Free. Compute 0,25 CU dan autosuspend lima menit sudah aktif; tidak ada perubahan setting. Langkah berikutnya adalah verifikasi SQL setelah periode baru 1 Oktober 2026 07.00 WIB dan audit aktivitas yang membuat compute aktif, kemudian menyelesaikan role baca serta backup/restore R2.
