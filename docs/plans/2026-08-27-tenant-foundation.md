# Fondasi Tenant: Dari ERP Internal ke Produk Berlangganan

**Tanggal:** 2026-08-27
**Status:** Disetujui (26 keputusan, enam putaran)
**Ruang lingkup:** lima fase, Agustus 2026 – Februari 2027
**Status eksekusi (2026-08-27):** Fase 0 ✅ (schema + migrasi 0035 + test arsitektur) · Fase 1–4 belum dimulai

## Masalah

Atria hari ini **benar untuk satu perusahaan**. Setiap asumsi single-tenant
ditanam sampai ke level constraint database, bukan hanya di kode aplikasi —
`app_config.key` unik global, `bank_account.account_number` unik global, dan
seluruh penomoran dokumen (`invoice_number`, `bill_number`, `receipt_number`)
mengasumsikan hanya ada satu penerbit di dunia.

Rencana bisnis menuntut yang sebaliknya: perusahaan lain memakai Atria untuk
data mereka sendiri, sambil ikut dalam satu project kolaborasi yang dipimpin
Dekoria. Dokumen ini menetapkan bentuk teknisnya dan — yang lebih penting —
**urutannya**, karena urutan yang salah menaruh migrasi 53 tabel di minggu yang
sama dengan go-live project terbesar Dekoria.

### Ukuran masalahnya

| Ukuran | Angka | Cara mengukur ulang |
| --- | --- | --- |
| Tabel di schema | 61 | `grep -c "= pgTable" db/schema/*.ts` |
| Tabel yang butuh `tenant_id` | **53** | 61 dikurangi 8 (lihat "Yang tetap global") |
| Titik query yang bergantung pada scoping | **865** | 559 `db.query.*` + 306 `db.select/insert/update/delete` |
| Transaksi ber-lock yang menyentuh saldo | 44 | `grep -c 'for("update")'` |
| Constraint unik yang harus jadi komposit | **16** (+1 menunggu keputusan) | lihat tabel di bawah |
| Berkas yang menyentuh `bankAccount` | 76 | — |
| Berkas yang menyentuh budget project | 65 | — |

Angka 865 itu yang menentukan pendekatan. Isolasi yang bergantung pada
kedisiplinan menulis `WHERE tenant_id = ?` di 865 tempat akan gagal — bukan
mungkin gagal, **pasti** gagal, dan kegagalannya berarti data keuangan satu
perusahaan terbaca oleh kompetitornya.

## Keputusan arsitektur

### Satu database, kolom tenant, isolasi ditegakkan Postgres

Tiga pola dipertimbangkan:

| Pola | Ditolak/diterima | Alasan |
| --- | --- | --- |
| Database terpisah per tenant | **Ditolak** | Fitur C menuntut Dekoria membaca paket vendor. Data di database lain tidak bisa dibaca — tidak ada trik. Ditambah: N migrasi, N backup, N deploy, satu orang operator. |
| Schema Postgres per tenant | **Ditolak** | Migrasi dikali N, dan query lintas-tenant kembali sulit. Menanggung biaya isolasi tanpa mendapat manfaat query. |
| **Satu schema, kolom `tenant_id`, RLS** | **Diterima** | Satu migrasi, satu deploy, satu backup, dan query lintas-tenant untuk project kolaborasi menjadi query biasa. |

Keputusan sebelumnya yang condong ke database terpisah **dicabut**. Pilihan itu
masuk akal selama kebutuhan "Dekoria memantau paket vendor" belum ada; setelah
kebutuhan itu dikonfirmasi, pilihan itu menjadi salah.

### Isolasi ditegakkan database, bukan kode aplikasi

Setiap tabel ber-tenant mendapat kebijakan Row Level Security:

```sql
ALTER TABLE bank_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_account FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bank_account
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

Dua hal yang menentukan apakah ini benar-benar bekerja:

1. **`FORCE ROW LEVEL SECURITY` wajib.** Tanpa itu, RLS tidak berlaku bagi
   pemilik tabel. Kebijakan menyala tetapi tidak menahan apa pun — jenis
   kesalahan yang tampak aman.
2. **Aplikasi connect memakai role terbatas, bukan role owner.** Role migrasi
   dan role runtime harus berbeda. Ini perubahan environment, bukan kode, dan
   mudah terlewat.

`db/index.ts` memakai `Pool` dari `@neondatabase/serverless` — pool berbasis
WebSocket dengan sesi nyata, bukan HTTP sekali-tembak. `SET LOCAL app.tenant_id`
di dalam transaksi karena itu **bekerja**, dan 44 transaksi ber-lock yang sudah
ada adalah pola yang sama. Ini prasyarat yang sudah terpenuhi, bukan yang harus
dibangun.

### Yang tetap global

Delapan tabel sengaja tidak mendapat `tenant_id`:

| Tabel | Alasan |
| --- | --- |
| `user` | Identitas orang, bukan milik perusahaan. Satu orang bisa bekerja di dua perusahaan; keanggotaan dipisah ke `tenant_member`. |
| `session`, `account`, `verification` | Internal Better Auth, menggantung pada `user`. |
| `role`, `role_permission` | **Menunggu keputusan** — lihat "Pertanyaan terbuka". |
| `project_cost_category` | Enum tetap (`MATERIAL`, `SUBCONTRACTOR`, `OPERATIONAL`, `OTHER`), bukan data perusahaan. |
| `ai_user_preference` | Preferensi milik orang, bukan perusahaan. Berkunci `user_id`, tanpa kolom `id`. |

Dua tabel baru:

- **`tenant`** — id, nama, status, tanggal mulai/berakhir langganan.
- **`tenant_member`** — `(user_id, tenant_id, role_id)`. Ini yang menggantikan
  asumsi "user milik satu perusahaan", dan yang membuat model ini tidak perlu
  dibongkar lagi saat ada orang yang bekerja di dua perusahaan.

`user.email` **tetap unik global**. Satu orang, satu akun, banyak keanggotaan.
Membuat email unik per tenant berarti satu orang punya kata sandi berbeda per
perusahaan — dan Better Auth harus dilawan untuk mencapainya.

## Constraint unik yang harus berubah

Enam belas pasti, satu menunggu keputusan peran.

| # | Lokasi | Sekarang | Menjadi |
| --- | --- | --- | --- |
| 1 | `finance.ts:31` | `bank_account.account_number` | `(tenant_id, account_number)` |
| 2 | `finance.ts:234` | `client_invoice.invoice_number` | `(tenant_id, invoice_number)` |
| 3 | `finance.ts:308` | `vendor.email` | `(tenant_id, email)` |
| 4 | `finance.ts:351` | `vendor_bill.bill_number` | `(tenant_id, bill_number)` |
| 5 | `finance.ts:514` | `bank_statement_row.fingerprint` | `(tenant_id, fingerprint)` |
| 6 | `projects.ts:27` | `client.email` | `(tenant_id, email)` |
| 7 | `projects.ts:230` | `expense_category.code` | `(tenant_id, code)` |
| 8 | `projects.ts:774` | `material_category.name` | `(tenant_id, name)` |
| 9 | `materials.ts:67` | `inventory_location.name` | `(tenant_id, name)` |
| 10 | `materials.ts:124` | `stock_transfer.transfer_number` | `(tenant_id, transfer_number)` |
| 11 | `materials.ts:149` | `stock_count.count_number` | `(tenant_id, count_number)` |
| 12 | `materials.ts:213` | `item_price_library.code` | `(tenant_id, code)` |
| 13 | `materials.ts:360` | `inventory_opening_batch.batch_number` | `(tenant_id, batch_number)` |
| 14 | `materials.ts:565` | `goods_receipt.receipt_number` | `(tenant_id, receipt_number)` |
| 15 | `system.ts:264` | `app_config.key` | `(tenant_id, key)` |
| 16 | `system.ts:183` | `ai_proposal_confirmation.tool_call_id` | `(tenant_id, tool_call_id)` |
| 17 | `auth.ts:36`, `auth.ts:74` | `role.name`, `(role_id, permission_key)` | menunggu keputusan |

Nomor 5 layak disorot. `bsr_fingerprint_uidx` adalah kunci deduplikasi impor
rekening koran. Dua perusahaan bisa sah-sah saja menghasilkan fingerprint yang
sama (nominal, tanggal, dan nomor referensi kebetulan sama), dan hari ini yang
kedua akan **ditolak diam-diam sebagai duplikat**. Guide UAT §B9.4 menguji
perilaku dedup ini; pengujiannya benar untuk satu tenant dan menyesatkan untuk
banyak tenant.

Tetap unik global dan **tidak** diubah: `user.email`, `session.token`,
`project_cost_category.name`.

Nomor 16 semula direncanakan tetap global — `tool_call_id` berasal dari AI SDK
dan tabrakan antar-tenant praktis mustahil. Test arsitektur menolaknya, dan
penolakan itu benar: "praktis mustahil" bukan jaminan, dan kegagalannya sekelas
dengan nomor 5 — konfirmasi tenant kedua ditolak diam-diam sebagai sudah pernah
dieksekusi. Aturan "tidak ada unik satu kolom pada tabel bertenant" lebih mudah
dijaga daripada aturan dengan empat pengecualian yang harus diingat.

Constraint komposit yang sudah aman karena kolom pertamanya sudah menyiratkan
tenant lewat foreign key — `mi_material_location_uidx`, `ct_bank_account_reference_uidx`,
`pb_project_id_idx`, `project_budgets_project_id_uidx`, `pbc_budget_category_uidx`,
`basc_setting_category_uidx`, `sci_count_material_uidx`, `ioi_batch_inventory_uidx`,
`pco_revised_rab_uidx` — tidak perlu diubah untuk kebenaran, hanya
dipertimbangkan ulang untuk efisiensi indeks setelah RLS menyala.

## Fase

Urutannya adalah inti dokumen ini. Setiap fase punya bentuk rilis sendiri dan
tidak boleh digabung.

### Fase 0 — Perancah tenant, sebelum go-live Polda

**Target: selesai sebelum data Polda masuk. Kalau mepet, mundur ke Fase 2.**

Ini satu-satunya jendela di mana migrasi 53 tabel bersifat mekanis: database
production masih kosong, jadi tidak ada backfill, tidak ada data yang bisa rusak,
dan **nol query yang perlu diubah** — dengan satu tenant, seluruh 865 titik query
tetap benar apa adanya.

1. Tabel `tenant` dan `tenant_member`; seed satu baris tenant Dekoria. Baris itu
   **disisipkan manual ke migrasi**, sebelum 53 foreign key dipasang —
   drizzle-kit tidak tahu tentang baris perancah.
2. `tenant_id uuid NOT NULL DEFAULT '<uuid-dekoria>'` di 53 tabel. `DEFAULT`-nya
   yang menjaga 865 titik query tetap benar tanpa disentuh; tanpa itu setiap
   INSERT wajib menyebut tenant dan seluruhnya pecah sekaligus.
3. Enam belas constraint unik menjadi komposit.
4. Test arsitektur baru, `lib/architecture/tenant-boundaries.test.ts`:
   menegaskan setiap tabel di luar daftar global punya kolom `tenant_id`.
   Daftar globalnya ditulis eksplisit, seperti allowlist rute API di
   `server-boundaries.test.ts` — menambah tabel global adalah keputusan desain,
   bukan kelalaian.
5. **RLS belum dinyalakan. Query tidak disentuh. Perilaku aplikasi tidak berubah.**

Kriteria selesai: `bun run test` hijau di baseline (551 pass + 135 skip),
`cd apps/web && bun test lib/architecture/` hijau, dan walkthrough §A0–A2
dijalankan ulang dari database kosong tanpa perbedaan satu rupiah pun.

Kerjakan di branch terpisah. **Jangan merge jika Polda kurang dari tiga hari
lagi** — jendela ini berharga, Polda lebih berharga.

### Fase 1 — Go-live Polda, September

Tidak ada pekerjaan tenant sama sekali. Isi fase ini ada di luar ruang lingkup
dokumen ini kecuali satu hal yang menyentuhnya: **partner kolaborasi masuk
sebagai `vendor`, bukan sebagai tenant.** Nol perubahan schema, dan jalur
tagihan-persetujuan-pencairan-penerimaan barang sudah terbukti di walkthrough §B5.

Itu sudah memberi "tiap perusahaan punya bagian keuangannya sendiri" dalam
bentuk yang bisa dipakai hari itu juga: komitmen, terbayar, dan sisa per partner.

### Fase 2 — Paket kerja, Oktober–November

"Project di dalam project": Polda dipecah menjadi paket per area (ruang kantor,
ruang rapat, dapur), masing-masing dengan lingkup, budget, dan realisasi
sendiri. **Masih satu tenant** — ini fitur struktur project, bukan fitur tenancy,
dan keduanya sering tertukar.

Dibangun sambil Polda berjalan, sehingga bentuk paketnya berasal dari lapangan
dan bukan dari rapat.

### Fase 3 — RLS menyala, tenant kedua hidup, Desember–Januari

1. Role database terbatas untuk runtime, terpisah dari role migrasi.
2. `SET LOCAL app.tenant_id` di pembungkus sesi, di dalam transaksi.
3. Kebijakan RLS + `FORCE ROW LEVEL SECURITY` di 53 tabel.
4. Test arsitektur diperluas: setiap tabel ber-tenant **wajib punya kebijakan
   RLS**, dan ketiadaannya menggagalkan suite.
5. Test isolasi yang menulis dua tenant lalu membuktikan tenant B tidak bisa
   membaca satu baris pun milik tenant A — dijalankan lewat
   `ATRIA_TEST_DATABASE_URL`, gerbang yang sudah ada.
6. Provisioning tenant kedua **manual**, dijalankan sendiri, memakai alur A0
   bootstrap + onboarding enam langkah yang sudah ada dan sudah terbukti.

Estimasi 4–6 minggu. Tanpa RLS estimasinya 2–3 bulan, dan risikonya beda kelas:
865 kesempatan untuk lupa berubah menjadi 54 kebijakan yang ditulis sekali dan
diuji sekali.

### Fase 4 — Ruang kolaborasi, Februari

Project kolaborasi hidup di **tenant Dekoria**, bukan di tenant netral tersendiri
— sesuai kenyataan bisnisnya, Dekoria penanggung jawab project, bukan peserta
setara. Vendor mendapat *grant* per paket lewat `project_participant_grant`,
satu kebijakan RLS tambahan di atas model yang sudah ada.

**Kontrak data, dan ini batas keras:**

| Masuk ruang bersama | Tidak pernah keluar dari tenant vendor |
| --- | --- |
| Nilai kontrak paket | Biaya aktual vendor |
| Progres pengerjaan | Margin vendor |
| Tagihan yang diajukan | Identitas pemasok vendor |
| Pembayaran yang diterima | RAP internal vendor |
| Foto lapangan, jadwal | — |

Kolom kanan bukan daftar "belum diimplementasikan". Itu daftar yang **tidak
akan pernah** diimplementasikan, dan alasannya komersial sebelum teknis: tidak
ada vendor interior yang menyerahkan marginnya kepada kontraktor utama, dan
komunitas itu kecil.

## Di luar ruang lingkup

Ditulis eksplisit supaya tidak merembes masuk:

- **Billing di dalam produk.** Nol dari 61 tabel menyentuh langganan; biarkan
  demikian. Sampai pelanggan kelima: invoice manual, transfer, perjanjian tertulis.
- **Pendaftaran mandiri.** Setiap tenant baru lewat tangan sendiri sampai RLS
  punya jam terbang. Orang asing tidak boleh membuat tenant di database yang
  berisi keuangan Dekoria dan Polda.
- **Portal vendor sebagai produk terpisah.** Muncul sendiri dari Fase 3 + 4.
- **Kustomisasi per tenant** (field tambahan, alur berbeda). Belum ada
  permintaannya, dan menebaknya sekarang berarti membangun yang salah.

## Pertanyaan terbuka

1. **Peran: global atau per tenant?** Rencana `2026-08-25-role-permission-unification.md`
   membuat peran bisa disunting. Peran yang bisa disunting hampir pasti milik
   tenant — tetapi itu menambah `tenant_id` ke `role` dan `role_permission`,
   dan mengubah `ROLE_ID_TO_NAME` yang saat ini memetakan UUID tetap. Harus
   diputuskan sebelum Fase 0 dieksekusi, karena menyentuh bentuk migrasi.
2. **Badan usaha yang memegang data.** Data keuangan vendor akan duduk di
   database yang sama dengan data Dekoria — kompetitor mereka. Pertanyaannya
   bukan teknis, dan jawabannya menentukan siapa yang menandatangani perjanjian
   langganan. Lihat artefak "Bekal Bisnis Atria".
3. **Retensi arsip setelah tenant berhenti.** Buku besar dan jejak audit sengaja
   append-only. Menghapus tenant menabrak invariant itu. Arahnya: hanya-baca 90
   hari, lalu data operasional dihapus dan ledger disimpan sebagai arsip terkunci
   — dan itu ditulis di perjanjian sebagai janji, bukan kejutan.

## Prasyarat yang tidak boleh dilewati

Ketiganya di luar pekerjaan tenant, tetapi Fase 1 tidak boleh jalan tanpanya.

1. ~~**Perbaiki `Perlu dibeli 0` vs `Beli 20`.**~~ **✅ Sudah beres.** Perbaikannya
   ternyata sudah mendarat di `51c2dde`, setelah runbook ditulis — jadi yang
   usang adalah §Status verifikasi runbook, bukan kodenya. Label form juga sudah
   berubah menjadi "Perlu diamankan". Yang belum ada adalah penjaganya: aturan
   itu hanya dijaga komentar. Sekarang dikunci
   `features/projects/detail/utils/rap-manager-utils.test.ts` (8 test), termasuk
   satu yang membandingkan angka form dengan `projectMaterialProjection` supaya
   kedua layar gagal bersama kalau berbeda lagi. Terbukti menangkap: 5 dari 8
   test gagal saat cacatnya sengaja dikembalikan.
2. ~~**Invariant test, dijalankan tiap malam.**~~ **✅ Sudah dibangun.** Keenamnya
   ada di `lib/finance/ledger-invariants.ts`, dipecah dua lapis: `evaluate*` yang
   murni (bisa diuji tanpa database) dan `check*` tipis yang mengambil baris.

   | # | Aturan |
   | --- | --- |
   | I1 | Saldo tiap `bank_account` = jumlah bersih `cash_transaction`-nya |
   | I2 | `material_inventory.current_stock` = jumlah `stock_movement` per material×lokasi |
   | I3 | Tiap `allocated_amount` = `ratio_percentage` × `internal_budget` |
   | I4 | Tiap entri buku besar punya pasangan `audit_log` di `bank_account` |
   | I5 | Pergerakan yang mengubah stok punya arah — `RESERVE` satu-satunya yang sah `NEUTRAL` |
   | I6 | Tiap `vendor_payment` `COMPLETED` menunjuk `cash_transaction` yang ada |

   Uang dan kuantitas dijumlahkan sebagai `bigint` sen lewat `parseNumericToCents`,
   bukan float — aturan yang sama dengan jalur mutasi saldo.

   **Terbukti mendeteksi, bukan hanya terbukti lulus.** `ledger-invariants.test.ts`
   (24 test) memberi tiap invarian data rusak buatan dan menuntut ia mengeluh —
   termasuk cacat `USE`/`WASTE`/`RETURN` tanpa arah yang pernah nyata, dan tipe
   pergerakan yang belum dikenal (gagal ke arah aman berkat daftar-larangan).

   Tiga cara menjalankan:
   - `bun run db:check-invariants` — hanya membaca, aman terhadap produksi, keluar
     dengan kode 1 bila ada pelanggaran. **Ini bentuk "tiap malam"**: jadwalkan
     perintah ini dan biarkan exit code yang bicara.
   - `ledger-invariants.integration.test.ts` — bergerbang `ATRIA_TEST_DATABASE_URL`.
   - `ledger-invariants.test.ts` — murni, ikut `bun run test` tanpa database.

   Database kosong sengaja dihitung **gagal**, bukan sehat: enam invarian yang
   lulus atas nol baris belum membuktikan apa pun.

   **Dijalankan pertama kali 27 Agustus 2026 terhadap `atria_uat_guard`:
   keenamnya terpenuhi, 82 baris diperiksa** (4 rekening, 12 sel inventaris, 25
   alokasi kategori, 13 entri buku besar, 24 pergerakan stok, 4 pembayaran
   vendor). Itu bukti pertama yang berdiri di luar runbook — tetapi datanya
   kecil. Angka yang berarti baru muncul setelah Polda berjalan; sampai saat itu
   yang terbukti adalah pemeriksanya berjalan dan dataset sekarang bersih, bukan
   bahwa sistemnya tahan pada volume nyata.

   Catatan eksekusi: skrip dijalankan dengan kondisi resolusi `react-server`
   (`bun --conditions react-server`) karena `import "server-only"` melempar di
   luar Next.js. Kondisi itu memang yang benar secara semantik — ini kode server.
3. ⚠️ **Point-in-time restore — LULUS SECARA MEKANIS, BELUM MEMADAI.**
   Dijalankan 2026-08-28 di project `atria-erp`: kedua uji lulus, 82 baris
   dipulihkan utuh, seluruhnya lewat `neonctl` dalam ±2 menit. **Tetapi retensi
   hanya 6 jam** — maksimum paket Free, sudah mentok. Risiko sebenarnya adalah
   salah catat yang baru ketahuan saat rekonsiliasi mingguan; pada saat itu
   titik pemulihannya sudah lewat. Butuh minimal 7 hari, tersedia di paket
   berbayar. Hasil lengkap di `docs/guide/restore-drill.md`.

   ~~**Point-in-time restore Neon menyala, dan sudah pernah benar-benar
   di-restore.**~~ Backup yang belum pernah diuji bukan backup — ia perasaan.
   Prosedurnya, dengan kriteria lulus/gagal, ada di
   `docs/guide/restore-drill.md`; `bun run db:restore-drill` menjalankan
   bagian yang bisa diotomatiskan. Dua uji harus lulus bersama:

   | Uji | Membuktikan |
   | --- | --- |
   | Perjalanan waktu | Tabel penanda **tidak ada** di branch hasil restore — pemulihan benar-benar mundur, bukan menyalin keadaan sekarang |
   | Keutuhan data | Keenam invarian terpenuhi atas data hasil pemulihan, dengan jumlah baris di atas nol |

   Uji pertama yang paling sering dilewati, dan ia yang membedakan "punya
   salinan" dari "bisa kembali ke titik sebelum kesalahan". Sisanya —
   menaikkan retensi riwayat dan membuat branch dari waktu lampau — hanya bisa
   dikerjakan dari console Neon.

   **Retensi harus lebih lama dari jeda antara kesalahan terjadi dan kesalahan
   disadari.** Untuk ERP yang direkonsiliasi mingguan, retensi 24 jam berarti
   titik pemulihannya sudah lewat pada saat kesalahannya ketahuan.

## Topologi database

Sejak 2026-08-28, project Neon `atria-erp` (`rapid-mountain-50889409`, org
`Dekoria`, pemilik `dekoria.office@gmail.com`) punya dua branch:

| Branch | Id | Dipakai untuk |
| --- | --- | --- |
| `production` | `br-holy-frost-ao2muwah` | Data yang akan dipakai Polda. Jangan disambungkan ke dev server. |
| `development` | `br-autumn-wind-aok3wub0` | Pengembangan sehari-hari. `apps/web/.env` menunjuk ke sini. |

Keduanya berisi `atria_uat_guard`, `atria_uat_empty`, dan `neondb`. Branch Neon
bersifat copy-on-write, jadi `development` lahir dengan seluruh isi `production`
pada saat pembuatannya — 36 migrasi, 54 kolom `tenant_id`, satu baris tenant, dan
keenam invarian terpenuhi atas 82 baris.

**Konsekuensi yang harus diingat:** kedua branch sekarang berjalan terpisah.
Migrasi yang dijalankan di `development` **tidak** ikut ke `production`; keduanya
harus dijalankan sendiri-sendiri, dan `production` yang menentukan kebenaran
sebelum go-live. Ini harga yang dibayar untuk berhenti mengembangkan langsung di
atas data yang akan dipakai proyek nyata.

### Reset production, 2026-08-28

`production` sudah dikosongkan dari 554 baris data UAT dan kini berada pada
keadaan awal yang sah: hanya `__drizzle_migrations` (36 baris) dan `tenant` (1
baris). Isi berikutnya harus datang lewat onboarding — lihat
`docs/guide/financial_workflow_guide.md` §A0.

Cadangan sebelum reset tersimpan sebagai branch `pre-reset-2026-08-28`
(`br-mute-thunder-aon6eqor`). Berbeda dari jendela PITR 6 jam, branch bertahan
sampai dihapus — hapus setelah go-live berjalan dan datanya jelas tidak
diperlukan lagi.

**Satu cacat ditemukan dan diperbaiki saat reset ini.** `truncate ... cascade`
mengosongkan `tenant` juga, padahal 53 tabel memakai `tenant_id NOT NULL DEFAULT
'<uuid-dekoria>'` dengan foreign key ke sana. Database yang "bersih" karena itu
tidak bisa dipakai memulai apa pun: insert pertama onboarding langsung gagal
foreign key. `scripts/reset-database.ts` kini menanam ulang baris tenant perancah
setelah truncate, dan perbaikan itu ikut menutup `db:demo:reset` yang memanggil
skrip yang sama. Terbukti: insert memakai DEFAULT `tenant_id` berhasil pada
database hasil reset.

Cacat ini lahir bersama migrasi 0035 dan hanya bisa muncul pada reset pertama
sesudahnya — jenis kesalahan yang, kalau tidak dikejar sekarang, baru ketahuan
saat onboarding di hari go-live.

**Catatan operasional:** selama `production` masih kosong,
`bun run db:check-invariants` terhadapnya akan **gagal** dengan alasan "nol baris
diperiksa". Itu memang disengaja — enam invarian yang lulus atas nol baris tidak
membuktikan apa pun. Jadwalkan pemeriksaan malam terhadap `production` **setelah**
data Polda mulai masuk, bukan sebelumnya.

## Riwayat keputusan

Berasal dari sesi pembedahan rencana 27 Agustus 2026, enam putaran, 26 keputusan.
Yang mengubah arah:

- Database terpisah per tenant **dicabut** setelah kebutuhan "Dekoria memantau
  paket vendor" dikonfirmasi. Dua keinginan itu tidak bisa dipenuhi bersamaan.
- Migrasi 53 tabel **dimajukan ke sebelum go-live**, karena database production
  yang masih kosong adalah jendela termurah yang akan pernah ada, dan jendela itu
  menutup saat Polda mulai.
- Partner kolaborasi September **turun** dari tenant penuh menjadi `vendor`,
  memindahkan 80% nilai yang diminta ke pekerjaan yang sudah selesai.
- Proposal AI **tetap menyala keempat keluarganya**, dengan plafon: usulan di
  atas Rp 5.000.000 wajib melewati jalur persetujuan Owner yang sudah ada, sama
  seperti aturan pembayaran di `CLAUDE.md`. Gerbangnya sudah benar —
  `ai_proposal_confirmation.tool_call_id` unik, konfirmasi lewat Server Action
  terpisah, idempoten — yang belum ada hanya jam terbang.
