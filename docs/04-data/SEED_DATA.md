# Connected Demo Seed — Data Contract

Dokumen ini menjelaskan kontrak dataset development pada `db/seed.ts`. Source of truth struktur
database tetap berada di schema Drizzle; dokumen ini tidak menyalin SQL atau pseudo-code seed.

Seed adalah **sandbox pembelajaran**, bukan bootstrap production. Untuk acceptance test dari data
operasional kosong, gunakan `docs/guide/financial_workflow_guide.md`.

## Menjalankan dengan aman

```bash
# Hanya dapat dipakai jika database sudah migrated dan seluruh tabel bisnis kosong.
bun run db:seed

# Menghapus data sandbox, seed ulang, membuat fixture CSV, lalu memverifikasi hasil.
bun run db:demo:reset --confirm-reset

# Audit read-only; tidak memperbaiki atau menghapus data.
bun run db:demo:verify
```

Perilaku wajib:

- `db:seed` menolak database berisi data dan tidak melakukan cleanup;
- command demo menolak `NODE_ENV=production`;
- reset tidak berjalan tanpa `--confirm-reset`;
- target host/database dicetak sebelum seed;
- kegagalan invariant di dalam seed me-roll back seluruh insert;
- fixture CSV ditulis ke `.atria-demo/` dan tidak disimpan di Git.

Tanggal menggunakan anchor hari seed di zona `Asia/Jakarta`. Untuk test otomatis, anchor dapat
dikunci dengan `ATRIA_DEMO_SEED_DATE=YYYY-MM-DD`. Nomor dokumen dan UUID tetap stabil agar guide,
fixture, dan test dapat merujuk record yang sama.

## Akun demo

| Peran           | Nama          | Email                | Password      |
| --------------- | ------------- | -------------------- | ------------- |
| Owner           | Ronald Wijaya | `ronald@dekoria.com` | `password123` |
| Finance Admin   | Lisa Permata  | `lisa@dekoria.com`   | `password123` |
| Project Manager | Budi Santoso  | `budi@dekoria.com`   | `password123` |
| Project Manager | Siti Aminah   | `siti@dekoria.com`   | `password123` |
| Purchasing      | Agus Setiawan | `agus@dekoria.com`   | `password123` |

Password tersebut hanya untuk development. Walkthrough mengutamakan Developer Account Switcher
dengan `ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED="true"`.

## Peta skenario project

| Project              | State awal                               | Tujuan demo                                          |
| -------------------- | ---------------------------------------- | ---------------------------------------------------- |
| Menteng Villa        | Active, RAB R1 approved, R2 void         | Finance/material utama dan histori revisi batal      |
| Sudirman Suites      | Active, Change Order R2 pending approval | Approval revisi scope, RAB, dan budget berisiko      |
| Brawijaya Residence  | Active, locked RAP, initial RAB draft    | RAB campuran, bundle, hidden line, dan approval awal |
| Cipete House         | Active, RAP draft pada tahap Review      | Finalisasi Material/Tukang/Subcon lalu generate RAB  |
| Pakubuwono Apartment | Draft, Project Budget pending approval   | Approve/reject budget dan gating workflow berikutnya |
| Senopati Office      | Active, seluruh blocker bersih           | Project Closing                                      |
| BSD Boutique Cafe    | Completed                                | Referensi project selesai                            |
| Kemang Townhouse     | On Hold                                  | Contoh project ditahan dengan alasan operasional     |
| PIK Shophouse        | Cancelled                                | Contoh project dibatalkan tanpa transaksi aktif      |

Project draft/on-hold/cancelled boleh tidak mempunyai transaksi. Project aktif yang dipakai untuk
workflow selalu mempunyai project, PM, client, budget/category, serta relasi detail yang sesuai.

## Baseline finance

### Rekening

| Rekening           | Saldo seed    | Sumber angka                          |
| ------------------ | ------------- | ------------------------------------- |
| BCA Operasional    | Rp655.000.000 | Seluruh INFLOW dikurangi OUTFLOW BCA  |
| Kas Kecil PM Budi  | Rp14.150.000  | Transfer masuk Rp15 juta − Rp850 ribu |
| Mandiri Giro Utama | Rp500.000.000 | Pelunasan Senopati                    |
| Kas Kecil PM Siti  | Rp9.500.000   | Saldo awal Rp12 juta − Rp2,5 juta     |

Saldo bukan opening balance tersembunyi: setiap rupiah berasal dari `cash_transaction`. Transfer
BCA → Kas Budi mempunyai dua ledger entries, arah berlawanan, nominal sama, dan shared
`referenceType/referenceId`.

### Invoice klien

| Invoice      | Nilai         | Payment seed  | Status awal      | Aksi belajar                |
| ------------ | ------------- | ------------- | ---------------- | --------------------------- |
| INV/2026/001 | Rp240.000.000 | Rp240.000.000 | Paid             | Lihat histori               |
| INV/2026/002 | Rp320.000.000 | Rp120.000.000 | Partially Paid   | Catat sisa Rp200.000.000    |
| INV/2026/005 | Rp240.000.000 | Rp0           | Unpaid + overdue | Lihat indikator jatuh tempo |
| INV/2026/003 | Rp360.000.000 | Rp360.000.000 | Paid             | Lihat histori               |
| INV/2026/004 | Rp480.000.000 | Rp0           | Unpaid           | Negative/overpayment test   |
| INV/2026/006 | Rp500.000.000 | Rp500.000.000 | Paid             | Closing Senopati            |

Status invoice selalu diturunkan dari agregasi seluruh `client_payment`; total payment tidak boleh
melewati nilai invoice.

### Vendor dan expense

- BILL-2026-091 Rp20 juta mempunyai payment terjadwal Rp4 juta. Karena di bawah threshold dan
  category tidak overrun, payment ini tidak mempunyai approval Owner.
- BILL-2026-092 Rp41 juta mempunyai payment terjadwal Rp10 juta dan approval Owner `PENDING`.
- BILL-2026-088 Rp15 juta dan BILL-2026-089 Rp35 juta adalah histori paid dengan cash transaction.
- Expense Rp1,05 juta sudah approved dan dapat langsung dicairkan Finance.
- Expense Rp5 juta serta Rp6,2 juta dimulai dari submitted/approval flow. Expense Rp6,2 juta berada
  pada category Subcon beralokasi Rp0, sehingga `budgetOverrun=true` dan wajib Owner.
- Expense Cipete Rp7,5 juta dan Rp18 juta sudah `VERIFIED`, sehingga langsung muncul pada baseline
  approval queue. Expense Rp18 juta berada pada Subcon beralokasi Rp0 dan menjadi contoh kritis.
- Setiap canonical `project_expenses` yang mempunyai `legacyProjectCostId` harus sama project,
  category, quantity, unit cost, amount, dan statusnya dengan `project_cost`.

Default budget berasal dari Settings: internal budget cap 90%, Tukang 18%, Material 35%,
Operasional 1%, Lain-lain 0,5%, dan Subcon 0% dari internal budget. Sisa 45,5% adalah unallocated
buffer, bukan gross margin.

## Kontrak rekonsiliasi

State awal mempunyai sembilan pasangan history dan dua pasangan terbuka:

| Tampilan Catatan Atria                                 | Mutasi bank                           | Nominal     |
| ------------------------------------------------------ | ------------------------------------- | ----------- |
| Pembelian lakban, sekrup, dan mata bor cadangan        | PENCAIRAN KLAIM SITE TRF-FLD-0606     | Rp850.000   |
| Pembelian lem kayu khusus sintetis & aksesoris bengkel | PENCAIRAN KLAIM WORKSHOP TRF-FLD-0609 | Rp2.500.000 |

Tab **Catatan Atria** mengambil deskripsi expense asli dan nama proyek dari `project_cost` yang
direferensikan cash transaction. Deskripsi ledger internal tetap menyimpan konteks pencairan,
misalnya `Pencairan klaim aksesoris Workshop Cikupa`, tetapi tidak dipakai sebagai judul utama jika
sumber bisnisnya tersedia.

Untuk setiap pasangan terbuka berlaku:

- rekening sama;
- arah `INFLOW`/`OUTFLOW` sama;
- nominal sama;
- tepat satu kandidat di kedua sisi;
- belum ada match ID maupun reconciliation evidence.

Kedua pasangan dapat langsung dicocokkan. Salah satunya juga dapat dipakai untuk mengetes
**Catat pengecualian → Hapus pengecualian → Cocokkan**. Pengecualian tidak mengubah saldo dan
tidak memindahkan transaksi ke Riwayat cocok.

File di `.atria-demo/` dipakai setelah walkthrough membuat transaksi baru. Jangan mengimpornya di
awal karena counterpart internalnya belum dibuat.

## Kontrak material dan stock

- Posted opening batch mempunyai maker dan approver berbeda serta movement untuk setiap item.
- Pending opening batch mempunyai item nyata dan approval Owner.
- Posted Goods Receipt mempunyai item dan stock movement.
- Stock transfer mempunyai movement OUT dan IN untuk setiap item.
- Stock count variance non-zero mempunyai adjustment movement.
- `material_inventory.current_stock` selalu sama dengan opening/receipt/usage/return/waste/
  transfer/adjustment movements pada material dan lokasi yang sama.
- Reservation tidak membuat cash transaction; usage stock juga tidak otomatis memindahkan kas.

## Invariant yang menggagalkan seed

Seed dan `db:demo:verify` memeriksa sedikitnya:

- saldo rekening = agregasi ledger;
- invoice/bill status = agregasi payment;
- completed payment dan paid expense memiliki cash transaction;
- setiap cash transaction mempunyai audit perubahan saldo;
- transfer bank net-zero dengan shared reference;
- open dan historical reconciliation one-to-one;
- canonical/legacy expense tidak drift;
- project, budget, category, material, RAP, bill, dan expense tidak cross-project;
- Pakubuwono memiliki budget pending tanpa RAP/RAB, Cipete memiliki RAP Review tanpa RAB, dan
  Brawijaya memiliki RAB draft campuran dengan total visible Rp950 juta;
- Sudirman mempunyai baseline R1, revision R2, dan Change Order terkonfirmasi senilai Rp1,335 miliar;
- Menteng mempunyai revision R2 void dengan Change Order cancelled;
- budget snapshot sama dengan category detail;
- stock sama dengan movement detail;
- Senopati memiliki approved canonical budget, satu approved RAB, dan invoice lunas.

Jika verifier gagal setelah walkthrough, itu dapat berarti skenario belum diselesaikan atau input
yang dipakai berbeda dari guide. Gunakan reset demo untuk kembali ke baseline; verifier tidak pernah
melakukan repair otomatis.
