# Spesifikasi UI/UX Mobile-First - Atria ERP

Dokumen ini mendefinisikan arsitektur antarmuka, tata letak layar, alur interaksi, dan strategi adaptasi desktop untuk Atria ERP. Desain ini mengikuti filosofi **iOS 26 Solid** yang mengutamakan kontras tinggi, keterbacaan di lapangan, serta keamanan transaksi finansial.

---

## 1. App Shell & Navigasi Utama (Bottom Navigation)

Aplikasi ini menggunakan **App Shell** satu halaman (Single Page App Shell) yang membungkus seluruh navigasi seluler dengan area konten dinamis di bagian tengah dan navigasi statis di bagian bawah.

### 1.1 Bottom Navigation Bar (Sticky Bottom Nav)
Navigasi bawah bersifat permanen (*sticky*) dan selalu berada di bagian paling bawah layar ponsel, di atas indikator home system (safe area bottom).

*   **Tinggi Bar:** 64px untuk memastikan ruang tap yang luas dan menghindari sentuhan tidak sengaja pada baris sistem iOS/Android.
*   **Touch Targets:** Setiap tab navigasi memiliki area sensitivitas tap minimal **48x48 piksel** (melebihi batas minimum 44x44px).
*   **Daftar Tab Navigasi (Kiri ke Kanan):**
    1.  **Projects** (Ikon: Folder/Koper) - Menampilkan daftar proyek aktif dan ringkasan anggaran.
    2.  **Ledger** (Ikon: Buku Kas/Chart) - Buku besar mutasi kas riil perusahaan.
    3.  **Add Expense** (Ikon: Tombol Bulat Tambah dengan warna khusus di tengah) - Tombol cepat untuk PM mengajukan biaya lapangan.
    4.  **Profile** (Ikon: User/Avatar) - Pengaturan akun, log aktivitas, dan peran otorisasi (RBAC).

```
+-------------------------------------------------------------+
|                       Viewport Utama                        |
|                                                             |
|                                                             |
+-------------------------------------------------------------+
| [Projects]      [Ledger]     [Add Expense]      [Profile]   |
|   Tab 1          Tab 2           Tab 3            Tab 4     |
+-------------------------------------------------------------+
```

---

## 2. Dasbor Keuangan (Finance Dashboard)

Dasbor utama memberikan ringkasan kesehatan finansial perusahaan secara instan kepada Owner dan Admin Finance.

### 2.1 Ringkasan Akun Bank (`bank_account` Card Grid)
Menampilkan saldo aktual dari tiga akun kas utama dalam bentuk kartu horizontal yang dapat digeser (*horizontal swipeable cards*):
*   **BCA Operational:** Menampilkan nama bank `BCA`, nomor rekening `8889991122`, nama pemegang `PT Dekoria Desain Estetika`, dan saldo dengan format Rupiah kontras tinggi (misal: `Rp 735.000.000,00`).
*   **Mandiri Project:** Menampilkan nama bank `Mandiri`, nomor rekening `11122233344`, nama pemegang `PT Dekoria Desain Estetika`, dan saldo (misal: `Rp 710.000.000,00`).
*   **Petty Cash Office:** Menampilkan nama bank `BCA`, nomor rekening `9990001112`, nama pemegang `Lisa Permata (Cashier)`, dan saldo (misal: `Rp 13.000.000,00`).

### 2.2 Feed Peringatan Dini Finansial (Financial Alerts Feed)
Menyajikan notifikasi real-time dari tabel `notification` yang difilter berdasarkan `severity`:
*   **WARNING Indicator:** Kartu berwarna amber/orange solid tanpa gradasi. Contoh: *"WARNING: Anggaran MEP Proyek Menteng telah terpakai Rp 65.000.000 dari alokasi Rp 70.000.000 (92.8%)."*
*   **CRITICAL Indicator:** Kartu berwarna merah solid berdensitas tinggi untuk menunjukkan bahaya pembengkakan biaya. Contoh: *"CRITICAL: Anggaran Operasional PM Proyek Menteng melampaui batas sebesar Rp 42.000.000 dari alokasi Rp 40.000.000 (105.0%)."*

### 2.3 Riwayat Log Audit Terbaru (Recent Audit Logs Stream)
Aliran aktivitas immutable terbaru dari `audit_log` untuk visibilitas forensik transaksi kas:
*   Format baris log: `[Waktu] - [Nama User] - [Tindakan] - [Nominal jika ada]`.
*   Contoh: *"14:10 - Lisa Permata mengubah status INV/2026/001 menjadi PAID (Rp 195.000.000,00)"*.

---

## 3. Detail Keuangan Proyek (Project Finance Detail Screen)

Layar ini diakses dengan mengetuk salah satu proyek di tab **Projects**. Layar menampilkan status kesehatan anggaran proyek secara granular.

### 3.1 Indikator Kesehatan Finansial (`financial_health`)
Di bagian atas detail proyek, terdapat badge kesehatan finansial proyek berdasarkan enum `project_financial_health`:
*   `HEALTHY` (Teks hijau emerald pekat `color-success` dengan latar belakang redup `color-success-light` 15% opacity): Pengeluaran di bawah 90% dari total anggaran.
*   `WARNING` (Teks amber pekat `color-warning` dengan latar belakang redup `color-warning-light` 15% opacity): Pengeluaran berada di rentang 90% - 99.9% dari total anggaran.
*   `CRITICAL` (Teks merah pekat `color-critical` dengan latar belakang redup `color-critical-light` 15% opacity): Pengeluaran $\ge 100\%$ (Over-budget).

### 3.2 Visualisasi Alokasi vs Realisasi Anggaran (`allocated_amount` vs `actual_spent`)
Daftar anggaran BoQ proyek yang diambil dari `project_budget_item` dikelompokkan berdasarkan `cost_category`:
*   **Kategori Material (`CAT_MATERIAL`):** Menampilkan nama item (misal: *Finishing Kabinet Dapur*), nominal dialokasikan (`Rp 220.000.000,00`), nominal terpakai (`Rp 210.000.000,00`), sisa anggaran (`Rp 10.000.000,00`), dan progress bar solid dengan tingkat keterisian 95.4%.
*   **Kategori Subkontraktor (`CAT_SUB`):** Menampilkan progress bar dan data realisasi.
*   **Kategori Operasional Lapangan (`CAT_OPERATIONAL`):** Jika terjadi overrun (seperti pada contoh Menteng Residence), progress bar akan terisi penuh (100%) dengan tambahan warna merah menyala pada teks sisa anggaran untuk menandai minus (misal: `-Rp 2.000.000,00`).

---

## 4. Pelacakan Pembayaran Klien (Client Payment Tracking Screen)

Digunakan oleh Admin dan Owner untuk melacak piutang termin proyek (*Accounts Receivable*).

### 4.1 Linimasa Invoice Klien (`client_invoice` Timeline)
Menampilkan daftar invoice secara kronologis berdasar tanggal jatuh tempo (`due_date`):
*   Setiap invoice menampilkan nomor invoice (misal: `INV/2026/001`), nominal (`Rp 195.000.000,00`), jatuh tempo, dan label tahap pembayaran (`DP`, `PROGRESS_1`, `PELUNASAN`, atau `AD_HOC`).
*   **Status Invoice Badges:**
    *   `UNPAID` (Teks kuning/amber pekat `color-warning` dengan latar belakang redup `color-warning-light` 15% opacity)
    *   `PARTIALLY_PAID` (Teks biru/indigo utama `color-primary` dengan latar belakang redup `color-primary-light` 15% opacity)
    *   `PAID` (Teks hijau emerald pekat `color-success` dengan latar belakang redup `color-success-light` 15% opacity)
    *   `OVERDUE` (Teks merah pekat `color-critical` dengan latar belakang redup `color-critical-light` 15% opacity)
    *   `VOID` (Teks abu-abu redup `color-text-muted` dengan latar belakang redup `color-bg-elevated` 15% opacity, serta coret tengah)

### 4.2 Pencatatan Pembayaran Piutang (Record Payment Flow)
Formulir input cepat untuk mencatat pembayaran masuk yang diterima di `bank_account`:
1.  **Pilih Rekening Penerima:** Dropdown berisi daftar `bank_account` (misal: BCA Operational).
2.  **Nominal Diterima:** Kolom input dengan pemisah ribuan otomatis (*automatic thousand separator*).
3.  **Tanggal Transaksi & Nomor Referensi:** Input tanggal transfer dan string ID transfer bank (misal: `TRF-BCA-9831`).
4.  **Aksi Simpan:** Tombol "Simpan Transaksi Kas Masuk" yang akan memicu transaksi database sinkron: menyisipkan ke `client_payment` dan `cash_transaction` (`DEBIT`), serta memperbarui saldo `bank_account` terkait.

---

## 5. Layar Input Pengeluaran Lapangan (Expense Input Form Screen)

Dirancang khusus untuk Project Manager (PM) yang berada di lapangan agar dapat mencatat pengeluaran secara cepat dan aman menggunakan satu tangan.

### 5.1 Tata Letak Ramah Satu Tangan (One-Hand Optimization)
*   Formulir pengisian memiliki elemen input utama di bagian tengah bawah layar agar mudah dijangkau oleh jempol.
*   Tombol aksi utama "Unggah Nota & Simpan" diletakkan mengambang (*floating button*) di sisi kanan bawah dengan diameter **56x56px**.

### 5.2 Alur Pemindaian Nota Otomatis (Gemini AI OCR Flow)
1.  **Pemicu Kamera:** PM mengetuk ikon Kamera Besar di bagian atas form. Kamera ponsel terbuka untuk mengambil foto nota pembelian material.
2.  **Unggah & Parsing Asinkron:** Setelah foto diambil, sistem mengirim file ke API Gemini AI. Layar menampilkan animasi pemrosesan mini: *"Memproses struk dengan Gemini AI..."* dengan skeleton loader pada kolom input.
3.  **Verifikasi Hasil OCR:** Gemini AI mengekstrak data ke format JSON. Sistem mengisi kolom form secara otomatis:
    *   `amount` (Nominal pengeluaran, misal: `Rp 65.000.000,00`)
    *   `description` (Detail belanja, misal: *Belanja kabel Eterna, MCB Schneider, & conduit PVC*)
    *   `vendorName` (Nama toko/vendor pembeli, dicocokkan dengan master `vendor` atau ditulis manual).
4.  **Seleksi Budget Item:** PM memilih `project_budget_item_id` dari dropdown proyek yang ditugaskan kepadanya.
5.  **Simpan & Kirim:** PM meninjau hasil ekstraksi dan menekan tombol centang hijau. Transaksi tersimpan ke `project_cost` dengan status `SUBMITTED`.

---

## 6. Layar Hutang Vendor (Vendor Payable Screen)

Memungkinkan Admin Finance untuk meninjau tagihan masuk dari supplier (*Accounts Payable* / AP) dan melakukan otorisasi pembayaran.

### 6.1 Daftar Tagihan Vendor (`vendor_bill` List)
Menampilkan daftar tagihan supplier terutang:
*   Identitas vendor (misal: *PT Cahaya Abadi Material*).
*   Nominal tagihan (`Rp 210.000.000,00`), tanggal jatuh tempo, dan alokasi item anggaran proyek terkait.
*   Informasi rekening bank tujuan transfer vendor yang ditarik dari tabel `vendor` (Nama Bank, Nomor Rekening, Nama Pemilik).

### 6.2 Otorisasi & Proses Transfer Kas Keluar (`vendor_payment` Flow)
1.  Admin memilih tagihan `vendor_bill` yang berstatus `UNPAID` atau `PARTIALLY_PAID`.
2.  Admin menentukan rekening asal transfer dari daftar `bank_account` (misal: BCA Operational).
3.  Admin menekan tombol "Ajukan Pembayaran" yang akan membuat record `vendor_payment` dengan status `PENDING`.
4.  Setelah Owner menyetujui, Admin memasukkan nomor referensi transfer bank (misal: `LLG-BCA-0012`) dan memperbarui status menjadi `COMPLETED` untuk memicu pemotongan saldo kas perusahaan dan penulisan ledger `cash_transaction` (`CREDIT`).

---

## 7. Layar Persetujuan Owner (Owner Approval/Action Screen)

Layar kritis bagi Pemilik Perusahaan untuk mengendalikan pengeluaran dan memberikan override anggaran yang jebol.

### 7.1 Antrean Persetujuan Prioritas Tinggi (High-Priority Approval Queue)
Sistem menyaring pengajuan biaya lapangan (`project_cost`) dan tagihan vendor (`vendor_bill`) yang membutuhkan persetujuan Owner berdasarkan dua aturan:
1.  Pengajuan dana lapangan atau pembayaran vendor dengan nominal **di atas Rp 5.000.000,00**.
2.  Pengajuan dana yang memicu pembengkakan anggaran (`budget_overrun = true`) di mana pengeluaran riil kategori anggaran proyek sudah melebihi 100% dari alokasi rencana.

### 7.2 Detail Kartu Persetujuan (Approval Card Detail)
Kartu persetujuan menampilkan informasi komparatif yang padat untuk mempermudah keputusan:
*   **Informasi Pengaju:** PM Budi Santoso mengajukan Rp 42.000.000,00 untuk proyek *Menteng Residence*.
*   **Status Anggaran Terkini:** Menampilkan anggaran kategori *Operasional Lapangan*: Plafon `Rp 40.000.000,00` | Riil Terpakai `Rp 0,00` | Sisa `Rp 40.000.000,00`. Jika pengajuan disetujui, maka total pengeluaran akan menjadi `Rp 42.000.000,00` (Jebol 105.0%).
*   **Bukti Pendukung:** Thumbnail foto nota belanja lapangan yang dapat diketuk untuk memperbesar (*pinch-to-zoom*).
*   **Catatan Justifikasi:** Deskripsi alasan pengajuan (misal: *Klaim akomodasi, sewa scaffolding, & konsumsi lembur tukang*).
*   **Tombol Tindakan Cepat:** Dua tombol bulat besar yang bersebelahan:
    *   **Approve** (Warna Hijau Solid, Ikon Centang, ukuran target tap **52x52px**).
    *   **Reject** (Warna Merah Solid, Ikon Silang, ukuran target tap **52x52px**).
    *   Menyetujui akan memicu penulisan ke tabel `approval` dengan status `APPROVED`, serta memperbarui status `project_cost` menjadi `APPROVED` / `PAID`.

---

## 8. Layar Taklimat AI (AI Briefing Screen)

Layar ringkasan eksekutif harian berbasis kecerdasan buatan Gemini AI untuk Owner.

### 8.1 Ringkasan Finansial Harian (AI Daily Briefing)
Menampilkan rangkuman teks naratif cerdas yang dihasilkan oleh Gemini AI (`ai_run` dengan tipe `FINANCIAL_BRIEFING`) setiap pukul 08:00 pagi:
*   **Highlights Mutasi Kas:** Kas masuk termin klien, total pengeluaran vendor, dan saldo kas bersih terdebit.
*   **Identifikasi Anomali & Risiko:** Menyoroti proyek mana yang mengalami pembengkakan budget atau vendor bill mendekati jatuh tempo tanpa cadangan kas memadai.
*   *Contoh Narasi:* "Selamat pagi Ronald. Dalam 24 jam terakhir, kas perusahaan menerima dana masuk sebesar Rp 195.000.000 dari Ibu Alexandra (Menteng DP). Namun, proyek Menteng saat ini berada dalam status CRITICAL karena kategori biaya Operasional Lapangan mengalami overrun sebesar 105.0% setelah persetujuan klaim akomodasi PM Budi kemarin. Disarankan menahan tagihan vendor CV Kayu Jati Luhur sebesar Rp 175.000.000 yang jatuh tempo dalam 3 hari ke depan hingga progress lapangan mencapai milestone berikutnya."

---

## 9. Keadaan UI Umum (UI States) & Gestur Interaksi

Untuk menjamin aplikasi terasa premium, interaktif, dan andal di kondisi sinyal lapangan yang buruk, keadaan UI berikut wajib diterapkan:

### 9.1 Empty States (Keadaan Kosong)
*   Ditampilkan saat tidak ada data pengajuan biaya, invoice, atau notifikasi.
*   **Desain:** Ilustrasi outline monokromatik abu-abu solid (tanpa warna gradasi mencolok) yang dipadukan dengan teks petunjuk singkat dalam Bahasa Indonesia.
*   **Contoh:** Pada daftar persetujuan kosong, tampilkan ikon kotak masuk bersih dengan teks *"Semua pengajuan telah diproses. Tidak ada antrean persetujuan saat ini."*

### 9.2 Loading States (Keadaan Memuat)
*   **Shimmer Skeletons:** Dilarang menggunakan animasi spinner berputar tradisional di tengah layar yang membuat aplikasi terasa membeku. Gunakan efek shimmer skeleton berwarna abu-abu terang ke gelap secara berkala pada elemen kartu, teks nominal, dan baris daftar untuk menunjukkan bagian data yang sedang dimuat secara asinkron.

### 9.3 Error States (Keadaan Gagal/Error)
*   Ditampilkan saat koneksi internet terputus atau Server Actions mengembalikan error Zod validation.
*   **Desain:** Banner merah bata solid dengan teks pesan error yang informatif (menghindari kode error sistem mentah) dan tombol "Coba Lagi" (*Retry*) dengan ukuran tap minimal **44x44px**.
*   **Contoh:** *"Gagal menyimpan pengajuan dana. Pastikan ukuran file foto nota di bawah 5MB dan nominal angka terisi dengan benar. [Tombol Coba Lagi]"*

### 9.4 Gestur Swipe & Tap
*   **Swipe-to-Approve / Swipe-to-Reject:** Pada daftar antrean persetujuan Owner, pengguna dapat menggeser kartu pengajuan ke arah kanan untuk langsung menyetujui (`APPROVED`) atau menggeser ke kiri untuk menolak (`REJECTED`) dengan efek haptic feedback bergetar pendek pada ponsel iOS/Android.
*   **Tap Behavior:** Umpan balik visual instan (efek penekanan/redup warna 10% atau scale down mikro 0.98x) saat tombol disentuh untuk menandakan input telah diterima oleh sistem sebelum Server Action selesai dieksekusi.

---

## 10. Strategi Adaptasi Desktop (Desktop Responsive Adaptation)

Meskipun Atria ERP mengutamakan kegunaan seluler (mobile-first), pengguna Admin Finance dan Owner sering kali memerlukan layar desktop atau tablet untuk menyelesaikan tugas pembukuan yang kompleks seperti rekonsiliasi bank bulanan atau penyusunan anggaran BoQ awal.

### 10.1 Transformasi Tata Letak Grid & Dual-Pane
Sistem antarmuka akan mendeteksi lebar layar menggunakan CSS Media Queries (`@media (min-width: 1024px)`):
*   **Navigasi:** Bottom Navigation Bar pada mobile akan bertransformasi menjadi **Sidebar Navigation** vertikal yang menetap di sisi kiri layar dengan lebar tetap 240px.
*   **Tampilan Dual-Pane (Layar Ganda):** Daftar proyek/transaksi kas dan panel detailnya yang sebelumnya berada di dua layar berbeda pada mobile, akan disajikan bersandingan dalam satu layar di desktop. Panel kiri menampilkan daftar list (lebar 35%), sementara panel kanan memuat informasi detail komprehensif, log audit, dan dokumen nota lampiran secara real-time (lebar 65%).
*   **Visualisasi Data:** Grafik sparkline mikro pada seluler akan bertransformasi menjadi dashboard visual interaktif berskala besar menggunakan chart area dan bar chart untuk membandingkan profitabilitas antar proyek secara komparatif.

```
+-------------------------------------------------------------------------+
| [Logo]   | Dasbor Keuangan - Menteng Residence                          |
|          +----------------------------------+---------------------------+
| Projects | Detail Anggaran Proyek (BoQ)     | Bukti Nota & Log Audit    |
| *Active  |                                  |                           |
|          | Category: Material (95.4%)       | [Foto Nota Belanja]       |
| Ledger   | [====================------]     |                           |
|          |                                  | Log Audit:                |
| Approvals| Category: Operational (105.0%)   | 14:10 - Budi Santoso      |
|          | [==========================]     | membuat reimbursement     |
| Profile  |                                  |                           |
+----------+----------------------------------+---------------------------+
```
