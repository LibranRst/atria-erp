# Walkthrough UAT Atria ERP — Dari Data Operasional Kosong sampai Project Closing

Versi implementasi: **7 September 2026**
Audit pendamping: `docs/guide/workflow_audit_2026-07-16.md`

## Status Verifikasi & Ringkasan Eksekutif

Runbook ini adalah panduan operasional dan User Acceptance Testing (UAT) resmi Atria ERP untuk Dekoria (*interior design & build*). Baseline finansial dan kontrol material dirancang untuk dieksekusi secara literal dari kondisi **database kosong**, diverifikasi pada antarmuka pengguna (UI), cross-surface agregat, serta verifikasi read-only langsung ke tabel PostgreSQL.

**Prinsip Desain Panduan Ini:**
- **Self-Contained Step Data**: Setiap langkah memuat seluruh data input (nama field, nilai input, nominal, opsi dropdown) secara langsung di tempat (*in-place*). Penguji tidak perlu scroll bolak-balik ke tabel master di bagian atas untuk menyalin data.
- **Urutan Workflow yang Akurat**: Penyiapan data master telah diselaraskan dengan dependensi form UI riil (Vendor Master disiapkan sebelum Material Master agar dropdown *Vendor default* langsung dapat dipilih).
- **Sinkronisasi UI Real-Time**: Seluruh label tombol, nama tab navigasi proyek (`Ringkasan`, `RAB`, `RAP`, `Stok`, `Pengeluaran`, `Pembayaran`, `Margin`), dan URL route cocok persis dengan kode aplikasi di `apps/web/`.

**Cakupan Verifikasi Dokumen:**
- **Bagian A (A0–A5)**: Bootstrap Owner pertama (`/setup`), Onboarding Quick Start v2 (`/onboarding`), Kesiapan Operasional (`/settings?tab=readiness`), Developer Account Switcher (`/profile`), Post-Setup Consistency Check, Role Boundary Security Gate.
- **Bagian B (B1–B12)**: Siklus hidup proyek lengkap dari penugasan PM, penyusunan Internal Plan (RAP Material, Paket Tukang, Paket Subcon), kalkulasi dan persetujuan RAB Klien (RAB Approved Rp50.000.000), penagihan Invoice DP 50% & Inflow kas BCA, pengadaan material (reservasi stok gudang, tagihan vendor bill, pembayaran, Goods Receipt), pemakaian bengkel (USE, RETURN, WASTE), upah tukang (kasbon kas kecil & transfer BCA), tagihan subcon & operasional lapangan, penagihan Termin 2, rekonsiliasi mutasi rekening koran BCA 100%, Change Order (+Rp6.000.000 dengan rescale proporsional), penagihan Termin 3 / BAST, verifikasi 10 invariant closing blocker, hingga finalisasi Project Closing di tab Margin.
- **Bagian C**: Matriks 18 Negative Tests executable yang menguji penolakan mutasi tidak sah tanpa menimbulkan *partial write* pada database.
- **Bagian D**: Panduan Troubleshooting dan Safe Resume State untuk pemulihan operasional tanpa reset data.

---

## 1. Arti “Mulai dari Kosong” & Prasyarat Environment

Runbook ini dimulai dari database yang telah menjalankan seluruh migration Drizzle tetapi belum memiliki data transaksi bisnis:

- **0 user bisnis, 0 project, 0 client, 0 vendor, 0 rekening bank, 0 item material, 0 mutasi stok, 0 invoice, 0 pengeluaran, 0 tagihan, dan 0 approval**.
- **Tanpa seed transaksi**: Jangan menjalankan `bun run db:seed` jika ingin menguji alur instalasi baru dari awal.
- Konfigurasi environment `.env` yang dipersyaratkan:
  ```env
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/atria_dev"
  BETTER_AUTH_SECRET="rahasia-auth-development-min-32-karakter-atria-erp"
  BETTER_AUTH_URL="http://localhost:3000"
  ATRIA_BOOTSTRAP_SECRET="super-secret-bootstrap-key-dekoria-2026"
  ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED="true"
  ```
- Seluruh akun tim, rekening, saldo awal kas, vendor, material master, stok pembuka opname, dan transaksi proyek dibentuk melalui UI dan Server Action resmi.

> **Pilih Mode Test:** Dokumen ini menguji instalasi baru dari database kosong. Untuk latihan atau eksplorasi data demo yang sudah terisi lengkap, gunakan [`seeded_demo_walkthrough.md`](./seeded_demo_walkthrough.md). Jangan mencampur kedua dataset dalam satu pengujian.

### Reset Database Development ke Data Kosong

Jalankan script reset hanya ketika seluruh data pada `DATABASE_URL` development memang boleh dibersihkan:

```bash
# 1. Periksa target database tanpa mutasi (dry-run)
bun run db:reset --dry-run

# 2. Eksekusi reset eksplisit
bun run db:reset --confirm-reset
```

Setelah reset, buka browser pada route `/setup` dan mulai dari **A0. Bootstrap First Owner**.

---

## 2. Akun, Kredensial UAT, dan Matriks Tanggung Jawab Role

Gunakan empat akun peran berbeda dengan email berpola `role@dekoria.test` dan satu password seragam untuk kemudahan simulasi UAT:

### Kredensial UAT

| Role            | Nama Tampilan             | Email                     | Password Awal   | Akses Utama & Wewenang                                |
| --------------- | ------------------------- | ------------------------- | --------------- | ----------------------------------------------------- |
| Owner           | `Ronald Wijaya`           | `owner@dekoria.test`      | `Dekoria123456` | Seluruh sistem, setup, approval global, closing       |
| Finance Admin   | `Finance UAT`             | `finance@dekoria.test`    | `Dekoria123456` | Rekening, verifikasi expense, pencairan, rekonsiliasi |
| Project Manager | `PM UAT Budi`             | `pm@dekoria.test`         | `Dekoria123456` | Proyek yang ditugaskan, susun RAP, ajukan pengeluaran |
| Purchasing      | `Purchasing UAT`          | `purchasing@dekoria.test` | `Dekoria123456` | Lokasi, Material Master, pergerakan stok gudang       |

Password `Dekoria123456` memenuhi validasi minimal 12 karakter dengan kombinasi huruf besar, huruf kecil, dan angka. **Jangan gunakan password sederhana ini pada environment production.**

### Matriks Tanggung Jawab dan Batasan Ketat

| Role            | Tanggung Jawab Utama                                                                     | Batasan Ketat (Dilarang Keras / Unauthorized)                 |
| --------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Owner           | Setup awal, default budget, persetujuan RAB, review high-risk, Change Order, closing     | Menganggap approval dokumen sebagai mutasi kas langsung       |
| Finance Admin   | Kelola rekening, verifikasi expense, pencairan vendor/lapangan, invoice, rekonsiliasi bank | Mengubah stok tanpa aksi penerimaan/pengeluaran material riil |
| Project Manager | Kelola proyek yang di-assign, susun RAP & paket kerja, ajukan nota/tagihan lapangan      | Melihat total kas perusahaan di `/ledger`, self-verify expense|
| Purchasing      | Kelola master material, lokasi, penerimaan barang, reservasi/use/return/waste stok gudang| Melihat saldo rekening bank atau mengubah formula margin      |

Setelah Developer Account Switcher aktif (A3), pergantian akun dapat dilakukan instan dari menu Profil (`/profile`) atau bar simulasi tanpa perlu logout-login manual.

---

## 3. Dataset Kontrol Studi Kasus Real-World (Bassura City)

Bagian ini berfungsi sebagai **Ringkasan Kontrol Global (Master Reference)** untuk memeriksa kecocokan angka akhir. Anda **tidak perlu menyalin data dari sini saat eksekusi** karena setiap langkah operasional pada Bagian A dan B telah memuat data input lengkap siap salin.

### 3.1 Identitas Bisnis, Proyek, dan Rekening Bank
- **Perusahaan**: PT Dekoria Desain Estetika
- **Nama Proyek**: `Fit-Out Interior Studio Bassura City — Unit 18B`
- **Klien**: `Bpk. Hendra Gunawan` (No HP: `081122334455`, Email: `hendra.gunawan@testmail.id`)
- **Project Manager**: `PM UAT Budi`
- **Lokasi Gudang**: `Workshop & Gudang Cikarang`
- **Kas Awal Perusahaan**: **Rp165.000.000** (BCA Operasional Rp150.000.000 + Kas Kecil Rp15.000.000)

### 3.2 Target Finansial Kontrak Awal Rp50.000.000 (Derivasi Bersih Cara A)
- **Nilai Kontrak / Total RAB Disetujui**: **Rp50.000.000**
- **Pemisahan Porsi Komponen RAB**:
  - **Porsi Produksi / Fisik**: **Rp28.070.000** (6 Item Material RAP + 1 Paket Tukang + 2 Paket Subcon)
  - **Porsi Jasa Desain & Fee Manajemen**: **Rp21.930.000** (`SERVICE_FEE`, dialokasikan 100% ke laba kotor)
- **Budget Internal Fisik (Cap 90% dari Porsi Fisik)**: **Rp25.265.000**
- **Alokasi Plafon 5 Kategori Fisik (dihitung dari Budget Fisik Rp25.265.000)**:
  - Material (38%): `Rp9.600.700` *(membungkus RAP Material Rp7.265.000 secara logis & aman)*
  - Tukang (28%): `Rp7.074.200`
  - Subcon (20%): `Rp5.053.000`
  - Operasional (4%): `Rp1.010.600`
  - Lain-lain (2%): `Rp505.300`
  - Buffer Fleksibilitas (8%): `Rp2.021.200`
- **Dual Target Gross Margin**:
  - **Margin Murni Produksi (Fisik)**: **10,0%** (`Rp2.805.000`) — batas aman efisiensi belanja operasional lapangan.
  - **Margin Total Proyek (Komersial)**: **49,5%** (`Rp24.735.000`) — akumulasi fee jasa desain (Rp21,93 jt) + margin fisik (Rp2,805 jt).

### 3.3 Ringkasan Persediaan & Master Vendor
- **Total Nilai Saldo Awal Gudang (Opname)**: **Rp4.865.000** (6 item bahan baku di Gudang Cikarang).
- **Vendor Partner Utama**:
  1. `PT Sumber Abadi Panel & HPL` (Bahan Baku & Fitting)
  2. `CV Marmer Indah Sentosa` (Subcon Top Table Solid Surface)
  3. `PT Kaca Nusantara Prima` (Subcon Cermin & Kaca)

---

## 4. Matriks Checkpoint State Terpusat (Resume Matrix)

Tabel ini menjadi acuan verifikasi cepat dan titik resume pengujian. Jika sistem terhenti di tengah jalan, periksa kondisi database dan lanjutkan ke langkah berikutnya tanpa mengulang mutasi.

| Checkpoint | Deskripsi State | Prerequisite | Jangan Ulangi Jika | Expected Database / UI State | Lanjut Ke |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CP-0** | Fresh Blank DB | Reset selesai | Ada row di `users` | 0 users, 0 bank accounts, 0 projects | **A0** |
| **CP-A0** | Owner Bootstrapped | CP-0 | Owner sudah ada | 1 user role `OWNER`, 5 categories, 1 budget default | **A1** |
| **CP-A1** | Quick Start Project Draft | CP-A0 | Proyek Bassura ada | 1 client, 1 project `DRAFT`, 5 category budgets | **A2** |
| **CP-A2** | Operational Readiness 100% | CP-A1 | 4 staff, 2 banks, 3 vendors, 6 items | 4 users, 2 bank accounts (Rp165jt), 3 vendors, 6 materials (Rp4.865jt) | **A3** |
| **CP-B1** | PM Assigned | CP-A2 | `project.project_manager_id` terisi | Proyek `DRAFT`, PM terhubung | **B2** |
| **CP-B2** | RAP Locked | CP-B1 | `project_rap.status = 'LOCKED'` | RAP cost Rp25.265.000 terkunci | **B3** |
| **CP-B3** | RAB Approved & Active | CP-B2 | `rab_estimate.status = 'APPROVED'` | Proyek `ACTIVE`, Budget internal Rp45jt aktif | **B4** |
| **CP-B4** | DP Invoiced & Paid | CP-B3 | Invoice DP `PAID` | BCA: Rp175jt, Piutang: Rp0, Total Kas: Rp190jt | **B5** |
| **CP-B5** | Procurement & GR Posted | CP-B4 | GR Posted & Bill Paid | BCA: Rp166.5jt, Mat Paid: Rp8.5jt, Stok fisik naik | **B6** |
| **CP-B6** | Material Consumed (Workshop) | CP-B5 | Movements USE/RET/WASTE ada | Mat Actual: Rp3.000.000, Stok fisik berkurang | **B7** |
| **CP-B7** | Tukang Wages Paid | CP-B6 | Tukang expense `PAID` | Kas kecil: Rp11jt, BCA: Rp160.5jt, Tukang Act: Rp10jt | **B8** |
| **CP-B8** | Subcon & Ops Paid | CP-B7 | Subcon & Ops `PAID` | BCA: Rp152.5jt, Kas kecil: Rp9.6jt, Subcon: Rp8jt, Ops: Rp1.4jt | **B9** |
| **CP-B9** | Termin 2 & Bank Reconciled | CP-B8 | 6 cash transactions reconciled | BCA: Rp170jt, 100% bank mutation reconciled | **B10** |
| **CP-B10**| Mid-Project Audit | CP-B9 | Posisi kas dievaluasi | Biaya Actual: Rp22.4jt, Margin: 55,2% | **B11** |
| **CP-B11**| Change Order Approved | CP-B10 | CO Approved, Inv CO Paid | Kontrak: Rp56jt, Budget: Rp50.4jt, BCA: Rp176jt | **B12** |
| **CP-B12**| Project Closed | CP-B11 | `project.status = 'COMPLETED'` | Snapshot final terkunci di tab Margin, 10 invariant bersih | **Selesai** |

---

## BAGIAN A — Bootstrap First Owner, Onboarding Quick Start v2, & Kesiapan Operasional

```
                           ALUR SETUP ORGANISASI BARU
 ┌────────────────────────────────────────────────────────────────────────┐
 │ A0. Bootstrap First Owner (/setup)                                     │
 │     └─ Buat akun Owner pertama dari database kosong                    │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ A1. Quick Start Owner v2 (/onboarding)                                 │
 │     ├─ Layar 1: Pengenalan (Welcome)                                   │
 │     ├─ Layar 2: Default Finansial (Review Cap 90% & 5 Kategori)        │
 │     ├─ Layar 3: Project Pertama (Studio Bassura City Rp50.000.000)     │
 │     └─ Layar 4: Sukses (Project Draft & Budget terbentuk atomik)       │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ A2. Kesiapan Operasional (/settings?tab=readiness)                     │
 │     ├─ A2.1: Akun Tim Inti (Finance Admin, PM, Purchasing)             │
 │     ├─ A2.2: Rekening Bank & Kas (BCA Rp150jt + Kas Rp15jt)            │
 │     ├─ A2.3: Vendor Master (PT Sumber Abadi, CV Marmer, PT Kaca)       │
 │     ├─ A2.4: Lokasi Gudang & 6 Material Master (dengan vendor default) │
 │     └─ A2.5: Keputusan Saldo Awal Stok (Batch Opname Rp4.865.000)      │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ A3. Developer Account Switcher (/profile)                              │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ A4. Post-Setup Consistency Check & A5. Role Boundary Smoke Test        │
 └────────────────────────────────────────────────────────────────────────┘
```

---

### A0. Bootstrap First Owner dari Database Kosong

1. Buka browser pada route `/setup`.
2. Masukkan data persis berikut pada form:

| Nama Field UI | Nilai Input Siap Salin | Keterangan |
| :--- | :--- | :--- |
| **Bootstrap secret** | Nilai `ATRIA_BOOTSTRAP_SECRET` dari file `.env` | Kunci otorisasi setup |
| **Nama Owner** | `Ronald Wijaya` | Nama akun Owner pertama |
| **Email** | `owner@dekoria.test` | Email login Owner |
| **Password** | `Dekoria123456` | Password awal (min. 12 karakter) |

3. Klik tombol **Buat akun Owner**.
4. **Expected UI**: Toast sukses muncul, sistem otomatis mengarahkan ke halaman login `/login`.
5. Login dengan email `owner@dekoria.test` dan password `Dekoria123456`.
6. **Expected Database Verification (Read-Only)**:
   - Tabel `users`: 1 record (`owner@dekoria.test`, role `OWNER`).
   - Tabel `expense_category`: 5 record kanonis (`MATERIAL`, `TUKANG`, `OPERASIONAL`, `LAIN_LAIN`, `SUBCON`).
   - Tabel `budget_allocation_setting`: 1 record default (Cap 90%, rasio 38/28/20/4/2, buffer 8%).

---

### A1. Onboarding Quick Start Owner v2

Setelah login pertama sebagai Owner, sistem otomatis mengarahkan ke alur `/onboarding`.

#### A1.1 Layar 1 — Pengenalan (Welcome)
- **Tampilan**: Ringkasan alur Quick Start v2 (estimasi 10–15 menit, tanpa pergerakan kas atau stok).
- **Aksi**: Klik tombol **Mulai quick start**.

#### A1.2 Layar 2 — Default Finansial (Financial Defaults)

Layar ini menentukan formula dan rasio anggaran yang otomatis diwarisi saat proyek baru dibuat:

1. **Verifikasi Metrik Komposisi Bawaan**:
   - Panel atas menampilkan tiga metrik utama:
     - **Internal**: `90%` (Batas pagu biaya internal perusahaan dari nilai kontrak).
     - **Terbagi**: `92%` (Total akumulasi alokasi 5 kategori pengeluaran).
     - **Buffer**: `8%` (Cadangan fleksibilitas Owner non-kategori pengeluaran).

2. **Menyesuaikan Komposisi Budget (Opsional / Verifikasi Mandiri)**:
   - Jika ingin memverifikasi atau mengubah rasio, klik tombol **Sesuaikan** di samping judul *Komposisi default*.
   - Sheet modal **Sesuaikan default budget** akan muncul. Pastikan atau ubah data form berikut:

| Nama Field UI | Nilai Input Siap Salin | Keterangan |
| :--- | :--- | :--- |
| **Nama Preset Formula** | `Standar Interior Dekoria` | Nama konfigurasi formula |
| **Batas Budget Internal (%)** | `90` | Target Gross Margin otomatis 10% |
| **Catatan Formula** (opsional) | `Default alokasi anggaran fit-out interior Dekoria.` | Catatan kebijakan anggaran |

   - Pada bagian **Alokasi 5 Kategori Pengeluaran**, pastikan switch seluruh kategori dalam posisi **Aktif (ON)** dan masukkan persentase berikut:

| No | Nama Kategori | Kode Kanonis | Status Switch | Input Rasio (%) | Plafon Nominal (Basis Kontrak Rp50jt / Budget Rp45jt) |
| :- | :--- | :--- | :---: | :---: | :---: |
| 1  | `Material` | `MATERIAL` | Aktif (ON) | `38` | `Rp17.100.000` |
| 2  | `Tukang` | `TUKANG` | Aktif (ON) | `28` | `Rp12.600.000` |
| 3  | `Subcon` | `SUBCON` | Aktif (ON) | `20` | `Rp9.000.000` |
| 4  | `Operasional`| `OPERASIONAL`| Aktif (ON) | `4` | `Rp1.800.000` |
| 5  | `Lain-lain` | `LAIN_LAIN` | Aktif (ON) | `2` | `Rp900.000` |
|    | **Total Teralokasi** | | | **92%** | **Rp41.400.000** |
|    | **Buffer Cadangan** | | | **8%** | **Rp3.600.000** |

   - Bilah mengambang (*sticky save bar*) di bawah akan memvalidasi status: `Teralokasi 92% · Buffer 8% · 90% Cap`.
   - Klik tombol **Simpan Perubahan Budget**. Toast sukses muncul dan sheet tertutup.

3. **Lanjut ke Layar Proyek Pertama**:
   - Klik tombol utama **Gunakan default ini** di bagian bawah layar untuk melanjutkan ke Layar 3.

#### A1.3 Layar 3 — Project Pertama (First Project)
- **Tampilan**: Form penyusunan proyek perdana.
- **Input Data Form**:

| Nama Field UI | Pilihan / Nilai Input Siap Salin | Keterangan |
| :--- | :--- | :--- |
| **Nama project** | `Fit-Out Interior Studio Bassura City — Unit 18B` | Nama proyek studi kasus |
| **Sumber data klien** | Klik tab **Klien baru** | Membuat kontak klien baru |
| **Nama klien baru** | `Bpk. Hendra Gunawan` | Nama klien |
| **Project Manager** | `Belum ditugaskan` | Biarkan default, akan di-assign di B1 |
| **Nilai project** | `50000000` | Nilai kontrak Rp50.000.000 |
| **RAB disetujui** | `50000000` | Mengikuti nilai kontrak Rp50.000.000 |

- **Preview Otomatis**:
  - Budget Internal (Cap 90%): `Rp45.000.000`
  - Target Gross Margin (10%): `Rp5.000.000`
  - Material (38%): `Rp17.100.000` | Tukang (28%): `Rp12.600.000` | Subcon (20%): `Rp9.000.000` | Operasional (4%): `Rp1.800.000` | Lain-lain (2%): `Rp900.000` | Buffer (8%): `Rp3.600.000`
- **Aksi**: Klik tombol **Buat project Draft**.

#### A1.4 Layar 4 — Sukses & Navigasi
- **Tampilan**: Kartu proyek Draft berhasil terbentuk secara atomik.
- **Aksi**: Klik tombol **Lihat kesiapan operasional** (mengarahkan ke `/settings?tab=readiness`).

---

### A2. Kesiapan Operasional (`/settings?tab=readiness`)

Eksekusi 5 langkah berikut secara berurutan agar seluruh dependensi data terpenuhi sempurna.

#### A2.1 Buat Akun Tim Inti
Buka **Pengaturan → Organisasi** (`/settings?tab=organization`), pastikan tab **Tim** (`admin=USERS`) aktif. Klik tombol **Tambah Pengguna** dan daftarkan 3 akun berikut:

| No | Nama | Email | Role | Password Sementara |
| :- | :--- | :--- | :--- | :--- |
| 1  | `Finance UAT` | `finance@dekoria.test` | `Finance Admin` | `Dekoria123456` |
| 2  | `PM UAT Budi` | `pm@dekoria.test` | `Project Manager` | `Dekoria123456` |
| 3  | `Purchasing UAT` | `purchasing@dekoria.test` | `Purchasing` | `Dekoria123456` |

*Expected State*: Total 4 user aktif di sistem (Owner + 3 Staff).

#### A2.2 Tambah Rekening Perusahaan & Saldo Awal Kas
Buka **Dashboard → Rekening** (`/ledger?tab=accounts`). Klik tombol **+ Tambah Rekening** dan daftarkan 2 rekening berikut:

**Rekening 1 (Bank Utama Operasional):**
- **Nama Rekening**: `BCA Operasional Dekoria`
- **Bank**: `BCA`
- **Nomor Rekening**: `8889991122`
- **Nama Pemegang**: `PT Dekoria Desain Estetika`
- **Saldo Awal**: `150000000` (Rp150.000.000)
- **Warna / Gaya Kartu**: `BCA Night`

**Rekening 2 (Kas Kecil Lapangan):**
- **Nama Rekening**: `Kas Kecil Lapangan / Workshop`
- **Bank**: `Kas`
- **Nomor Rekening**: `0000000001`
- **Nama Pemegang**: `PM UAT Budi`
- **Saldo Awal**: `15000000` (Rp15.000.000)
- **Warna / Gaya Kartu**: `Cash Mint`

*Expected State*: Total kas tercatat **Rp165.000.000** di `/ledger`. Dua record `opening_balance` terbentuk di tabel `cash_transaction`.

#### A2.3 Daftarkan Master Vendor Partner
Buka **Pengaturan → Organisasi** (`/settings?tab=organization`), klik tab **Vendor** (`admin=VENDORS`). Klik tombol **Tambah Vendor** dan daftarkan 3 vendor berikut:

| No | Nama Vendor | Telepon | Email | Alamat | Bank | No. Rekening | Pemegang Rekening |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1  | `PT Sumber Abadi Panel & HPL` | `081288991100` | `sales@sumberabadi.co.id` | `Jl. Raya Industri No. 45, Cikarang Barat, Bekasi` | `BCA` | `8880001100` | `PT Sumber Abadi` |
| 2  | `CV Marmer Indah Sentosa` | `081399882233` | `order@marmerindah.test` | `Sentra Marmer Blok C No. 12, Jakarta Timur` | `Mandiri` | `1220009988` | `CV Marmer Indah` |
| 3  | `PT Kaca Nusantara Prima` | `081177663344` | `proyek@kacaprima.test` | `Kawasan Pluit Blok D No. 8, Jakarta Utara` | `BCA` | `8880002200` | `PT Kaca Nusantara` |

*Expected State*: 3 vendor terdaftar dan siap dipilih pada form pengadaan dan subcon.

#### A2.4 Siapkan Lokasi Gudang & 6 Material Master
Buka **Pengaturan → Katalog** (`/settings?tab=catalog`):

1. **Buat Lokasi Penyimpanan**:
   - Klik subtab **Lokasi** (`catalog=locations`).
   - Klik tombol **Tambah Lokasi** (atau **Buat lokasi gudang pertama**).
   - **Nama Lokasi**: `Workshop & Gudang Cikarang`. Klik **Simpan**.

2. **Daftarkan 6 Material Master**:
   - Klik subtab **Material** (`catalog=materials`).
   - Klik tombol **Tambah Material** untuk masing-masing baris pada tabel di bawah.
   - Buka bagian **Detail material** (opsional) untuk memasukkan Merek, Kode, Warna, Vendor default, dan Spesifikasi:

| No | Kategori | Nama Material | Satuan | Merek | Kode | Warna | Vendor Default | Spesifikasi | Lokasi | Min Stok | Harga Acuan |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| 1 | `Panel Kayu` | `Multipleks Palm 18mm` | `lembar` | `Palm` | `PLY-18-PLM` | `Natural Wood` | `PT Sumber Abadi Panel & HPL` | `Panel multipleks 1220 x 2440 x 18 mm, grade interior.` | `Workshop & Gudang Cikarang` | `5` | `260000` |
| 2 | `Finishing & Laminate` | `HPL Taco Woodgrain TH-1218FC` | `lembar` | `Taco` | `HPL-TH1218FC` | `Warm Teak` | `PT Sumber Abadi Panel & HPL` | `HPL 0.7mm tekstur woodgrain matte.` | `Workshop & Gudang Cikarang` | `3` | `195000` |
| 3 | `Perekat & Kimia` | `Lem Kuning Aica Aibon 2.5 kg Kaleng` | `kaleng` | `Aica Aibon` | `GLU-AIB-25K` | `Kuning` | `PT Sumber Abadi Panel & HPL` | `Lem kontak solvent kaleng 2.5 kg.` | `Workshop & Gudang Cikarang` | `2` | `145000` |
| 4 | `Finishing & Laminate` | `Edging PVC Taco 22x1mm Woodgrain (50m)` | `roll` | `Taco` | `EDG-TC-2201` | `Warm Teak` | `PT Sumber Abadi Panel & HPL` | `Edging PVC lebar 22mm tebal 1mm rol 50m.` | `Workshop & Gudang Cikarang` | `1` | `110000` |
| 5 | `Hardware & Fitting` | `Engsel Sendok Slow-Motion Huben` | `pasang` | `Huben` | `HNG-SM-HBN` | `Nickel Chrome` | `PT Sumber Abadi Panel & HPL` | `Engsel sendok lurus soft-closing hidrolik 35mm.` | `Workshop & Gudang Cikarang` | `10` | `25000` |
| 6 | `Hardware & Fitting` | `Rel Laci Double Extension 40cm Huben` | `set` | `Huben` | `RLL-DX-40CM` | `Hitam` | `PT Sumber Abadi Panel & HPL` | `Rel laci ball bearing double extension 40cm max 30kg.` | `Workshop & Gudang Cikarang` | `4` | `55000` |

#### A2.5 Keputusan Saldo Awal Stok Fisik (Maker-Checker Flow)
Buka **Pengaturan → Kesiapan** lalu klik kartu **Saldo awal stok** (`/settings?tab=readiness&flow=initial-stock`):

1. **Maker (Owner atau Purchasing UAT)**:
   - Klik kartu opsi: **Ada stok lama** (membuka sheet modal *Catat saldo awal stok lama*).
   - Pastikan tab metode yang aktif adalah **Isi manual**.
   - Lengkapi bagian **Sumber saldo**:

| Nama Field UI | Tipe Kontrol | Nilai Input Siap Salin | Keterangan |
| :--- | :--- | :--- | :--- |
| **Tanggal saldo awal** | Date Picker | Pilih tanggal `2026-08-15` (atau tanggal hari ini) | **Wajib diisi** (dasar cutover) |
| **Dokumen referensi** | Text Input | `BA-OPNAME-CKR-2026-08` | Opsional (nomor berita acara) |
| **Catatan sumber data**| Textarea | `Hasil hitung fisik opname gudang Cikarang per 15 Agustus 2026.` | **Wajib diisi** (minimal 10 karakter) |

   - Pada bagian **Daftar item stok fisik**, form awal menyediakan 1 baris (*Item stok 1*). Klik tombol **+ Tambah item stok lainnya** (atau tombol **Tambah item** di kanan atas) untuk menambahkan baris hingga terdapat 6 item.
   - Isi masing-masing baris item dengan data persis berikut:

| Baris Form | Field: Material & lokasi | Field: Jumlah fisik | Field: Harga pokok unit | Subtotal Otomatis |
| :--- | :--- | :---: | :---: | :---: |
| **Item stok 1** | `Multipleks Palm 18mm` · `Workshop & Gudang Cikarang` | `10` | `260000` | Rp2.600.000 |
| **Item stok 2** | `HPL Taco Woodgrain TH-1218FC` · `Workshop & Gudang Cikarang` | `4` | `195000` | Rp780.000 |
| **Item stok 3** | `Lem Kuning Aica Aibon 2.5 kg Kaleng` · `Workshop & Gudang Cikarang`| `3` | `145000` | Rp435.000 |
| **Item stok 4** | `Edging PVC Taco 22x1mm Woodgrain (50m)` · `Workshop & Gudang Cikarang` | `2` | `110000` | Rp220.000 |
| **Item stok 5** | `Engsel Sendok Slow-Motion Huben` · `Workshop & Gudang Cikarang` | `20` | `25000` | Rp500.000 |
| **Item stok 6** | `Rel Laci Double Extension 40cm Huben` · `Workshop & Gudang Cikarang` | `6` | `55000` | Rp330.000 |
| | **Total Saldo Awal (6 item siap diajukan)** | | | **Rp4.865.000** |

   - Periksa kartu ringkasan bawah: Total tertera **Rp4.865.000** (6 item siap diajukan).
   - Klik tombol utama: **Ajukan saldo awal**. Sheet tertutup, batch tercatat dengan status `PENDING_APPROVAL`.

2. **Checker (Finance Admin Review & Posting)**:
   - **Opsi A (Shortcut Cepat)**: Pada kartu batch `BA-OPNAME-CKR-2026-08` yang baru terbentuk di halaman Kesiapan, klik tombol **Simulasikan Finance Admin**.
   - **Opsi B (Manual Switcher)**: Buka `/profile`, pilih `Finance UAT`, klik **Mulai simulasi**, lalu buka URL `/onboarding/review`.
   - Pada form review batch, masukkan input wajib berikut:

| Nama Field UI | Nilai Input Siap Salin | Keterangan |
| :--- | :--- | :--- |
| **Alasan keputusan** | `Hasil hitung fisik gudang dan bukti opname telah diverifikasi.` | **Wajib diisi** (minimal 10 karakter) |

   - Klik tombol **Setujui & posting**.
   - Klik tombol **Kembali** pada banner simulasi developer di atas layar untuk kembali ke peran `Owner`.

*Expected State*:
- Stok fisik di `Workshop & Gudang Cikarang` terisi 6 material dengan total nilai inventory **Rp4.865.000**.
- Saldo rekening kas dan bank tetap utuh **Rp165.000.000** (pembentukan persediaan awal non-kas).
- Seluruh 4 fondasi kesiapan di `/settings?tab=readiness` kini berstatus **Siap**.

---

### A3. Developer Account Switcher (`/profile`)

1. Login sebagai `Owner`, buka menu **Profil** (`/profile`).
2. Pada kartu **Simulasi developer**, pilih salah satu staf:
   - `PM UAT Budi` (untuk menyusun RAP dan mengajukan nota operasional/kasbon).
   - `Finance UAT` (untuk verifikasi expense, jadwal bayar, pencairan kas, dan rekonsiliasi).
   - `Purchasing UAT` (untuk reservasi material, catat use/return/waste, dan penerimaan barang).
3. Klik tombol **Mulai simulasi**. Sistem langsung beralih peran tanpa perlu logout manual.
4. Klik tombol **Kembali** pada banner mengambang di atas layar untuk kembali ke peran Owner.

---

### A4. Post-Setup Consistency Check

Lakukan verifikasi cross-surface sebelum memulai operasional proyek:
1. **Dashboard `/ledger`**: Total kas tepat **Rp165.000.000**, Piutang = Rp0, Hutang = Rp0, Pending Approval = Rp0.
2. **Proyek `/projects`**: Proyek `Fit-Out Interior Studio Bassura City — Unit 18B` berstatus **DRAFT** (Kontrak Rp50jt, Budget Internal Rp45jt).
3. **Material `/materials`**: Total nilai inventory **Rp4.865.000** di `Workshop & Gudang Cikarang`.
4. **Pengaturan `/settings?tab=readiness`**: Keempat fondasi wajib berstatus **Siap**.

---

### A5. Role Boundary Smoke Test (Security Gate)

1. **PM Scoping Guard**: Switch ke `PM UAT Budi`, buka `/ledger`. Akses **wajib ditolak** (HTTP 403 / redirect ke `/projects`).
2. **Purchasing Boundary Guard**: Switch ke `Purchasing UAT`, buka `/expenses`. Saldo bank dan nama rekening disembunyikan. Buka `/settings/budget` → akses ditolak.
3. **Finance Admin Boundary Guard**: Switch ke `Finance UAT`, buka `/settings`. Tab manajemen tim disembunyikan.

---

## BAGIAN B — Eksekusi Proyek, Kontrol Material, Arus Kas & Closing

```
                        SIKLUS HIDUP PROYEK LENGKAP
 ┌────────────────────────────────────────────────────────────────────────┐
 │ B1. Scoping & Assign PM (PM UAT Budi ditugaskan ke Proyek)             │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ B2. Penyusunan Internal Plan di Tab RAP (Material, Tukang, Subcon)     │
 │     └─ Finalisasi RAP oleh Owner (Status RAP: LOCKED)                  │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ B3. Persetujuan RAB Klien di Tab RAB (RAB APPROVED -> Proyek ACTIVE)   │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ B4. Penagihan DP Klien di Tab Pembayaran (Invoice DP 50% -> Kas BCA)   │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ B5. Pengadaan Material (Reservasi Gudang + Bill Vendor + Disburse + GR)│
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ B6. Pemakaian Bahan Baku di Workshop (USE, RETURN, WASTE)              │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ B7. Upah & Kasbon Lapangan Tukang (Dicairkan dari Kas Kecil & BCA)     │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ B8. Tagihan Subcon & Biaya Operasional (Solid Surface, Kaca, Pickup)   │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ B9. Penagihan Termin 2 & Rekonsiliasi Bank BCA (/reconciliation)       │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ B10. Audit Posisi Finansial Tengah Proyek                              │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ B11. Change Order di Tab RAB (Add-on Meja Kerja +Rp6jt -> Rescale)     │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ B12. Serah Terima (BAST), Pelunasan & Project Closing di Tab Margin    │
 └────────────────────────────────────────────────────────────────────────┘
```

---

### B1. Assign Project Manager & Lengkapi Detail Proyek

1. Login / switch sebagai `Owner`, buka menu **Proyek** (`/projects`) lalu pilih `Fit-Out Interior Studio Bassura City — Unit 18B`.
2. Klik pill **+ Tugaskan PM** (atau buka menu **Edit Proyek**), masukkan data berikut:

| Nama Field UI | Nilai Input Siap Salin | Keterangan |
| :--- | :--- | :--- |
| **Project Manager** | `PM UAT Budi` | PM penanggung jawab |
| **Area** | `Kitchenette, Bedroom, Wardrobe` | Ruang lingkup kerja |
| **Tipe Proyek** | `Interior Fit-Out Apartemen` | Klasifikasi proyek |
| **Lokasi Proyek** | `Tower Cattleya Lt. 18 Unit 18B, Apartemen Bassura City, Jakarta Timur` | Alamat fisik site |

3. Klik tombol **Simpan**.
4. *Expected State*: Proyek tetap `DRAFT`. Switch ke `PM UAT Budi`, proyek Bassura City sekarang tampil di daftar proyek yang ditugaskan kepada PM.

---

### B2. Penyusunan Internal Plan (RAP) oleh Project Manager

Switch ke peran `PM UAT Budi`, buka proyek Bassura City lalu klik tab **RAP** (`/projects/[id]?tab=rap`). Klik tombol **Mulai Susun RAP**.

#### B2.1 Tahap 1 — Rencana Material RAP (6 Item)
Klik tombol **Tambah Material RAP** untuk masing-masing baris berikut:

| No | Material Master Dipilih | Area / Ruangan | Satuan | Nama Material | Jml Dibutuhkan | Buffer | Biaya per Satuan | Sumber Pemenuhan | Catatan Internal |
| :- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| 1  | `Multipleks Palm 18mm` | `Kitchenette & Wardrobe` | `lembar` | `Multipleks Palm 18mm` | `14` | `2` | `260000` | `STOCK_AND_PURCHASE` | `Bahan bodi kabinet atas & bawah` |
| 2  | `HPL Taco Woodgrain TH-1218FC` | `Finishing Luar Kabinet` | `lembar` | `HPL Taco Woodgrain TH-1218FC` | `6` | `1` | `195000` | `STOCK_AND_PURCHASE` | `Finishing pintu dan ambalan` |
| 3  | `Lem Kuning Aica Aibon 2.5 kg Kaleng` | `Laminasi HPL` | `kaleng` | `Lem Kuning Aica Aibon 2.5 kg` | `4` | `0` | `145000` | `PURCHASE` | `Pengeleman HPL ke multipleks` |
| 4  | `Edging PVC Taco 22x1mm Woodgrain (50m)` | `Edging Pintu Kabinet` | `roll` | `Edging PVC Taco 22x1mm` | `3` | `0` | `110000` | `PURCHASE` | `Edging pinggiran pintu & laci` |
| 5  | `Engsel Sendok Slow-Motion Huben` | `Fitting & Hardware` | `pasang` | `Engsel Slow-Motion Huben` | `20` | `0` | `25000` | `STOCK` | `Engsel pintu kabinet kitchen & lemari` |
| 6  | `Rel Laci Double Extension 40cm Huben` | `Fitting & Hardware` | `set` | `Rel Laci 40cm Huben` | `6` | `0` | `55000` | `STOCK` | `Rel laci kitchen set & nakas` |

*Subtotal Material RAP*: **Rp7.265.000** (Total qty multipleks: 16 lbr, HPL: 7 lbr).

#### B2.2 Tahap 2 — Rencana Paket Tukang (1 Paket)
Klik tombol **Lanjut ke Tukang**, lalu klik **Tambah Paket Kerja**:

| Nama Field UI | Nilai Input Siap Salin | Keterangan |
| :--- | :--- | :--- |
| **Kategori Budget** | `Tukang` | Kategori penyerapan |
| **Area / Lingkup** | `Workshop & Site Bassura` | Lokasi kerja |
| **Nama Paket** | `Paket Pembuatan & Perakitan Interior Studio` | Nama lingkup upah |
| **Lingkup Pekerjaan** | `Pemotongan bahan, perakitan kabinet, pengeleman HPL, dan instalasi di site.` | Detail deskripsi |
| **Jumlah** | `1` | Satuan paket |
| **Satuan** | `paket` | Satuan pengukuran |
| **Biaya per Satuan** | `10000000` (Rp10.000.000) | Biaya total upah |
| **Catatan Internal** | `Mandor Bpk. Slamet (5 tukang kayu & 2 tukang finishing).` | Info tim lapangan |

*Subtotal Tukang RAP*: **Rp10.000.000**.

#### B2.3 Tahap 3 — Rencana Paket Subcon (2 Paket)
Klik tombol **Lanjut ke Subcon**, lalu daftarkan 2 paket vendor spesialis berikut:

**Paket Subcon 1 (Top Table Solid Surface):**
- **Kategori Budget**: `Subcon`
- **Area / Lingkup**: `Kitchenette`
- **Vendor**: `CV Marmer Indah Sentosa`
- **Nama Paket**: `Paket Top Table Solid Surface`
- **Lingkup Pekerjaan**: `Fabrikasi & pasang top table solid surface 1.8m + sink cut-out.`
- **Jumlah / Satuan**: `1` / `paket`
- **Biaya per Satuan**: `5500000` (Rp5.500.000)

**Paket Subcon 2 (Cermin Grey Mirror & Backsplash):**
- **Kategori Budget**: `Subcon`
- **Area / Lingkup**: `Wardrobe & Kitchenette`
- **Vendor**: `PT Kaca Nusantara Prima`
- **Nama Paket**: `Paket Cermin Grey Mirror & Backsplash`
- **Lingkup Pekerjaan**: `Pasang cermin grey mirror wardrobe & backsplash tempered 5mm.`
- **Jumlah / Satuan**: `1` / `paket`
- **Biaya per Satuan**: `2500000` (Rp2.500.000)

*Subtotal Subcon RAP*: **Rp8.000.000**.  
*Total Rencana Biaya RAP (Cost Baseline)*: Rp7.265.000 + Rp10.000.000 + Rp8.000.000 = **Rp25.265.000**.

#### B2.4 Finalisasi RAP oleh Owner
1. Switch peran ke `Owner`, buka proyek Bassura City → tab **RAP** (`/projects/[id]?tab=rap`).
2. Klik tombol **Finalisasi RAP**.
3. *Expected State*: Status RAP berubah menjadi `LOCKED` (`project_rap.status = 'LOCKED'`). Item RAP tidak dapat diubah tanpa revisi resmi.

---

### B3. Persetujuan RAB Klien & Aktivasi Baseline Finansial

1. Masih sebagai `Owner`, buka tab **RAB** pada proyek Bassura City (`/projects/[id]?tab=rab`).
2. Klik tombol **Pilih Sumber RAB** (atau **Generate dari RAP**).
3. Centang seluruh item sumber: 6 item Material RAP, 1 Paket Tukang, dan 2 Paket Subcon (Porsi Produksi Fisik = **Rp28.070.000**).
4. Aktifkan switch **Tambah baris manual untuk klien**, lalu masukkan data komersial berikut untuk menggenapkan total penawaran klien menjadi tepat Rp50.000.000:

| Nama Field UI | Nilai Input Siap Salin | Keterangan |
| :--- | :--- | :--- |
| **Sifat Komponen** | `Jasa Desain & Manajemen Fee` (`SERVICE_FEE`) | **PENTING (Cara A)**: Menjaga agar fee desain tidak memotong/menggelembungkan plafon fisik lapangan |
| **Nama baris manual** | `Jasa Desain 3D, Shop Drawing, Supervisi & Manajemen Proyek` | Baris jasa komersial |
| **Deskripsi untuk klien**| `Perencanaan desain 3D photorealistic, gambar kerja workshop, supervisi lapangan, dan manajemen proyek interior.` | Deskripsi proposal |
| **Jumlah** | `1` | Unit paket |
| **Satuan** | `ls` | Satuan lumpsum |
| **Harga satuan klien** | `21930000` (Rp21.930.000) | Penyeimbang ke Rp50jt (Porsi Jasa & Fee) |

5. Klik tombol **Buat**. Total nilai draft penawaran RAB Klien bernilai tepat **Rp50.000.000**.
6. Pada panel ringkasan atas, perhatikan indikator pemisahan visual:
   - Kartu rincian: `Porsi Fisik/Produksi: Rp 28,07 jt` dan `Jasa Desain & Fee: Rp 21,93 jt`.
   - Indikator dual margin: `Margin Fisik: 10.0%` dan `Margin Total: 49.5%`.
   - Baris item manual memiliki badge ungu `Jasa & Fee` dan icon `design_services`.
7. Pada panel aksi draft RAB di bawah, klik tombol **Tinjau & Setujui RAB**.

*Expected Atomic Changes (Derivasi Bersih Cara A)*:
- `rab_estimate.status` = `APPROVED` (Approved Value: Rp50.000.000).
- `project.status` = `ACTIVE`.
- `project_budgets.internal_budget` terkunci pada **Rp25.265.000** (Cap 90% hanya atas porsi produksi fisik Rp28.070.000, bukan Rp45.000.000).
- `project_budgets.target_gross_amount` = **Rp24.735.000** (Target Gross Margin 49,47% ~ 49,5%).
- Plafon kategori fisik aktif: Material Rp9.600.700, Tukang Rp7.074.200, Subcon Rp5.053.000, Operasional Rp1.010.600, Lain-lain Rp505.300, Buffer Rp2.021.200.
- Tidak ada mutasi kas riil pada tahap ini.

*Visualisasi Verifikasi di Tab Ikhtisar (`?tab=overview`)*:
- **Hero Card "Sisa Budget Internal"**:
  - Format angka `fullDynamic` 2 baris terpisah:
    - **Baris 1 (2 Kolom)**: `Nilai proyek: Rp 50.000.000` dan `Budget: Rp 25.265.000`.
    - **Baris 2 (Full Width)**: `Realisasi: Rp 0`.
  - **Dual Margin View**:
    - `Margin Murni Produksi`: **Rp 2.805.000** (dengan angka `10,0%` subtle di bawah nominal).
    - `Margin Total Proyek`: **Rp 24.735.000** (dengan angka `49,5%` subtle di bawah nominal).

---

### B4. Penagihan DP Klien (Termin 1) & Penerimaan Kas

#### B4.1 Buat Invoice DP 50% (Smart Auto-Generated)
Switch ke `Finance UAT`, buka proyek Bassura City → tab **Pembayaran** (`/projects/[id]?tab=payments`) → klik tombol **+ Invoice**.

Form pembuatan invoice dilengkapi **Smart Auto-Fill (Opsi 1)** yang otomatis membaca konteks proyek:
1. **Konteks Kontrak Proyek**: Panel atas menampilkan ringkasan langsung: `BSR` · Kontrak Rp 50 jt · Sudah Ditagih Rp 0 · Sisa Rp 50 jt.
2. **Saran Isian Otomatis (Prefill)**:
   - **Nomor Invoice**: Terisi otomatis kanonis `INV/2026/09/BSR-001` (dapat diedit manual jika diperlukan).
   - **Tahap Tagihan**: Otomatis terpilih `Uang Muka` (`DP`).
   - **Nominal Tagihan**: Otomatis terisi `25000000` (Rp25.000.000, tepat 50% dari nilai kontrak Rp50jt).
   - **Pilihan Termin Cepat**: Chip `[50% DP]` aktif. Tombol `[30% Progress]`, `[20% Pelunasan]`, dan `[Sisa Tagihan]` tersedia untuk mengubah termin dan kalkulasi instan dengan satu klik.
   - **Jatuh Tempo**: Otomatis terisi tanggal 7 hari ke depan.
   - **Catatan Invoice**: Otomatis terisi `Pembayaran Uang Muka (DP 50%) pekerjaan fit-out interior.`

3. Klik tombol **Tinjau** $\rightarrow$ periksa ringkasan invoice $\rightarrow$ klik **Buat**.
4. Status invoice menjadi `UNPAID` (Piutang proyek = Rp25.000.000, Kas belum bertambah).

#### B4.2 Catat Pembayaran DP Masuk ke Rekening BCA
Buka invoice `INV/2026/09/BSR-001` tersebut lalu klik tombol **Catat Pembayaran** pada footer detail (atau klik langsung tombol **Catat bayar** pada kartu invoice di daftar). Sheet drawer **Penerimaan kas termin** akan terbuka:

| Bagian Form | Nama Field UI | Nilai Input Siap Salin | Keterangan |
| :--- | :--- | :--- | :--- |
| **Dana masuk** | **Rekening Penerima Dana (DEBIT)** | `BCA - BCA Operasional Dekoria` | Rekening tujuan dana (saldo bertambah) |
| | **Nominal Diterima** | `25000000` (Rp25.000.000) | Pelunasan penuh nilai DP 50% |
| **Referensi transaksi** | **Nomor Referensi Bukti Transfer** | `TRF-BCA-HENDRA-DP` | Bukti mutasi transfer klien |
| | **Tanggal Transaksi Diterima** | `<hari ini>` | Tanggal mutasi bank |

Klik tombol **Tinjau** → layar berganti ke mode **Tinjau penerimaan klien** → periksa kartu dampak saldo rekening (`Rp 150.000.000 → Rp 175.000.000`) → klik tombol **Catat**.

*Expected Finansial & Invariant*:
- Status invoice: `PAID` (Piutang proyek kembali ke Rp0).
- Saldo `BCA Operasional Dekoria`: **Rp150.000.000 → Rp175.000.000**.
- Total Kas Perusahaan: **Rp190.000.000** (BCA Rp175jt + Kas Kecil Rp15jt).
- Record `cash_transaction` (`INFLOW`, Rp25.000.000, `reconciled = false`).

---

### B5. Pengadaan Material: Reservasi Gudang, Tagihan Vendor & Goods Receipt

#### B5.1 Reservasi Stok Gudang yang Sudah Tersedia
Login / Switch ke `Purchasing UAT` (`purchasing@dekoria.test` / `Dekoria123456`), lalu buka modul **Material** (`/materials`):

> **Catatan Operasional Purchasing:** Sebagai fungsi terpusat (*Shared Services*), Purchasing mengelola stok gudang lintas proyek dari modul `/materials` tanpa perlu membuka halaman proyek. Pemilihan proyek dilakukan langsung di dalam formulir transaksi material.

1. **Reservasi Item 1 (Multipleks Palm 18mm)**:
   - Klik tombol **+** (FAB) di pojok kanan bawah layar → pilih **Reservasi Material** (atau akses URL `/materials?action=RESERVE`).
   - Lengkapi formulir reservasi:

| Bagian Form | Nama Field UI | Nilai Input Siap Salin | Keterangan |
| :--- | :--- | :--- | :--- |
| **Proyek dan material** | **Proyek** | `Fit-Out Interior Studio Bassura City — Unit 18B` | Proyek alokasi |
| | **RAP material** | `Multipleks Palm 18mm · Kitchenette & Wardrobe` | Kebutuhan RAP Bassura |
| | **Lokasi inventori** | `Workshop & Gudang Cikarang` | Gudang asal stok |
| **Jumlah dan catatan** | **Jumlah (lembar)** | `8` | 8 lembar |
| | **Catatan reservasi** | `Disiapkan untuk kabinet interior studio Bassura Unit 18B.` | Minimal 3 karakter |

   - Klik **Tinjau** → periksa ringkasan dampak stok pada kartu preview → klik **Catat**.
   - *Status item di gudang*: Stok fisik 10, tereservasi 8, tersedia bebas 2 lembar.

2. **Reservasi Item 2 (HPL Taco Woodgrain TH-1218FC)**:
   - Klik kembali tombol **+** (FAB) di pojok kanan bawah → pilih **Reservasi Material**.
   - Lengkapi formulir reservasi:

| Bagian Form | Nama Field UI | Nilai Input Siap Salin | Keterangan |
| :--- | :--- | :--- | :--- |
| **Proyek dan material** | **Proyek** | `Fit-Out Interior Studio Bassura City — Unit 18B` | Proyek alokasi |
| | **RAP material** | `HPL Taco Woodgrain TH-1218FC · Finishing Luar Kabinet` | Kebutuhan RAP Bassura |
| | **Lokasi inventori** | `Workshop & Gudang Cikarang` | Gudang asal stok |
| **Jumlah dan catatan** | **Jumlah (lembar)** | `3` | 3 lembar |
| | **Catatan reservasi** | `Disiapkan untuk laminasi kabinet studio Bassura Unit 18B.` | Minimal 3 karakter |

   - Klik **Tinjau** → klik **Catat**.
   - *Status item di gudang*: Stok fisik 4, tereservasi 3, tersedia bebas 1 lembar.

*Expected Invariant*: Stok fisik tetap di rak gudang Cikarang. Stok tereservasi bertambah. Kas dan Material Actual tetap Rp0.

#### B5.2 Buat Tagihan Vendor Pengadaan Material Tambahan
Switch ke `PM UAT Budi`, buka modul **Pengeluaran** (`/expenses`) → klik tab **Tagihan Vendor** (`?view=vendor-bills`) → klik tombol **+ Buat Tagihan** (atau FAB **Tagihan Vendor**, URL `/expenses?new-vendor-bill=true`). Sheet **Tagihan vendor baru** akan terbuka:

| Bagian Form | Nama Field UI | Nilai Input Siap Salin | Keterangan |
| :--- | :--- | :--- | :--- |
| **Vendor dan proyek** | **Vendor** | `PT Sumber Abadi Panel & HPL` | Pemasok panel & laminate |
| | **Proyek** | `Fit-Out Interior Studio Bassura City — Unit 18B` | Pembebanan proyek |
| | **Kategori Budget** | `Material` | Kategori pagu budget |
| **Dokumen tagihan** | **Nomor Tagihan** | `INV-SA-2026-8891` | No faktur fisik dari vendor |
| | **Nominal Tagihan** | `8500000` (Rp8.500.000) | Multipleks 8 lbr, HPL 4 lbr, lem & hardware |
| | **Tanggal Jatuh Tempo** | `<hari ini + 14 hari>` | Tempo pembayaran |
| | **Catatan** | `Pengadaan multipleks 8 lbr, HPL 4 lbr, lem & hardware fitting.` | Uraian pesanan |

Klik tombol **Tinjau** di bawah sheet → periksa rincian pada sheet **Tinjau tagihan vendor** (notice: *"Menjadi nilai persediaan"* menunjukkan pembelian material menambah persediaan dan hutang vendor, bukan pemakaian langsung proyek) → klik tombol **Buat**.

Status tagihan: `UNPAID` (Hutang vendor = Rp8.500.000, Kas belum berkurang).

#### B5.3 Penjadwalan Bayar, Approval High-Risk & Pencairan Dana
1. Switch ke `Finance UAT`, buka modul `/expenses` tab **Tagihan Vendor** (`?view=vendor-bills`):
   - Klik kartu tagihan `INV-SA-2026-8891` → pada drawer detail klik tombol **Jadwalkan Bayar**.
   - Sheet **Jadwalkan pembayaran vendor** terbuka:
     - **Rekening Rencana**: Pilih `BCA - BCA Operasional Dekoria`
     - **Tanggal Pembayaran**: `<hari ini>`
     - **Nominal Pembayaran**: `8500000` (Rp8.500.000)
   - Klik tombol **Tinjau** → periksa notice: *"Memerlukan persetujuan Owner"* (karena nominal Rp8.500.000 >= ambang persetujuan Owner Rp5.000.000) → klik tombol **Jadwalkan**.
   - Status pembayaran di subtab **Rencana Bayar** menjadi **Menunggu Owner** (`approvalStatus: PENDING`).
2. Switch ke `Owner`, buka menu **Persetujuan** (`/approvals`):
   - Temukan pengajuan pembayaran tagihan `PT Sumber Abadi Panel & HPL` sebesar Rp8.500.000.
   - Klik tombol **Setujui**. Status approval berubah menjadi `APPROVED`.
3. Switch kembali ke `Finance UAT`, buka `/expenses` tab **Tagihan Vendor** → subtab **Rencana Bayar**:
   - Status kartu pembayaran PT Sumber Abadi kini berubah menjadi **Siap Cair**.
   - Klik kartu pembayaran tersebut → pada drawer detail klik tombol **Cairkan**.
   - Sheet **Cairkan pembayaran vendor** terbuka:
     - **Rekening Sumber Dana**: Pilih `BCA - BCA Operasional Dekoria`
     - **Nomor Referensi Bukti Transfer**: Ketik `TRF-BCA-VND-SA01`
   - Klik tombol **Tinjau** → layar menampilkan rincian dampak kas (`Rp 175.000.000 → Rp 166.500.000`) dan notice *"Transaksi kas final"* → klik tombol **Bayar**.

*Expected Finansial*:
- Saldo `BCA Operasional Dekoria`: **Rp175.000.000 → Rp166.500.000**.
- Saldo `Kas Kecil Lapangan / Workshop`: **Rp15.000.000** (belum terpakai).
- Total **Kas Tersedia** (Hero Dashboard Finansial): **Rp181.500.000** (Rp166.500.000 BCA + Rp15.000.000 Kas Kecil).
- Material Paid bertambah **Rp8.500.000**.
- Tagihan vendor: `PAID` (Hutang = Rp0).
- **Material Actual tetap Rp0** (pembelian material adalah persediaan, bukan realisasi biaya konsumsi proyek).

#### B5.4 Catat Penerimaan Barang Fisik (Goods Receipt)
Barang fisik pesanan tiba di gudang. Switch ke `Purchasing UAT`, buka modul **Material** (`/materials`):
1. Di pojok kanan bawah, klik tombol **+** (FAB) → pilih menu **Terima Barang** (atau akses langsung URL `/materials?action=RECEIVE`). Sheet drawer **Penerimaan Barang** akan terbuka.
2. Lengkapi data pada bagian **Sumber & Lokasi**:
   - **Tagihan vendor**: Pilih opsi `INV-SA-2026-8891` (menampilkan label `INV-SA-2026-8891` · `PT Sumber Abadi Panel & HPL · Rp 8.500.000` dengan badge `Lunas` di bawah grup proyek Bassura).
   - **Project**: Otomatis terisi `Fit-Out Interior Studio Bassura City — Unit 18B` dari tagihan vendor terpilih.
   - **Lokasi inventori**: Pastikan terpilih `Workshop & Gudang Cikarang`.
   > **Notifikasi Prefill Sistem**: Di bawah section Sumber & Lokasi akan muncul banner konteks bernada peringatan (amber):
   > *"Project, nominal, dan catatan sudah diprefill. Pilih material yang benar sebelum posting."*
   > Kartu akordion pertama (`Material 1`) pada bagian *Material diterima* otomatis dibuka dengan status awal `Lengkapi` (ikon kotak inventori oranye).
3. Bagian **Dokumen Penerimaan**:
   - **Nomor penerimaan**: Input teks (sistem otomatis menyediakan default nomor acak seperti `GR/2026/...`, biarkan atau ubah/salin: `GR-CKR-2026-001`).
   - **Tanggal diterima**: Tanggal hari ini (`<hari ini>`).
   - **Catatan penerimaan**: Terisi otomatis dari tagihan vendor: `Tagihan INV-SA-2026-8891 · Pengadaan multipleks 8 lbr, HPL 4 lbr, lem & hardware fitting.` (dapat disesuaikan jika perlu).
4. Bagian **Material diterima**:
   Form ini menggunakan daftar kartu akordion per item dengan indikator status real-time (`Lengkapi` / `Lengkap`) dan subtotal otomatis. Di dalam setiap kartu yang terbuka tersedia tombol kontrol **Duplikat** dan **Hapus** (aktif bila item > 1). Gunakan tombol **Tambah Material** di bawah daftar untuk menambahkan baris item baru:

   - **Item 1** (Kartu akordion `Material 1` yang sedang terbuka):
     - **Material**: Pilih `Multipleks Palm 18mm` (Satuan lembar).
     - **Tautan RAP**: Pilih `Multipleks Palm 18mm · Kitchenette & Wardrobe`. (Perhatian: Memilih tautan RAP otomatis mengisikan kuota total RAP 16 lembar dan harga estimasi Rp260.000 ke dalam form).
     - **Jumlah (lembar)**: Gunakan stepper atau ketik langsung, ubah nilai `16` menjadi `8` (karena dari 16 lembar total kebutuhan RAP, 8 lembar dipenuhi oleh pengadaan baru ini, dan 8 lembar sisanya telah direservasi dari stok lama gudang di B5.1).
     - **Harga per unit**: Pastikan bernilai `260000` (Rp260.000).
     - **Catatan item** (opsional): Kosongkan atau beri catatan spesifik.
     - Subtotal kartu menjadi **Rp2.080.000** dan status kartu berubah menjadi `Lengkap` (ikon centang hijau).

   - Klik tombol **Tambah Material** di bawah daftar untuk membuka **Item 2**:
     - **Material**: Pilih `HPL Taco Woodgrain TH-1218FC` (Satuan lembar).
     - **Tautan RAP**: Pilih `HPL Taco Woodgrain TH-1218FC · Finishing Luar Kabinet`. (Kuota RAP 7 lembar terisi otomatis).
     - **Jumlah (lembar)**: Ubah nilai `7` menjadi `4` (karena 3 lembar sudah direservasi di B5.1, dan 4 lembar dipenuhi dari penerimaan fisik ini).
     - **Harga per unit**: `195000` (Rp195.000).
     - Subtotal kartu: **Rp780.000** (status kartu berubah menjadi `Lengkap`).

   - Klik tombol **Tambah Material** untuk membuka **Item 3**:
     - **Material**: Pilih `Lem Kuning Aica Aibon 2.5 kg Kaleng` (Satuan kaleng).
     - **Tautan RAP**: Pilih `Lem Kuning Aica Aibon 2.5 kg · Laminasi HPL`. (Kuota RAP 4 kaleng terisi otomatis).
     - **Jumlah (kaleng)**: Ubah nilai `4` menjadi `2` (pengadaan tagihan ini untuk 2 kaleng, 3 kaleng sudah tersedia di gudang).
     - **Harga per unit**: `145000` (Rp145.000).
     - Subtotal kartu: **Rp290.000** (status kartu berubah menjadi `Lengkap`).

   - Klik tombol **Tambah Material** untuk membuka **Item 4**:
     - **Material**: Pilih `Edging PVC Taco 22x1mm Woodgrain (50m)` (Satuan roll).
     - **Tautan RAP**: Pilih `Edging PVC Taco 22x1mm · Edging Pintu Kabinet`. (Kuota RAP 3 roll terisi otomatis).
     - **Jumlah (roll)**: Ubah nilai `3` menjadi `2`.
     - **Harga per unit**: `110000` (Rp110.000).
     - Subtotal kartu: **Rp220.000** (status kartu berubah menjadi `Lengkap`).

   - Ringkasan total *Material diterima* di kanan atas: **Rp3.370.000**.
5. Klik tombol **Tinjau** di bawah sheet:
   - Layar berganti ke mode **Tinjau Penerimaan Barang**.
   - Periksa ringkasan proyek, gudang, nomor dokumen, tagihan vendor referensi, total Rp3.370.000, dan 4 kartu dampak perubahan stok (*Stock Impact Rows*):
     - Multipleks Palm 18mm: Fisik sebelum 10 + 8 = 18 lembar (reservasi 8).
     - HPL Taco Woodgrain: Fisik sebelum 4 + 4 = 8 lembar (reservasi 3).
     - Lem Kuning Aica: Fisik sebelum 3 + 2 = 5 kaleng.
     - Edging PVC Taco: Fisik sebelum 2 + 2 = 4 roll.
   - Banner risiko muncul: *"Posting mengubah stok — Harga rata-rata bergerak dan stok fisik langsung bertambah."*
6. Klik tombol **Posting**.
   - Sistem memvalidasi atomik dan menampilkan dialog sukses: *"Penerimaan barang berhasil — Stok, harga rata-rata, movement, dan audit trail telah diperbarui dalam satu transaksi."*
   - Klik **Tutup** (atau di luar modal).

*Expected Inventori & Invariant*:
- Stok fisik Multipleks di Cikarang bertambah dari 10 → 18 lembar.
- Stok fisik HPL bertambah dari 4 → 8 lembar.
- Seluruh kebutuhan pengadaan proyek (*Need to Buy*) terpenuhi 100%.
- **Saldo kas tidak berubah** (Goods Receipt adalah mutasi fisik inventori non-kas).

---

### B6. Pemakaian Bahan Baku di Workshop: Use, Return, dan Waste

Seluruh aksi pergerakan fisik ini dicatat oleh peran `Purchasing UAT` melalui modul **Material** (`/materials`). Drawer operasi menggunakan alur 2 tahap: pengisian form → klik **Tinjau** → periksa dampak stok → klik **Catat**.

#### B6.1 Catat Pemakaian Bahan Baku (Use Material)
Tukang merakit kabinet di workshop. Buka `/materials`, lalu catat pemakaian 4 item melalui tombol **+** (FAB) → **Pakai Material** (atau akses URL `/materials?action=USE`). Drawer **Pakai Material** akan terbuka:

1. **Multipleks Palm 18mm**:
   - Bagian *Proyek dan material*:
     - **Proyek**: `Fit-Out Interior Studio Bassura City — Unit 18B`
     - **RAP material**: `Multipleks Palm 18mm · Kitchenette & Wardrobe`
     - **Lokasi inventori**: `Workshop & Gudang Cikarang`
   - Bagian *Jumlah dan catatan*:
     - **Jumlah (lembar)**: `8` (mengonsumsi kuota reservasi proyek)
     - **Catatan pemakaian**: `Pemotongan badan kabinet dan ambalan utama.` (minimal 3 karakter)
   - Klik **Tinjau** → periksa kartu dampak stok (fisik 18 → 10 lembar, reservasi 8 → 0) → klik **Catat**.

2. **HPL Taco Woodgrain TH-1218FC**:
   - Bagian *Proyek dan material*:
     - **Proyek**: `Fit-Out Interior Studio Bassura City — Unit 18B`
     - **RAP material**: `HPL Taco Woodgrain TH-1218FC · Finishing Luar Kabinet`
     - **Lokasi inventori**: `Workshop & Gudang Cikarang`
   - Bagian *Jumlah dan catatan*:
     - **Jumlah (lembar)**: `3` (mengonsumsi kuota reservasi proyek)
     - **Catatan pemakaian**: `Laminasi permukaan kabinet dan pintu.`
   - Klik **Tinjau** → periksa dampak stok (fisik 8 → 5 lembar, reservasi 3 → 0) → klik **Catat**.

3. **Lem Kuning Aica Aibon 2.5 kg Kaleng**:
   - Bagian *Proyek dan material*:
     - **Proyek**: `Fit-Out Interior Studio Bassura City — Unit 18B`
     - **RAP material**: `Lem Kuning Aica Aibon 2.5 kg · Laminasi HPL`
     - **Lokasi inventori**: `Workshop & Gudang Cikarang`
   - Bagian *Jumlah dan catatan*:
     - **Jumlah (kaleng)**: `2`
     - **Catatan pemakaian**: `Pengeleman HPL kabinet studio.`
   - Klik **Tinjau** → periksa dampak stok (fisik 5 → 3 kaleng) → klik **Catat**.

4. **Edging PVC Taco 22x1mm Woodgrain (50m)**:
   - Bagian *Proyek dan material*:
     - **Proyek**: `Fit-Out Interior Studio Bassura City — Unit 18B`
     - **RAP material**: `Edging PVC Taco 22x1mm · Edging Pintu Kabinet`
     - **Lokasi inventori**: `Workshop & Gudang Cikarang`
   - Bagian *Jumlah dan catatan*:
     - **Jumlah (roll)**: `1`
     - **Catatan pemakaian**: `Pemasangan edging pinggiran panel kabinet.`
   - Klik **Tinjau** → periksa dampak stok (fisik 4 → 3 roll) → klik **Catat**.

*Expected State*:
- Stok fisik di rak gudang terpotong secara akurat.
- **Biaya Material Aktual (Actual Cost)** terakui secara non-kas: (8 × 260rb) + (3 × 195rb) + (2 × 145rb) + (1 × 110rb) = **Rp3.065.000**.
- Saldo kas bank BCA tidak berubah.

#### B6.2 Pengembalian Bahan Sisa Utuh (Return Material)
Terdapat 1 lembar multipleks utuh yang tidak jadi dipotong. Dari `/materials`, klik tombol **+** (FAB) → pilih **Kembalikan Sisa** (atau URL `/materials?action=RETURN`). Drawer **Kembalikan Sisa** akan terbuka:

| Bagian Form | Nama Field UI | Nilai Input Siap Salin | Keterangan |
| :--- | :--- | :--- | :--- |
| **Proyek dan material** | **Proyek** | `Fit-Out Interior Studio Bassura City — Unit 18B` | Proyek asal bahan |
| | **RAP material** | `Multipleks Palm 18mm · Kitchenette & Wardrobe` | Item yang dikembalikan |
| | **Lokasi inventori** | `Workshop & Gudang Cikarang` | Gudang penerima fisik |
| **Jumlah dan catatan** | **Jumlah (lembar)** | `1` | Qty fisik kembali (1 lembar) |
| | **Catatan pengembalian** | `Sisa 1 lembar utuh dikembalikan ke rak persediaan bebas gudang.` | Wajib minimal 3 karakter |

Klik **Tinjau** → periksa penambahan stok fisik (10 → 11 lembar) → klik **Catat**.

*Expected State*: Stok fisik bertambah 1 lembar. Biaya Material Actual berkurang **-Rp260.000** menjadi **Rp2.805.000**.

#### B6.3 Pencatatan Bahan Rusak / Terbuang (Waste Material)
1 lembar HPL retak saat pemotongan pola lengkung. Dari `/materials`, klik tombol **+** (FAB) → pilih **Material Terbuang** (icon segitiga peringatan `report_problem`, atau URL `/materials?action=WASTE`). Drawer **Material Terbuang** akan terbuka:

| Bagian Form | Nama Field UI | Nilai Input Siap Salin | Keterangan |
| :--- | :--- | :--- | :--- |
| **Proyek dan material** | **Proyek** | `Fit-Out Interior Studio Bassura City — Unit 18B` | Proyek pembebanan waste |
| | **RAP material** | `HPL Taco Woodgrain TH-1218FC · Finishing Luar Kabinet` | Item rusak |
| | **Lokasi inventori** | `Workshop & Gudang Cikarang` | Gudang terdampak |
| **Jumlah dan catatan** | **Jumlah (lembar)** | `1` | Qty rusak (1 lembar) |
| | **Alasan material terbuang** | `Pecah di sudut saat proses pemotongan tepi meja rias.` | Wajib minimal 10 karakter |

Klik **Tinjau** → periksa notice risiko *Material terbuang tercatat permanen* → klik tombol merah **Catat**.

*Expected State*: Stok fisik terpotong 1 lembar (5 → 4 lembar). Biaya Material Actual bertambah **+Rp195.000** menjadi tepat **Rp3.000.000**. Sisa reservasi aktif = 0.

---

### B7. Upah & Kasbon Lapangan Tukang

#### B7.1 Pengajuan Kasbon Mingguan Tukang
Switch ke `PM UAT Budi`, buka modul **Pengeluaran** (`/expenses`):
1. Klik tombol **+** (FAB) di kanan bawah → pilih **Expense Lapangan** (atau URL `/expenses?new-expense=true`). Drawer **Tambah Pengeluaran** akan terbuka.
2. Bagian **Proyek**:
   - **Proyek**: Pilih `Fit-Out Interior Studio Bassura City — Unit 18B`.
3. Bagian **Nota (opsional)**: Lewati (nota fisik opsional).
4. Bagian **Rincian item**:
   - Klik kartu `Item 1` (badge `Belum lengkap`) untuk membuka sheet **Rincian item 1**:
     - Bagian **Informasi item**:
       - **Kategori Pengeluaran**: Pilih `Tukang`.
       - **Keterangan**: `Kasbon upah tukang minggu ke-1 (5 tukang kayu di workshop)` (minimal 5 karakter).
       - **Jumlah**: `1`
       - **Harga Satuan**: `4000000` (Rp4.000.000)
     - Bagian **Paket Tukang**:
       - **Paket Tukang**: Pilih `Workshop & Site Bassura · Paket Pembuatan & Perakitan Interior Studio`.
     - Klik tombol **Simpan** di bawah sheet item.
5. Kartu item kini berstatus `Lengkap` dengan subtotal Rp4.000.000.
6. Klik tombol **Tinjau** di bawah drawer → di layar **Tinjau Pengeluaran** periksa rincian biaya dan sisa budget → klik tombol **Ajukan**. Status pengeluaran berubah menjadi `SUBMITTED`.

#### B7.2 Verifikasi & Pencairan Kasbon dari Kas Kecil
1. Switch ke `Finance UAT`, buka `/expenses` tab **Pengeluaran Lapangan** (`?view=field-expenses`).
2. Pada baris pengajuan kasbon Rp4.000.000 tadi, klik tombol **Verifikasi** (Status berubah menjadi `APPROVED`).
3. Klik tombol **Cairkan**. Sheet drawer **Pencairan dana** akan terbuka:
   - Bagian **Rincian Pengeluaran**: Menampilkan informasi biaya, proyek, dan pengaju PM Budi.
   - Bagian **Pencairan Pengeluaran**:
     - **Rekening Sumber Dana**: Pilih `KAS - Kas Kecil Lapangan / Workshop`.
     - **Nomor Referensi Bukti Transfer**: Ketik `KAS-OUT-TKG-01`.
   - Klik tombol **Tinjau** → layar menampilkan rincian dampak kas (`Rp 15.000.000 → Rp 11.000.000`) dan notice *"Pencairan final"*.
   - Klik tombol merah **Cairkan**.

*Expected Finansial*:
- Saldo `Kas Kecil Lapangan / Workshop`: **Rp15.000.000 → Rp11.000.000**.
- Realisasi Biaya Tukang Actual & Paid: **Rp4.000.000**.

#### B7.3 Pelunasan Sisa Upah Tukang via Transfer BCA
Setelah pekerjaan kayu terpasang di site:
1. `PM UAT Budi` mengajukan sisa upah via FAB **Expense Lapangan**:
   - **Proyek**: `Fit-Out Interior Studio Bassura City — Unit 18B`
   - Buka editor kartu `Item 1`:
     - **Kategori Pengeluaran**: `Tukang`
     - **Keterangan**: `Pelunasan upah tukang setelah finishing & instalasi selesai di site.`
     - **Jumlah**: `1`
     - **Harga Satuan**: `6000000` (Rp6.000.000)
     - **Paket Tukang**: `Workshop & Site Bassura · Paket Pembuatan & Perakitan Interior Studio`
     - Klik **Simpan** → klik **Tinjau** → klik **Ajukan**.
2. `Finance UAT` memverifikasi dan mencairkan dari rekening bank:
   - Buka `/expenses` tab **Pengeluaran Lapangan**, klik **Verifikasi** pada pengeluaran Rp6.000.000 tersebut.
   - Klik **Cairkan**:
     - **Rekening Sumber Dana**: Pilih `BCA - BCA Operasional Dekoria`.
     - **Nomor Referensi Bukti Transfer**: Ketik `TRF-BCA-TKG-FINAL`.
     - Klik **Tinjau** → periksa perubahan saldo (`Rp 166.500.000 → Rp 160.500.000`) → klik tombol merah **Cairkan**.

*Expected Finansial*:
- Saldo `BCA Operasional Dekoria`: **Rp166.500.000 → Rp160.500.000**.
- Total Biaya Tukang Actual & Paid: **Rp10.000.000** (dari pagu budget internal Rp7.074.200, overrun terverifikasi sah).

---

### B8. Tagihan Subcon & Biaya Operasional Lapangan

#### B8.1 Tagihan & Pembayaran 2 Vendor Subcon
Switch ke `PM UAT Budi` (atau `Finance UAT`), buka `/expenses` → tab **Tagihan Vendor** (`?view=vendor-bills`):

**Tagihan Subcon 1 (CV Marmer Indah Sentosa):**
1. Klik tombol **+ Buat Tagihan** (atau FAB **Tagihan Vendor**):
   - Bagian **Vendor dan proyek**:
     - **Vendor**: `CV Marmer Indah Sentosa`
     - **Proyek**: `Fit-Out Interior Studio Bassura City — Unit 18B`
     - **Kategori Budget**: `Subcon`
     - **Paket Subkon**: `Kitchenette · Paket Top Table Solid Surface`
   - Bagian **Dokumen tagihan**:
     - **Nomor Tagihan**: `INV-MARMER-089`
     - **Nominal Tagihan**: `5500000` (Rp5.500.000)
     - **Tanggal Jatuh Tempo**: `<hari ini + 7 hari>`
     - **Catatan**: `Pelunasan pekerjaan top table solid surface 1.8m.`
   - Klik **Tinjau** → pada sheet review klik **Buat**. Status tagihan: `UNPAID`.
2. *Jadwalkan Pembayaran oleh Finance*:
   - Switch ke `Finance UAT`, temukan kartu tagihan `INV-MARMER-089` di tab **Tagihan Vendor** → klik kartu → pada drawer detail klik **Jadwalkan Bayar**.
   - Sheet **Jadwalkan pembayaran vendor** terbuka:
     - **Rekening Rencana**: `BCA - BCA Operasional Dekoria`
     - **Tanggal Pembayaran**: `<hari ini>`
     - **Nominal Pembayaran**: `5500000`
     - Klik **Tinjau** → klik **Jadwalkan**.
   - Notice: *"Memerlukan persetujuan Owner"* muncul karena nominal Rp5.500.000 >= threshold Rp5.000.000. Status pembayaran di subtab **Rencana Bayar** adalah **Menunggu Owner** (`approvalStatus: PENDING`).
3. *Persetujuan Owner*:
   - Switch ke `Owner`, buka `/approvals` → temukan pembayaran `CV Marmer Indah Sentosa` Rp5.500.000 → klik **Setujui**.
4. *Pencairan Pembayaran oleh Finance*:
   - Switch kembali ke `Finance UAT`, buka `/expenses` tab **Tagihan Vendor** → subtab **Rencana Bayar**.
   - Status kartu pembayaran CV Marmer kini berubah menjadi **Siap Cair**.
   - Klik kartu pembayaran tersebut → klik tombol **Cairkan**.
   - Sheet **Cairkan pembayaran vendor** terbuka:
     - **Rekening Sumber Dana**: `BCA - BCA Operasional Dekoria`
     - **Nomor Referensi Bukti Transfer**: `TRF-BCA-SUB-MARMER`
     - Klik **Tinjau** → periksa dampak kas (`Rp 160.500.000 → Rp 155.000.000`) → klik tombol **Bayar**.

**Tagihan Subcon 2 (PT Kaca Nusantara Prima):**
1. Masih di `/expenses` tab **Tagihan Vendor**, klik **+ Buat Tagihan**:
   - Bagian **Vendor dan proyek**:
     - **Vendor**: `PT Kaca Nusantara Prima`
     - **Proyek**: `Fit-Out Interior Studio Bassura City — Unit 18B`
     - **Kategori Budget**: `Subcon`
     - **Paket Subkon**: `Wardrobe & Kitchenette · Paket Cermin Grey Mirror & Backsplash`
   - Bagian **Dokumen tagihan**:
     - **Nomor Tagihan**: `INV-KACA-441`
     - **Nominal Tagihan**: `2500000` (Rp2.500.000)
     - **Tanggal Jatuh Tempo**: `<hari ini + 7 hari>`
     - **Catatan**: `Pelunasan pasang cermin grey mirror & backsplash.`
   - Klik **Tinjau** → klik **Buat**. Status: `UNPAID`.
2. *Jadwalkan Bayar (Wajib)*:
   - Klik kartu tagihan `INV-KACA-441` → klik **Jadwalkan Bayar**.
   - Sheet **Jadwalkan pembayaran vendor** terbuka:
     - **Rekening Rencana**: `BCA - BCA Operasional Dekoria`
     - **Tanggal Pembayaran**: `<hari ini>`
     - **Nominal Pembayaran**: `2500000`
     - Klik **Tinjau** → klik **Jadwalkan**.
   - *Otomasi Ambang Batas*: Karena nominal Rp2.500.000 < threshold persetujuan Owner (Rp5.000.000) dan budget Subcon tidak overrun, jadwal pembayaran ini langsung disetujui sistem tanpa approval Owner. Di subtab **Rencana Bayar**, status pembayaran langsung **Siap Cair**.
3. *Pencairan Pembayaran oleh Finance*:
   - Buka subtab **Rencana Bayar**, klik kartu pembayaran PT Kaca Nusantara Prima → klik **Cairkan**.
   - Sheet **Cairkan pembayaran vendor** terbuka:
     - **Rekening Sumber Dana**: `BCA - BCA Operasional Dekoria`
     - **Nomor Referensi Bukti Transfer**: `TRF-BCA-SUB-KACA`
     - Klik **Tinjau** → klik **Bayar**.

*Expected Finansial*:
- Saldo `BCA Operasional Dekoria`: **Rp160.500.000 → Rp152.500.000**.
- Realisasi Subcon Actual & Paid: **Rp8.000.000** (Rp5.5jt Marmer + Rp2.5jt Kaca).

#### B8.2 Tiga Nota Operasional Lapangan (Petty Cash)
`PM UAT Budi` mengajukan 3 nota operasional melalui FAB **Expense Lapangan** di `/expenses`:
- **Proyek**: `Fit-Out Interior Studio Bassura City — Unit 18B`

| No | Kategori Pengeluaran | Keterangan | Nominal | No. Referensi Kas Kecil |
| :- | :--- | :--- | :---: | :--- |
| 1  | `Operasional` | `Sewa Pickup & BBM Pengiriman Workshop ke Site Bassura` | `650000` (Rp650.000) | `KAS-OPS-BSR-01` |
| 2  | `Operasional` | `Izin Fit-Out & Deposit Kerja Pengelola Apartemen` | `500000` (Rp500.000) | `KAS-OPS-BSR-02` |
| 3  | `Operasional` | `Konsumsi Lembur Tukang saat Instalasi Malam` | `250000` (Rp250.000) | `KAS-OPS-BSR-03` |
|    | **Total Pengeluaran Operasional** | | **Rp1.400.000** | |

Untuk setiap nota:
1. `PM UAT Budi` mengisi form editor item (Kategori Pengeluaran: `Operasional`, Keterangan, Jumlah: `1`, Harga Satuan), klik **Simpan** → klik **Tinjau** → klik **Ajukan**.

> 💡 **Invarian Finansial — Mengapa Butuh Persetujuan Owner padahal Nominal < Rp5 Juta?**
> Di Atria ERP, aturan persetujuan Owner dipicu oleh **salah satu dari 2 kondisi**:
> 1. Nominal $\ge$ Rp5.000.000 (*Ambang Persetujuan*), **ATAU**
> 2. **Budget Overrun**: Total pengeluaran melebihi sisa alokasi kategori budget proyek.
>
> Pada proyek Bassura, alokasi kategori `Operasional` adalah **4% dari budget internal**, yaitu **Rp1.010.600**.
> - **Nota 1 (Rp650.000)**: Rp650.000 $\le$ Rp1.010.600 (di dalam plafon). Saat Finance klik **Verifikasi**, statusnya **langsung `APPROVED`** dan tombol **Cairkan** langsung aktif! (Nota ini **tidak masuk** ke antrean `/approvals` Owner karena sudah otomatis lolos).
> - **Nota 2 (Rp500.000)**: Komitmen belanja menjadi $650.000 + 500.000 = \text{Rp1.150.000} > \text{Rp1.010.600}$ (**Overrun Rp139.400**).
> - **Nota 3 (Rp250.000)**: Komitmen belanja menjadi $1.150.000 + 250.000 = \text{Rp1.400.000} > \text{Rp1.010.600}$ (**Overrun Rp389.400**).
> - Akibatnya, Nota 2 dan Nota 3 berstatus `VERIFIED` (*Menunggu persetujuan*) dan **hanya 2 nota inilah yang dikirim ke modul `/approvals` milik Owner**!

2. **Verifikasi oleh Finance (`Finance UAT`)**:
   - Buka modul **Pengeluaran** (`/expenses`) → tab **Pengeluaran Lapangan**.
   - Pada baris Nota 1 (`Sewa Pickup`), klik **Verifikasi** → Status langsung berubah menjadi `APPROVED` (ikon centang hijau, siap dicairkan).
   - Pada baris Nota 2 (`Izin Fit-Out`), klik **Verifikasi** → Status berubah menjadi `VERIFIED` (*Menunggu persetujuan*, ada indikator merah *Melebihi budget*).
   - Pada baris Nota 3 (`Konsumsi Lembur`), klik **Verifikasi** → Status berubah menjadi `VERIFIED` (*Menunggu persetujuan*, ada indikator merah *Melebihi budget*).

3. **Persetujuan Overrun oleh Owner (`Owner UAT`)**:
   - Switch role ke `Owner UAT`, lalu buka modul **Persetujuan** (`/approvals`).
   - Anda akan melihat **tepat 2 kartu pengajuan** (Nota 2 Rp500.000 dan Nota 3 Rp250.000 dengan badge *Perhatian / Melebihi budget*).
   - Klik kartu **Izin Fit-Out & Deposit Kerja** → klik tombol **Setujui** → konfirmasi persetujuan.
   - Klik kartu **Konsumsi Lembur Tukang** → klik tombol **Setujui** → konfirmasi persetujuan.
   - Antrean persetujuan kini bersih (0 antrean).

4. **Pencairan oleh Finance (`Finance UAT`)**:
   - Switch kembali ke role `Finance UAT`, buka kembali `/expenses` tab **Pengeluaran Lapangan**.
   - Ketiga nota kini telah berstatus `APPROVED` (hijau) dan menampilkan tombol **Cairkan**.
   - Klik tombol **Cairkan** pada masing-masing nota secara bergantian:
     - **Nota 1 (`Sewa Pickup & BBM`)**:
       - Rekening Sumber Dana: `KAS - Kas Kecil Lapangan / Workshop`
       - Nomor Referensi Bukti Transfer: `KAS-OPS-BSR-01`
       - Klik **Tinjau** → klik **Cairkan**.
     - **Nota 2 (`Izin Fit-Out & Deposit`)**:
       - Rekening Sumber Dana: `KAS - Kas Kecil Lapangan / Workshop`
       - Nomor Referensi Bukti Transfer: `KAS-OPS-BSR-02`
       - Klik **Tinjau** → klik **Cairkan**.
     - **Nota 3 (`Konsumsi Lembur`)**:
       - Rekening Sumber Dana: `KAS - Kas Kecil Lapangan / Workshop`
       - Nomor Referensi Bukti Transfer: `KAS-OPS-BSR-03`
       - Klik **Tinjau** → klik **Cairkan**.

*Expected Finansial*:
- Saldo `Kas Kecil Lapangan / Workshop`: **Rp11.000.000 → Rp9.600.000**.
- Realisasi Operasional Actual & Paid: **Rp1.400.000**.

---

### B9. Penagihan Termin 2 & Rekonsiliasi Bank BCA (`/reconciliation`)

#### B9.1 Terbitkan Invoice Termin 2 (Progress 35%)
Switch ke `Finance UAT`, buka proyek Bassura City → tab **Pembayaran** (`/projects/[id]?tab=payments`):
1. Klik tombol **+ Invoice** di header panel. Sheet **Buat invoice klien** terbuka:
   - Bagian **Identitas invoice**:
     - **Nomor Invoice**: `INV/2026/09/BSR-002` (terisi otomatis atau ketik)
     - **Tahap Tagihan**: Pilih `Termin Progress 1` (value: `PROGRESS_1`)
   - Bagian **Nilai dan tenggat**:
     - Klik tombol preset cepat **`35% Progress`** (otomatis mengisi nominal `17500000` dan tahap `PROGRESS_1`) atau ketik manual pada **Nominal Tagihan**: `17500000`
     - **Tanggal Jatuh Tempo**: `<hari ini + 3 hari>`
     - **Catatan**: `Penagihan termin progress lapangan 35% sesuai kesepakatan kontrak.`
   - Klik tombol **Tinjau** → pada sheet review **Tinjau invoice klien** periksa ringkasan invoice → klik tombol **Buat**.
2. Pada kartu invoice `INV/2026/09/BSR-002` yang baru dibuat, klik tombol **Catat bayar** (atau klik invoice → tombol **Catat Pembayaran** di footer):
   - Sheet drawer **Penerimaan kas termin** terbuka:
     - Bagian **Dana masuk**:
       - **Rekening Penerima Dana (DEBIT)**: Pilih `BCA - BCA Operasional Dekoria`.
       - **Nominal Diterima**: `17500000` (Rp17.500.000).
     - Bagian **Referensi transaksi**:
       - **Nomor Referensi Bukti Transfer**: Ketik `TRF-BCA-HENDRA-TRM2`.
       - **Tanggal Transaksi Diterima**: `<hari ini>`.
     - Klik tombol **Tinjau** → layar menampilkan mode **Tinjau penerimaan klien** dengan dampak saldo rekening (`Rp 152.500.000 → Rp 170.000.000`) → klik tombol **Catat**.

*Expected State*: Saldo `BCA Operasional Dekoria` bertambah: **Rp152.500.000 → Rp170.000.000**. Invoice berstatus `PAID`.

#### B9.2 Rekonsiliasi Mutasi Rekening Koran Bank BCA
Buka modul **Rekonsiliasi** (`/reconciliation`):

1. Pada tab **Mutasi bank** (`?view=statement`), klik tombol **Impor CSV**:
   - Sheet **Impor rekening koran** terbuka.
   - **Rekening**: Pilih `BCA Operasional Dekoria`.
   - Klik **Pilih file**, lalu unggah file CSV rekening koran (misal `mutasi-bca-bassura.csv`) berisi 6 transaksi mutasi berikut:

```csv
tanggal,deskripsi,dana_masuk,dana_keluar
2026-08-20,TRF CR BCA HENDRA GUNAWAN DP 50%,25000000,
2026-08-22,TRF DB PT SUMBER ABADI MATERIAL,,8500000
2026-08-28,TRF DB SLAMET UPAH TUKANG FINISHING,,6000000
2026-08-29,TRF DB CV MARMER INDAH SOLID SURFACE,,5500000
2026-08-29,TRF DB PT KACA NUSANTARA CERMIN,,2500000
2026-09-01,TRF CR BCA HENDRA GUNAWAN PROGRESS 35%,17500000,
```

2. Klik tombol **Impor**. Sistem menampilkan notifikasi: *"6 mutasi berhasil diimpor."*
3. **Pencocokan Transaksi Mutasi**:
   - Sistem mendeteksi 6 transaksi kas proyek yang cocok sempurna nilai dan arah mutasinya (berstatus *"Pasangan ditemukan"*).
   - Klik baris mutasi bank yang memiliki pasangan → sheet **Cocokkan transaksi** terbuka dengan pasangan dari Catatan Atria terhubung otomatis.
   - Klik tombol **Cocokkan**.
   - Ulangi untuk keenam transaksi tersebut. Status transaksi di buku besar berubah menjadi **Cocok** (`reconciled = true`).
4. **Catat Pengecualian Saldo Pembukaan Kas**:
   - Saldo pembukaan awal kas (Rp150jt di BCA dan Rp15jt di Kas Kecil) terjadi sebelum periode rekening koran.
   - Buka tab **Catatan Atria** (`?view=cash`).
   - Klik baris transaksi *Saldo Pembukaan* BCA → sheet **Cocokkan transaksi** terbuka.
   - Klik tombol sekunder **Catat pengecualian**. Sheet **Catat pengecualian** terbuka:
     - **Alasan** (wajib minimal 10 karakter): `Saldo pembukaan kas awal sebelum sistem go-live.`
     - Klik tombol **Simpan alasan**.
   - Ulangi langkah di atas untuk mutasi saldo pembukaan pada rekening `Kas Kecil Lapangan / Workshop`.

---

### B10. Audit Posisi Finansial Tengah Proyek

Periksa ringkasan posisi anggaran dan kas sebelum Change Order:

| Kategori    | Plafon Anggaran (Cara A) | Realisasi Aktual (Actual) | Kas Keluar (Paid) | Sisa Anggaran | % Terpakai | Status Kategori |
| ----------- | -----------------------: | ------------------------: | ----------------: | ------------: | ---------: | :-------------: |
| Material    |             Rp9.600.700 |               Rp3.000.000 |       Rp8.500.000 |   Rp6.600.700 |     31,25% | Aman            |
| Tukang      |             Rp7.074.200 |              Rp10.000.000 |      Rp10.000.000 |  -Rp2.925.800 |    141,36% | Perlu Pantau    |
| Subcon      |             Rp5.053.000 |               Rp8.000.000 |       Rp8.000.000 |  -Rp2.947.000 |    158,32% | Perlu Pantau    |
| Operasional |             Rp1.010.600 |               Rp1.400.000 |       Rp1.400.000 |     -Rp389.400 |   138,53% | Perlu Pantau    |
| Lain-lain   |               Rp505.300 |                       Rp0 |               Rp0 |     Rp505.300 |      0,00% | Aman            |
| **Buffer**  |             Rp2.021.200 |                       —   |               —   |   Rp2.021.200 |        —   | Utuh            |

- **Total Budget Internal Fisik**: `Rp25.265.000` (Porsi Fisik Rp28.070.000 × 90%)
- **Total Biaya Diakui (Actual)**: `Rp22.400.000` (88,66% dari total budget internal, proyek secara agregat fisik tetap **Terkendali**)
- **Total Penerimaan Kas Klien**: `Rp42.500.000` (DP 50% + Progress 35%)
- **Total Kas Proyek Keluar (Paid)**: `Rp8.5jt + Rp10jt + Rp8jt + Rp1.4jt = Rp27.900.000`
- **Posisi Kas Proyek Bersih**: `Rp42.500.000 − Rp27.900.000 = Rp14.600.000`
- **Margin Realisasi Sementara**: `Rp50.000.000 − Rp22.400.000 = Rp27.600.000` (55,2%)

---

### B11. Simulasi Change Order (Add-on Meja Kerja & LED Strip)

Klien meminta penambahan pekerjaan fisik: **Meja Kerja Floating & Ambalan LED Strip** senilai **Rp6.000.000**.

1. Switch ke peran `Owner`, buka proyek Bassura City → klik tab **RAB** (`/projects/[id]?tab=rab`).
2. Pada kartu ringkasan RAB berstatus disetujui, klik tombol **Buat revisi RAB**. Sheet **Buat Revisi RAB** terbuka.
3. Seluruh sumber dari baseline RAB otomatis terpilih sebagai snapshot (mencakup **Material RAP**, **Paket kerja**, serta bagian **Item manual & jasa** seperti *Jasa Desain 3D, Shop Drawing, Supervisi & Manajemen Proyek*). Klik tombol **Revisi** di bawah sheet.
4. Sistem membuat draft revisi RAB baru (status `DRAFT`).
5. Pada panel **Item RAB**, klik tombol bulat **+** di bagian header panel (kanan atas) untuk membuka sheet **Tambah Item Manual**:
   - Bagian **Tampilan untuk klien**:
     - **Nama item**: `Meja Kerja Floating & Ambalan LED Strip`
     - **Deskripsi untuk klien**: `Meja kerja ambalan gantung finish HPL dengan concealed warm white LED strip.`
   - Bagian **Jumlah & harga**:
     - **Jumlah**: `1`
     - **Satuan**: `ls`
     - **Harga satuan klien**: `6000000` (Rp6.000.000)
   - Bagian **Sifat komponen biaya**:
     - Pilih opsi: **Pekerjaan Fisik Tambahan** (default)
   - Klik tombol **Tambah**.
6. Draft revisi RAB kini memiliki total penawaran **Rp56.000.000** (+Rp6.000.000).
7. Scroll ke panel **Keputusan draf** di bawah, klik tombol **Proses change order**. Sheet **Proses Change Order** terbuka:
   - Section **2 · Alasan & lingkup**:
     - **Alasan perubahan** (minimal 10 karakter): `Klien meminta penambahan meja kerja floating dan ambalan dengan concealed LED strip.`
     - **Ringkasan lingkup lama ke baru**: `Penambahan lingkup dari interior studio standar mencakup meja kerja floating dan ambalan dekoratif.`
   - Section **3 · Bukti persetujuan klien**:
     - **Referensi persetujuan klien**: `WA Approval Bpk. Hendra tgl 01 Sept 2026`
     - **Tanggal persetujuan klien**: Pilih tanggal `2026-09-01`
   - Klik tombol **Tinjau**.
8. Dialog konfirmasi muncul (*"Setujui Change Order?"*). Klik tombol **Setujui Perubahan**.

*Expected Atomic Rescaling (Derivasi Bersih Cara A)*:
- Nilai Kontrak Baru: **Rp56.000.000**.
- Porsi Produksi Fisik Baru: **Rp34.070.000** (Rp28.070.000 fisik awal + Rp6.000.000 add-on fisik).
- Porsi Jasa Desain & Fee: tetap **Rp21.930.000**.
- Plafon Budget Internal Baru (Cap 90% dari Porsi Fisik): **Rp30.663.000** (+Rp5.400.000).
- Target Laba Kotor Baru: **Rp25.337.000** (+Rp600.000 / 45,24%).
- Kategori ter-rescale otomatis secara proporsional atas plafon fisik baru:
  - Material (38%): `Rp11.651.940`
  - Tukang (28%): `Rp8.585.640`
  - Subcon (20%): `Rp6.132.600`
  - Operasional (4%): `Rp1.226.520`
  - Lain-lain (2%): `Rp613.260`
  - Buffer (8%): `Rp2.453.040`
- RAB versi lama berstatus `SUPERSEDED`, RAB baru berstatus `APPROVED`.

9. **Tagihkan Invoice Change Order**:
   - Switch ke `Finance UAT`, buka tab **Pembayaran**, klik **+ Invoice**:
     - Sheet **Buat invoice klien**:
       - **Nomor Invoice**: `INV/2026/09/BSR-CO1`
       - **Tahap Tagihan**: `Pekerjaan Tambah / Kurang` (value: `AD_HOC`)
       - **Nominal Tagihan**: `6000000` (Rp6.000.000)
       - **Tanggal Jatuh Tempo**: `<hari ini + 3 hari>`
       - Klik **Tinjau** → Klik **Buat**.
   - Pada invoice tersebut, klik **Catat bayar**:
     - Sheet **Penerimaan kas termin**:
       - **Rekening Penerima Dana (DEBIT)**: `BCA - BCA Operasional Dekoria`
       - **Nominal Diterima**: `6000000`
       - **Nomor Referensi Bukti Transfer**: `TRF-BCA-HENDRA-CO`
       - **Tanggal Transaksi Diterima**: `<hari ini>`
       - Klik **Tinjau** → Klik **Catat**.
   - Saldo BCA bertambah: **Rp170.000.000 → Rp176.000.000**.

---

### B12. Serah Terima (BAST), Pelunasan Akhir, & Project Closing

#### B12.1 Penagihan Termin 3 (Pelunasan Akhir 15%)
1. Masih sebagai `Finance UAT`, di tab **Pembayaran**, buat invoice pelunasan:
   - Klik **+ Invoice**:
     - Sheet **Buat invoice klien**:
       - **Nomor Invoice**: `INV/2026/09/BSR-003`
       - **Tahap Tagihan**: `Pelunasan Akhir` (value: `FINAL_PAYMENT`)
       - **Nominal Tagihan**: `7500000` (Rp7.500.000 — 15% dari kontrak dasar Rp50jt)
       - **Tanggal Jatuh Tempo**: `<hari ini + 3 hari>`
       - Klik **Tinjau** → Klik **Buat**.
2. Klik **Catat bayar** pada invoice pelunasan tersebut:
   - Sheet **Penerimaan kas termin**:
     - **Rekening Penerima Dana (DEBIT)**: `BCA - BCA Operasional Dekoria`
     - **Nominal Diterima**: `7500000` (Rp7.500.000)
     - **Nomor Referensi Bukti Transfer**: `TRF-BCA-HENDRA-PELUNASAN`
     - **Tanggal Transaksi Diterima**: `<hari ini>`
     - Klik **Tinjau** → Klik **Catat**.
3. Buka `/reconciliation`, impor/catat mutasi rekening koran untuk 2 transaksi kas masuk baru (CO Rp6jt & Pelunasan Rp7.5jt), lalu cocokkan keduanya di tab **Mutasi bank**.

*Expected Finansial Akhir*:
- Total Dana Diterima dari Klien: **Rp56.000.000** (100% lunas dari seluruh invoice).
- Saldo Akhir `BCA Operasional Dekoria`: **Rp183.500.000**.
- Saldo Akhir `Kas Kecil Lapangan / Workshop`: **Rp9.600.000**.
- Total Kas Perusahaan: **Rp193.100.000** (Saldo awal Rp165jt + Kas bersih proyek Rp28.1jt).

#### B12.2 Evaluasi 10 Invariant Closing Guard di Tab Margin
1. Switch ke peran `Owner`, buka proyek Bassura City lalu klik tab **Margin** (`/projects/[id]?tab=profitability`).
2. Scroll ke kartu **Penutupan finansial**, klik tombol **Periksa kesiapan closing**.
3. Sistem memvalidasi 10 guard berikut secara atomik:
   - `invoicedValue === contractValue` (Rp56.000.000 = Rp56.000.000) → **Lolos**.
   - Seluruh invoice client berstatus `PAID` / VOID (Piutang = Rp0) → **Lolos**.
   - Seluruh vendor bill berstatus `PAID` / VOID (Hutang = Rp0) → **Lolos**.
   - Seluruh vendor payment final (`COMPLETED`) → **Lolos**.
   - Seluruh expense request lapangan final (`PAID` / `REJECTED`) → **Lolos**.
   - Tidak ada pengeluaran berstatus `SUBMITTED` / `VERIFIED` → **Lolos**.
   - Seluruh cash expense telah lunas dibayar → **Lolos**.
   - Tepat satu current `APPROVED` RAB dan 0 draft revision → **Lolos**.
   - Tidak ada Change Order berstatus terbuka → **Lolos**.
   - `calculateOutstandingProjectReservations === 0` dan seluruh cash transaction `reconciled = true` (atau memiliki exception sah) → **Lolos**.

#### B12.3 Finalisasi Penutupan Proyek
1. Setelah seluruh guard lolos, form closing terbuka di bawah kartu:
   - **Catatan closing final** (wajib minimal 10 karakter):
     `Pekerjaan interior studio Bassura City unit 18B selesai 100%, BAST ditandatangani klien, dan seluruh kewajiban finansial/stok telah direkonsiliasi sempurna.`
2. Klik tombol **Selesaikan proyek dan simpan ringkasan akhir**.

*Expected State & Snapshot Profitabilitas*:
- `project.status` berubah menjadi `COMPLETED`.
- Record baru tersimpan di tabel `project_profitability_snapshot` dengan tipe `FINAL`:
  - `contract_value`: `56000000.00`
  - `internal_budget`: `50400000.00`
  - `actual_cost`: `22400000.00`
  - `realized_margin_amount`: `33600000.00` (Rp56.000.000 − Rp22.400.000)
  - `realized_margin_percentage`: `60.0000%`
  - `cash_position`: `28100000.00` (Rp56.000.000 − Rp27.900.000)
  - `risk_status`: `SAFE`
- Proyek terkunci permanen dari mutasi pengeluaran, pergerakan stok, dan penerbitan tagihan baru.

---

## BAGIAN C — Matriks 18 Negative Tests & Invariant Guards

Seluruh skenario pengujian negatif di bawah ini dapat dieksekusi langsung untuk memverifikasi bahwa mutasi tidak sah ditolak pada boundary validasi dan transaksi database di-rollback tanpa meninggalkan *partial write*.

| No | Nama Negative Test | Role Aktif | Route / Action Target | Input / Skenario Pengujian | Hasil Rejection (Expected Error) | Bukti Database Bebas Partial Write |
| :- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Project Scoping Guard | PM Lain | `/projects/<id-bassura>` | PM yang tidak di-assign mencoba membuka URL proyek Bassura | HTTP 403 / Redirect | Data proyek tidak dikirim dalam RSC payload |
| **2** | Global Finance Guard | PM | `/ledger` | PM mencoba mengakses dashboard arus kas global perusahaan | HTTP 403 / Unauthorized route | Session dicegat di middleware & layout |
| **3** | Sensitive Balance Guard | Purchasing | `/expenses` | Purchasing membuka daftar tagihan pengadaan material | UI menyembunyikan saldo | Payload server menghapus saldo & nama bank |
| **4** | Self-Verification Guard | PM Pembuat | `verifyExpenseRequest` | PM mencoba memverifikasi nota pengeluaran yang diajukan sendiri | `FORBIDDEN: Pembuat pengeluaran tidak boleh memverifikasi` | Status pengeluaran tetap `SUBMITTED` |
| **5** | Budget Settings Guard | Purchasing | `updateBudgetAllocationSetting` | Purchasing mencoba mengubah rasio default budget di `/settings` | `FORBIDDEN: Memerlukan izin update:budget_setting` | Record `budget_allocation_setting` tidak berubah |
| **6** | Approved RAP Immutability | PM | `updateProjectRapItem` | PM mencoba mengedit quantity material saat status RAP `LOCKED` | `RAP_LOCKED: RAP yang sudah difinalisasi tidak dapat diedit` | Item RAP di database tetap utuh |
| **7** | Over-Reserve Guard | Purchasing | `reserveMaterialStock` | Reservasi 50 lembar Multipleks (stok tersedia gudang hanya 2 lbr) | `INSUFFICIENT_STOCK: Jumlah melebihi stok tersedia` | Row `stock_movement` tidak dibuat, stok tetap |
| **8** | Cross-Project Reserve | Proyek B | `useMaterialStock` | Proyek B mencoba mengonsumsi stok yang direservasi Proyek A | `RESERVATION_MISMATCH: Stok terikat untuk proyek lain` | Stok proyek A tidak terpotong |
| **9** | Excess Return Guard | Purchasing | `returnMaterialStock` | Mencatat Return 5 lembar padahal pemakaian bersih (*net use*) hanya 1 lembar | `EXCESS_RETURN: Jumlah return melebihi pemakaian bersih` | Row return ditolak, nilai actual tidak minus |
| **10**| Short Audit Note Guard | Purchasing | `recordMaterialWaste` | Mencatat Waste material dengan catatan `"rusak"` (< 10 karakter) | `VALIDATION_ERROR: Catatan minimal 10 karakter` | Mutasi waste ditolak, audit log tidak terbentuk |
| **11**| Reserved Reversal Guard | Finance | `requestGoodsReceiptReversal` | Reversal Goods Receipt saat sisa stok gudang lebih kecil dari reservasi | `REVERSAL_BLOCKED: Akan menyebabkan available stock minus` | Status GR tetap `POSTED`, stok tidak ditarik |
| **12**| Vendor Over-Schedule | Finance | `scheduleVendorBillPayment` | Menjadwalkan bayar Rp10.000.000 pada tagihan bersisa Rp8.500.000 | `OVERPAYMENT_NOT_ALLOWED: Melebihi sisa tagihan` | Jadwal bayar tidak tercatat di `vendor_payment` |
| **13**| Early Vendor Pay Guard | Finance | `disburseVendorPayment` | Mencairkan pembayaran tagihan > Rp5jt sebelum disetujui Owner | `APPROVAL_REQUIRED: Pembayaran high-risk belum disetujui` | Saldo bank tidak terpotong, payment tetap `SCHEDULED` |
| **14**| Rejected Payment Guard | Finance | `disburseVendorPayment` | Mencoba mencairkan transaksi yang berstatus `FAILED` | `INVALID_STATUS: Hanya payment SCHEDULED yang dapat dicairkan` | Tidak ada mutasi kas keluar |
| **15**| Client Overpay Guard | Finance | `recordClientPayment` | Mencatat pembayaran Rp30.000.000 pada invoice bernilai Rp25.000.000 | `OVERPAYMENT: Jumlah bayar melebihi sisa tagihan invoice` | Transaksi kas masuk di-rollback |
| **16**| Archived Account Guard | Finance | `createCashTransaction` | Mencatat transaksi kas pada rekening bank berstatus `ARCHIVED` | `ACCOUNT_INACTIVE: Rekening bank tidak aktif` | Saldo rekening tidak berubah |
| **17**| Direct Second RAB Guard | Owner | `approveRabEstimate` | Menyetujui revisi RAB kedua langsung tanpa melalui Change Order | `CHANGE_ORDER_REQUIRED: Baseline aktif harus via Change Order` | Status RAB tetap `DRAFT`, kontrak tidak berubah |
| **18**| Premature Closing Guard | Owner | `completeProject` | Menutup proyek saat masih ada transaksi kas yang belum direkonsiliasi | `FORBIDDEN: Transaksi kas proyek belum cocok dengan mutasi bank` | `project.status` tetap `ACTIVE`, snapshot tidak dibuat |

---

## BAGIAN D — Panduan Troubleshooting & Safe Resume State

Ketika terjadi kendala operasional atau simulasi terhenti di tengah jalan, gunakan panduan berikut untuk mendiagnosis dan memulihkan sistem secara aman tanpa melakukan reset database.

### 1. Membedakan Duplicate Transaction vs Pending Approval

- **Gejala**: Pengeluaran lapangan atau jadwal pembayaran vendor tidak dapat disimpan kembali dan muncul error konflik.
- **Langkah Diagnostik (Read-Only)**:
  ```sql
  -- Periksa status tagihan vendor dan jadwal bayar
  SELECT id, bill_number, status, total_amount FROM vendor_bill WHERE project_id = '<project_id>';
  SELECT id, vendor_bill_id, amount, status FROM vendor_payment WHERE vendor_bill_id = '<vendor_bill_id>';
  ```
- **Aksi Pemulihan**:
  - Jika `vendor_payment` berstatus `SCHEDULED` (menunggu persetujuan): Buka menu **Persetujuan** (`/approvals`) sebagai Owner untuk menyetujui, lalu cairkan sebagai Finance Admin. Jangan membuat tagihan baru.
  - Jika transaksi duplicate terbentuk: Buka detail tagihan, batalkan jadwal bayar yang keliru sebelum membuat jadwal baru.

### 2. Unmatched Bank Statement & Rekonsiliasi Blocker

- **Gejala**: Checklist closing B12 terblokir dengan pesan `X transaksi kas proyek belum cocok dengan mutasi bank`.
- **Langkah Diagnostik (Read-Only)**:
  ```sql
  -- Cari transaksi kas proyek yang belum direkonsiliasi
  SELECT id, transaction_type, amount, reconciled, reconciliation_exception_at
  FROM cash_transaction
  WHERE id IN (
    SELECT cash_transaction_id FROM client_payment WHERE invoice_id IN (SELECT id FROM client_invoice WHERE project_id = '<project_id>')
    UNION
    SELECT cash_transaction_id FROM vendor_payment WHERE vendor_bill_id IN (SELECT id FROM vendor_bill WHERE project_id = '<project_id>')
    UNION
    SELECT cash_transaction_id FROM project_cost WHERE project_id = '<project_id>'
  ) AND reconciled = false AND reconciliation_exception_at IS NULL;
  ```
- **Aksi Pemulihan**:
  1. Buka route `/reconciliation` sebagai `Finance UAT`.
  2. Jika transaksi memiliki pasangan mutasi di bank: Impor CSV mutasi koran dan klik **Cocokkan**.
  3. Jika transaksi adalah kas kecil lapangan atau mutasi internal non-bank: Buka tab **Catatan Atria**, klik **Catat Pengecualian**, masukkan alasan yang sah (misal: `Pengeluaran kas kecil operasional lapangan diverifikasi dengan nota fisik.`).

### 3. Reserved Stock Conflict

- **Gejala**: Purchasing tidak dapat mencatat Use Material atau pesan error `INSUFFICIENT_STOCK` muncul.
- **Langkah Diagnostik (Read-Only)**:
  ```sql
  -- Periksa riwayat pergerakan stok untuk proyek
  SELECT id, movement_type, material_id, quantity, project_id, created_at
  FROM stock_movement
  WHERE project_id = '<project_id>'
  ORDER BY created_at ASC;
  ```
- **Aksi Pemulihan**:
  - Pastikan reservasi material sudah dilakukan sebelum aksi USE.
  - Jika material belum tiba di gudang, pastikan Goods Receipt sudah di-posting melalui menu `/materials`.

### 4. Closing Invariant Failure Recovery

- **Gejala**: Tombol **Periksa kesiapan closing** di tab Margin menampilkan blocker merah.
- **Matriks Resolusi Blocker**:
  - *Total invoice belum sama dengan nilai kontrak*: Terbitkan invoice sisa termin atau invoice Change Order di tab **Pembayaran**.
  - *Masih ada vendor bill outstanding*: Lunasi seluruh tagihan vendor yang belum `PAID` di modul `/expenses`.
  - *Reservasi stock proyek belum diselesaikan*: Catat aksi USE untuk seluruh sisa reservasi material proyek di modul `/materials`.
  - *Masih ada Change Order terbuka*: Setujui atau batalkan Change Order yang masih berstatus `DRAFT` di tab **RAB**.

---

## Kriteria Kelulusan UAT (Acceptance Criteria)

### Status PASS

- Seluruh positive path menghasilkan state dan angka expected sesuai alur kerja.
- Seluruh 18 negative test ditolak pada boundary validasi tanpa partial write di database.
- Setiap mutasi kas memiliki pencatatan `cash_transaction`, saldo rekening ter-update akurat, reference ID unik, dan entry `audit_log`.
- Setiap mutasi material tercatat di `stock_movement`, delta stok fisik/reservasi konsisten, dan tercatat di `audit_log`.
- Role-based scoping terisolasi penuh: PM tidak dapat mengakses proyek lain atau melakukan self-approval.
- Halaman Dashboard Finansial, Detail Proyek, Pengeluaran, dan Material menunjukkan konsistensi data 100%.

### Status FAIL

- Saldo bank atau kas kecil berubah tanpa transaksi di `cash_transaction`.
- Stok fisik atau tereservasi berubah tanpa record di `stock_movement`.
- Pengakuan actual terhitung ganda (*double-counting*) untuk satu pengadaan yang sama.
- Terjadi overpayment pada invoice klien atau tagihan vendor melebihi sisa tagihan.
- Transaksi berstatus pending atau rejected dapat dicairkan.
- Stok fisik di rak gudang bernilai negatif atau lebih kecil dari reservasi aktif (`current_stock < reserved_stock`).
- Closing proyek berhasil dieksekusi saat masih ada blocker invariant yang belum terpenuhi.

### Catatan Khusus Cost Attribution Stock

Model sistem adalah *inventory-funded cost*:
- **Opening Inventory & Goods Receipt**: Membentuk saldo kuantitas dan nilai persediaan fisik di gudang.
- **Tagihan Vendor Material**: Membentuk kewajiban hutang (*payable*) dan bukti kas keluar (*paid*), **bukan biaya aktual langsung proyek** (*Material Actual tetap Rp0*).
- **Pemakaian (USE) & Terbuang (WASTE)**: Mengakui realisasi biaya proyek (*Budget Actual*) berbasis harga rata-rata bergerak persediaan (*moving average cost*).
- **Pengembalian (RETURN)**: Mengembalikan fisik ke persediaan bebas gudang dan membalik (*credit*) biaya aktual proyek secara proporsional.
- **Pengeluaran Lapangan Non-Material**: Langsung membebankan biaya aktual ke proyek terkait.

---

## Ringkasan Perubahan Nilai per Aksi Sistem

| Aksi Sistem / Mutasi             |                 Budget Actual |   Budget Paid |          Kas |                 Stok Fisik |             Stok Reservasi | Hutang / Piutang |
| -------------------------------- | ----------------------------: | ------------: | -----------: | -------------------------: | -------------------------: | :--------------- |
| **Buat Proyek / RAP / Draf RAB** |                             — |             — |            — |                          — |                          — | —                |
| **Setujui RAB / Change Order**   |      Porsi alokasi bertambah  |             — |            — |                          — |                          — | —                |
| **Ajukan Pengeluaran Lapangan**  |                  Pending naik |             — |            — |                          — |                          — | —                |
| **Verifikasi Pengeluaran**       |                   Actual naik |             — |            — |                          — |                          — | —                |
| **Cairkan Pengeluaran Kas**      |                             — |     Paid naik |        Turun |                          — |                          — | —                |
| **Buat Tagihan Vendor Material** | Tetap (masuk aset persediaan) |             — |            — |                          — |                          — | Hutang naik      |
| **Buat Tagihan Vendor Subcon**   |                   Actual naik |             — |            — |                          — |                          — | Hutang naik      |
| **Jadwalkan Bayar Tagihan**      |                             — |             — |            — |                          — |                          — | Tetap            |
| **Cairkan Pembayaran Tagihan**   |                             — |     Paid naik |        Turun |                          — |                          — | Hutang turun     |
| **Goods Receipt (Terima Fisik)** |                             — |             — |            — |                       Naik |                      Tetap | Tetap            |
| **Reservasi Material Gudang**    |                             — |             — |            — |                      Tetap |                       Naik | —                |
| **Pakai Material (USE)**         |          Actual non-kas naik  |         Tetap |        Tetap |                      Turun | Turun kuota reservasi      | —                |
| **Kembalikan Sisa (RETURN)**     |         Actual non-kas turun  |         Tetap |        Tetap |                       Naik |                      Tetap | —                |
| **Bahan Rusak (WASTE)**          |          Actual non-kas naik  |         Tetap |        Tetap |                      Turun | Turun kuota reservasi      | —                |
| **Terbitkan Invoice Klien**      |                             — |             — |            — |                          — |                          — | Piutang naik     |
| **Catat Pembayaran Klien**       |                             — |             — |         Naik |                          — |                          — | Piutang turun    |
| **Penutupan Proyek (Closing)**   |                Final snapshot | Final snapshot| Tidak berubah|              Tidak berubah | Harus 0 reservasi aktif    | Seluruhnya final |

