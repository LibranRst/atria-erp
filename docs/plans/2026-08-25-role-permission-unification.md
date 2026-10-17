# Penyatuan Peran dan Izin

**Tanggal:** 2026-08-25
**Status:** Disetujui (22 keputusan, tiga putaran)
**Ruang lingkup:** empat fase, masing-masing punya bentuk rilis sendiri
**Status eksekusi (2026-08-25):** Fase 1 ✅ · Fase 2 ✅ · Fase 3 ✅ (data + runtime + daur hidup) · Fase 4 ✅ (layar + katalog izin + shell klien)

## Masalah

Sistem peran hari ini **aman untuk empat peran yang ada**, tetapi tidak siap
untuk peran yang bisa disunting. Menaruh UI pengaturan izin di atas fondasi
sekarang akan menghasilkan layar yang menjanjikan kontrol yang tidak dipatuhi
kode — lebih buruk daripada tidak ada layar sama sekali.

### Yang sudah benar

- Setiap Server Action menolak sesi kosong; `proxy.ts` memblokir non-sesi, akun
  nonaktif, dan akun berkata-sandi sementara di seluruh rute non-API.
- Seluruh tool AI read-only (ditegakkan `lib/ai/tools/read-only.test.ts`),
  identitas ditutup lewat closure sehingga model tidak bisa mengaku sebagai
  orang lain, dan `canAccessProject` memverifikasi setiap `projectId` yang
  datang dari model.
- Peran tak dikenal gagal ke arah aman: `ROLE_PERMISSIONS[name] ?? []` → nol izin.

### Empat retakan

| #   | Retakan                                      | Bukti                                                                                                                                                                                                                                                                                                                   |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Matriks izin bukan satu-satunya otoritas** | 78 perbandingan nama peran hardcoded di 40 berkas. `server/usecases/project/create-project.ts:31` memakai `actor.roleName !== "OWNER" && !== "FINANCE_ADMIN"`; permission key `create:project` tidak ada sama sekali.                                                                                                   |
| 2   | **Empat gaya penegakan berdampingan**        | `assertPermission` (melempar), `assertSettingsPermission` (mengembalikan error), helper domain (`authorizeFieldRequestAction`, `assertProjectMutationAccess`), dan perbandingan nama peran mentah. Tidak ada satu titik cekik, dan `lib/architecture/server-boundaries.test.ts` menguji bentuk modul — bukan otorisasi. |
| 3   | **Cakupan data proyek ditulis dua kali**     | `lib/auth/scoping.ts:17` (OWNER/FINANCE_ADMIN global, PROJECT_MANAGER tertugas, sisanya nol baris) dan salinannya `GLOBAL_SCOPE_ROLES` di `lib/ai/tools/context.ts:24`.                                                                                                                                                 |
| 4   | **Konfigurasi peran yang berbohong**         | `ROLE_PERMISSIONS` mendefinisikan tujuh peran dan `ROLE_ID_TO_NAME` memetakan tujuh UUID, tetapi `packages/core/src/auth/role-constants.ts` hanya menjadikan **empat** bisa ditugaskan. SALES, DESIGNER, dan MARKETING punya matriks lengkap yang tidak bisa dipakai siapa pun.                                         |

### Ambang persetujuan tercecer sebelum sempat dikonfigurasi

| Lokasi                                                                       | Bentuk                                                                              |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/core/src/finance/expense-approval-rule.ts:1`                       | `OWNER_APPROVAL_AMOUNT_THRESHOLD = 5_000_000` (rupiah)                              |
| `packages/core/src/finance/vendor-payment-rules.ts:12`                       | `OWNER_APPROVAL_PAYMENT_THRESHOLD_CENTS = 500_000_000n` (sen)                       |
| `apps/web/lib/finance/approval-details.ts:253`                               | literal `5_000_000`                                                                 |
| `apps/web/app/actions/finance/field-request-review.ts:86`                    | literal `5000000`                                                                   |
| `apps/web/features/expenses/components/sheets/vendor-payment-sheets.tsx:145` | literal ×3 — **UI memutuskan sendiri** kapan menulis "Memerlukan persetujuan Owner" |
| `apps/web/features/expenses/hooks/use-vendor-payment-operations.ts:167`      | literal                                                                             |

Dua satuan berbeda untuk satu aturan, dan klien menghitung ulang keputusan yang
seharusnya milik server.

## Inventaris 78 titik

Dua kelas, keduanya harus dimigrasi — tetapi karena alasan yang berbeda.

**Otorisasi (server).** Menentukan siapa boleh menulis atau membaca apa. Salah
di sini adalah lubang keamanan.

| Berkas                                                                                                                                                    | Titik                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `app/actions/material/operations-dashboard.ts`                                                                                                            | 7                                                     |
| `lib/auth/scoping.ts`                                                                                                                                     | 4                                                     |
| `server/usecases/onboarding/owner-onboarding-overview.ts`                                                                                                 | 2                                                     |
| `server/usecases/finance/dashboard-overview.ts`                                                                                                           | 2                                                     |
| `app/actions/project/revision-change-order-approval.ts`                                                                                                   | 2                                                     |
| `server/usecases/project/{create-project,project-form-bootstrap}.ts`                                                                                      | 2                                                     |
| `app/actions/project/{workflow-governance,rap-setup,closing,activation}.ts`                                                                               | 4                                                     |
| `app/actions/material/{warehouse-stock-count,warehouse-receipt-reversal,warehouse-adjustment,opening-inventory-queries,inventory-utils,goods-receipt}.ts` | 6                                                     |
| `app/actions/finance/{vendor-bill-drafts,field-request-review}.ts`                                                                                        | 2                                                     |
| `app/actions/{onboarding-review,developer-account-simulation,activity-detail-resolver-utils}.ts`                                                          | 3                                                     |
| `lib/finance/approval-details.ts`                                                                                                                         | 1                                                     |
| `features/expenses/utils/expenses-access.ts`                                                                                                              | 1 — **redaksi data rekening**, bukan sekadar tampilan |

**Bentuk & navigasi (loader + klien).** Menentukan apa yang tampak. Salah di
sini bukan lubang keamanan, tetapi peran kustom akan mendapat aplikasi yang
kosong atau rusak — jadi tetap harus ikut pindah.

| Berkas                                                                          | Titik |
| ------------------------------------------------------------------------------- | ----- |
| `features/finance-dashboard/**` (workspace, tab, hook, loader)                  | 11    |
| `components/layout/bottom-nav-config.ts`                                        | 5     |
| `components/layout/header-menu-config.ts`                                       | 4     |
| `features/profile/server/get-profile-page-data.ts`                              | 4     |
| `features/materials/components/**`                                              | 5     |
| `features/navigation/server/get-mobile-home-route.ts`                           | 3     |
| `features/expenses/server/get-expenses-page-data.ts`                            | 3     |
| `features/approvals/server/get-approvals-page-data.ts`                          | 3     |
| `app/page.tsx`                                                                  | 3     |
| `features/projects/{detail,list}/server/*.ts`                                   | 3     |
| `features/administration/components/forms/administration-user-editor-sheet.tsx` | 2     |

## Keputusan

| #   | Keputusan                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Lingkup penuh: Owner bisa menyunting izin peran **dan** membuat peran baru — dengan penyatuan penegakan sebagai fase satu yang berdiri sendiri dan bisa dirilis lebih dulu.                                                                                                                                                           |
| 2   | Sumber kebenaran izin pindah ke tabel `role_permission`; matriks kode turun status menjadi seed, sejalan dengan aturan repo "Settings adalah sumber kebenaran, konstanta kode hanya seed/fallback".                                                                                                                                   |
| 3   | `PermissionKey` tetap union tertutup milik kode. Owner menyalakan/mematikan kunci, tidak pernah membuat kunci baru — kunci yang belum ditegakkan kode adalah janji kosong.                                                                                                                                                            |
| 4   | Cakupan data menjadi atribut peran (`data_scope: GLOBAL \| ASSIGNED`), dan `GLOBAL_SCOPE_ROLES` milik AI dihapus supaya batas AI tidak pernah berbeda dari batas halaman.                                                                                                                                                             |
| 5   | Peran OWNER kebal: izin tetap, tidak bisa dihapus atau diganti nama, dan tidak bisa dilepas dari Owner aktif terakhir. Ini menutup penguncian-diri tanpa logika "minimal satu peran punya X".                                                                                                                                         |
| 6   | Izin dibaca per request dengan cache satu-request (`React.cache`). Tidak pernah ditanam ke sesi/token — izin yang ditanam basi justru saat ketepatannya paling penting, yaitu saat pencabutan.                                                                                                                                        |
| 7   | Ambang persetujuan **bukan** konfigurasi peran. Ia kontrol finansial perusahaan, jadi tinggal di Settings di atas `app_config`.                                                                                                                                                                                                       |
| 8   | Layar "Peran & akses" hidup di workspace Administrasi, bersebelahan dengan daftar staf; hub Settings menautkannya.                                                                                                                                                                                                                    |
| 9   | Dua ambang terpisah (`approval.field_cost.owner_threshold`, `approval.vendor_payment.owner_threshold`) — angkanya kebetulan sama hari ini, bukan secara desain. Perubahan hanya berlaku untuk pengajuan baru.                                                                                                                         |
| 10  | `data_scope: ASSIGNED` untuk sekarang berarti "seperti PM" (`project.projectManagerId`). Tabel `project_member` dicatat sebagai pekerjaan berikutnya — ia menyentuh setiap kueri berlingkup proyek dan pantas jadi proyek tersendiri.                                                                                                 |
| 11  | Kunci baru dibuat satu per **keputusan bisnis**, bukan per Server Action. Perkiraan 10–14 kunci; daftar final muncul saat migrasi tiap domain. Satu kunci per fungsi akan menghasilkan matriks yang tak terbaca di kolom 448 px.                                                                                                      |
| 12  | Migrasi domain demi domain (finance → project → material → settings → navigasi/klien → AI). **AI paling akhir**, supaya tidak pernah ada jendela di mana AI memakai aturan lebih longgar daripada halaman.                                                                                                                            |
| 13  | Tes arsitektur: (a) larang literal nama peran di luar daftar putih kecil — ditegakkan keras lewat regex atas sumber, gaya `lib/architecture/*`; (b) tuntut setiap modul `"use server"` atau use-case yang dipanggilnya menyebut satu penjaga bernama, dengan pengecualian eksplisit untuk yang memang publik-per-sesi.                |
| 14  | Pencabutan izin di tengah sesi: gagal di server dengan `FORBIDDEN` dan pesan "Akses Anda berubah. Muat ulang halaman." Tidak ada polling izin, tidak ada logout paksa — mencabut izin bukan mencabut identitas.                                                                                                                       |
| 15  | Daur hidup peran: hapus ditolak selama masih dipakai (pesan menyebut jumlah pengguna); duplikasi disediakan karena cara nyata membuat peran adalah "seperti PM tapi tanpa X"; tiga peran mati dibuang dari matriks; audit satu baris per penyimpanan berisi selisih izin.                                                             |
| 16  | Editor memakai ulang taksonomi enam modul dan deskripsi Bahasa Indonesia yang sudah ada di `features/profile/utils/profile-access.ts`, sehingga yang Owner atur terbaca identik dengan yang stafnya lihat di halaman Profil.                                                                                                          |
| 17  | `role_permission` diisi lewat **migrasi Drizzle**, bukan skrip terpisah atau backfill malas. Database yang sudah jalan naik dengan perilaku identik — itulah yang membuat Fase 1 dan 3 bisa dirilis terpisah.                                                                                                                         |
| 18  | `manage:roles` boleh diberikan ke peran lain, dengan satu aturan anti-eskalasi: **sebuah peran tidak pernah bisa memberikan izin yang tidak dimilikinya sendiri.** Tanpa itu, mendelegasikan pengelolaan peran sama dengan menyerahkan seluruh sistem.                                                                                |
| 19  | Yang dibekukan ke baris pengajuan adalah **keputusannya** (`requires_owner_approval`), bukan angkanya. Alur kerja bertanya "apakah ini butuh Owner", bukan "berapa ambangnya". Alasan historis tetap terlacak lewat `audit_log` perubahan `app_config`.                                                                               |
| 20  | `role.data_scope` dan `role.is_system` ditegakkan di use-case dan dikunci tes, bukan trigger database — repo ini tidak punya satu pun trigger, dan yang pertama tidak layak lahir demi satu aturan otorisasi. `is_system` juga yang membuat tombol hapus/ganti nama **hilang** dari UI, bukan sekadar ditolak setelah ditekan.        |
| 21  | Nilai ambang disimpan dalam **sen**, sejalan dengan aturan uang repo. Dua konstanta yang ada hari ini tidak sepakat satuannya; sen adalah yang mengikuti aturan.                                                                                                                                                                      |
| 22  | `ROLE_ID_TO_NAME`/`resolveStaticRoleName` dibuang: peta statis akan mulai berbohong begitu peran bisa dibuat dan diganti nama, dan bohongnya senyap karena `?? []` menyamarkannya sebagai "peran tanpa izin". `OWNER_ROLE_ID` **tetap** — bootstrap Owner pertama pada database kosong butuh satu jangkar yang tidak bergantung data. |

## Fase

### Fase 1 — Penyatuan penegakan (tanpa perubahan yang terlihat)

Empat peran yang ada berperilaku persis sama sebelum dan sesudah. Yang berubah
hanya **dari mana** jawabannya datang.

1. Tambahkan kunci izin untuk keputusan yang hari ini dijaga nama peran.
2. Migrasikan 78 titik domain demi domain, sesuai urutan keputusan 12.
3. Satukan `scopeProjectQuery`, `assertProjectAccess`, dan `GLOBAL_SCOPE_ROLES`
   menjadi satu sumber.
4. Pasang dua tes arsitektur dari keputusan 13.
5. Buang tiga peran mati dari matriks.

### Fase 2 — Ambang persetujuan bisa dikonfigurasi

Enam literal menjadi dua kunci `app_config` bersatuan sen; keputusan dibekukan
ke `requires_owner_approval` pada `project_cost` dan `vendor_payment` saat
submit; klien berhenti menghitung sendiri dan menerima keputusan dari server;
modul "Kontrol persetujuan" di Settings dijaga kunci izinnya sendiri.

### Fase 3 — Peran dinamis

`role_permission` dibuat dan diisi lewat migrasi; `role.data_scope` dan
`role.is_system`; pembacaan izin pindah dari matriks kode ke database dengan
cache per-request; aturan anti-eskalasi; daur hidup peran sesuai keputusan 15.

### Fase 4 — Layar

Modul "Peran & akses" di workspace Administrasi memakai taksonomi katalog izin,
ditautkan dari hub Settings.

## Yang sengaja tidak dikerjakan

- Tabel `project_member` dan penugasan proyek banyak-ke-banyak (keputusan 10).
- Aturan workflow governance selain ambang nominal.
- Izin per proyek (peran berbeda di proyek berbeda).
- Kunci izin yang bisa dibuat dari UI (keputusan 3).
- Trigger atau row-level security di database (keputusan 20).

## Catatan eksekusi

**Ditemukan saat implementasi:** cakupan proyek ternyata ditulis **tiga** kali,
bukan dua. Selain `scoping.ts` dan salinan AI, domain material melewatinya
sepenuhnya lewat `roleName !== "OWNER" && !== "FINANCE_ADMIN" && !== "PURCHASING"`.
Ketiga peran itu persis pemegang `create:stock_movement`, jadi terjemahannya
tepat tanpa mengubah perilaku: gudang memang bukan milik satu proyek. Karena itu
`PURCHASING` bercakupan `NONE`, bukan `GLOBAL` — menyetelnya global akan
diam-diam membuka seluruh daftar proyek untuknya.

**Dua perilaku yang sengaja dikoreksi** (UI menyusul aturan server, bukan
sebaliknya):

1. FAB "Expense Lapangan" muncul untuk Finance Admin, padahal
   `submitFieldRequest` menuntut `create:cost` yang tidak dipegangnya — tombol
   itu selalu berakhir `FORBIDDEN`.
2. Kontrol kelola budget proyek disembunyikan dari Finance Admin, padahal
   `workflow-governance.ts` sejak dulu mengizinkannya lewat `update:budget`.

**Satu perilaku yang dipertahankan tetapi ditandai:** penyempitan antrean
persetujuan Finance Admin ke opening inventory tidak bisa diturunkan dari
matriks izin — Finance Admin juga memegang `approve:budget`, `approve:rab`, dan
`approve:stock_count`. Ia dipertahankan lewat kunci `decide:all_approvals`.
Layak ditinjau ulang ketika layar peran ada.

**Belum dijalankan:** migrasi `0032` (kolom `requires_owner_approval` + seed
ambang) dan `0033` (`role_permission`, `role.data_scope`, `role.is_system` +
seed izin) belum diterapkan ke database mana pun.

## Verifikasi

- `bun run test` hijau di setiap batas domain, bukan hanya di akhir.
- Dua tes arsitektur baru merah ketika literal nama peran atau action tanpa
  penjaga diperkenalkan kembali.
- `lib/ai/tools/read-only.test.ts` tetap hijau; batas AI dimigrasi paling akhir
  dan diverifikasi setelah seluruh batas halaman selesai.
- Fase 1 diverifikasi sebagai **nol perubahan perilaku**: keempat peran sistem
  melihat dan bisa melakukan hal yang persis sama seperti sebelumnya.

## Catatan eksekusi Fase 4

**Katalog izin menggantikan taksonomi enam modul.** Rencana semula memakai
kembali enam grup dari Profile. Ternyata keenamnya hanya memuat 63 dari 71 kunci
— `manage:users`, `manage:vendors`, `manage:roles`, kedua kunci AI, dan tiga
kunci saldo awal inventory tidak masuk grup mana pun. Untuk halaman Profile itu
sekadar ringkasan yang tidak lengkap; untuk layar penyunting itu fatal: sebuah
kunci yang tidak pernah ditampilkan adalah izin yang tidak pernah bisa dicabut,
sementara layarnya menyiratkan Owner sudah melihat seluruh akses peran itu.

`packages/core/src/auth/permission-catalog.ts` karena itu menjadi satu-satunya
tempat sebuah kunci punya nama manusia dan tempat tinggal, dengan delapan grup
dan tes yang menuntut setiap `PermissionKey` muncul di **tepat satu** grup.
`getAllPermissionKeys()` ikut pindah ke katalog: sebelumnya ia menurunkan daftar
kunci sah dari matriks seed, sehingga kunci yang kebetulan belum dipegang peran
bawaan mana pun akan ditolak server justru saat layarnya menawarkannya.

**Empat penyumbatan yang membuat peran baru tidak berguna** — ditemukan saat
membangun layarnya, semuanya di jalur yang tidak dipindai Fase 1:

1. `packages/core/src/auth/administration-access.ts` memutuskan akses workspace
   Administrasi lewat `roleName === "OWNER"`. Pemindaian `role-authority.test.ts`
   berhenti di `apps/web`, jadi retakan kelas Fase 1 ini selamat di paket
   sebelah. Sekarang diturunkan dari `manage:users`/`manage:vendors`/`manage:roles`,
   dan pemindaiannya diperluas ke `packages/core` (dengan komentar dibuang lebih
   dulu, supaya penjelasan tentang bentuk lama tidak ikut gagal).
2. Daftar peran yang bisa ditugaskan disaring `STAFF_ROLE_IDS` — empat UUID
   bawaan. Peran baru bisa dibuat tetapi tidak pernah bisa dipakai siapa pun.
   Sekarang syaratnya "peran itu ada di database".
3. `bottom-nav.tsx` menurunkan nama peran dari `ROLE_ID_TO_NAME`, peta UUID
   statis. UUID peran buatan tidak ada di sana, sehingga pemegangnya mendapat
   bilah "peran tidak dikenal" (dua tab) dan nol aksi cepat, apa pun izin yang
   diberikan. Bilah bawah, aksi cepat, dan menu bilah atas kini membaca
   `usePermissions()` — daftar efektif yang sama dengan yang ditegakkan server.
4. `getRoleNavItems` mencabangi empat nama peran. Sekarang diturunkan dari izin
   dengan tiga slot dan urutan pengorbanan yang eksplisit; keempat peran bawaan
   menghasilkan tab yang **persis sama** seperti sebelumnya (dikunci tes).

**Satu literal peran lagi diterjemahkan:** `dashboard-overview.ts` mengurutkan
kartu dan menghitung persetujuan tertunda lewat `role === "OWNER"`. Yang
dimaksud sebenarnya `approve:cost` — himpunan pemegangnya identik, dan artinya
lebih jujur: kartu persetujuan naik untuk orang yang benar-benar bisa menekan
tombolnya.

**Profile ikut berubah sedikit.** Ia sekarang menurunkan grupnya dari katalog,
jadi Owner melihat grup "Tim, vendor & peran" yang sebelumnya tidak pernah
muncul. `view:ai_brief` tetap disembunyikan lewat penyaring presentasi
eksplisit, sesuai penundaan AI CFO yang sudah didokumentasikan.

### Verifikasi visual (2026-08-25)

Diperiksa pada 320/360/390/430 px terhadap database UAT. Daftar peran, penyunting,
dan sheet peran baru tidak meluber pada satu lebar pun; jalur read-only Owner
terbukti: 14 sakelar seluruhnya nonaktif, tanpa tombol simpan maupun hapus.

Empat perbaikan lahir dari pemeriksaan ini, dua di antaranya pada primitif
bersama:

1. **`OptionChoiceGroup` meluber sampai 460 px di dalam sheet 320 px.**
   `fieldset` bawaan browser memakai `min-inline-size: min-content`, dan
   deskripsi pilihan memakai `truncate` (`white-space: nowrap`) — sehingga
   min-content-nya selebar teks utuh. `min-w-0` pada fieldset memperbaikinya
   untuk **semua** pemakai primitif itu, bukan hanya layar peran.
2. **Sakelar `SwitchRow` hanya 44×24 px tanpa perluasan area sentuh**, di bawah
   aturan 48 px. Diperluas lewat `after:` menjadi 52×48; jarak antar baris 58 px
   sehingga target tetangga tidak bertabrakan.
3. Label tab administrasi kehilangan hitungannya dan barisnya menjadi
   `scrollable` — "Anggota Tim (5)" menyusut jadi "Anggot…" pada 320 px, dan
   hitungan yang terpotong lebih buruk daripada tidak ada.
4. Cakupan data mendapat barisnya sendiri di baris daftar; digabung, justru ia
   yang terpotong lebih dulu padahal satu-satunya fakta yang tidak bisa ditebak
   dari nama peran.
5. **`OptionChoiceGroup` diganti baris pilihan bergaya panel.** Primitif itu
   membawa permukaan abu-abunya sendiri, sehingga di dalam sheet yang seluruh
   bagiannya panel putih ia tampil sebagai kotak asing yang bersarang.
   `ChoiceRow` diperluas dengan `selectionMode="radio"` (indikator titik,
   `role="radio"` + `aria-checked`, dan menekan baris terpilih tidak
   membatalkannya) supaya pilihan tunggal punya bentuk baku di seluruh aplikasi,
   bukan komponen lokal baru.
6. **Label ganda di sheet peran baru.** `AdaptiveSelect` merender labelnya
   sendiri; membungkusnya dengan `FormField` berlabel sama mencetak "Salin izin
   dari" dua kali. Pola bakunya — select langsung sebagai anak `FormSection` —
   dipakai kembali.

**Yang belum diuji:** jalur tulis (buat → simpan → hapus) belum dijalankan
terhadap database, karena setiap percobaan meninggalkan baris `audit_log` yang
tidak bisa dihapus. Aksi servernya sendiri tertutup tes unit.

### Migrasi dijalankan (2026-08-25)

`0032`, `0033`, dan `0034` sudah diterapkan ke database UAT (`atria_uat_guard`,
Neon). Hasil verifikasi: 4 peran sistem bercakupan GLOBAL/GLOBAL/ASSIGNED/NONE,
160 baris `role_permission`, dua ambang persetujuan terisi 500000000 sen, dan
backfill menandai 2 dari 8 `project_cost` serta 3 dari 4 `vendor_payment`.

**`0033` ternyata cacat dan ditambal `0034`.** Daftar seed-nya memuat 69 dari 70
izin Owner — `manage:roles` terlewat. Justru kunci itu yang paling fatal: begitu
`0033` berjalan, peran Owner punya baris di `role_permission`, sehingga cadangan
ke matriks kode berhenti berlaku dan layar "Peran & akses" tertutup untuk semua
orang termasuk Owner. Karena `0033` sudah tercatat di `__drizzle_migrations` dan
hash-nya tidak boleh berubah, perbaikannya maju lewat `0034`.

Cacat itu tidak terlihat dari kode mana pun — ia hanya muncul saat isi database
dibandingkan baris demi baris dengan `ROLE_PERMISSIONS`. Perbandingan itu layak
dijalankan setiap kali migrasi seed izin ditambahkan.
