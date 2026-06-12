# Spesifikasi UI/UX Mobile-First - Atria ERP

Dokumen ini mendefinisikan arsitektur antarmuka, tata letak layar, alur interaksi, dan strategi adaptasi desktop untuk Atria ERP. Desain ini mengikuti filosofi **iOS 26 Solid** yang mengutamakan kontras tinggi, keterbacaan di lapangan, serta keamanan transaksi finansial.

---

## 1. App Shell & Navigasi Utama (Bottom Navigation & FAB)

Aplikasi ini menggunakan **App Shell** satu halaman (Single Page App Shell) yang membungkus seluruh navigasi seluler dengan area konten dinamis di bagian tengah, navigasi melayang di bagian bawah, dan tombol aksi melayang (FAB).

### 1.1 Bottom Navigation Bar (Floating Pill Tab Bar)
Navigasi bawah bersifat melayang (*floating*) di atas konten halaman dengan bentuk kapsul membulat halus (`rounded-[28px]`).

*   **Tinggi Bar:** 80px untuk ruang tap yang luas dan menghindari sentuhan tidak sengaja pada baris sistem.
*   **Touch Targets:** Setiap tab navigasi memiliki area sensitivitas tap minimal **48x48 piksel** (dioptimalkan ke 52x52px).
*   **Daftar Tab Navigasi (Kiri ke Kanan):**
    1.  **Today** (Ikon: Kalender) - Dasbor utama ringkasan portofolio keuangan saat ini (`/ledger`).
    2.  **Projects** (Ikon: Kompas) - Menampilkan daftar proyek aktif dan ringkasan anggaran.
    3.  **Payments** (Ikon: Banknote) - Daftar persetujuan/pembayaran tagihan vendor atau klaim PM (`/approvals`).
    4.  **Expenses** (Ikon: Receipt) - Form pencatatan biaya pengeluaran lapangan baru (`/expenses/new`).
    5.  **AI Brief** (Ikon: Sparkles) - CFO AI Daily Briefing terpusat (`/ledger?brief=true`).
*   **Active Tab Circle Indicator:** Tab yang sedang aktif ditandai dengan lingkaran berwarna teal pekat (`bg-primary size-10 text-white rounded-full`) di sekitar ikonnya, sedangkan tab pasif hanya menampilkan ikon berwarna abu-abu redup tanpa latar belakang lingkaran.

### 1.2 Floating Action Button (FAB)
Di pojok kanan bawah, melayang tepat di atas tab bar navigasi, terdapat tombol aksi melayang (FAB) berbentuk lingkaran teal pekat dengan ikon "+" putih. Tombol ini memberikan akses pintas instan untuk mencatat pengeluaran lapangan baru dari mana saja.

### 1.3 Avatar Profil Header
Di bagian header atas layar dasbor utama, terdapat foto profil melingkar pengguna aktif (Sarah). Ketukan pada foto profil ini mengarahkan pengguna ke halaman Pengaturan Profil (`/profile`) sehingga menghemat ruang pada bar navigasi bawah.

---

## 2. Dasbor Keuangan (Finance Dashboard)

Dasbor utama memberikan ringkasan kesehatan finansial perusahaan secara instan kepada Owner dan Admin Finance dengan tata letak vertikal yang modular:

### 2.1 Kartu Saldo Kas Utama (Cash Available Card)
*   **Warna Latar:** Solid Deep Teal pekat (`bg-primary`) dengan bayangan halus.
*   **Teks Atas:** Label "CASH AVAILABLE" dengan huruf kapital kecil, warna teal muda redup, dan tracking renggang.
*   **Nilai Saldo:** Nilai agregat dari seluruh rekening bank perusahaan (misal: `Rp 420.500.000,00`) disajikan dengan font Outfit besar berukuran 32px dan penyejajaran angka tabular (`font-variant-numeric: tabular-nums`).
*   **Umpan Tren:** Badge tren positif "+2.4% dari last month" berwarna hijau cerah dengan ikon tren naik.
*   **Dekorasi Latar:** Ikon dompet (*wallet*) yang samar di sisi pojok kanan bawah kartu sebagai penanda visual yang elegan.

### 2.2 Kartu Ekspektasi Kas Ganda (Expected In & To Pay)
Dua kartu putih bersih bersandingan secara horizontal:
*   **Expected In (Kiri):** Menampilkan estimasi piutang invoice masuk (misal: `Rp 85jt`) dilengkapi batang kemajuan progres horizontal berwarna teal pekat.
*   **To Pay (Kanan):** Menampilkan estimasi utang vendor jatuh tempo (misal: `Rp 42jt`) dilengkapi batang progres berwarna abu-abu charcoal.

### 2.3 Panel AI Brief
*   Boks modular berwarna krem/abu-abu hangat dengan ikon bintang berpendar (*sparkles*) di dalam boks teal kecil.
*   Menampilkan taklimat/ringkasan naratif kecerdasan buatan Gemini CFO secara padat mengenai posisi kas saat ini dan tindakan tindak lanjut tagihan yang disarankan.

### 2.4 Urgent Alerts Section
*   Daftar peringatan kritis berdesain baris bar yang dapat diketuk:
    *   **3 Overdue Payments:** Lencana peringatan merah solid dengan tanda segitiga bahaya.
    *   **1 Project at Margin Risk:** Lencana peringatan kuning/amber solid untuk risiko margin proyek.

### 2.5 Recent Transactions List
*   Satu kontainer kartu putih solid dengan pembatas baris tipis berisi aliran mutasi kas buku besar terbaru:
    *   Kas Masuk (`DEBIT`): Menggunakan ikon kompas abu-abu, judul proyek klien (misal: "Studio Loft Renovation - Invoiced"), dan nominal bertanda plus dengan warna teal pekat.
    *   Kas Keluar (`CREDIT`): Menggunakan ikon keranjang belanja, judul vendor (misal: "Luxe Marble Supplies - Vendor Payment"), dan nominal bertanda minus warna slate gray.

---

## 3. Detail Keuangan Proyek (Project Finance Detail Screen)

Layar ini menampilkan status kesehatan anggaran proyek secara granular:
*   **BoQ Kategori Biaya:** Progress bar horizontal berwarna dinamis: biru untuk aman ($\le 90\%$), amber untuk batas kritis ($90\% - 100\%$), dan merah menyala untuk budget overrun ($\ge 100\%$).
*   **Jumlah Moneter:** Menggunakan format tabular numbers Outfit untuk kemudahan pembacaan audit vertikal.
