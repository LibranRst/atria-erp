# P0: otorisasi dari izin efektif

Status: perbaikan backend sudah live pada production, 29 September 2026. Dimulai 18 September; implementasi lokal selesai 19 September.

Tindak lanjut 29 September: [cutover production](2026-09-29-release-candidate-and-pooled-smoke.md#hasil-cutover-production) selesai setelah 62 test pooled, quality gates kandidat, dan smoke preview. Production kini memakai pooled URL serta region Singapore. Catatan implementasi dan keterbatasan verifikasi lokal di bawah dipertahankan sebagai sejarah audit; sinkronisasi affordance klien dan recovery tetap backlog terpisah.

Mengimplementasikan P0-01/P0-02 dari [baseline readiness](2026-09-18-readiness-baseline-and-backlog.md). Seam verifikasi mengikuti reproduksi yang sudah disepakati dalam audit dan instruksi melanjutkan: `getRoleAccess`, middleware tRPC, dan payment use-case/Server Action.

## Kontrak

- Daftar izin tersimpan, termasuk daftar kosong, merupakan sumber kebenaran. Lookup gagal/hilang menolak akses.
- Actor memakai `permissions`; nama peran hanya identitas/presentasi. Jalur server legacy yang hanya membawa nama memakai lookup database, bukan seed.
- Scope tetap ditegakkan terpisah dari permission. Role kustom tidak boleh memperoleh akses proyek global hanya karena satu permission diberikan.
- Tidak mengubah transaksi saldo/stock atau menjalankan migrasi/data mutation selama perbaikan.
- Perbaiki fallback seed di role read model/notifikasi. Seed/provisioning tetap memakai matriks seed secara eksplisit.

## Urutan

1. Regression middleware: revoked permission ditolak; custom permission diterima; user nonaktif ditolak.
2. Hilangkan fallback seed dari resolver izin/scope, role list, dan audience notifikasi; regression revoke-all dan lookup gagal.
3. Migrasikan server guards: Actor memakai izin efektif; legacy server action memakai lookup DB. Inventory referensi seed dan tambah architecture guard.
4. Uji payment rejection sebelum transaction serta kedua transport, scope, dan refresh izin. Jalankan suite, typecheck/build, lint, format file yang berubah.
5. Perbarui baseline dengan bukti dan batas verifikasi. DB integration/deployment tetap gerbang terpisah.

## Batas

Tidak melakukan redesign/UI primitive changes atau migrasi tenant. Helper presentasi klien yang masih membaca seed diinventarisasi terpisah; server tidak boleh mengandalkannya. Deploy database lama wajib menjalankan migrasi seed permission existing; runtime tidak lagi mengasumsikan izin seed saat tabel kosong.

## Hasil implementasi

- `getRoleAccess` mempertahankan daftar izin kosong. Lookup role hilang/gagal dan scope tidak valid gagal tertutup; Actor tidak dibuat bila lookup role gagal.
- Middleware tRPC dan use-case yang menerima Actor memakai `actorCan(actor, permission)`. Aktor nonaktif ditolak. Jalur server legacy memakai lookup database; pengecekan nama role tidak membaca matriks seed.
- Daftar role dan audience notifikasi tidak mengaktifkan kembali izin seed setelah revoke-all.
- Guard server untuk finance, material, proyek, onboarding, approval, dan loader sudah dimigrasikan dari pemanggilan helper seed. Architecture test mencegah pemanggilan `actorHasPermission`, indeks `ROLE_PERMISSIONS`, dan `getRoleDataScope` seed di jalur server yang dipindai.
- Pembayaran biaya memeriksa scope penugasan melalui transaction handle yang sama sebelum posting. Penolakan tidak menulis ledger/audit pembayaran.
- Nilai bank dan biaya/tagihan pada loader diperiksa berdasarkan izin aktual, bukan nama role. Agregat dashboard/approval global menolak scope non-global.
- Aturan Purchasing dipertahankan: scope proyek `NONE` tidak menghapus kemampuan gudang lintas proyek yang diberikan melalui izin domain. Untuk material, scope `ASSIGNED` tetap membatasi proyek. Scope invoice/vendor legacy dibaca dari database.
- Override self-approval diselesaikan sebelum transaksi stock/reversal, sehingga perubahan ini tidak menambah lookup koneksi lain di tengah transaksi tersebut.

Tidak ada perubahan schema, migrasi, deploy, reset, atau penulisan database eksternal. Test database baru menggunakan PGlite in-memory dengan schema Drizzle asli, di child process agar mock koneksi tidak mencemari suite lain.

## Bukti verifikasi

| Pemeriksaan                                 | Hasil                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Red → green middleware                      | Tiga regression awal gagal sebelum perbaikan; delapan test middleware kemudian lulus                                                                                                                                                                                   |
| Red → green revoke-all                      | Test database gagal saat izin kosong kembali menjadi seed; test daftar role juga gagal sebelum fallback read model dihapus                                                                                                                                             |
| PGlite auth                                 | Update/revoke izin melalui use-case asli, role baru kosong/kustom, assertion by-ID/by-name, missing/error lookup, scope invalid, serta penolakan Server Action dan tRPC lulus                                                                                          |
| PGlite scope/payment                        | Role ASSIGNED ditolak pada proyek lain, setelah ditugaskan lolos sampai validasi rekening; penolakan tidak menulis cash transaction/audit dan status biaya tetap APPROVED                                                                                              |
| PGlite material                             | Purchasing dengan izin gudang tetap dapat mengakses proyek operasional; setelah izin dicabut ditolak; role ASSIGNED tidak dapat melewati penugasan                                                                                                                     |
| PGlite notifikasi                           | Revoke-all menghentikan notifikasi berbasis permission; suite notifikasi existing tetap lulus                                                                                                                                                                          |
| Suite workspace                             | 1.278 pass, 148 skip, 0 fail: core 291, mobile 5, web 982                                                                                                                                                                                                              |
| Lint                                        | 0 error; satu warning existing di notification scheduler (`import/no-anonymous-default-export`)                                                                                                                                                                        |
| Web production build                        | Lulus                                                                                                                                                                                                                                                                  |
| Standalone `tsc --noEmit` web               | Masih dua error existing di `features/projects/detail/components/rab/rab-export-redesign.test.tsx` baris 47/62: fixture menyebut `sourceId` dan `isClientCustom` yang tidak ada di `RabItemView`. File ini tidak diubah; error yang sama tercatat sebelum implementasi |
| Formatting perubahan dan `git diff --check` | Lulus; formatting repo penuh masih memiliki drift di luar scope                                                                                                                                                                                                        |

148 test integrasi yang memerlukan DB eksternal tetap skip. PGlite membuktikan kontrak otorisasi lokal, bukan connection pooling/concurrency PostgreSQL produksi, autentikasi bearer melalui HTTP nyata, atau kesiapan release end-to-end. Session boundary pada reproduksi kedua transport dimock, sedangkan resolver Actor, middleware, guard, dan use-case memakai kode asli.

## Gerbang deployment dan pekerjaan berikutnya

1. Pastikan migrasi `0033_add_role_permission.sql` dan `0034_grant_owner_manage_roles.sql` sudah diterapkan pada target. Verifikasi Owner memiliki izin administrasi sebelum rollout. Jangan melakukan reseed seluruh role untuk menutupi daftar kosong yang disengaja.
2. Jalankan P0-04 pada DB disposable PostgreSQL yang teridentifikasi, termasuk bearer HTTP nyata dan transaksi concurrent. P0-03 recovery/cloud belum diverifikasi ulang.
3. Samakan affordance klien dengan izin efektif: hook rekening, util RAP/RAB, serta navigasi/layar mobile masih memiliki referensi seed. Ini utang presentasi; server yang diperbaiki tidak mempercayai kontrol klien. Perbaikan ini tidak mengklaim seluruh pengalaman role kustom telah selesai.
4. Pisahkan perbaikan dua fixture typecheck RAB dan drift formatting dari otorisasi.

Inventory presentasi tersisa: `features/finance-dashboard/hooks/use-bank-accounts-control.ts`, `features/projects/detail/utils/rab-manager-utils.ts`, `features/projects/detail/utils/rap-manager-utils.ts`, dan referensi `ROLE_PERMISSIONS`/`actorHasPermission` pada `apps/mobile/src`. Matriks seed dalam provisioning dan test fixture tetap sah.
