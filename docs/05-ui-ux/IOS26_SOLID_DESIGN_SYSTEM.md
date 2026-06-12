# Panduan Sistem Desain iOS 26 Solid - Atria ERP

Dokumen ini berisi spesifikasi teknis dan aturan implementasi sistem desain antarmuka **iOS 26 Solid** untuk Atria ERP. Panduan ini dirancang untuk memastikan aplikasi memiliki visual premium yang konsisten, berkinerja tinggi pada webview seluler, serta ramah bagi penggunaan lapangan.

---

## 1. Filosofi Estetika & Nada Desain (iOS 26 Solid Philosophy)

Atria ERP menghindari tren estetika yang berlebihan seperti efek kaca cair (*liquid glass*), gradasi neon mencolok, atau transparansi bertingkat yang membebani rendering browser seluler.

Sistem desain **iOS 26 Solid** berfokus pada:
1.  **Light Theme & Flat Blocks:** Penggunaan warna latar off-white hangat yang nyaman dipandang di bawah sinar matahari dengan border mikro tipis dan bayangan sangat halus (*subtle shadows*).
2.  **Kejelasan Hierarki:** Penekanan pada ukuran huruf, ketebalan tipografi, dan kontras warna (menggunakan Deep Teal sebagai warna utama dan Slate Gray untuk teks primer).
3.  **Efisiensi GPU Webview:** Mengurangi beban rendering CSS filter blur pada perangkat seluler demi memastikan aplikasi tetap responsif pada kecepatan 60fps.

---

## 2. Palet Warna (Color Tokens)

Sistem warna menggunakan model **HSL (Hue, Saturation, Lightness)** untuk mempermudah kustomisasi tema dinamis dan variasi kegelapan warna (opacity).

### 2.1 Warna Dasar & Latar (Base & Background Colors)
*   `color-deep`: `hsl(30, 15%, 97%)` - Latar belakang utama aplikasi (off-white hangat / `#F7F6F3`).
*   `color-surface`: `hsl(0, 0%, 100%)` - Latar belakang kartu, panel, dan bar navigasi (putih bersih / `#FFFFFF`).
*   `color-elevated`: `hsl(30, 12%, 94%)` - Latar belakang modal sheet, popover, dan item terpilih (cream / `#F1F0EC`).
*   `color-border`: `hsl(214, 32%, 91%)` - Warna border pemisah (`#E2E8F0`).

### 2.2 Warna Teks (Typography Colors)
*   `color-text-primary`: `hsl(215, 28%, 17%)` - Teks judul dan nominal keuangan utama (dark slate / `#1E293B`).
*   `color-secondary`: `hsl(215, 16%, 47%)` - Teks deskripsi dan label form (slate-500 / `#64748B`).
*   `color-muted`: `hsl(215, 16%, 65%)` - Teks log audit, tanggal, dan informasi sekunder (slate-400 / `#94A3B8`).

### 2.3 Warna Fungsional & Status (Brand & Functional Colors)
Setiap warna status memiliki pasangan warna latar belakang redup (15% opacity) untuk kebutuhan badge kontras tinggi.

*   **Primary Brand (Deep Teal):**
    *   `color-primary`: `hsl(185, 100%, 16%)` - Warna tombol utama, link, tab aktif, dan jumlah nominal mutasi debit (`#004D54`).
    *   `color-primary-light`: `hsl(185, 60%, 93%)` - Latar belakang badge/tombol sekunder (`#E6F4F5`).
*   **Success Status (Emerald Green):**
    *   `color-success`: `hsl(142, 76%, 36%)` - Indikator profitabilitas aman, status invoice `PAID`, rekening bank surplus.
    *   `color-success-light`: `hsl(142, 76%, 93%)` - Latar belakang badge aman/surplus.
*   **Warning Status (Amber/Orange):**
    *   `color-warning`: `hsl(38, 92%, 50%)` - Indikator anggaran terpakai $\ge 90\%$, status invoice `OVERDUE`.
    *   `color-warning-light`: `hsl(38, 30%, 93%)` - Latar belakang badge peringatan anggaran.
*   **Critical Status (Red/Coral):**
    *   `color-critical`: `hsl(350, 89%, 60%)` - Indikator anggaran jebol $\ge 100\%$, pengeluaran ditolak, saldo minus.
    *   `color-critical-light`: `hsl(350, 89%, 93%)` - Latar belakang badge kritis/danger.

---

## 3. Tipografi & Grid Jarak (Typography & Spacing Grid)

### 3.1 Tipografi (Typography)
Atria ERP memadukan dua keluarga font modern:
*   **Outfit:** Digunakan untuk elemen display seperti angka nominal finansial besar, judul layar utama, dan statistik dasbor. Karakter Outfit yang geometris memberikan kesan bersih dan premium.
*   **Inter:** Digunakan untuk seluruh teks isi (*body text*), kolom input formulir, log transaksi, label, dan data tabel demi keterbacaan tingkat tinggi di bawah terik matahari lapangan.

| Token Nama | Ukuran (px / rem) | Font Family | Weight | Line Height | Penggunaan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `font-display` | `32px / 2.0rem` | Outfit | Bold (700) | `1.2` | Angka saldo utama dasbor |
| `font-title-lg` | `24px / 1.5rem` | Outfit | Bold (700) | `1.3` | Judul halaman/layar utama |
| `font-title-md` | `18px / 1.125rem` | Outfit | SemiBold (600) | `1.4` | Judul kartu & kategori BoQ |
| `font-body-bold` | `15px / 0.9375rem`| Inter | SemiBold (600) | `1.5` | Nama vendor, item pengajuan |
| `font-body` | `15px / 0.9375rem`| Inter | Regular (400) | `1.5` | Deskripsi, teks log audit |
| `font-caption` | `12px / 0.75rem` | Inter | Medium (500) | `1.4` | Sub-label form, tanggal jatuh tempo |
| `font-micro` | `10px / 0.625rem` | Inter | Bold (700) | `1.2` | Teks di dalam status badge |

### 3.2 Spacing Grid (4px/8px Increments)
Seluruh margin, padding, dan jarak antar elemen wajib menggunakan kelipatan **4px / 8px** untuk menjaga konsistensi ritme vertikal:
*   `space-xs`: `4px` - Jarak antara ikon dan teks pendukung.
*   `space-sm`: `8px` - Jarak antar elemen dalam kartu, padding horizontal badge.
*   `space-md`: `12px` - Padding internal input form kecil, jarak antar kartu kecil.
*   `space-lg`: `16px` - Padding internal standar kartu BoQ, margin tepi layar ponsel.
*   `space-xl`: `24px` - Jarak antar bagian layar (*section gap*), padding horizontal tombol besar.
*   `space-2xl`: `32px` - Jarak vertikal antar grup formulir besar.

---

## 4. Kelengkungan Sudut (Border Radii)

Untuk mencerminkan kehalusan antarmuka iOS modern, digunakan tiga tingkat kelengkungan sudut (`border-radius`):
1.  **Badge & Tombol Kecil (`rounded-lg`):** `8px` - Digunakan untuk elemen dengan tinggi kecil seperti status badge, checkbox, dan tombol verifikasi mini.
2.  **Kartu & Input Form (`rounded-2xl`):** `16px` - Digunakan untuk komponen berukuran sedang seperti kartu proyek, kartu mutasi kas, container input form, dan pop-up dialog.
3.  **Bottom Sheets, Modal Drawer, & Floating Tabbar (`rounded-3xl` / `rounded-[28px]`):** `24px` atau `28px` - Digunakan untuk kontainer melayang tabbar navigasi dan bottom sheet untuk memberikan estetika modern yang lembut.

---

## 5. Komponen Utama (Core Components)

### 5.1 Kartu Finansial (Financial Cards)
*   **Struktur HTML/CSS:**
    ```css
    .card-solid {
      background-color: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 24px; /* rounded-3xl */
      padding: 16px; /* space-lg */
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
    }
    ```
*   **Aturan Visual:** Tidak menggunakan filter blur. Jika kartu berada di atas peta atau gambar latar belakang, gunakan warna latar solid dengan tingkat kegelapan penuh (*opaque*) demi keterbacaan teks angka finansial.

### 5.2 Tombol & Area Sentuh (Buttons & Touch Targets)
Semua tombol interaktif wajib memenuhi kriteria area sentuh minimum **44x44px** (dioptimalkan ke **48x48px** untuk tombol lapangan).

*   **Primary Button (Tombol Utama):**
    *   Latar belakang solid `color-primary`. Teks `color-text-primary`.
    *   Padding: `14px 24px` untuk tinggi total 48px.
    *   Kelengkungan: `rounded-2xl` (16px) untuk menyesuaikan bentuk kartu.
*   **Secondary Button (Tombol Sekunder):**
    *   Latar belakang solid `color-primary-light` (redup). Teks `color-primary`.
    *   Tinggi target tetap: 48px.
*   **Destructive Button (Tombol Tolak/Hapus):**
    *   Latar belakang solid `color-critical`. Teks `color-text-primary`.

---

## 6. Elemen Formulir & Kontrol (Forms, Bottom Sheets, & Floating Navigation)

### 6.1 Floating Navigation & FAB (Floating Action Button)
*   **Floating Tab Bar Container:** Mengambang di atas konten dengan margin bawah `mb-4 px-4`. Berbentuk kapsul dengan kelengkungan `rounded-[28px]` dan bayangan lembut `shadow-[0_8px_24px_rgba(0,0,0,0.06)]`.
*   **Active Tab Circle Indicator:** Item tab aktif dibungkus dengan lingkaran solid `bg-primary size-10 flex items-center justify-center text-white rounded-full`. Item pasif tidak memiliki lingkaran background. Jarak vertikal dijaga seragam agar pusat ikon sejajar vertikal.
*   **FAB (Floating Action Button):** Tombol bulat melayang `bg-primary` di pojok kanan bawah, tepat di atas baris tab navigasi. Menyediakan pintasan instan bermodel ikon "+" untuk mempercepat akses form biaya lapangan.

### 6.2 Bottom Sheets (Slide-up Drawer)
Digunakan untuk formulir pemilihan proyek cepat atau peninjauan nota belanja:
*   **Pull Bar Indicator:** Di bagian tengah atas modal sheet, terdapat baris penarik horizontal dengan ukuran `36px x 4px` berwarna `color-border` dengan sudut membulat penuh untuk memberi tanda visual bahwa panel dapat digeser ke bawah.
*   **Backdrop Overlay:** Saat bottom sheet aktif, layar belakang ditutupi oleh overlay hitam solid dengan transparansi 60% (`rgba(0, 0, 0, 0.6)`). Ketukan pada area backdrop akan menutup sheet secara otomatis.

---

## 7. Lencana Status & Angka Finansial (Status Badges & Financial Numbers)

### 7.1 Lencana Status (Status Badges)
Digunakan untuk menandai fase persetujuan atau pembayaran. Setiap badge menggunakan warna teks status pekat dengan latar belakang redup (15% opacity) dari warna status tersebut:
*   `PAID` / `APPROVED` -> Teks `color-success`, Latar belakang `color-success-light` (15% opacity).
*   `PENDING` / `SUBMITTED` / `UNPAID` -> Teks `color-warning` (kuning/amber), Latar belakang `color-warning-light` (15% opacity).
*   `PARTIALLY_PAID` -> Teks `color-primary` (biru/indigo utama), Latar belakang `color-primary-light` (15% opacity).
*   `WARNING` -> Teks `color-warning`, Latar belakang `color-warning-light` (15% opacity).
*   `CRITICAL` / `OVERDUE` -> Teks `color-critical`, Latar belakang `color-critical-light` (15% opacity).

### 7.2 Format & Gaya Angka Finansial (Financial Numbers Styling)
Penulisan angka nominal uang Rupiah dirancang agar sangat terbaca untuk mendeteksi selisih angka sekecil apa pun:
1.  **Tabular Numbers (Monospace Alignment):** Menggunakan fitur CSS font untuk memaksa setiap karakter angka memiliki lebar horizontal yang seragam (sama rata) agar digit angka ribuan berbaris lurus ke bawah saat disajikan dalam tabel:
    ```css
    .financial-amount {
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum";
    }
    ```
2.  **Pemisah Ribuan & Desimal:** Wajib menggunakan pemisah ribuan titik (`.`) dan pemisah desimal koma (`,`) standar Rupiah Indonesia. Desimal dua angka di belakang koma (sen) disajikan dengan ukuran font lebih kecil 15% dari angka utama (misal: `Rp 650.000.000,`<sup>`00`</sup>).
3.  **Tanda Minus Finansial:** Saldo minus atau kas keluar (`CREDIT`) ditulis dengan tanda minus jelas di depan simbol mata uang dan berwarna merah solid. Contoh: `-Rp 42.000.000,00`. Kas masuk (`DEBIT`) ditulis dengan tanda plus berwarna deep teal (`color-primary`). Contoh: `+Rp 195.000.000,00`.
