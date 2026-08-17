# Walkthrough UAT Atria ERP — Dari Data Operasional Kosong sampai Project Closing

Versi implementasi: **17 Agustus 2026**
Audit pendamping: `docs/guide/workflow_audit_2026-07-16.md`

## Status verifikasi

Dokumen ini dijalankan ulang terhadap aplikasi pada 17 Agustus 2026, dari database
yang benar-benar dikosongkan, dan setiap angka dicocokkan langsung ke Postgres —
bukan hanya ke tampilan layar.

**Sudah dijalankan dan cocok sampai rupiah terakhir:** A0 bootstrap, seluruh langkah
onboarding 1–6 beserta Ringkasan, B1 pembuatan project, B2 RAP (Material, Tukang,
Subcon, finalisasi), B3 RAB dan aktivasi, B4 reservasi, B5 tagihan vendor sampai
pencairan dan Goods Receipt, B6 pakai/kembalikan/terbuang, B7.1 pengajuan
pengeluaran, serta B9.1–B9.4 invoice klien sampai seluruh termin lunas dan rekonsiliasi kas
dijalankan, serta B10 rekonsiliasi profitability dan B12 penutupan proyek — termasuk
snapshot final yang tersimpan.

B9 terbukti persis seperti tertulis: tiga invoice berjumlah Rp17.000.000, partial
payment Rp2.000.000 membawa BCA Rp92.000.000 → Rp94.000.000, percobaan
Rp3.100.001 ditolak tanpa menyisakan satu baris pun, dan setelah seluruh termin
dilunasi BCA berhenti di Rp109.000.000 dengan total kas Rp114.300.000.

Rekonsiliasi B9.4 juga terbukti: impor CSV menambah pembanding tanpa menyentuh
saldo, pencocokan hanya memindahkan status (BCA tetap Rp109.000.000), impor ulang
file yang sama melewati seluruh baris duplikat, fallback manual dengan fingerprint
sama ditolak, dan pengecualian tersimpan dengan `reconciled` tetap `false`.

**Dua ekspektasi B9.4 belum dapat dibuktikan pada run ini:** penanda aging
**Perlu diperiksa** untuk transaksi berumur lebih dari 3 hari (seluruh transaksi
UAT masih berumur nol hari), dan penolakan closing proyek karena kas belum cocok
— yang terakhir baru diuji pada B12.

Angka acuan §3.4 terbukti apa adanya: contract Rp17.000.000, Internal Budget
Rp15.300.000, alokasi 5.814.000 / 4.284.000 / 3.060.000 / 612.000 / 306.000, dan
buffer Rp1.224.000.

**Sudah dijalankan sebagian:** Bagian C — sembilan dari delapan belas negative
test terbukti live, satu terverifikasi dari kode, delapan sisanya menunggu
proyek `ACTIVE` baru atau akun PM kedua. Rinciannya ada di akhir Bagian C.

**Belum dijalankan ulang:** B11 revisi dan Change Order. B7.2 dan B8 sudah
dijalankan — hasil akhirnya cocok persis dengan tabel B10, dan justru dari
skenario B7.2 cacat aturan persetujuan gabungan ditemukan.
Bagian-bagian itu masih berisi ekspektasi hasil desain, bukan hasil pengamatan.

Tiga belas cacat aplikasi ditemukan dan diperbaiki selama proses ini; yang paling
memengaruhi cara membaca runbook:

- Panel dampak budget pada review tagihan vendor **dan** pada sheet persetujuan
  dahulu memproyeksikan realisasi naik untuk tagihan kategori Material. Tagihan
  Material adalah pembelian persediaan: realisasinya baru diakui saat stok dipakai
  atau menjadi waste. Keduanya kini menampilkan dampak yang datar.
- `USE`, `WASTE`, dan `RETURN` dahulu tersimpan tanpa arah pergerakan, sehingga
  buku pergerakan stok tidak lagi menjumlah menjadi saldo `material_inventory`.
- `bun run test` dahulu menulis ke database yang sama dengan dev server. Sekarang
  suite yang menyentuh Postgres hanya berjalan bila `ATRIA_TEST_DATABASE_URL` diisi,
  jadi menjalankan test di tengah UAT tidak lagi menggeser angka yang sedang diperiksa.
- Penolakan pembayaran klien dahulu menampilkan sentinel internal
  (`PAYMENT_EXCEEDS_INVOICE_OUTSTANDING: …`) langsung ke layar. Pesan gagal kini
  murni Bahasa Indonesia; kode mesin hanya lewat `error.code`.
- Spanduk gagal pada sheet penerimaan klien dahulu bertahan setelah nominal
  penyebabnya dikoreksi, sehingga tinjauan yang sudah sah tetap terlihat merah.
- Kartu **Realisasi kas** dahulu memberi label "Pengeluaran kas" pada realisasi
  akrual, sementara "Posisi kas bersih" di bawahnya memakai kas yang benar-benar
  keluar. Ketiga barisnya karena itu tidak saling menjumlah, dan selisihnya persis
  sebesar persediaan yang sudah dibayar tetapi belum dipakai — justru angka yang
  paling mudah disalahbaca pada model biaya ini.
- Hasil **Periksa kesiapan closing** dahulu dirender di bawah lipatan layar tanpa
  digulirkan ke tampilan, sehingga daftar blocker — satu-satunya penjelasan
  mengapa proyek belum bisa ditutup — tidak terlihat.
- Ketiga sheet pada `/reconciliation` dahulu menonaktifkan tombol utamanya tanpa
  menjelaskan alasannya. Aturan alasan pengecualian minimal 10 karakter sama
  sekali tidak terlihat dari layar; sekarang footer menyebutkan syarat yang
  belum terpenuhi, sama seperti sheet lain di aplikasi.

Dokumen ini adalah runbook acceptance test. Ikuti urutannya, ganti role sesuai instruksi, dan catat nilai sebelum/sesudah setiap action. Jangan memakai project atau transaksi seed sebagai titik awal.

> **Pilih mode test:** dokumen ini menguji onboarding dan operasi seperti production dari database
> kosong. Untuk belajar memakai data contoh yang sudah saling terhubung, gunakan
> [`seeded_demo_walkthrough.md`](./seeded_demo_walkthrough.md). Jangan mencampur kedua dataset dalam
> satu run.

### Cara membaca contoh form

- Nilai pada kolom **Contoh UAT** adalah dataset kontrol yang harus diketik atau dipilih saat simulasi.
- `Kosongkan` berarti field memang opsional dan sengaja tidak diisi untuk menguji jalur minimal. Nilai bertanda `<...>` harus diganti dengan secret, akun, atau tanggal milik environment UAT; jangan menyalin tanda kurung sudutnya.
- Nilai uang ditulis tanpa simbol saat diinput bila komponen form sudah memformat Rupiah. Contoh `250000` akan tampil sebagai `Rp250.000`.
- Hampir semua form keuangan dan material memakai **dua tahap**: tombol pertama membuka review (**Tinjau**, atau **Tinjau perubahan** pada default budget), lalu review sheet punya tombol final tersendiri (**Buat**, **Tambah**, **Catat**, **Posting**, **Bayar**, **Simpan Default**). Bila langkah di bawah menulis "klik Simpan", yang dimaksud adalah menuntaskan kedua tahap itu. Cocokkan seluruh nilai di review sheet sebelum menekan action final.
- Field kondisional hanya muncul setelah pilihan pemicunya dipilih. Contoh: data klien baru muncul setelah **Jenis klien = Klien baru**.

## 1. Arti “mulai dari kosong”

Runbook ini dimulai dari database yang sudah menjalankan seluruh migration tetapi belum memiliki data bisnis:

- 0 user, role, project, client, vendor, rekening, material, inventory movement, invoice, expense, payment, dan approval;
- tidak menjalankan `db:seed`;
- hanya `ATRIA_BOOTSTRAP_SECRET`, `BETTER_AUTH_SECRET`, database connection, dan URL auth yang diprovision melalui environment;
- seluruh role, reference master, opening balance, dan transaksi dibuat lewat UI/action resmi.

Migration bukan seed. Bootstrap hanya membuat first Owner, empat role system, lima canonical Expense Categories, default Budget Allocation, dan audit evidence. Bootstrap tidak membuat project, vendor, rekening, stock, atau transaksi contoh.

### Reset database development ke data kosong

Gunakan script reset hanya ketika seluruh data pada `DATABASE_URL` memang boleh dihapus. Script mempertahankan schema dan metadata migration, tetapi mengosongkan semua tabel data `public`, termasuk user/account/session Better Auth, role, `app_config`, audit, project, finance, dan inventory.

1. Periksa target dan daftar tabel tanpa mutasi:

   ```bash
   bun run db:reset --dry-run
   ```

2. Jika host dan nama database sudah benar, jalankan reset eksplisit:

   ```bash
   bun run db:reset --confirm-reset
   ```

3. Buka `/setup` dan lanjutkan dari **A0. Bootstrap first Owner**.

Script menolak berjalan tanpa `DATABASE_URL` dan tanpa flag konfirmasi. Ketika `NODE_ENV=production`, reset juga ditolak kecuali diberi `--allow-production`; override tersebut hanya boleh digunakan bila penghapusan database production benar-benar disengaja.

## 2. Akun dan tanggung jawab role

Gunakan empat akun berbeda. Email aktual boleh berbeda, tetapi role harus sama.

| Role            | Tanggung jawab dalam simulasi                                                             | Tidak boleh                                                    |
| --------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Owner           | Setup awal, rekening, finalisasi RAP, approval RAB, high-risk approval, closing           | Menganggap approval sebagai perubahan kas                      |
| Finance Admin   | Verifikasi expense, jadwal/pencairan vendor, invoice client, penerimaan kas, rekonsiliasi | Mengubah stock tanpa explicit material action                  |
| Project Manager | Project yang ditugaskan, menyusun RAP/package, submit expense/vendor bill                 | Membuka global ledger, self-verify expense, membayar transaksi |
| Purchasing      | Material, receipt, reserve/use/return/waste, transfer, stock count                        | Melihat balance rekening atau mengubah budget formula          |

Setelah Account Switcher pada A3 aktif, instruksi “Login sebagai …” pada Bagian B boleh dilakukan dengan simulasi: kembali ke Owner, pilih akun target di `/profile`, lalu lanjutkan flow. Akun aktif yang masih memakai password sementara tetap dapat disimulasikan di development; login normal tetap mengarahkan akun tersebut untuk mengganti password.

Siapkan lembar bukti UAT dengan kolom berikut:

| Waktu | Role | Route | Action | ID dokumen | Nilai sebelum | Nilai sesudah | Expected | Actual | Bukti |
| ----- | ---- | ----- | ------ | ---------- | ------------: | ------------: | -------- | ------ | ----- |

## 3. Dataset kontrol

### 3.1 Identitas

- Project: `UAT Rumah Nara — Full Workflow`
- Client baru: `Nara Pratama`
- PM: akun Project Manager test
- Vendor: `PT Vendor UAT Dekoria`
- Lokasi stock: `Gudang UAT Utama`
- Rekening 1: `BCA UAT Operasional`, opening balance Rp100.000.000
- Rekening 2: `Kas UAT Lapangan`, opening balance Rp10.000.000

### 3.2 Budget defaults untuk test

| Kategori           | Ratio Internal Budget |
| ------------------ | --------------------: |
| Material           |                   38% |
| Tukang             |                   28% |
| Operasional        |                    4% |
| Lain-lain          |                    2% |
| Subcon             |                   20% |
| Total allocation   |                   92% |
| Unallocated Buffer |                    8% |

Internal Budget Cap tetap 90% dari approved RAB/contract value.

### 3.3 Master dan plan

| Item                                  |    Internal cost |     Client price | Qty | Internal total |     Client total |
| ------------------------------------- | ---------------: | ---------------: | --: | -------------: | ---------------: |
| Multipleks UAT 18mm                   | Rp250.000/lembar | Rp312.500/lembar |  20 |    Rp5.000.000 |      Rp6.250.000 |
| Paket Instalasi Kabinet               |      Rp4.000.000 |      Rp5.000.000 |   1 |    Rp4.000.000 |      Rp5.000.000 |
| Paket Top Table Subcon                |      Rp3.000.000 |      Rp3.750.000 |   1 |    Rp3.000.000 |      Rp3.750.000 |
| Koordinasi Design — manual client row |                — |      Rp2.000.000 |   1 |              — |      Rp2.000.000 |
| Total                                 |                  |                  |     |   Rp12.000.000 | **Rp17.000.000** |

Material initial stock: 10 lembar, reserved 0, average cost Rp250.000, minimum stock 2.

### 3.4 Expected budget setelah RAB Rp17.000.000 approved

- Contract Value = Rp17.000.000
- Internal Budget = 90% × Rp17.000.000 = **Rp15.300.000**
- Target Gross = Rp1.700.000 atau 10%

| Kategori           | Expected allocation |
| ------------------ | ------------------: |
| Material           |         Rp5.814.000 |
| Tukang             |         Rp4.284.000 |
| Operasional        |           Rp612.000 |
| Lain-lain          |           Rp306.000 |
| Subcon             |         Rp3.060.000 |
| Unallocated Buffer |         Rp1.224.000 |

## 4. Kontrak observasi mutation: halaman, angka, dan bukti yang harus dilihat

Jangan menyatakan sebuah mutation berhasil hanya karena success sheet muncul. Setiap test harus melewati tiga lapis pemeriksaan berikut:

1. **Surface asal**: form menutup dengan status sukses dan row yang dimutasi menunjukkan status/nilai baru.
2. **Surface silang**: buka halaman kedua yang membaca aggregate berbeda. Contoh: setelah membayar vendor di Expenses, buka Dashboard → Rekening untuk memastikan saldo benar-benar turun.
3. **Invariant**: pastikan angka yang seharusnya tidak berubah memang tetap. Approval, schedule, reserve, dan Goods Receipt bukan cash movement.

Gunakan refresh browser setelah mencatat hasil instan. Nilai setelah refresh harus sama dengan nilai sebelum refresh; jika berbeda, UI hanya memperbarui state lokal tetapi persistence/revalidation belum benar.

### 4.1 Peta UI operasional yang dipakai saat test

| Domain             | Route dan UI                                           | Angka/status utama                                                                                    |
| ------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Posisi perusahaan  | `/ledger` → **Ringkasan**                              | Kas tersedia, Piutang, Hutang, kewajiban ≤7 hari, Budget aktif terpakai, Sisa budget, Margin proyeksi |
| Approval           | `/ledger?tab=approvals` atau `/approvals`              | Jumlah pending, maker, dampak budget setelah approval, nominal, status approval                       |
| Budget             | `/ledger?tab=budget` dan `/projects/<id>?tab=overview` | Project value, Internal Budget, Actual/Consumed, Paid, Remaining, Used %, margin dan category risk    |
| Jatuh tempo        | `/ledger?tab=cash`                                     | Vendor bill/client invoice outstanding dan tanggal jatuh tempo                                        |
| Rekening           | `/ledger?tab=accounts`                                 | Saldo tiap rekening, total cash, dan transaksi kas terbaru                                            |
| Rekonsiliasi bank  | `/reconciliation`                                      | Transaksi internal belum cocok, mutasi rekening koran belum cocok, dan pasangan yang akan disahkan    |
| Expenses           | `/expenses` → **Pengeluaran Lapangan**                 | Diajukan/Terverifikasi/Disetujui/Lunas, antrean, biaya aktual, nilai dibayar, rekening pencairan      |
| Tagihan vendor     | `/expenses` → **Tagihan Vendor** → **Tagihan**         | Belum dibayar/Dibayar sebagian/Lunas, nominal bill, terjadwal, dibayar, dan sisa                      |
| Rencana bayar      | `/expenses` → **Tagihan Vendor** → **Rencana Bayar**   | Menunggu/Sedang diproses/Selesai/Gagal, approval, tanggal rencana, rekening, dan referensi            |
| Material ringkas   | `/materials` → **Ringkasan**                           | Total nilai stok, stok tersedia, shortage, low stock, pending approval                                |
| Kebutuhan material | `/materials?tab=needs`                                 | Kebutuhan RAP, stok diamankan proyek, perlu dibeli, status Siap/Kekurangan                            |
| Inventory          | `/materials?tab=inventory`                             | Stok fisik, direservasi, tersedia, harga rata-rata, dan nilai inventori per lokasi                    |
| Aktivitas material | `/materials?tab=activity`                              | Movement type, qty, project, lokasi, reference dan waktu                                              |
| Stok project       | `/projects/<id>?tab=stok`                              | Required, secured, reserved outstanding, received/bought, used, returned, waste, leftover, shortage   |
| Invoice client     | `/projects/<id>` → tab pembayaran/invoice              | Invoice amount, paid amount, outstanding, status dan cash receipt                                     |

`<id>` berarti UUID project dari URL setelah project dibuka. Jangan memakai angka dari success sheet sebagai satu-satunya bukti; selalu buka route silang pada tabel di atas.

### 4.1.1 Cara membaca detail aktivitas

Setiap baris pada **Aktivitas**, **Riwayat**, **Transaksi terbaru**, dan timeline dapat diketuk. Ketuk seluruh baris—bukan hanya nominal atau ikon—lalu baca drawer **Detail aktivitas** yang menampilkan data terbaru yang tersedia.

Urutan pemeriksaan di drawer:

1. **Identitas**: cocokkan judul, status, pelaku, dan waktu dengan aksi yang baru dilakukan.
2. **Rincian transaksi**: cocokkan jumlah, harga satuan, subtotal/nominal, lokasi, proyek, rekening, dan referensi dokumen.
3. **Perubahan**: bila section ini ada, bandingkan nilai Sebelum dan Sesudah. Section tidak ditampilkan bila histori lama tidak menyimpan bukti before-state.
4. **Dampak bisnis**: pastikan arah stok, budget, kas, utang, piutang, atau nilai kontrak sesuai matriks mutation di bawah.
5. **Catatan & bukti**: periksa alasan approval/rejection/reversal dan nomor referensi. Pesan “Data perubahan historis belum tercatat lengkap” berarti sistem sengaja tidak mengarang data lama.
6. Gunakan CTA bagian bawah untuk membuka sumber yang diizinkan bagi role aktif. CTA yang tidak muncul bukan bukti record hilang; akses sumber dapat dibatasi RBAC.

| Row yang diketuk                                       | Detail utama yang harus cocok                                    | Dampak yang harus diperiksa                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Materials → Pergerakan stok / Project → Aktivitas stok | Material, lokasi, jumlah, harga satuan, jenis pergerakan, pelaku | Stok lokasi naik/turun; reservasi/pakai/kembali/terbuang tidak mengubah kas sendiri  |
| Materials → Transfer                                   | Lokasi asal/tujuan, item, quantity, nilai                        | Asal turun, tujuan naik, net stock global nol, kas tetap                             |
| Materials → Stock opname                               | Jumlah di sistem, hasil hitung fisik, selisih, pemeriksa, alasan | Penyesuaian stok/nilai hanya setelah diposting atau disetujui, kas tetap             |
| Materials → Saldo awal                                 | Seluruh item, harga satuan, subtotal, total, pemeriksa           | Stok dan nilai persediaan naik setelah diposting; kas, utang, realisasi proyek tetap |
| Expenses → Riwayat pengeluaran                         | Jumlah, harga satuan, subtotal, kategori, pengaju/pemeriksa      | Realisasi/dibayar mengikuti status; kas hanya berubah setelah lunas                  |
| Expenses → Tagihan/Rencana bayar                       | Bill, vendor, scheduled/paid, rekening, reference                | Utang dan kas berubah pada tahap yang tepat                                          |
| Dashboard/Rekening → Transaksi terbaru                 | Dana masuk/keluar, nominal, rekening, sumber, rekonsiliasi       | Dana masuk menambah kas; dana keluar mengurangi kas                                  |
| Project → Invoice/pembayaran                           | Invoice, paid, outstanding, rekening, reference                  | Pembayaran mengurangi piutang dan menambah kas                                       |
| Project → Riwayat RAB/Change Order                     | Revisi, nilai sebelum/sesudah, delta, actor, alasan              | Nilai kontrak hanya berubah lewat workflow Change Order yang disetujui               |

### 4.2 Matriks efek mutation yang benar

| Mutation nyata                           | Surface asal                                      | Perubahan yang wajib terlihat                                                                        | Surface silang                             | Angka yang wajib tetap                                       |
| ---------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| `createBankAccount` dengan saldo awal    | Onboarding **Rekening** atau Dashboard → Rekening | Rekening baru dan saldo awal                                                                         | `/ledger` Ringkasan + Rekening             | Project budget, payable, receivable dan stock                |
| `approveRabEstimate` initial             | Project → RAB                                     | RAB APPROVED, project value dan canonical allocation terbentuk                                       | Project Overview + `/ledger?tab=budget`    | Kas, stock, payable dan receivable                           |
| `reserveMaterialForProject`              | Materials action **Reserve**                      | Reserved naik, Available turun, Current tetap                                                        | Project → Stok + Materials → Aktivitas     | Kas, actual, paid dan average cost                           |
| `submitVendorBill` kategori Material     | Expenses → Tagihan                                | Bill UNPAID dan payable naik                                                                         | `/ledger` Ringkasan/Jatuh Tempo            | Kas, Material actual, Material paid dan stock                |
| `submitVendorBill` kategori non-Material | Expenses → Tagihan                                | Bill UNPAID; canonical actual mengikuti source non-material                                          | Project Overview + Budget tab              | Kas dan stock                                                |
| `scheduleVendorBillPayment`              | Tagihan → Jadwalkan                               | Payment PENDING; scheduled/committed naik                                                            | Rencana Bayar + Approval bila high-risk    | Kas, paid dan stock                                          |
| `approveVendorPayment`                   | Approval drawer                                   | Approval APPROVED dan action pencairan menjadi tersedia                                              | Expenses → Rencana Bayar                   | Kas, paid, bill outstanding dan stock                        |
| `payVendorBill`                          | Rencana Bayar → Cairkan                           | Payment COMPLETED, bill paid/outstanding berubah, reference tersimpan, transaksi kas **belum cocok** | `/ledger?tab=accounts` + `/reconciliation` | Current stock dan Material actual untuk inventory purchase   |
| `postGoodsReceipt`                       | Materials → Goods Receipt                         | Current dan asset value naik; receipt POSTED                                                         | Inventory + Aktivitas + Project Stok       | Kas, paid dan payable                                        |
| `useMaterialForProject`                  | Materials action **Use**                          | Current turun, reserve milik project dikonsumsi, Material actual naik                                | Project Stok + Project Overview            | Kas dan paid                                                 |
| `returnMaterialFromProject`              | Materials action **Return**                       | Current naik, net used dan Material actual turun                                                     | Project Stok + Aktivitas                   | Kas dan paid; return tidak otomatis membuat reservation baru |
| `wasteMaterialForProject`                | Materials action **Waste**                        | Current turun, waste dan Material actual naik; shortage bisa naik                                    | Project Stok + Budget + Aktivitas          | Kas dan paid                                                 |
| `submitFieldRequest(s)`                  | Expense form                                      | Request SUBMITTED dan pending category naik                                                          | Project Overview/Budget                    | Actual, paid, kas dan stock kecuali explicit stock handling  |
| `verifyFieldRequest`                     | Expense review                                    | Normal request dapat APPROVED; high-risk berhenti VERIFIED/menunggu Owner                            | Approval + Budget                          | Kas dan paid                                                 |
| `approveFieldRequest`                    | Approval drawer                                   | Request APPROVED dan actual canonical final                                                          | Expenses + Project Budget                  | Kas dan paid                                                 |
| `payFieldRequest`                        | Expenses → Cairkan                                | Request PAID, category paid naik, saldo rekening turun, OUTFLOW ledger tercatat dan **belum cocok**  | `/ledger?tab=accounts` + `/reconciliation` | Stock tanpa explicit material handling                       |
| `createClientInvoice`                    | Project → Invoice                                 | Invoice/outstanding receivable naik                                                                  | `/ledger` Ringkasan/Jatuh Tempo            | Kas sampai pembayaran diterima                               |
| `recordClientPayment`                    | Invoice → Catat Pembayaran                        | Invoice paid/outstanding berubah, saldo rekening naik, INFLOW ledger tercatat dan **belum cocok**    | `/ledger?tab=accounts` + `/reconciliation` | Budget actual, stock dan payable                             |
| `importBankStatementCsv`                 | `/reconciliation` → Impor CSV                     | Baris rekening koran baru dibuat; duplikat dilewati dan saldo tidak berubah                          | `/reconciliation`                          | Saldo sistem, budget, payable, receivable, dan stock         |
| `recordBankStatementRow`                 | `/reconciliation` → Catat mutasi                  | Satu baris rekening koran **belum cocok** dibuat                                                     | `/reconciliation`                          | Saldo sistem, budget, payable, receivable, dan stock         |
| `reconcileCashTransaction`               | `/reconciliation` → Cocokkan                      | Satu transaksi kas dan satu mutasi rekening koran menjadi **Cocok**                                  | `/ledger?tab=accounts` + `/reconciliation` | Saldo, budget, payable, receivable, dan stock                |

### 4.3 Arti angka bisnis yang tidak boleh tertukar

- **Allocated**: batas kategori dari canonical `projectBudgetCategory`.
- **Pending**: request yang sudah diajukan tetapi belum menjadi actual final.
- **Actual/Consumed**: biaya yang diakui ke project. Inventory purchase tidak menjadi Material actual saat bill dibayar; actual muncul ketika material dipakai atau menjadi waste.
- **Paid**: cash outflow yang sudah dicairkan dan diatribusikan ke kategori. Karena timing berbeda, `Paid` dapat lebih besar daripada `Actual`, terutama untuk pembelian inventory yang belum dipakai.
- **Remaining**: `Allocated - Actual`, bukan `Allocated - Paid`.
- **Stok fisik**: jumlah barang yang secara fisik berada di lokasi.
- **Stok direservasi**: stok gudang yang belum keluar, tetapi sudah diamankan untuk proyek.
- **Stok tersedia**: `Stok fisik - Stok direservasi`.
- **Secured project**: unit yang secara canonical sudah aman untuk project; receipt dan reservation atas unit yang sama tidak boleh dihitung dua kali.
- **Need to buy**: kekurangan RAP setelah proyeksi secured/used/return/waste. Global free stock tidak otomatis dianggap milik project sebelum di-reserve.

Jika Dashboard, Project Overview, Expenses, Materials, dan Stok Project menunjukkan definisi berbeda untuk source yang sama, tandai FAIL walaupun total akhirnya terlihat masuk akal.

## BAGIAN A — Akun Baru, Onboarding Setup, & Readiness Gate

### A0. Bootstrap first Owner dari database kosong

1. Pastikan environment memiliki `ATRIA_BOOTSTRAP_SECRET` minimal 16 karakter dan `BETTER_AUTH_SECRET` yang kuat. Keduanya didokumentasikan di `apps/web/.env.example`; salin ke `apps/web/.env` sebelum menjalankan dev server.
2. Buka route khusus `/setup`.
3. Isi nama, email, password Owner (minimal 12 karakter, mengandung huruf besar, huruf kecil, dan angka), serta masukkan bootstrap secret.
4. Submit satu kali, lalu login sebagai Owner.

Contoh form **Buat Owner pertama**:

| Field            | Wajib | Contoh UAT                       | Catatan                                                              |
| ---------------- | ----- | -------------------------------- | -------------------------------------------------------------------- |
| Bootstrap secret | Ya    | `<nilai ATRIA_BOOTSTRAP_SECRET>` | Ambil dari environment; jangan dicatat di bukti UAT atau screenshot. |
| Nama Owner       | Ya    | `Owner UAT Dekoria`              | Menjadi identitas Owner pertama.                                     |
| Email            | Ya    | `owner.uat@dekoria.test`         | Gunakan alamat test yang dapat dibedakan dari akun staff.            |
| Password awal    | Ya    | `OwnerUAT2026!`                  | Minimal 12 karakter, mengandung huruf besar, kecil, dan angka.       |

Expected:

- Sebelum submit, setup required (diarahkan ke form setup);
- Sesudah submit, retry bootstrap ditolak sebagai conflict (409);
- 1 Owner aktif, 4 role system, 5 kategori canonical, dan 1 default budget tersedia;
- Audit `BOOTSTRAP_PRODUCTION_FOUNDATION` tersedia;
- 0 project, 0 rekening, 0 cash transaction, 0 vendor, dan 0 stock movement;
- Route `/setup` terkunci dan tidak dapat digunakan lagi untuk membuat Owner kedua.

---

### A1. Panduan Workspace Onboarding

Setelah login pertama sebagai Owner, sistem secara otomatis mengarahkan Anda ke route `/onboarding`. Semua setup dasar dilakukan dalam satu workspace terintegrasi ini.

#### Mekanisme UI & UX Onboarding yang Wajib Diuji:

1. **Penyimpanan Drawer (Contextual Form Style)**: Form tambah/edit data dibuka sebagai drawer bottom sheet (iOS-inspired). Menekan tombol simpan/save akan memperbarui data dan indikator kesiapan (`readiness`) secara inline tanpa memindahkan posisi langkah (step) aktif atau mengubah URL.
2. **Konfirmasi Unsaved Changes**: Jika ada draft input dalam drawer yang berubah lalu drawer ditutup tanpa disimpan, konfirmasi **"Buang perubahan?"** harus muncul demi keamanan data.
3. **Navigasi Step**: Owner menekan tombol **"Lanjut"** di bagian bawah halaman setelah memverifikasi data. Perhatikan satu pengecualian nyata: ketika sebuah simpanan membuat status langkah berubah dari _Perlu dilengkapi_ menjadi siap untuk pertama kalinya, aplikasi langsung memindahkan Owner ke langkah berikutnya. Simpanan berikutnya pada langkah yang sama tidak memindahkan apa pun.
4. **Lewati Step (Skip)**: Untuk step non-mandatory, tombol **"Lewati step ini"** tersedia. Status step di summary akan ditandai sebagai **"Dilanjutkan nanti" (SKIPPED)** tanpa memalsukan readiness checklist aktual.
5. **Jeda dan Lanjutkan (Pause & Resume)**:
   - Tekan tombol **"Silang/Close" (X)** di kanan atas header onboarding.
   - Sistem akan mengarahkan Owner ke Dashboard utama `/ledger`. Pastikan Owner tetap dapat menjelajahi aplikasi.
   - Untuk melanjutkan, gunakan kartu **Lanjutkan setup** yang tampil untuk Owner. Jangan mengetik route manual; sistem mengembalikan Owner ke step terakhir yang tersimpan.
6. **Verification snapshot**: Setelah setiap create/edit/mutasi tersimpan, tetap berada pada step yang sama dan baca panel **Verification snapshot**. Panel ini berasal dari query database, bukan angka optimistis form. Cocokkan fakta bisnis, actor, status, before/after, dan dampak sebelum menekan **Lanjut**.
7. **Detail teknis developer**: Saat `ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED="true"` pada non-production, disclosure developer menampilkan record ID, reference ID, movement ID, dan audit context. Informasi ini tidak tampil di production.

---

### A2. Langkah-Langkah Onboarding

Ikuti urutan langkah di bawah ini untuk mengisi data kontrol UAT langsung dari dalam workspace `/onboarding`.

> **Penomoran langkah.** Header di aplikasi menghitung **enam** langkah yang dapat dikerjakan
> (`1 dari 6` … `6 dari 6`); `welcome` dan `summary` tidak ikut dihitung. Judul di bawah memakai
> penomoran aplikasi, dengan Step ID canonical sebagai penanda yang stabil.

#### Pengenalan · sebelum langkah 1 (Step ID: `welcome`)

- **Tampilan**: Landing page onboarding yang menjelaskan tujuan setup organisasi (default finansial, tim, kas, dan master data).
- **Aksi**: Baca panduan lalu tekan tombol primary **"Mulai setup"**.
- **Expected**: Progress bar di atas berubah dari 0% ke langkah 1/8.

#### Langkah 1 dari 6 — Review default finansial (Step ID: `financial_defaults`)

- **Tampilan**: Hubungan default budget, alokasi, dan unallocated buffer. Terdapat segmented tab **Budget / Kategori**.
- **Aksi (1) - Konfigurasi Budget Allocation**:
  - Pada tab **Budget**, klik **Sesuaikan** untuk membuka drawer _Default Budget_.
  - Isi form alokasi sesuai target kontrol UAT:
    - **Batas Budget Internal (Cap)**: `90%` dari nilai kontrak.
    - **Nama Default**: `Default UAT 90-92`
    - **Rasio Alokasi Kategori**:
      - Material: `38%`
      - Tukang: `28%`
      - Operasional: `4%`
      - Lain-lain: `2%`
      - Subcon: `20%`
    - **Catatan**: `Baseline UAT production kosong — alokasi 92% dan buffer 8%.`
  - Klik **Simpan**.
- **Aksi (2) - Verifikasi Expense Categories**:
  - Pindah ke tab **Kategori** dan verifikasi lima kategori biaya canonical telah aktif dengan kode: `MATERIAL`, `TUKANG`, `OPERASIONAL`, `LAIN_LAIN`, `SUBCON`.
- **Expected**:
  - Total alokasi terhitung otomatis `92%` dan unallocated buffer `8%`.
  - Simpan berhasil menutup drawer dan memperbarui visual preview (Internal 90%, Terbagi 92%, Buffer 8%).
  - Negative test: jika alokasi kategori diisi hingga total > 100% (misal 101%), tombol simpan harus memunculkan error validation dan tidak dapat disubmit.
- Tekan **Lanjut** untuk ke langkah berikutnya.

#### Langkah 2 dari 6 — Siapkan tim dan vendor (Step ID: `team_vendors`)

- **Tampilan**: Ringkasan jumlah tim dan vendor aktif. Terdapat segmented tab **Tim / Vendor**.
- **Aksi (1) - Buat Akun Tim**:
  - Pada tab **Tim**, klik tambah user lewat drawer sebanyak 3 kali untuk membuat peran staff berikut:

    | Nama user        | Email                         | Role              | Password sementara |
    | ---------------- | ----------------------------- | ----------------- | ------------------ |
    | `Finance UAT`    | `finance.uat@dekoria.test`    | `Finance Admin`   | `FinanceTemp2026!` |
    | `PM UAT Nara`    | `pm.uat@dekoria.test`         | `Project Manager` | `PmTempUAT2026!`   |
    | `Purchasing UAT` | `purchasing.uat@dekoria.test` | `Purchasing`      | `PurchTemp2026!`   |

  - Password sementara tidak memblokir readiness onboarding. Forced-password flow diuji setelah control room selesai agar Owner tidak perlu meninggalkan workspace pada rangkaian setup ini.
- **Aksi (2) - Tambah Vendor Master**:
  - Kembali ke tab **Vendor** di onboarding Owner, klik tambah vendor lewat drawer:
    - **Nama vendor**: `PT Vendor UAT Dekoria`
    - **Telepon**: `081234567890`
    - **Email**: `vendor.uat@dekoria.test`
    - **Alamat**: `Jl. UAT Material No. 18, Jakarta`
    - **Bank**: `BCA`
    - **Nomor rekening**: `8880001800`
    - **Nama pemilik**: `PT Vendor UAT Dekoria`
    - Klik **Simpan**.
- **Expected**: Tim dan vendor terdaftar di database secara riil. List dan status kesiapan di onboarding terupdate secara instan.
- Tekan **Lanjut**.

#### Langkah 3 dari 6 — Tambahkan rekening perusahaan (Step ID: `bank_accounts`)

- **Tampilan**: List rekening aktif.
- **Aksi - Tambah Rekening & Saldo Awal**:
  - Klik **Tambah** untuk membuka drawer form rekening, ulangi proses ini dua kali untuk membuat dua rekening berikut:

    | Field              | Rekening 1 (BCA)             | Rekening 2 (Kas Lapangan) |
    | ------------------ | ---------------------------- | ------------------------- |
    | **Nama Rekening**  | `BCA UAT Operasional`        | `Kas UAT Lapangan`        |
    | **Nama Bank**      | `BCA`                        | `Kas`                     |
    | **Nomor Rekening** | `8889991122`                 | `0000000001`              |
    | **Pemegang**       | `PT Dekoria Desain Estetika` | `PM UAT Nara`             |
    | **Saldo Awal**     | `100000000` (Rp100.000.000)  | `10000000` (Rp10.000.000) |
    | **Tampilan Kartu** | `BCA Night`                  | `Cash Mint`               |

  - Klik **Simpan** untuk masing-masing rekening.
- **Expected**:
  - Terbuat 2 rekening baru dengan total saldo kas terkonsolidasi menjadi **Rp110.000.000**.
  - Karena saldo awal > 0, sistem otomatis mencatat transaksi ledger `INFLOW` dengan kategori `opening_balance` dan membuat log audit.
  - Di **Verification snapshot**, cocokkan identitas kedua rekening, saldo aktual total `Rp110.000.000`, serta entry ledger saldo awal. Project cost, payable, receivable, dan stok tidak berubah.
- Tekan **Lanjut**.

#### Langkah 4 dari 6 — Siapkan lokasi dan Material Master (Step ID: `material_foundation`)

- **Tampilan**: Segmented tab **Lokasi / Material**.
- **Aksi (1) - Buat Lokasi Gudang**:
  - Pada tab **Lokasi**, klik **Buat lokasi**:
    - **Nama lokasi baru**: `Gudang UAT Utama`
    - Klik **Simpan**.
- **Aksi (2) - Tambah Material Master**:
  - Pindah ke tab **Material** (hanya terbuka jika minimal ada 1 lokasi aktif).
  - Klik tambah material melalui drawer:
    - **Kategori**: Buat kategori baru bernama `Panel UAT`.
    - **Nama Material**: `Multipleks UAT 18mm`
    - **Satuan**: `lembar`
    - **Merek / Kode**: `UAT Board` / `UAT-PLY-18`
    - **Warna**: `Natural`
    - **Vendor Default**: `PT Vendor UAT Dekoria`
    - **Spesifikasi**: `18mm test grade`
    - **Lokasi Default**: `Gudang UAT Utama`
    - **Stok Minimum**: `2`
    - **Harga Acuan**: `250000` (Rp250.000)
    - Klik **Simpan**.
  - _(Opsional) Pengujian CSV Import_: Owner juga dapat menggunakan tombol **Import CSV** untuk mengunggah master data dalam batch menggunakan template:
    ```csv
    name,category,unit,location,minimum_stock,last_purchase_price,vendor,specification,brand,code,color
    Multipleks UAT 18mm,Panel UAT,lembar,Gudang UAT Utama,2,250000,PT Vendor UAT Dekoria,18mm test grade,UAT Board,UAT-PLY-18,Natural
    ```
- **Expected**: Material Master terdaftar. Stok fisik awal di inventory secara default masih bernilai **0** (average cost Rp0, total value Rp0). Tidak ada cash transaction yang terbuat.
- Tekan **Lanjut**.

#### Langkah 5 dari 6 — Siapkan Library Item & Harga (Step ID: `item_library`)

- **Tampilan**: Daftar template aktif yang dapat digunakan kembali ketika menyusun RAP Material, Paket Tukang, Paket Subcon, atau baris RAB klien. Step ini boleh dilewati, tetapi UAT ini mengisi tiga template agar alur proyek berikutnya dapat diuji dengan data yang konsisten.
- **Pola input yang benar**: Setiap template diisi berurutan dari **Identitas template → Rincian biaya → Harga untuk klien → Sumber harga & detail → Simpan Template**. Jangan menekan **Simpan Template** sebelum komponen biaya di dalamnya disimpan.
- **Aksi - Tambah 3 Template Library**:

  1. Klik **Tambah** untuk membuka drawer **Tambah Template Harga**.
  2. Isi template pertama menggunakan tabel di bawah. Setelah berhasil tersimpan dan drawer tertutup, klik **Tambah** lagi untuk template kedua, lalu ulangi untuk template ketiga.

  | Urutan field pada form     | Template Material                 | Template Tukang                 | Template Subcon                 |
  | -------------------------- | --------------------------------- | ------------------------------- | ------------------------------- |
  | **Tipe item**              | `Material`                        | `Paket Tukang`                  | `Paket Subcon`                  |
  | **Kategori pengeluaran**   | Otomatis `Material` dan read-only | Otomatis `Tukang` dan read-only | Otomatis `Subcon` dan read-only |
  | **Nama template**          | `Multipleks UAT 18mm`             | `Paket Instalasi Kabinet`       | `Paket Top Table Subcon`        |
  | **Kategori item**          | `Panel UAT`                       | `Instalasi Kabinet`             | `Top Table`                     |
  | **Satuan**                 | `lembar`                          | `paket`                         | `paket`                         |
  | **Tautan Material Master** | Pilih `Multipleks UAT 18mm`       | Field tidak tampil              | Field tidak tampil              |

  **Isi Rincian biaya pada setiap template**:

  - Form baru sudah membawa satu baris kosong **Komponen 1**. Ketuk baris tersebut; gunakan tombol **Tambah** hanya jika memang membutuhkan komponen biaya kedua.
  - Di drawer **Edit Komponen Biaya**, isi field sesuai urutan layar berikut:

    | Urutan field komponen | Template Material        | Template Tukang            | Template Subcon            |
    | --------------------- | ------------------------ | -------------------------- | -------------------------- |
    | **Tipe komponen**     | `Material`               | `Tenaga kerja`             | `Lainnya`                  |
    | **Nama biaya**        | `Multipleks utama`       | `Jasa instalasi kabinet`   | `Jasa top table`           |
    | **Jumlah**            | `1`                      | `1`                        | `1`                        |
    | **Satuan**            | `lembar`                 | `paket`                    | `paket`                    |
    | **Biaya satuan**      | `250000`                 | `4000000`                  | `3000000`                  |
    | **Subtotal komponen** | Harus tampil `Rp250.000` | Harus tampil `Rp4.000.000` | Harus tampil `Rp3.000.000` |

  - Klik **Simpan**. Pastikan kembali ke drawer template dan baris komponen berstatus **Lengkap**, bukan **Perlu diperiksa**.

  **Isi Harga untuk klien**:

  | Urutan field/angka preview  | Template Material    | Template Tukang      | Template Subcon      |
  | --------------------------- | -------------------- | -------------------- | -------------------- |
  | **Metode harga**            | `Berdasarkan margin` | `Berdasarkan margin` | `Berdasarkan margin` |
  | **Target margin kotor (%)** | `20`                 | `20`                 | `20`                 |
  | **Biaya internal**          | `Rp250.000`          | `Rp4.000.000`        | `Rp3.000.000`        |
  | **Harga klien**             | `Rp312.500`          | `Rp5.000.000`        | `Rp3.750.000`        |
  | **Margin kotor**            | `20%`                | `20%`                | `20%`                |

  > Harga klien pada mode margin dihitung dengan rumus `biaya internal / (1 - target margin)`. Target `20%` bukan markup 20% dari biaya. Jika memilih **Harga tetap**, field target margin diganti oleh **Harga tetap untuk klien** dan nominalnya wajib lebih dari Rp0.

  **Lengkapi Sumber harga & detail**:

  | Urutan field pada disclosure | Template Material                                          | Template Tukang                                                      | Template Subcon                                                     |
  | ---------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
  | **Kode**                     | `LIB-UAT-MAT-001`                                          | `LIB-UAT-TKG-001`                                                    | `LIB-UAT-SUB-001`                                                   |
  | **Berlaku mulai**            | Tanggal hari pengujian                                     | Tanggal hari pengujian                                               | Tanggal hari pengujian                                              |
  | **Vendor default**           | `PT Vendor UAT Dekoria`                                    | `Tanpa vendor default`                                               | `PT Vendor UAT Dekoria`                                             |
  | **Sumber harga**             | `Rincian biaya`                                            | `Rincian biaya`                                                      | `Penawaran vendor`                                                  |
  | **Catatan sumber**           | `Harga acuan Material Master UAT pada tanggal setup awal.` | `Estimasi tenaga kerja internal UAT untuk satu paket instalasi.`     | `Penawaran PT Vendor UAT Dekoria untuk satu paket top table.`       |
  | **Deskripsi**                | `Template material panel untuk pengujian RAP dan RAB.`     | `Template pekerjaan instalasi kabinet untuk pengujian paket Tukang.` | `Template pekerjaan top table vendor untuk pengujian paket Subcon.` |
  - **Berlaku mulai** dan **Catatan sumber** wajib valid. **Kode**, **Vendor default**, dan **Deskripsi** secara sistem bersifat opsional, tetapi tetap diisi pada UAT agar sumber angka mudah diaudit.
  - Pilihan **Sumber harga** yang tersedia untuk template baru adalah **Rincian biaya**, **Penawaran vendor**, dan **Riwayat harga**. Opsi **Data lama** tidak tersedia untuk template baru; label tersebut hanya dipertahankan saat membuka record hasil migrasi lama agar datanya tetap dapat dibaca dan dipindahkan ke sumber canonical.
  - Periksa status ringkas di header drawer: jumlah komponen, total biaya internal, dan margin harus sama dengan tabel preview di atas.
  - Klik **Simpan**. Expected toast: **Template dan breakdown harga berhasil disimpan.**

- **Expected setelah ketiga template tersimpan**:
  - Ringkasan onboarding menampilkan **3 template aktif**.
  - Ketiga nama template muncul pada daftar; nominal utama masing-masing adalah `Rp312.500`, `Rp5.000.000`, dan `Rp3.750.000`.
  - Tidak ada saldo bank, stok fisik, actual spend, tagihan vendor, atau cash transaction yang berubah. Mutasi ini hanya membuat master template harga dan komponen biayanya serta menulis audit log `CREATE_PRICING_TEMPLATE`.
  - Harga yang nantinya disalin ke RAP/RAB menjadi snapshot. Perubahan Library di kemudian hari tidak mengubah RAP/RAB lama secara diam-diam.
- Tekan **Lanjut**.

#### Langkah 6 dari 6 — Tentukan saldo awal stok (Step ID: `initial_stock`)

- **Tampilan**: Pilihan keputusan saldo awal stok lama.
- **Aksi (1) - Ajukan Saldo Awal Fisik (Maker-Flow)**:
  - Tekan **Ada stok lama** untuk membuka drawer input stok fisik.
  - Masukkan data pembukaan stok secara manual (atau via CSV upload):
    - **Tanggal saldo awal**: Pilih hari ini.
    - **Dokumen referensi**: `Stock opname UAT 2026-01`
    - **Catatan sumber data**: `Saldo awal dari hasil hitung fisik Gudang UAT Utama.`
    - Pada bagian **Stok fisik**, perhatikan indikator `0 dari 1 dipilih`. Satu pengajuan dapat memuat banyak material/lokasi; jumlah maksimal mengikuti inventory yang masih eligible.
    - Pada **Item stok 1**, pilih `Multipleks UAT 18mm — Gudang UAT Utama`, isi Jumlah Fisik = `10 lembar` dan Harga Pokok Rata-rata = `250000`.
    - Verifikasi **Nilai awal item** dan ringkasan **Nilai inventory awal** sama-sama menampilkan `Rp2.500.000`.
    - Karena skenario dasar hanya memiliki satu kombinasi material/lokasi, tombol tambah akan berubah menjadi **Semua inventory sudah ditambahkan** setelah item dipilih. Jika tersedia inventory lain, tekan **Tambah baris item stok** atau **Tambah item stok lainnya**, lalu isi setiap baris sebelum mengajukan batch.
    - Klik **Ajukan saldo awal**.
  - **Expected Saat Pending**: Batch berlabel **Menunggu persetujuan** terbuat. Namun, pastikan stok aktual `Multipleks UAT 18mm` di gudang **tetap bernilai 0** dan belum ada pergerakan **Saldo awal stok** yang diposting.
  - **Negative test pengajuan ganda**: Tetap di step **Saldo awal stok**. Inventory yang sudah berada di batch pending harus menjadi tidak eligible dan tombol **Ada stok lama** disabled jika tidak ada kandidat lain. Sistem harus menolak pengajuan kedua untuk kombinasi material/lokasi yang sama.
  - Ketuk batch pada riwayat saldo awal. Drawer detail harus menampilkan nomor/status batch, nilai persediaan `Rp2.500.000`, item `Multipleks UAT 18mm — Gudang UAT Utama`, jumlah `10 lembar`, harga pokok `Rp250.000/lembar`, subtotal, pengaju, dokumen referensi, dan catatan sumber. Selama masih menunggu keputusan, stok fisik/direservasi/tersedia tetap `0` dan belum ada harga rata-rata atau pergerakan stok.
- **Aksi (2) - Persetujuan Saldo Awal (Checker-Flow)**:
  - **Aturan Keamanan (Maker-Checker)**: Pembuat pengajuan (Purchasing/Owner) tidak boleh menyetujui pengajuannya sendiri.
  - **Production**: Finance Admin login normal. Dari landing setelah login, sistem otomatis membuka restricted **Onboarding Review** jika onboarding belum selesai dan ada setup approval pending. Finance tidak melihat editor budget, tim, rekening, Material Master, atau margin Owner.
  - **Development inline (disarankan untuk walkthrough tunggal)**: Sebagai Owner tekan **Simulasikan Finance Admin** pada batch pending. Baca confirmation effective identity/audit, lalu konfirmasi. Panel yang sama berubah menjadi mode review Finance tanpa logout atau navigation manual. Temporary password Finance tidak memblokir context khusus ini.
  - Pada **Item stok fisik**, pastikan **Jumlah fisik** = `10 lembar`, **Harga per unit** = `Rp250.000`, **Subtotal** = `Rp2.500.000`, dan total batch sama.
  - Isi **Alasan keputusan**: `Saldo fisik dan harga pokok sudah cocok dengan dokumen stock opname.` (minimal 10 karakter), lalu tekan **Setujui & posting**.
  - Pada simulasi development, keputusan **Setujui & posting** otomatis menghentikan simulasi, mengembalikan sesi ke Owner, memuat data terbaru, lalu membuka **Ringkasan**. Keputusan **Tolak** kembali ke langkah saldo awal agar Owner dapat membaca alasan dan memperbaiki pengajuan. Jika penyimpanan keputusan gagal, mode Finance tetap aktif dan tombol **Kembali ke Owner tanpa keputusan** tersedia.
  - Pada login Finance biasa, keputusan tersimpan lalu pengajuan berikutnya langsung dibuka. Setelah antrean habis, tampil status **Semua saldo awal sudah diperiksa** dengan tombol **Masuk Dashboard**; Finance tidak membuka Ringkasan Owner.
- **Expected Setelah Diposting**:
  - Status batch berubah menjadi **Diposting**.
  - Stok `Multipleks UAT 18mm` di `Gudang UAT Utama` bertambah secara riil: Stok fisik = `10`, Direservasi = `0`, Tersedia = `10`, Harga rata-rata = `Rp250.000`, Nilai inventori = `Rp2.500.000`.
  - Tercatat pergerakan tipe **Saldo awal stok**. Kode internal `OPENING_BALANCE` hanya boleh terlihat pada detail teknis developer.
  - Saldo kas bank, utang, dan realisasi biaya proyek tetap Rp0 karena posting saldo awal stok tidak mengubah kas.
- Bila masih ada material/lokasi lain yang memenuhi syarat, tombol **Catat saldo awal lainnya** tetap tersedia tanpa menghilangkan status sukses batch yang sudah final.
- Jika keputusan dilakukan melalui simulasi Finance, Ringkasan terbuka otomatis. Status pending tetap boleh membuka Ringkasan secara manual, tetapi penyelesaian onboarding terblokir sampai seluruh keputusan Finance final.

#### Ringkasan · setelah langkah 6 (Step ID: `summary`)

- **Tampilan**: Ringkasan control room di dalam shell onboarding yang sama; bukan Dashboard operasional.
- **Aksi**: Tinjau status seluruh step.
  - Section **Wajib diselesaikan** berisi hard blocker yang menonaktifkan kedua CTA final. Section **Boleh dilengkapi nanti** berisi warning vendor/library yang tidak memblokir completion.
  - Ketuk blocker, warning, atau baris readiness untuk kembali ke step internal terkait. Jangan membuka route operasional atau mengetik URL.
  - Setelah semua step siap, pilih salah satu action final di bagian bawah:
    - **"Buat proyek pertama"**: Menyelesaikan onboarding dan langsung mengarahkan Anda ke route pembuatan proyek (`/projects?new-project=true`).
    - **"Masuk Dashboard"**: Menyelesaikan onboarding dan mengarahkan ke dashboard utama `/ledger`.
- **Expected**: Completion hanya berhasil jika budget + lima kategori canonical, tiga akun role inti, rekening aktif, lokasi + Material Master, serta keputusan saldo awal final telah diverifikasi ulang server-side dan tidak ada batch pending. Flag berubah menjadi `COMPLETED` dan audit log penyelesaian tercatat.

---

### A3. Aktifkan Account Switcher khusus developer

Fitur ini mengganti effective user pada **session browser yang sama**. Ini bukan sekadar mengganti label role di client: route guard, project scoping, permission, maker-checker, audit actor, dan seluruh Server Action berikutnya benar-benar membaca akun tim yang dipilih.

#### A3.1 Konfigurasi environment

Tambahkan atau ubah nilai berikut pada `.env`, lalu restart dev server:

```env
ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED="true"
```

Ketentuan keamanan:

- fitur selalu mati ketika `NODE_ENV=production`, walaupun flag bernilai `true`;
- hanya Owner aktif yang dapat memulai simulasi;
- context `GENERAL` dari Profile mensyaratkan onboarding `COMPLETED` dan tiga role inti aktif; status password sementara ditampilkan tetapi tidak memblokir simulation development;
- context `ONBOARDING_SETUP_REVIEW` hanya tersedia dari step saldo awal dan hanya menargetkan Finance Admin aktif;
- fitur tidak membaca, menampilkan, atau mengubah password target;
- start dan stop simulation dicatat sebagai `START_DEVELOPER_ACCOUNT_SIMULATION` dan `STOP_DEVELOPER_ACCOUNT_SIMULATION` pada audit log.
- audit start/stop menyimpan simulation context agar penggunaan bypass setup dapat dibedakan dari switcher umum.

Migration `0022_developer_account_simulation` harus sudah diterapkan. Migration menambahkan `session.developer_actor_user_id` untuk menyimpan Owner asal tanpa membuat session/password baru.

#### A3.2 Memulai simulasi

1. Login sebagai Owner dan buka `/profile`.
2. Cari section **Simulasi developer**. Section hanya muncul jika flag development aktif.
3. Pastikan tidak ada blocker onboarding atau team readiness.
4. Pilih akun, misalnya `Purchasing UAT`.
5. Pada confirmation sheet, cocokkan nama dan role, lalu tekan **Mulai simulasi**.
6. Browser berpindah ke landing route role:
   - Finance Admin → `/ledger`;
   - Project Manager → `/projects`;
   - Purchasing → `/materials`.

Expected:

- floating status simulation tampil tepat di atas bottom navigation, memuat role dan nama akun efektif, serta tetap berada di bawah layer drawer;
- avatar/Profile, menu, navigation, data scoping, dan mutation mengikuti akun target;
- PM hanya melihat project yang di-assign kepadanya;
- Purchasing tidak memperoleh saldo rekening atau commercial margin;
- aksi yang dilakukan selama mode ini menyimpan akun target sebagai actor bisnis, sama seperti login normal;
- refresh browser tidak mengembalikan role ke Owner.
- akun dengan badge **Password sementara** tetap dapat diuji; password tidak dibaca atau diubah, sedangkan login normal tetap mewajibkan penggantian password.

#### A3.3 Kembali ke Owner dan berpindah role lagi

1. Tekan **Kembali** pada floating status simulation.
2. Session yang sama dikembalikan ke Owner dan diarahkan ke `/profile`.
3. Pastikan identity surface kembali menampilkan Owner.
4. Pilih akun berikutnya dari section **Simulasi developer**.

Stop simulation tetap boleh dilakukan jika flag `.env` dimatikan setelah simulasi dimulai. Hal ini mencegah session tertinggal sebagai staff. Jika session sudah di-logout atau expired, login kembali dengan kredensial Owner seperti biasa.

#### A3.4 Negative test switcher

| Test                                        | Expected                                                         |
| ------------------------------------------- | ---------------------------------------------------------------- |
| Flag `false` lalu restart                   | Section tidak muncul dan start action mengembalikan FORBIDDEN    |
| `NODE_ENV=production` + flag `true`         | Fitur tetap tidak aktif                                          |
| Onboarding belum COMPLETED                  | Section menunjukkan blocker; tidak ada target yang dapat dipilih |
| Salah satu role minimum belum ada           | Section menunjukkan blocker team readiness                       |
| Target masih `mustChangePassword=true`      | Target tetap tersedia dengan badge **Password sementara**        |
| Staff mencoba memanggil start action        | Ditolak; hanya original active Owner dapat memulai               |
| Owner memilih akun nonaktif/UUID manipulasi | Ditolak tanpa mengubah session                                   |
| Refresh selama simulasi                     | Role simulasi tetap aktif dan banner tetap tampil                |
| Stop simulation                             | Kembali ke Owner; marker session kosong; audit stop tercatat     |

Baris blocker `Onboarding belum COMPLETED` hanya berlaku untuk switcher `GENERAL` di Profile. Tombol inline **Simulasikan Finance Admin** tetap tersedia pada control room ketika flag aktif dan ada Finance Admin aktif.

---

### A4. Login dan Empty-State Check sebagai Owner

Setelah menyelesaikan onboarding secara penuh, lakukan pengecekan kebersihan data operasional awal:

1. Buka Dashboard Finansial `/ledger`. Pastikan kas terhitung tepat **Rp110.000.000**, sedangkan piutang, hutang, pengeluaran proyek, dan pending approval semuanya bernilai **Rp0**.
2. Buka halaman Proyek `/projects`. Pastikan daftar proyek aktif kosong (empty state).
3. Buka halaman Stok `/materials`. Pastikan total stok barang di `Gudang UAT Utama` tercatat 10 lembar Multipleks 18mm, dengan status reserved = 0 dan available = 10.
4. Buka halaman Settings `/settings`. Verifikasi bahwa parameter allocation default dan kategori biaya sudah tersimpan sesuai data onboarding.

---

### A5. Role Boundary Smoke Test (Security Gate)

Sebelum memulai transaksi proyek, uji pembatasan hak akses (RBAC) antar akun menggunakan route URL langsung (bukan sekadar menyembunyikan menu UI):

1. **Project Manager (PM) Boundary Test**:
   - Gunakan switcher developer untuk masuk sebagai `PM UAT Nara` atau login normal dengan akun tersebut.
   - Coba buka URL global finance `/ledger`. Sistem wajib menolak akses (redirect ke unauthorized/error page).
   - Pastikan PM tidak bisa melihat total saldo kas organisasi.
2. **Purchasing Boundary Test**:
   - Kembali ke Owner, lalu simulasikan `Purchasing UAT` atau login normal.
   - Buka menu Expenses `/expenses`. Purchasing tetap boleh melihat nominal dan status tagihan yang dibutuhkan untuk pengadaan, tetapi pilihan rekening, nama bank, dan saldo tidak ditampilkan.
   - Arti “data rekening diblokir” adalah server tidak menjalankan query daftar rekening untuk Purchasing dan menghapus relasi rekening dari data pembayaran sebelum respons dikirim ke browser. Ini bukan rekening yang dibekukan di bank.
   - Coba buka menu settings budget `/settings/budget`. Sistem wajib memblokir mutasi budget default oleh Purchasing.
3. **Finance Admin Boundary Test**:
   - Kembali ke Owner, lalu simulasikan `Finance UAT` atau login normal.
   - Buka menu Settings. Finance hanya menerima dan melihat data **Vendor** serta boleh menambah atau memperbaruinya untuk kebutuhan tagihan dan pembayaran.
   - Tab **User**, daftar user, pilihan role, tombol tambah user, dan drawer edit user tidak dikirim atau dirender. Pemanggilan Server Action manajemen user secara langsung tetap ditolak; hanya Owner yang boleh mengelola user.

---

## BAGIAN B — Project Execution, Material Control, dan Closing

### B1. Owner membuat project dari nol

#### B1.1. Create project

Sebagai Owner buka `/projects` → Buat Proyek Baru.

1. Nama project: `UAT Rumah Nara — Full Workflow`.
2. Pilih Klien Baru dan isi `Nara Pratama` beserta kontak.
3. Assign akun PM test.
4. Buka Detail operasional lalu isi lokasi, tanggal, area, tipe project, cover bila diperlukan, dan note UAT.
5. Tinjau lalu simpan.

Contoh form **Buat Proyek Baru**:

| Field           | Wajib | Contoh UAT                                             |
| --------------- | ----- | ------------------------------------------------------ |
| Nama Proyek     | Ya    | `UAT Rumah Nara — Full Workflow`                       |
| Jenis klien     | Ya    | `Klien baru`                                           |
| Nama Klien      | Ya    | `Nara Pratama`                                         |
| No. Telepon     | Tidak | `081298765432`                                         |
| Email           | Tidak | `nara.uat@example.test`                                |
| Alamat Klien    | Tidak | `Jl. Simulasi Produksi No. 17, Jakarta`                |
| Project Manager | Ya    | `PM UAT Nara`                                          |
| Tanggal Mulai   | Tidak | `20 Juli 2026`                                         |
| Tanggal Selesai | Tidak | `30 September 2026`                                    |
| Lokasi          | Tidak | `Menteng, Jakarta`                                     |
| Ruangan/Area    | Tidak | `Kitchen`                                              |
| Tipe Proyek     | Tidak | `Interior Fit-Out`                                     |
| Cover proyek    | Tidak | `Kosongkan`                                            |
| Catatan Proyek  | Tidak | `Project simulasi full workflow dari database kosong.` |

Status tidak tampil pada form create current state; jangan mencari field itu. Status awal mengikuti aturan sistem. Field **Status Proyek** dan **Kesehatan Finansial** hanya muncul saat Edit Proyek.

Expected immediately:

- project dan client baru tersimpan;
- `totalContractValue = Rp0`;
- canonical Project Budget otomatis `DRAFT`;
- Internal Budget dan semua category allocation masih Rp0;
- ratio category sudah 38/28/4/2/20;
- project terkunci untuk Expenses dan Payments;
- RAP setup tetap dapat dimulai.

Jika project tersimpan tetapi canonical budget tidak ada, hentikan run. Ini adalah known atomicity gap dan perlu recovery engineering.

#### B1.2. PM scoping

Login sebagai PM yang ditugaskan.

- Project UAT harus terlihat.
- Project milik PM lain tidak boleh dapat dibuka lewat URL langsung.
- Dashboard global dan saldo rekening tidak boleh terlihat.

### B2. PM menyusun internal plan

#### B2.1. Buat RAP draft

Buka Project UAT → tab **Perencanaan → RAP** → **Mulai Susun RAP**.

Expected: RAP revision 1, status `DRAFT`, stage `MATERIAL`.

#### B2.2. Tambahkan Material dari Library

Gunakan template `Multipleks UAT 18mm`:

- area `Kitchen`;
- required 18;
- buffer 2;
- total 20;
- source `Stock + Purchase`;
- internal note `Gunakan stock existing terlebih dahulu`.

Contoh form **Tambah Material RAP**:

| Field                    | Contoh UAT                                |
| ------------------------ | ----------------------------------------- |
| Gunakan template Library | `Multipleks UAT 18mm`                     |
| Material Master          | `Multipleks UAT 18mm`                     |
| Area / Ruangan           | `Kitchen`                                 |
| Satuan                   | `lembar`                                  |
| Nama Material            | `Multipleks UAT 18mm`                     |
| Deskripsi Internal       | `Panel kabinet kitchen, grade test 18mm.` |
| Jumlah Dibutuhkan        | `18`                                      |
| Buffer                   | `2`                                       |
| Biaya per Satuan         | `250000`                                  |
| Sumber Pemenuhan         | `Stok + Pembelian`                        |
| Catatan Internal         | `Gunakan stock existing terlebih dahulu.` |

Expected:

- internal unit cost snapshot Rp250.000;
- planned Material cost Rp5.000.000;
- available stock 10;
- need to buy 10;
- suggested client unit price snapshot Rp312.500.

#### B2.3. Tahap Tukang

Klik Lanjut ke Tukang. Salin template `Paket Instalasi Kabinet`:

- area `Kitchen`;
- qty 1;
- unit `paket`;
- internal Rp4.000.000.

Tandai package menjadi Siap/Active. Draft package belum boleh melewati stage.

Contoh form **Tambah Paket Tukang**:

| Field                    | Contoh UAT                                         |
| ------------------------ | -------------------------------------------------- |
| Gunakan template Library | `Tukang · Paket Instalasi Kabinet`                 |
| Kategori Budget          | `Tukang`                                           |
| Area / Lingkup           | `Kitchen`                                          |
| Vendor                   | `Tanpa vendor`                                     |
| Nama Paket               | `Paket Instalasi Kabinet`                          |
| Lingkup Pekerjaan        | `Instalasi kabinet kitchen sampai siap digunakan.` |
| Jumlah                   | `1`                                                |
| Satuan                   | `paket`                                            |
| Biaya per Satuan         | `4000000`                                          |
| Catatan Internal         | `Koordinasi pemasangan dengan PM UAT.`             |

#### B2.4. Tahap Subcon

Klik Lanjut ke Subcon. Salin `Paket Top Table Subcon`:

- area `Kitchen`;
- qty 1;
- internal Rp3.000.000;
- vendor test bila tersedia.

Tandai Siap/Active lalu Lanjut ke Review.

Contoh form **Tambah Paket Subcon**:

| Field                    | Contoh UAT                                     |
| ------------------------ | ---------------------------------------------- |
| Gunakan template Library | `Subcon · Paket Top Table Subcon`              |
| Kategori Budget          | `Subcon`                                       |
| Area / Lingkup           | `Kitchen`                                      |
| Vendor                   | `PT Vendor UAT Dekoria`                        |
| Nama Paket               | `Paket Top Table Subcon`                       |
| Lingkup Pekerjaan        | `Fabrikasi dan instalasi top table kitchen.`   |
| Jumlah                   | `1`                                            |
| Satuan                   | `paket`                                        |
| Biaya per Satuan         | `3000000`                                      |
| Catatan Internal         | `Gunakan vendor UAT dan bukti penawaran test.` |

#### B2.5. Owner/Finance finalisasi

PM tidak boleh menekan final approval. Login Owner atau Finance, buka Review Internal Plan, lalu Finalisasi.

Expected:

- RAP `LOCKED`;
- total internal plan Rp12.000.000;
- direct edit/delete RAP item ditolak;
- package siap menjadi source RAB;
- cash, actual budget, dan inventory belum berubah.

### B3. RAB client dan aktivasi project finance

#### B3.1. Generate RAB

Sebagai Owner/Finance buka tab RAB.

1. Pilih Material RAP, Tukang Package, dan Subcon Package.
2. Tambahkan manual client-safe line `Koordinasi Design`, qty 1, unit `ls`, price Rp2.000.000.
3. Generate draft.

Contoh form **Pilih Sumber RAB**:

| Field/opsi         | Contoh UAT                                                     |
| ------------------ | -------------------------------------------------------------- |
| Material RAP       | Centang `Multipleks UAT 18mm`                                  |
| Paket kerja        | Centang `Paket Instalasi Kabinet` dan `Paket Top Table Subcon` |
| Nama item manual   | `Koordinasi Design`                                            |
| Jumlah             | `1`                                                            |
| Satuan             | `ls`                                                           |
| Harga satuan klien | `2000000`                                                      |

Pada source picker current state, item manual inline memang tidak memiliki field deskripsi. Field **Deskripsi untuk klien** hanya tersedia pada drawer **Tambah Item Manual** yang dibuka dari draft RAB. Bila memakai drawer tersebut sebagai alternatif, isi `Koordinasi desain, shop drawing, dan final checking.` lalu gunakan jumlah, satuan, dan harga yang sama.

Expected draft total **Rp17.000.000**.

Client preview tidak boleh memuat:

- internal unit cost;
- margin/markup formula;
- vendor/internal note;
- stock availability;
- need-to-buy.

#### B3.2. Approve initial RAB

Review setiap line, lalu Tinjau & Setujui RAB.

Expected atomic changes:

- RAB `APPROVED`, approved value Rp17.000.000;
- Project Contract Value Rp17.000.000;
- Project Budget `APPROVED`;
- Internal Budget Rp15.300.000;
- Target Gross Rp1.700.000;
- category allocation sesuai tabel 3.4;
- Expenses dan Payments terbuka;
- RAP/source package locked;
- tidak ada cash movement.

Negative tests:

- edit approved RAB harus ditolak;
- approve initial RAB kedua harus ditolak dan diarahkan ke Change Order;
- edit Library sekarang tidak boleh mengubah RAP/RAB snapshot project.

### B4. Purchasing menjalankan material control

#### B4.1. Reserve stock existing

Login Purchasing, buka `/materials`, pilih project dan RAP item.

Lakukan **Reserve** ketika material sudah dipastikan tersedia dan sengaja disisihkan untuk proyek, tetapi belum diambil dari gudang oleh tukang. Reserve 8 lembar di `Gudang UAT Utama`.

Contoh form **Reserve Material**:

| Field            | Contoh UAT                                    |
| ---------------- | --------------------------------------------- |
| Project          | `UAT Rumah Nara — Full Workflow`              |
| RAP Material     | `Multipleks UAT 18mm`                         |
| Lokasi inventori | `Gudang UAT Utama`                            |
| Jumlah           | `8`                                           |
| Catatan          | `Reservasi awal untuk instalasi kitchen UAT.` |

| Nilai     |       Sebelum |       Sesudah |
| --------- | ------------: | ------------: |
| Current   |            10 |            10 |
| Reserved  |             0 |             8 |
| Available |            10 |             2 |
| Cash      | Rp110.000.000 | Rp110.000.000 |

Bukti lapangan yang diperiksa: label/area penyimpanan menunjukkan 8 lembar milik proyek ini dan barang masih berada di gudang. Dampak bisnisnya hanya stok tersedia berkurang; stok fisik, realisasi biaya Material, nilai dibayar, dan kas belum berubah.

Expected: movement `RESERVE` dan audit log dibuat; tidak ada expense/cash transaction.

Cross-check `/projects/<id>?tab=stok` pada row Multipleks. **Lakukan cross-check ini sebagai Owner, Finance Admin, atau PM proyek** — Purchasing tidak memiliki akses detail proyek sama sekali (daftar proyeknya kosong dan URL langsung dialihkan kembali), jadi tabel di bawah tidak dapat dibaca dari sesi Purchasing:

| Proyeksi project     | Sebelum reserve | Sesudah reserve 8 |
| -------------------- | --------------: | ----------------: |
| Required RAP         |              20 |                20 |
| Reserved outstanding |               0 |                 8 |
| Secured project      |               0 |                 8 |
| Need to buy          |              20 |                12 |

Free stock gudang sebanyak 10 tidak otomatis menurunkan `Need to buy` sebelum di-reserve. Setelah refresh, angka harus tetap 20/8/12 sesuai kolom terakhir.

Negative test: reserve tambahan 3 harus ditolak karena available hanya 2.

### B5. Vendor bill, approval, payment, dan Goods Receipt

#### B5.1. PM membuat vendor bill Material

Login PM, buka `/expenses` → **Tagihan Vendor**.

- project UAT;
- vendor test;
- category Material;
- bill `VB-UAT-MAT-001`;
- amount Rp5.000.000;
- due date sesuai test;
- note `20 lembar multipleks dan hardware UAT`.

Contoh form **Buat Tagihan Vendor**:

| Field               | Wajib       | Contoh UAT                               |
| ------------------- | ----------- | ---------------------------------------- |
| Vendor              | Ya          | `PT Vendor UAT Dekoria`                  |
| Proyek              | Ya          | `UAT Rumah Nara — Full Workflow`         |
| Kategori Budget     | Ya          | `Material`                               |
| Paket Tukang/Subkon | Kondisional | Tidak tampil untuk Material              |
| Nomor Tagihan       | Ya          | `VB-UAT-MAT-001`                         |
| Nominal Tagihan     | Ya          | `5000000`                                |
| Tanggal Jatuh Tempo | Ya          | `<tanggal UAT + 14 hari>`                |
| Catatan             | Tidak       | `20 lembar multipleks dan hardware UAT.` |

Expected saat bill dibuat:

- tagihan vendor berstatus **Belum dibayar**;
- canonical cost source `INVENTORY_PURCHASE` berstatus `INVENTORY_ASSET` Rp5.000.000;
- Material actual tetap Rp0 karena barang belum digunakan;
- Material paid tetap Rp0;
- payable naik Rp5.000.000;
- cash tidak berubah.

Catatan penting: bill mengakui liability dan sumber nilai inventory. Actual project Material baru diakui saat USE/WASTE; payment hanya mengubah cash dan paid amount.

#### B5.2. Finance menjadwalkan payment

Login Finance, schedule Rp5.000.000 dari BCA UAT.

Contoh form **Jadwalkan Pembayaran**:

| Field              | Wajib | Contoh UAT                  |
| ------------------ | ----- | --------------------------- |
| Rekening Rencana   | Ya    | `BCA · BCA UAT Operasional` |
| Tanggal Pembayaran | Ya    | `<tanggal UAT + 1 hari>`    |
| Nominal Pembayaran | Ya    | `5000000`                   |

Expected:

- vendor payment `PENDING`;
- approval Owner `PENDING` karena nominal >= Rp5.000.000;
- cash dan paid amount belum berubah.

Negative tests:

- schedule tambahan Rp1 harus ditolak karena seluruh outstanding sudah committed;
- Pay sebelum Owner approve harus ditolak.

#### B5.3. Owner approval

Login Owner → Approvals. Buka detail dan pastikan project, vendor, category impact, nominal, due date, dan balance context benar. Approve.

Expected: approval berubah `APPROVED`; cash masih belum berubah.

#### B5.4. Finance mencairkan

Login Finance, Pay vendor payment dengan reference `TRF-UAT-MAT-001`.

Contoh form **Cairkan Pembayaran Vendor**:

| Field                          | Wajib | Contoh UAT                  |
| ------------------------------ | ----- | --------------------------- |
| Rekening Sumber Dana           | Ya    | `BCA · BCA UAT Operasional` |
| Nomor Referensi Bukti Transfer | Ya    | `TRF-UAT-MAT-001`           |

Rekening saat pencairan boleh berbeda dari rekening rencana, tetapi untuk baseline UAT gunakan rekening yang sama dan periksa preview saldo sebelum/sesudah.

Expected:

- BCA Rp100.000.000 → Rp95.000.000;
- total cash Rp110.000.000 → Rp105.000.000;
- pembayaran vendor berstatus **Selesai**;
- tagihan berstatus **Lunas**;
- Material paid Rp5.000.000;
- payable turun Rp5.000.000;
- ledger mencatat **Kas keluar · Pembayaran vendor** Rp5.000.000;
- audit balance dan audit payment tersedia.

#### B5.5. Purchasing menerima barang

Login Purchasing → Materials → Goods Receipt.

- receipt `GR-UAT-001`;
- project UAT;
- vendor bill `VB-UAT-MAT-001`;
- location Gudang UAT;
- material Multipleks UAT;
- RAP item terkait;
- qty 20;
- unit cost Rp250.000.

Contoh form **Catat Penerimaan Barang**:

| Field              | Wajib | Contoh UAT                                                |
| ------------------ | ----- | --------------------------------------------------------- |
| Tagihan vendor     | Tidak | `VB-UAT-MAT-001 · PT Vendor UAT Dekoria`                  |
| Project            | Ya    | `UAT Rumah Nara — Full Workflow`                          |
| Lokasi inventori   | Ya    | `Gudang UAT Utama`                                        |
| Nomor penerimaan   | Ya    | `GR-UAT-001`                                              |
| Tanggal diterima   | Ya    | `<tanggal UAT hari ini>`                                  |
| Material           | Ya    | `Multipleks UAT 18mm`                                     |
| Tautan RAP         | Tidak | `Multipleks UAT 18mm · Kitchen`                           |
| Jumlah (lembar)    | Ya    | `20`                                                      |
| Harga per unit     | Ya    | `250000`                                                  |
| Catatan item       | Tidak | `Barang diterima lengkap untuk skenario UAT.`             |
| Catatan penerimaan | Tidak | `Diterima Purchasing UAT dan ditautkan ke bill material.` |

Expected:

| Nilai        | Sebelum GR | Sesudah GR |
| ------------ | ---------: | ---------: |
| Current      |         10 |         30 |
| Reserved     |          8 |          8 |
| Available    |          2 |         22 |
| Average cost |  Rp250.000 |  Rp250.000 |

Goods Receipt tidak membayar vendor dan tidak membuat cash transaction baru.

Cross-check setelah membuka ulang `/projects/<id>?tab=stok`:

| Proyeksi project     | Setelah reserve |    Setelah GR 20 |
| -------------------- | --------------: | ---------------: |
| Required RAP         |              20 |               20 |
| Bought/received net  |               0 |               20 |
| Reserved outstanding |               8 |                8 |
| Secured project      |               8 | **20**, bukan 28 |
| Need to buy          |              12 |                0 |

Receipt dan reservation dapat menunjuk unit yang sama; canonical projection memakai pool terbesar dan tidak menjumlahkan keduanya dua kali.

Negative cumulative receipt tests:

1. Buka Goods Receipt lagi dan pilih bill yang sama. Bill yang sudah diterima penuh seharusnya tidak lagi tersedia untuk prefill.
2. Jika request dimanipulasi untuk menambah qty 1 pada RAP yang sudah menerima 20, Server Action harus menolak `receipt quantity exceeds RAP` dan stock tetap 30.
3. Jika total nilai receipt dimanipulasi melebihi Rp5.000.000, Server Action harus menolak dan tidak membuat receipt/movement parsial.
4. Setelah penolakan, periksa `/materials?tab=activity`: hanya satu pergerakan **Penerimaan barang** sebanyak 20 yang boleh ada.

### B6. Pakai, kembalikan, dan catat material terbuang

#### B6.1. Use 8 lembar

Sebagai Purchasing, catat **Use Material** saat 8 lembar sudah diambil dari lokasi stok dan benar-benar digunakan tukang di proyek—bukan saat barang baru dipesan, dibayar, atau sekadar direservasi. Cocokkan dengan serah-terima material, catatan mandor, atau bukti lapangan yang berlaku.

Contoh form **Use Material**:

| Field            | Contoh UAT                                       |
| ---------------- | ------------------------------------------------ |
| Project          | `UAT Rumah Nara — Full Workflow`                 |
| RAP Material     | `Multipleks UAT 18mm`                            |
| Lokasi inventori | `Gudang UAT Utama`                               |
| Jumlah           | `8`                                              |
| Catatan          | `Pemakaian untuk instalasi kabinet kitchen UAT.` |

Expected:

- current 30 → 22;
- reserved 8 → 0;
- available tetap 22;
- movement `USE`;
- non-cash Material expense Rp2.000.000;
- Material actual Rp0 → Rp2.000.000;
- Material paid tetap Rp5.000.000;
- cash tetap Rp105.000.000.

Dampak bisnis: stok fisik berkurang dan realisasi biaya kategori Material bertambah memakai harga rata-rata stok. Kas tidak bergerak karena pembayaran vendor dicatat melalui alur tagihan/pembayaran, bukan melalui Use Material.

Pada `/projects/<id>?tab=stok`, expected `used=8`, `reserved outstanding=0`, `leftover=12`, `secured=20`, dan `need to buy=0`.

#### B6.2. Return 1 lembar

Catat **Return** setelah satu lembar yang tidak terpakai benar-benar diterima kembali dan dapat digunakan lagi di gudang. Jangan mencatat Return hanya karena rencana pemakaian berubah sementara barang masih di lapangan.

Contoh form **Return Material**:

| Field            | Contoh UAT                                          |
| ---------------- | --------------------------------------------------- |
| Project          | `UAT Rumah Nara — Full Workflow`                    |
| RAP Material     | `Multipleks UAT 18mm`                               |
| Lokasi inventori | `Gudang UAT Utama`                                  |
| Jumlah           | `1`                                                 |
| Catatan          | `Satu lembar tidak terpakai dan kembali ke gudang.` |

Expected:

- current 22 → 23;
- non-cash Material reversal Rp250.000;
- Material actual Rp2.000.000 → Rp1.750.000;
- cash tidak berubah.

Pada Stok Project, expected `net used=7`, `returned=1`, `leftover receipt=12`, `secured=19`, dan `need to buy=1`. Return masuk kembali sebagai free warehouse stock dan **tidak** diam-diam menjadi reservation project.

Bukti yang diperiksa: lokasi penerima, jumlah fisik, kondisi material, dan catatan pengembalian. Kas dan nilai dibayar tidak berubah.

Negative test: return 8 lagi harus ditolak karena net use tersisa hanya 7.

#### B6.3. Waste 1 lembar

Catat **Waste** ketika satu lembar rusak, hilang, atau menjadi sisa potongan yang tidak dapat digunakan lagi. Isi catatan audit minimal 10 karakter dengan kondisi lapangan yang nyata; bila tersedia, cocokkan dengan foto atau laporan mandor.

Contoh form **Waste Material**:

| Field            | Contoh UAT                                 |
| ---------------- | ------------------------------------------ |
| Project          | `UAT Rumah Nara — Full Workflow`           |
| RAP Material     | `Multipleks UAT 18mm`                      |
| Lokasi inventori | `Gudang UAT Utama`                         |
| Jumlah           | `1`                                        |
| Catatan audit    | `Rusak saat pemotongan panel kitchen UAT.` |

Expected:

- current 23 → 22;
- non-cash Material cost Rp250.000;
- Material actual Rp1.750.000 → Rp2.000.000;
- cash tetap.

Pada Stok Project, expected `net used=7`, `returned=1`, `waste=1`, `leftover receipt=11`, `secured=18`, dan `need to buy=2`. Waste mengurangi unit yang aman untuk menyelesaikan RAP sehingga shortage replacement naik satu lagi.

Dampak bisnis: stok fisik dan ketersediaan untuk menyelesaikan RAP berkurang, sedangkan realisasi biaya Material bertambah. Kas tetap tidak bergerak.

Negative test: note terlalu pendek harus ditolak tanpa stock movement.

### B7. Expense request dengan pemisahan tugas

#### B7.1. Tukang expense normal

Login PM, Add Expense:

- category Tukang;
- link Paket Instalasi Kabinet;
- qty 1 × Rp4.000.000;

Contoh form **Tambah Pengeluaran — Tukang**:

| Field                | Wajib | Contoh UAT                          |
| -------------------- | ----- | ----------------------------------- |
| Proyek               | Ya    | `UAT Rumah Nara — Full Workflow`    |
| Nota                 | Tidak | `Kosongkan`                         |
| Kategori Pengeluaran | Ya    | `Tukang`                            |
| Keterangan           | Ya    | `Upah instalasi kabinet kitchen`    |
| Jumlah               | Ya    | `1`                                 |
| Harga Satuan         | Ya    | `4000000`                           |
| Paket Tukang         | Tidak | `Kitchen · Paket Instalasi Kabinet` |

Field **Perlakuan Stok**, **Material**, **Lokasi Stok**, dan **Item RAP** hanya tampil untuk kategori Material, sehingga tidak muncul pada skenario Tukang ini.

Saat submit:

- request `SUBMITTED`;
- Tukang pending Rp4.000.000;
- actual/paid belum berubah.

PM tidak boleh dapat memverifikasi request ini.

Login Finance dan Verify:

- nominal < Rp5 juta dan tidak overrun;
- status langsung `APPROVED`;
- pending turun Rp4.000.000;
- actual naik Rp4.000.000.

Finance Pay dari Kas UAT:

Contoh form **Cairkan Pengeluaran**:

| Field                          | Wajib | Contoh UAT               |
| ------------------------------ | ----- | ------------------------ |
| Rekening Sumber Dana           | Ya    | `Kas · Kas UAT Lapangan` |
| Nomor Referensi Bukti Transfer | Ya    | `TRF-UAT-TKG-001`        |

- Kas UAT Rp10.000.000 → Rp6.000.000;
- Tukang paid Rp4.000.000;
- ledger/audit dibuat.

#### B7.2. Operasional yang menyebabkan overrun

PM submit dua line atau satu grouped receipt dengan total Operasional Rp700.000. Contoh:

- Transport Rp400.000;
- Konsumsi Rp300.000.

Contoh form **Tambah Pengeluaran — Operasional dua item**:

| Field                   | Item 1                                                     | Item 2                          |
| ----------------------- | ---------------------------------------------------------- | ------------------------------- |
| Proyek                  | `UAT Rumah Nara — Full Workflow`                           | Mengikuti header form yang sama |
| Nota                    | Unggah foto nota test bila tersedia; jika tidak, kosongkan | Mengikuti header form yang sama |
| Kategori Pengeluaran    | `Operasional`                                              | `Operasional`                   |
| Keterangan              | `Transport survey dan koordinasi`                          | `Konsumsi tim instalasi`        |
| Jumlah                  | `1`                                                        | `1`                             |
| Harga Satuan            | `400000`                                                   | `300000`                        |
| Paket Tukang/Subkon     | Tidak tampil                                               | Tidak tampil                    |
| Field stok/Material/RAP | Tidak tampil                                               | Tidak tampil                    |

Operasional allocation hanya Rp612.000.

Expected:

- request masuk `SUBMITTED`, pending Rp700.000;
- budgetOverrun true pada line yang melewati allocation;
- Owner approval record dibuat untuk high-risk line.

Finance Verify:

- line normal dapat `APPROVED`;
- line overrun berhenti di `VERIFIED`.

Owner Approve line overrun, lalu Finance Pay semua line dari Kas UAT.

Saat mencairkan, ulangi form **Cairkan Pengeluaran** untuk setiap pengeluaran yang telah approved:

| Pengeluaran         | Rekening Sumber Dana     | Nomor Referensi Bukti Transfer |
| ------------------- | ------------------------ | ------------------------------ |
| Transport Rp400.000 | `Kas · Kas UAT Lapangan` | `TRF-UAT-OPS-001`              |
| Konsumsi Rp300.000  | `Kas · Kas UAT Lapangan` | `TRF-UAT-OPS-002`              |

Expected final:

- Operasional actual Rp700.000;
- paid Rp700.000;
- remaining -Rp88.000;
- terpakai 114,38%, status **Melebihi budget**;
- Kas UAT Rp6.000.000 → Rp5.300.000.

### B8. Subcon vendor bill

Buat vendor bill `VB-UAT-SUB-001` Rp3.000.000, category Subcon, link Paket Top Table.

Contoh form **Buat Tagihan Vendor — Subcon**:

| Field               | Contoh UAT                                     |
| ------------------- | ---------------------------------------------- |
| Vendor              | `PT Vendor UAT Dekoria`                        |
| Proyek              | `UAT Rumah Nara — Full Workflow`               |
| Kategori Budget     | `Subcon`                                       |
| Paket Subkon        | `Kitchen · Paket Top Table Subcon`             |
| Nomor Tagihan       | `VB-UAT-SUB-001`                               |
| Nominal Tagihan     | `3000000`                                      |
| Tanggal Jatuh Tempo | `<tanggal UAT + 14 hari>`                      |
| Catatan             | `Paket fabrikasi dan instalasi top table UAT.` |

1. PM/Purchasing create bill.
2. Finance schedule Rp3.000.000.
3. Karena payment < Rp5 juta dan category belum overrun saat schedule, tidak perlu Owner approval.
4. Finance pay dari BCA UAT.

Contoh form payment Subcon:

| Tahap    | Field                          | Contoh UAT                  |
| -------- | ------------------------------ | --------------------------- |
| Schedule | Rekening Rencana               | `BCA · BCA UAT Operasional` |
| Schedule | Tanggal Pembayaran             | `<tanggal UAT + 1 hari>`    |
| Schedule | Nominal Pembayaran             | `3000000`                   |
| Pay      | Rekening Sumber Dana           | `BCA · BCA UAT Operasional` |
| Pay      | Nomor Referensi Bukti Transfer | `TRF-UAT-SUB-001`           |

Expected:

- BCA Rp95.000.000 → Rp92.000.000;
- Subcon actual/paid Rp3.000.000;
- allocation Rp3.060.000;
- remaining Rp60.000;
- tagihan **Lunas** dan pembayaran **Selesai**.

### B9. Invoice client dan cash-in

#### B9.1. Buat tiga invoice klien

Login Finance/Owner, lalu buka Project → tab **Keuangan** → sub-tab **Pembayaran** → tombol **+ Invoice** di kartu ringkasan.

Tab ini juga punya generator **Buat termin 30% · 35% · 25% · 10%** yang membuat empat termin sekaligus. Dataset kontrol runbook memakai pembagian 30/50/20, jadi **jangan** memakai generator itu — isi form tiga kali secara manual.

| Field               | Invoice DP 30%           | Invoice Progress 50%       | Invoice Pelunasan 20%     |
| ------------------- | ------------------------ | -------------------------- | ------------------------- |
| Nomor Invoice       | `INV-UAT-001-DP`         | `INV-UAT-002-PROGRESS`     | `INV-UAT-003-PELUNASAN`   |
| Tahap Tagihan       | `Uang Muka`              | `Termin Progress 1`        | `Pelunasan`               |
| Nominal Tagihan     | `5100000`                | `8500000`                  | `3400000`                 |
| Tanggal Jatuh Tempo | `<tanggal UAT + 7 hari>` | `<tanggal UAT + 30 hari>`  | `<tanggal UAT + 60 hari>` |
| Catatan             | `DP 30% sesuai RAB UAT.` | `Termin progress 50% UAT.` | `Pelunasan 20% UAT.`      |

Expected total invoice tepat Rp17.000.000. Receivable naik Rp17.000.000; cash belum berubah — kartu ringkasan membaca **Rp17.000.000 · 3 termin · 100% nilai kontrak sudah ditagihkan**, sementara saldo kedua rekening tidak bergerak.

#### B9.2. Partial payment dan overpayment guard

Pada invoice DP:

1. Record Rp2.000.000 ke BCA.
2. Status invoice menjadi **Dibayar sebagian**.
3. BCA Rp92.000.000 → Rp94.000.000.
4. Coba record Rp3.100.001: harus ditolak.
5. Pastikan balance tetap Rp94.000.000.
6. Catat sisa tepat Rp3.100.000: invoice menjadi **Lunas** dan BCA Rp97.100.000.

Contoh form **Catat Pembayaran Klien** untuk langkah 1:

| Field                          | Contoh UAT                  |
| ------------------------------ | --------------------------- |
| Rekening Penerima Dana         | `BCA · BCA UAT Operasional` |
| Nominal Diterima               | `2000000`                   |
| Nomor Referensi Bukti Transfer | `RCV-UAT-DP-001`            |
| Tanggal Transaksi Diterima     | `<tanggal UAT hari ini>`    |

Untuk negative overpayment pada langkah 4, gunakan field yang sama tetapi **Nominal Diterima = `3100001`** dan referensi `RCV-UAT-DP-OVERPAY`. Untuk pelunasan langkah 6, gunakan nominal `3100000` dan referensi `RCV-UAT-DP-002`.

Dua hal yang mudah terlewat saat menjalankan langkah ini:

- **Rekening penerima tidak otomatis BCA.** Sheet membuka dengan rekening pertama pada daftar (`Kas · Kas UAT Lapangan`); pilih BCA secara eksplisit, atau kas masuk akan tercatat di rekening yang salah.
- **Nominal sudah terisi penuh** sebesar sisa tagihan. Untuk partial payment, ganti isinya menjadi `2000000`.

Penolakan overpayment berjalan **dua lapis**, dan hanya lapis kedua yang benar-benar menghentikan transaksi:

1. Form memberi peringatan `Nominal melebihi sisa invoice sebesar Rp 1.` di footer, dan baris `Sisa sesudah` pada review berubah menjadi `Rp 0 · periksa kelebihan bayar`. Tombol **Tinjau** dan **Catat** tetap aktif — peringatan ini tidak memblokir.
2. Server menolak saat **Catat** ditekan, dengan pesan `Nominal pembayaran melebihi sisa piutang invoice.` Seluruh transaksi di-rollback: saldo BCA tetap Rp94.000.000, tidak ada baris `client_payment` maupun `cash_transaction` yang tertulis, dan status invoice tetap **Dibayar sebagian**.

#### B9.3. Lunasi invoice lain

Record Progress Rp8.500.000 dan Pelunasan Rp3.400.000 ke BCA.

Contoh form pembayaran dua invoice terakhir:

| Field                          | Progress                    | Pelunasan                   |
| ------------------------------ | --------------------------- | --------------------------- |
| Rekening Penerima Dana         | `BCA · BCA UAT Operasional` | `BCA · BCA UAT Operasional` |
| Nominal Diterima               | `8500000`                   | `3400000`                   |
| Nomor Referensi Bukti Transfer | `RCV-UAT-PROGRESS-001`      | `RCV-UAT-PELUNASAN-001`     |
| Tanggal Transaksi Diterima     | `<tanggal UAT hari ini>`    | `<tanggal UAT hari ini>`    |

Expected:

- seluruh invoice **Lunas**;
- client receipts Rp17.000.000;
- receivable Rp0;
- BCA final Rp109.000.000;
- total cash final Rp114.300.000.

Rekonsiliasi kas:

`Rp110.000.000 opening + Rp17.000.000 client receipts - Rp12.700.000 cash out = Rp114.300.000`

Nomor referensi wajib unik per rekening. Bila satu percobaan gagal karena nominal, referensi yang sama masih boleh dipakai ulang — percobaan yang ditolak tidak menyisakan baris apa pun.

#### B9.4. Rekonsiliasi dengan rekening koran

Perhitungan saldo di atas **bukan** rekonsiliasi. Saat pembayaran klien, pencairan vendor, atau pencairan pengeluaran dicatat, kas sistem sudah berubah tetapi transaksi tersebut berstatus **Belum cocok**. Status itu baru berubah menjadi **Cocok** setelah Finance Admin atau Owner memasangkan bukti mutasi rekening koran yang benar.

Login sebagai Finance Admin atau Owner, lalu buka `/reconciliation`. Judul **Rekonsiliasi** adalah istilah finance standar; subtitle menjelaskan tugasnya sebagai mencocokkan catatan Atria dengan mutasi bank. Halaman menyediakan tiga peer view: **Mutasi bank**, **Catatan Atria**, dan **Riwayat**. View **Mutasi bank** terbuka lebih dahulu karena data bank adalah bukti pembanding utama.

1. Tekan **Impor CSV**. Pada sheet **Impor rekening koran**, pilih rekening tujuan.
2. Tekan **Unduh template**. Isi file menggunakan kolom persis `tanggal,deskripsi,dana_masuk,dana_keluar`. Setiap baris wajib mengisi tepat satu kolom nominal: `dana_masuk` atau `dana_keluar`.
3. Tekan **Pilih file**, pilih CSV maksimal 1 MB dan 500 baris, lalu tekan **Impor**. Impor tidak mengubah saldo. Fingerprint yang sama dilewati agar file yang diunggah ulang tidak menggandakan mutasi.
4. Baris dengan satu pasangan tepat diberi status **Pasangan ditemukan**. Ketuk baris tersebut untuk membuka sheet **Cocokkan transaksi**. Jika ada lebih dari satu kandidat, buka **Catatan Atria** dan pilih transaksi yang benar.
5. Cocokkan rekening, arah, nominal, tanggal, deskripsi, dan referensi; lalu tekan **Cocokkan**. Sistem hanya mengizinkan rekening, arah, dan nominal yang sama persis.
6. Setelah berhasil, toast **Transaksi berhasil direkonsiliasi.** tampil dan pasangan hilang dari kedua antrean. Pasangan tetap tersedia di **Riwayat**, audit log dibuat, dan saldo rekening tetap sama.

Contoh CSV kontrol minimal setelah B9.2 langkah pertama:

```csv
tanggal,deskripsi,dana_masuk,dana_keluar
2026-07-22,Penerimaan DP UAT — RCV-UAT-DP-001,2000000,
```

Bila B9.3 sudah dituntaskan lebih dahulu, seluruh mutasi BCA sudah ada dan CSV berikut memasangkan semuanya sekaligus. Ganti tanggal sesuai tanggal UAT masing-masing:

```csv
tanggal,deskripsi,dana_masuk,dana_keluar
2026-08-17,Penerimaan DP UAT — RCV-UAT-DP-001,2000000,
2026-08-17,Pelunasan DP UAT — RCV-UAT-DP-002,3100000,
2026-08-17,Termin progress UAT — RCV-UAT-PROG-001,8500000,
2026-08-17,Pelunasan kontrak UAT — RCV-UAT-PELUNASAN-001,3400000,
2026-08-18,Transfer vendor subcon — TRF-UAT-SUB-001,,3000000
2026-08-18,Transfer vendor material — TRF-UAT-MAT-001,,5000000
```

Saldo awal rekening **tidak** dimasukkan ke CSV: mutasi itu tidak pernah muncul di rekening koran, dan justru menjadi contoh sah untuk **Catat pengecualian** di bawah.

Kalimat persis yang muncul saat impor ulang file yang sama: **Tidak ada mutasi baru. 6 baris duplikat dilewati.**

Jika bank belum menyediakan file untuk diolah, tekan **Catat manual**; sheet yang terbuka berjudul **Catat mutasi bank**. Form fallback berisi **Rekening**, **Tanggal mutasi**, **Arah mutasi**, **Nominal**, dan **Deskripsi**. Pilihan arah yang terlihat adalah **Dana masuk** atau **Dana keluar**; kode canonical internalnya adalah `INFLOW` dan `OUTFLOW` dengan makna yang sama, bukan istilah debit/kredit rekening bank.

Jika satu **Catatan Atria** memang tidak akan mempunyai pasangan bank, buka transaksi lalu pilih **Catat pengecualian**. Isi alasan minimal 10 karakter; selama belum cukup, tombol **Simpan alasan** nonaktif dan footer menjelaskan `Tulis alasan minimal 10 karakter.` Status menjadi **Pengecualian tercatat** dan menyimpan alasan, pemeriksa, waktu, serta audit log, tetapi transaksi tetap `reconciled = false`. Gunakan hanya untuk kasus yang dapat dijelaskan, misalnya koreksi pembukaan atau transaksi internal non-bank; jangan gunakan untuk menyembunyikan transfer gagal atau perbedaan nominal. Pengecualian dapat dihapus agar transaksi kembali menjadi pekerjaan terbuka, atau otomatis dibersihkan ketika pasangan bank yang sah kemudian dikonfirmasi.

Untuk audit, buka **Riwayat** lalu ketuk row. Sheet detail harus menampilkan Catatan Atria, nominal/arah, rekening dan referensi, mutasi bank pasangannya, tanggal bank, nama file sumber, tanggal rekonsiliasi, serta pemeriksa.

Expected:

- sebelum pencocokan, **Catatan Atria** dan **Mutasi bank** masing-masing memuat satu transaksi **Dana masuk** Rp2.000.000 yang belum cocok;
- setelah pencocokan, pasangan tersebut hilang dari kedua antrean **Belum cocok** dan angka pada tab berkurang; saldo BCA tetap Rp94.000.000 karena rekonsiliasi tidak membuat mutasi kas baru;
- mutasi rekening koran yang sudah dipakai tidak ditawarkan lagi sebagai pasangan transaksi lain;
- mengimpor file yang sama kembali harus menghasilkan 0 mutasi baru dan melaporkan baris duplikat yang dilewati;
- mencoba mencatat fallback manual dengan fingerprint yang sama (rekening, tanggal, arah, nominal, dan deskripsi) harus ditolak dengan pesan **Mutasi rekening koran ini sudah tercatat.**;
- nomor referensi bank untuk penerimaan/pencairan harus unik dalam rekening yang sama. Jika bank mengirim referensi yang sama lagi, hentikan input dan investigasi lebih dulu—jangan melakukan submit ulang.
- transaksi lebih dari 3 hari tampil sebagai **Perlu diperiksa**; ini adalah aging operasional, bukan perubahan saldo atau pembayaran;
- project closing harus ditolak ketika cash transaction proyek belum cocok dan belum memiliki pengecualian tercatat. Pengecualian yang diterima tetap ditampilkan pada closing review.

Batasan rilis saat ini: CSV harus mengikuti template canonical Atria; file mentah setiap bank belum dipetakan otomatis. Pencocokan masih **satu lawan satu dengan nominal tepat**. Split/one-to-many dan auto-approve tidak tersedia; sistem hanya memberi saran dan keputusan akhir tetap dilakukan user.

### B10. Rekonsiliasi profitability sebelum closing

Expected category final untuk base scenario:

| Kategori    |  Allocation |      Actual |        Paid |   Remaining |    Used | Status          |
| ----------- | ----------: | ----------: | ----------: | ----------: | ------: | --------------- |
| Material    | Rp5.814.000 | Rp2.000.000 | Rp5.000.000 | Rp3.814.000 |  34,40% | Aman            |
| Tukang      | Rp4.284.000 | Rp4.000.000 | Rp4.000.000 |   Rp284.000 |  93,37% | Perlu dipantau  |
| Operasional |   Rp612.000 |   Rp700.000 |   Rp700.000 |   -Rp88.000 | 114,38% | Melebihi budget |
| Lain-lain   |   Rp306.000 |         Rp0 |         Rp0 |   Rp306.000 |      0% | Aman            |
| Subcon      | Rp3.060.000 | Rp3.000.000 | Rp3.000.000 |    Rp60.000 |  98,04% | Kritis          |

Expected project totals:

- actual cost Rp9.700.000;
- cash outflow/paid cost Rp12.700.000;
- non-cash cost net Rp2.000.000;
- realized/projected gross Rp17.000.000 - Rp9.700.000 = **Rp7.300.000**;
- margin 42,94%;
- project cash position Rp17.000.000 - Rp12.700.000 = **Rp4.300.000**;
- Internal Budget remaining Rp5.600.000.

Dashboard harus tetap menonjolkan category overrun walaupun total project masih di bawah Internal Budget.

Perhatikan bahwa keenam angka di atas tidak semuanya tampil pada satu layar:

- Tab **Keuangan → Margin** menampilkan **Margin proyeksi Rp1.700.000 (10,0%)** — itu nilai kontrak dikurangi **plafon** budget internal (Rp17.000.000 − Rp15.300.000), bukan realized gross. Kartunya menyebutkan dasar perhitungan itu secara eksplisit.
- Kartu **Realisasi kas** pada tab yang sama menampilkan Dana diterima Rp17.000.000, Pengeluaran kas Rp12.700.000, dan Posisi kas bersih Rp4.300.000. Baris tengah memakai **kas yang benar-benar keluar** (`paidAmount`), bukan realisasi akrual — selisih Rp3.000.000 terhadap actual cost adalah material yang sudah dibayar tetapi belum dipakai.
- **Realized gross Rp7.300.000 dan margin 42,94%** muncul pada **checklist penutupan** (`Periksa kesiapan closing`), bukan pada kartu Margin. Di sanalah `contractValue - actualCost` dihitung.

Jangan mencari realized gross pada kartu Margin; keduanya memang metrik berbeda dan dilabeli berbeda.

### B11. Optional revision dan Change Order

Lakukan bagian ini bila ingin menguji approved-scope change. Jika dilewati, lanjut ke Closing.

1. Buat RAP/package revision, bukan membuka baseline lama.
2. Generate RAB revision dari source terbaru.
3. Tambahkan perubahan client-safe.
4. Buat Change Order dengan alasan dan bukti client confirmation.
5. Owner/Finance approve Change Order.

Untuk contoh revision yang deterministik, pada source picker pilih kembali tiga source yang sama seperti E1, lalu tambahkan satu item manual baru melalui **Tambah Item Manual**:

| Field                 | Contoh UAT                                          |
| --------------------- | --------------------------------------------------- |
| Nama item             | `Tambahan Koordinasi Pantry`                        |
| Deskripsi untuk klien | `Koordinasi desain dan final checking area pantry.` |
| Jumlah                | `1`                                                 |
| Satuan                | `ls`                                                |
| Harga satuan klien    | `1000000`                                           |

Dengan contoh ini, nilai revision RAB menjadi Rp18.000.000 dan selisih Change Order Rp1.000.000.

Contoh form **Buat Change Order**:

| Field                          | Wajib | Contoh UAT                                                               |
| ------------------------------ | ----- | ------------------------------------------------------------------------ |
| Alasan perubahan               | Ya    | `Klien menambah lingkup kabinet pantry setelah baseline disetujui.`      |
| Ringkasan lingkup lama ke baru | Ya    | `Baseline hanya kitchen; revisi menambahkan kabinet pantry client-safe.` |
| Referensi persetujuan klien    | Ya    | `Email UAT-CO-001 tanggal <tanggal UAT>`                                 |
| Tanggal persetujuan klien      | Ya    | `<tanggal UAT hari ini>`                                                 |

Jika menguji pembatalan draft revision, isi form **Batalkan Revisi**:

| Field             | Wajib | Contoh UAT                                                      |
| ----------------- | ----- | --------------------------------------------------------------- |
| Alasan pembatalan | Ya    | `Klien membatalkan perubahan lingkup pantry pada skenario UAT.` |

Expected:

- approved baseline lama tetap ada sebagai history/superseded;
- hanya satu current approved RAB;
- project Contract Value dan canonical budget berubah atomically;
- category non-manual override rescale mengikuti contract baru;
- cash dan invoice tidak berubah otomatis.

Jika contract bertambah, buat invoice `AD_HOC` sebesar selisih dan lunasi sebelum closing. Total invoice aktif wajib sama dengan contract terbaru.

Contoh form invoice dan pelunasan selisih untuk revision di atas:

| Tahap            | Field                          | Contoh UAT                                 |
| ---------------- | ------------------------------ | ------------------------------------------ |
| Buat invoice     | Nomor Invoice                  | `INV-UAT-004-CO`                           |
| Buat invoice     | Tahap Tagihan                  | `Tagihan Khusus`                           |
| Buat invoice     | Nominal Tagihan                | `1000000`                                  |
| Buat invoice     | Tanggal Jatuh Tempo            | `<tanggal UAT + 7 hari>`                   |
| Buat invoice     | Catatan                        | `Tagihan selisih Change Order UAT-CO-001.` |
| Catat pembayaran | Rekening Penerima Dana         | `BCA · BCA UAT Operasional`                |
| Catat pembayaran | Nominal Diterima               | `1000000`                                  |
| Catat pembayaran | Nomor Referensi Bukti Transfer | `RCV-UAT-CO-001`                           |
| Catat pembayaran | Tanggal Transaksi Diterima     | `<tanggal UAT hari ini>`                   |

Bila menjalankan optional revision ini, jangan memakai angka closing base scenario secara mentah: contract, receipts, cash, budget allocation, gross, dan margin harus dihitung ulang dari baseline Rp18.000.000.

Negative tests:

- direct approve revision tanpa Change Order harus ditolak;
- cancel draft revision harus membuat revision `VOID`, tidak mengubah baseline atau budget;
- Change Order tanpa client confirmation tidak boleh approved.

### B12. Project Closing

Login Owner/Finance → tab **Keuangan → Margin** → bagian closing. Tombol finalnya berlabel **Selesaikan proyek dan simpan ringkasan akhir**, bukan "Complete Project".

Sebelum final close, checklist harus memastikan:

- `/reconciliation` sudah ditinjau; setiap transaksi kas proyek sudah memiliki pasangan bank atau pengecualian tercatat dengan alasan yang dapat dipertanggungjawabkan. Closing review menampilkan jumlah pengecualian yang diterima;
- total invoice aktif = current contract value;
- semua invoice **Lunas** atau **Dibatalkan**;
- semua tagihan vendor **Lunas** atau **Dibatalkan**;
- semua pembayaran vendor sudah final (**Selesai**/**Gagal**);
- semua pengajuan pengeluaran **Lunas** atau **Ditolak**;
- tidak ada RAB draft;
- tepat satu current approved RAB;
- tidak ada Change Order terbuka;
- outstanding reservation project = 0;
- canonical budget `APPROVED` dan tersinkron.

Pemeriksaan rekonsiliasi **sudah menjadi blocker otomatis**. Bila masih ada transaksi kas proyek yang belum cocok dan belum punya pengecualian tercatat, checklist menampilkan blocker berbunyi `N transaksi kas proyek belum cocok dengan mutasi bank atau belum memiliki pengecualian tercatat.` dan tombol final tidak muncul sama sekali.

Cakupan hitungannya sempit dan disengaja: hanya transaksi kas yang terikat pada proyek ini — pembayaran klien, pembayaran vendor, dan pencairan pengeluaran lapangan. **Saldo awal rekening tidak ikut dihitung** karena bukan milik proyek mana pun. Karena itu pengecualian yang dicatat pada saldo awal (contoh di B9.4) tidak akan muncul sebagai `pengecualian yang diterima` pada closing review proyek.

Negative test: sebelum melunasi satu invoice atau saat masih ada reservation, Complete Project harus ditolak dan tidak membuat final snapshot.

Menekan **Periksa kesiapan closing** menampilkan tiga angka final lebih dahulu — Biaya final saat ini, Margin realisasi, dan Posisi kas — lalu daftar blocker di bawahnya. Untuk skenario base, ketiganya berbunyi Rp9.700.000, Rp7.300.000 · 42,94%, dan Rp4.300.000.

Setelah semua blocker nol, isi closing note dan Complete Project.

Contoh form **Complete Project**:

| Field                 | Wajib | Contoh UAT                                                                                                            |
| --------------------- | ----- | --------------------------------------------------------------------------------------------------------------------- |
| Catatan closing final | Ya    | `Seluruh invoice, vendor bill, expense, reservation, dan revisi UAT telah final; angka closing sudah direkonsiliasi.` |

Catatan closing minimal 10 karakter sebelum tombol final aktif.

Expected base scenario:

- project status `COMPLETED`;
- end date terisi;
- final profitability snapshot immutable tercatat;
- actual Rp9.700.000;
- realized margin Rp7.300.000 / 42,94%;
- cash position Rp4.300.000;
- project tidak dapat diedit menjadi ACTIVE melalui form biasa.

Ketiga jaminan terakhir dijaga di sisi server, bukan hanya disembunyikan di UI:
`updateProject` menolak seluruh pengeditan proyek berstatus `COMPLETED` atau
`CANCELLED`, dan menolak penetapan `COMPLETED` yang tidak lewat closing
checklist. Seluruh action pencatatan transaksi juga menolak proyek non-`ACTIVE`
lewat `assertProjectStatusIsOperational`.

Snapshot final tersimpan di `project_profitability_snapshot` dengan
`snapshot_type = FINAL`. Untuk skenario base isinya: contract 17.000.000,
internal budget 15.300.000, actual 9.700.000, sisa 5.600.000, terpakai 63,3987%,
realized margin 7.300.000 / 42,9412%, cash position 4.300.000, serta rincian
Material 5.814.000 / 2.000.000 / 3.814.000 pada 34,3997%.

## BAGIAN C — Negative test matrix wajib

| Test                  | Role          | Action                                    | Expected                                 |
| --------------------- | ------------- | ----------------------------------------- | ---------------------------------------- |
| Project scoping       | PM lain       | Buka Project UAT via URL                  | Ditolak/redirect                         |
| Global finance        | PM            | Buka `/ledger`                            | Ditolak                                  |
| Sensitive balance     | Purchasing    | Buka Expenses                             | Balance rekening tidak terkirim/terlihat |
| Self verification     | PM pembuat    | Verify expense                            | FORBIDDEN                                |
| Budget settings       | Purchasing    | Ubah budget ratio                         | FORBIDDEN                                |
| Approved RAP          | PM            | Edit/delete item locked                   | Ditolak                                  |
| Over-reserve          | Purchasing    | Reserve > available                       | Ditolak, stock unchanged                 |
| Cross-project reserve | Project B     | Use stock reserved Project A              | Ditolak atau tidak mengurangi reserve A  |
| Excess return         | Purchasing    | Return > net use                          | Ditolak                                  |
| Short audit note      | Purchasing    | Waste/adjustment                          | Validation error                         |
| Reserved reversal     | Owner/Finance | Reverse receipt hingga current < reserved | Ditolak                                  |
| Vendor over-schedule  | Finance       | Pending + new > bill                      | Ditolak                                  |
| Early vendor pay      | Finance       | Pay high-risk before approval             | Ditolak                                  |
| Rejected payment      | Finance       | Pay payment `FAILED`                      | Ditolak                                  |
| Client overpay        | Finance       | Payment > invoice outstanding             | Ditolak, cash unchanged                  |
| Archived account      | Finance       | Mutasi rekening inactive                  | Ditolak                                  |
| Direct second RAB     | Owner         | Approve revision tanpa CO                 | Ditolak                                  |
| Premature closing     | Owner         | Complete dengan blocker                   | Ditolak, no snapshot                     |

### Status verifikasi Bagian C

Dijalankan 18 Agustus 2026 terhadap database UAT yang sama.

**Sudah terbukti live (9):** Global finance, Sensitive balance, Self verification,
Budget settings, Approved RAP, Over-reserve, Short audit note, Client overpay,
dan Premature closing.

Dua di antaranya lebih kuat dari yang tertulis di matriks:

- **Sensitive balance** bukan sekadar "tidak terlihat". Saat Purchasing membuka
  `/expenses`, nama rekening maupun angka saldo tidak ada sama sekali di DOM
  maupun di payload RSC — datanya tidak pernah dikirim ke klien.
- **Budget settings** dijaga dua lapis: seluruh modul pada `/settings` berlabel
  **Hanya baca** untuk Purchasing dan tidak punya tombol simpan, sementara
  `manage:budget_settings` memang hanya dimiliki Owner dan Finance Admin.

Sebagai catatan tambahan, menu navigasi juga ikut menyempit mengikuti peran: PM
hanya melihat Proyek, Material & Stok, Kas & Tagihan, dan Profil.

**Terverifikasi dari kode, belum dijalankan live (1):** Archived account.
`recordBankAccountMovement` dan jalur transfer mencari rekening dengan filter
`isActive = true`, sehingga rekening terarsip ditolak sebagai
`BANK_ACCOUNT_NOT_FOUND` sebelum saldo tersentuh. Pesannya berbunyi "tidak
ditemukan", bukan "sudah diarsipkan" — perilakunya benar, tetapi kalimatnya
belum menjelaskan sebab sebenarnya.

**Belum dapat dijalankan (8):**

- **Project scoping** memerlukan akun PM kedua; workspace UAT baru punya satu PM.
- **Cross-project reserve, Excess return, Reserved reversal, Vendor
  over-schedule, Early vendor pay, Rejected payment, dan Direct second RAB**
  memerlukan proyek berstatus `ACTIVE`. Proyek UAT pertama sudah `COMPLETED`
  sehingga seluruh action pencatatan menolaknya lewat
  `assertProjectStatusIsOperational`.

## BAGIAN D — Cara menilai hasil UAT

### PASS

- seluruh positive path menghasilkan state dan angka expected;
- seluruh negative path ditolak tanpa partial write;
- setiap cash action punya bank balance, cash transaction, reference ID, dan audit log yang konsisten;
- setiap stock action punya inventory delta, stock movement, dan audit log;
- role tidak menerima data sensitif yang tidak dibutuhkan;
- Dashboard, Project Overview, Expenses, dan Materials menunjukkan angka yang sama.

### FAIL

- saldo berubah tanpa ledger;
- stock berubah tanpa movement;
- actual berubah dua kali untuk satu source cost;
- invoice/vendor bill dapat overpay;
- rejected/pending approval dapat dicairkan;
- PM dapat melihat project lain atau memverifikasi request sendiri;
- current < reserved;
- approved baseline dapat diedit;
- closing lolos dengan blocker.

### Catatan khusus cost attribution stock

Model production adalah inventory-funded cost. Opening dan Goods Receipt membentuk quantity/value inventory; Material vendor bill membentuk payable/paid evidence tetapi bukan actual project. USE/WASTE mengakui actual berdasarkan average cost, RETURN membalik actual. Direct-use expense mengakui actual langsung dan movement terkait tidak boleh membuat actual kedua.

## Ringkasan perubahan nilai per action

| Action                          |                         Budget actual |    Budget paid |          Cash |             Current stock |               Reserved stock | Liability/receivable |
| ------------------------------- | ------------------------------------: | -------------: | ------------: | ------------------------: | ---------------------------: | -------------------- |
| Create Project/RAP/RAB draft    |                                     — |              — |             — |                         — |                            — | —                    |
| Approve RAB                     |              Allocation/value berubah |              — |             — |                         — |                            — | —                    |
| Submit expense                  |                          Pending naik |              — |             — | tergantung stock handling |                   tergantung | —                    |
| Verify/approve expense          |                           Actual naik |              — |             — |                         — |                            — | —                    |
| Pay expense                     |                                     — |      Paid naik |         Turun |                         — |                            — | —                    |
| Create Material vendor bill     | Tetap; source menjadi inventory asset |              — |             — |                         — |                            — | Payable naik         |
| Create non-Material vendor bill |                           Actual naik |              — |             — |                         — |                            — | Payable naik         |
| Schedule vendor payment         |                                     — |              — |             — |                         — |                            — | Tetap                |
| Pay vendor                      |                                     — |      Paid naik |         Turun |                         — |                            — | Payable turun        |
| Goods Receipt                   |                                     — |              — |             — |                      Naik |                        Tetap | Tetap                |
| Reserve                         |                                     — |              — |             — |                     Tetap |                         Naik | —                    |
| Use existing stock              |                  Actual non-cash naik |          Tetap |         Tetap |                     Turun | Turun sesuai reserve sendiri | —                    |
| Return                          |                 Actual non-cash turun |          Tetap |         Tetap |                      Naik |                        Tetap | —                    |
| Waste                           |                  Actual non-cash naik |          Tetap |         Tetap |                     Turun | Turun sesuai reserve sendiri | —                    |
| Create client invoice           |                                     — |              — |             — |                         — |                            — | Receivable naik      |
| Record client payment           |                                     — |              — |          Naik |                         — |                            — | Receivable turun     |
| Closing                         |                        Final snapshot | Final snapshot | Tidak berubah |             Tidak berubah |  Harus 0 outstanding project | Semua final          |
