# Product Requirement Document (PRD) - Atria ERP

## 1. Gambaran Umum Produk (Product Overview)
Atria ERP adalah sistem Enterprise Resource Planning (ERP) internal yang dirancang khusus untuk perusahaan kontraktor dan desain interior. Berbeda dengan ERP generik yang berfokus pada manajemen SDM atau inventaris, Atria ERP mengadopsi pendekatan **finance-first** dan **mobile-first**. Sistem ini menempatkan pencatatan keuangan granular, pengendalian anggaran proyek, dan rekonsiliasi kas sebagai poros utama operational bisnis. 

Dengan antarmuka yang dioptimalkan untuk perangkat seluler (**mobile-first** menggunakan filosofi **iOS 26 Solid UI/UX**), seluruh personil lapangan dapat melakukan pencatatan pengeluaran secara real-time langsung dari lokasi proyek. Hal ini meminimalkan keterlambatan input data yang sering memicu kebocoran anggaran.

---

## 2. Pernyataan Masalah (Problem Statement)
Perusahaan desain interior & kontraktor sering kali menghadapi masalah finansial klasik berikut:
1.  **Kebocoran Anggaran Proyek (Project Budget Leaks):** Pembelian material tambahan atau pembayaran subkontraktor di lapangan sering kali tidak tercatat secara instan. Admin baru mengetahuinya berminggu-minggu setelahnya ketika tagihan datang, sehingga anggaran proyek terlampaui tanpa disadari.
2.  **Selisih Saldo Kas & Bank (Cash & Bank Discrepancies):** Sulitnya mencocokkan pengeluaran lapangan riil dengan mutasi rekening bank secara harian karena tidak adanya rekonsiliasi yang terstruktur.
3.  **Keterlambatan Pelaporan Laba/Rugi (Delayed P&L Reports):** Pemilik perusahaan (*Owner*) baru bisa melihat keuntungan bersih proyek berminggu-minggu setelah proyek selesai, menghalangi pengambilan keputusan strategis yang cepat.

---

## 3. Pengguna Sasaran (Target Users)

| Peran (Role) | Kebutuhan Utama | Perilaku Penggunaan |
| :--- | :--- | :--- |
| **Owner** (Pemilik Perusahaan) | *   Melihat profitabilitas proyek & cash flow real-time.<br>*   Persetujuan pengeluaran bernilai besar secara instan. | Menggunakan aplikasi 100% dari mobile phone untuk monitoring dashboard eksekutif dan menyetujui Server Actions mutasi kas. |
| **Admin** (Finance & Bookkeeper) | *   Rekonsiliasi mutasi bank dengan ledger sistem.<br>*   Verifikasi pengajuan dana PM.<br>*   Mengelola tagihan klien (*invoices*) & tagihan vendor (*bills*). | Menggunakan kombinasi tablet/laptop untuk tugas administratif berat, tetapi membutuhkan kemudahan akses mobile untuk verifikasi cepat. |
| **Project Manager (PM)** | *   Mengajukan dana proyek (*cash advance* / *reimbursement*).<br>*   Mencatat nota belanja langsung di lapangan. | 100% mobile-first di lapangan. Menggunakan kamera hp untuk mengambil foto nota dan mengandalkan Gemini AI parser untuk ekstraksi data nota otomatis. |

---

## 4. Cakupan MVP Keuangan (Finance-First MVP Scope)

### Modul Utama dalam MVP (In-Scope):
1.  **Cash & Bank Management:**
    *   Pengelolaan akun kas/bank (`bank_account`).
    *   Ledger transaksi kas (`cash_transaction`) yang mencatat kas masuk (*debit*) dan kas keluar (*credit*).
    *   Fitur rekonsiliasi mutasi bank harian.
2.  **Project Budgeting & Profitability:**
    *   Pembuatan anggaran proyek terperinci (`project_budget_item`) berdasarkan kategori (Material, Subkontraktor, Operasional).
    *   Pelacakan realisasi pengeluaran riil vs anggaran proyek secara real-time.
    *   Dashboard laba/rugi proyek (Gross & Net Profit) per proyek.
3.  **Field Cash Request & Approval Flow:**
    *   Pengajuan uang muka (*cash advance*) atau klaim biaya (*reimbursement*) oleh PM di lapangan.
    *   Alur validasi bertingkat: diajukan PM -> diverifikasi Admin -> disetujui Owner.
    *   Pembayaran otomatis memotong saldo akun bank terpilih setelah disetujui.
4.  **AI OCR Receipt Processing (Gemini AI Integration):**
    *   Fitur unggah nota/kuitansi belanja oleh PM melalui kamera HP.
    *   Gemini AI membaca gambar nota secara asinkron, mengekstrak total nominal, nama vendor, tanggal, dan mencocokkannya ke `project_budget_item` yang relevan.

### Di Luar Cakupan MVP (Out-of-Scope):
1.  **Manajemen SDM & Payroll:** Perhitungan gaji karyawan, komisi sales, BPJS, dan absensi kehadiran penuh.
2.  **Manajemen Inventaris Gudang (Warehouse Inventory):** Manajemen stok fisik barang masuk/keluar, pelacakan barcode, dan penilaian inventaris FIFO/LIFO.
3.  **Portal Eksternal Vendor & Klien:** Akses login langsung untuk pihak luar. Semua interaksi dijembatani oleh staf internal.
4.  **Multi-Currency:** Sistem ini hanya mendukung mata uang Rupiah (IDR).

---

## 5. Cerita Pengguna (User Stories)

*   **US-1 (Owner):** Sebagai Owner, saya ingin melihat grafik laba/rugi bersih (Net Profit) dari seluruh proyek aktif melalui HP saya, agar saya dapat mengetahui tingkat profitabilitas perusahaan secara instan tanpa perlu meminta laporan manual dari tim admin.
*   **US-2 (Owner):** Sebagai Owner, saya ingin menerima notifikasi mobile ketika ada pengajuan *cash advance* di atas Rp 5.000.000 dari Project Manager, sehingga saya bisa langsung memberikan persetujuan atau penolakan dengan satu ketukan.
*   **US-3 (Admin):** Sebagai Admin Finance, saya ingin mencocokkan mutasi bank yang diunggah secara berkala dengan entri `cash_transaction` di sistem, agar saya dapat memastikan tidak ada transaksi liar yang tidak tercatat di pembukuan perusahaan.
*   **US-4 (Project Manager):** Sebagai PM di lapangan, saya ingin mengunggah foto nota pembelian semen tambahan dari toko bangunan terdekat dan membiarkan Gemini AI mengisi form nominal transaksi secara otomatis, agar saya tidak perlu mengetik detail secara manual di tengah kesibukan proyek.
*   **US-5 (Project Manager):** Sebagai PM, saya ingin melihat sisa anggaran (`project_budget_item`) untuk kategori "Bahan Bangunan Utama" sebelum melakukan pemesanan pasir, agar saya bisa menjamin pengeluaran tidak melebihi alokasi yang disepakati klien.

---

## 6. Kriteria Penerimaan (Acceptance Criteria)

### A. Pengajuan Dana Lapangan (Field Reimbursement Flow)
*   **AC-1:** Form pengajuan wajib memuat field: `project_id`, `project_budget_item_id`, `amount`, `description`, dan `receipt_image_url` (opsional jika pengajuan di awal).
*   **AC-2:** Validasi menggunakan Zod schema di level Server Actions untuk memastikan nominal `amount` adalah angka positif lebih besar dari nol.
*   **AC-3:** PM hanya dapat mengajukan dana untuk proyek yang menugaskan namanya. PM dilarang keras melihat atau mengajukan dana ke proyek PM lain.
*   **AC-4:** Transaksi kas tidak boleh memotong atau menambah saldo `bank_account` secara riil sebelum status pengajuan berubah menjadi `APPROVED` oleh Owner dan dibayar oleh Admin.

### B. Validasi Anggaran Proyek (Budget Enforcement)
*   **AC-5:** Ketika realisasi biaya riil pada salah satu kategori `project_budget_item` melebihi 100% dari anggaran rencana, sistem wajib memberikan indikator warna merah (warning) di UI PM dan memblokir pengajuan otomatis kecuali mendapat override persetujuan dari Owner.
*   **AC-6:** Dashboard proyek harus menampilkan perhitungan persentase progres anggaran terpakai secara real-time menggunakan formula:
    $$\text{Budget Usage \%} = \left( \frac{\text{Actual Expenses}}{\text{Total Budget Allocation}} \right) \times 100$$

### C. Pemrosesan OCR Nota (Gemini AI Processing)
*   **AC-7:** File gambar nota yang diunggah oleh PM harus dikirim ke API Gemini AI. Hasil parsing harus mengembalikan format JSON yang tervalidasi oleh schema Zod: `vendorName`, `transactionDate`, `totalAmount`, dan `items`.
*   **AC-8:** Jika Gemini gagal memproses gambar atau tingkat kepercayaan data rendah, sistem harus menampilkan formulir kosong kepada PM dengan notifikasi kegagalan OCR agar diinput manual.

---

## 7. Metrik Kesuksesan (Success Metrics)

1.  **Akurasi Rekonsiliasi Kas:** Selisih nominal kas antara saldo pembukuan sistem dan saldo mutasi rekening bank riil adalah 0% di akhir bulan.
2.  **Kecepatan Input Transaksi:** Rata-rata waktu yang dibutuhkan untuk mencatat pengeluaran lapangan setelah transaksi fisik terjadi berkurang dari 7 hari (sistem manual terdahulu) menjadi kurang dari 12 jam.
3.  **Efisiensi Waktu Admin:** Waktu rekonsiliasi laporan bulanan oleh tim keuangan berkurang dari 3 hari kerja menjadi kurang dari 4 jam melalui pencocokan mutasi otomatis.
4.  **Penekanan Kebocoran Anggaran:** Jumlah proyek yang mengalami pembengkakan biaya (over-budget) tanpa persetujuan tertulis turun hingga di bawah 2% dari total proyek dalam setahun.
