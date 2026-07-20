# Rencana Implementasi: TSK-011 UI Form Pengeluaran Lapangan & Integrasi OCR PM

Rencana ini menjelaskan rancangan dan implementasi antarmuka formulir pengisian pengeluaran lapangan (field claims / project costs) untuk Project Manager (PM), yang dioptimalkan untuk penggunaan satu tangan, terintegrasi dengan unggah berkas ke ImageKit CDN menggunakan signature aman, serta asinkron Gemini OCR parsing untuk mendeteksi data nota otomatis.

---

## User Review Required

> [!IMPORTANT]
> **Alur Unggah Langsung Client-to-CDN:**
> Berkas gambar nota diunggah langsung dari browser pengguna ke ImageKit CDN menggunakan tanda tangan otentikasi sekali pakai (`token`, `expire`, `signature`) yang diperoleh dari Server Action `/app/actions/media/sign-imagekit.ts`. Ini mencegah lalu lintas data gambar yang besar membebani server Next.js kita, sekaligus menjaga kerahasiaan `IMAGEKIT_PRIVATE_KEY` di tingkat server.

---

## Proposed Changes

### 1. Komponen: Media Upload Security (Server Actions)

#### [NEW] [sign-imagekit.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/actions/media/sign-imagekit.ts)
*   Membuat Server Action `signImagekit()` yang:
    1. Memverifikasi sesi pengguna aktif menggunakan Better Auth.
    2. Menghasilkan parameter otentikasi sekali pakai untuk ImageKit:
        *   `token`: String acak menggunakan `crypto.randomBytes(16).toString("hex")`.
        *   `expire`: Waktu kedaluwarsa berupa epoch timestamp (dalam detik) untuk 40 menit ke depan.
        *   `signature`: Hash HMAC-SHA1 dari string `token + expire` menggunakan `IMAGEKIT_PRIVATE_KEY` sebagai kunci rahasia.
    3. Mengembalikan parameter ke client-side.

### 2. Komponen: Formulir Input Pengeluaran (Client-Side Component)

#### [NEW] [expense-form.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/expense/expense-form.tsx)
*   Membuat komponen React Client `ExpenseForm` yang memiliki fitur:
    *   **Pilihan Proyek & Kategori Anggaran:** 
        *   Menampilkan daftar proyek aktif yang ditugaskan kepada PM yang sedang login (dibatasi menggunakan scoping filter).
        *   Menampilkan daftar item BoQ anggaran (`project_budget_item`) yang aktif untuk proyek yang dipilih.
    *   **Unggah Gambar Nota Terintegrasi:**
        *   Tombol input file (`accept="image/*"`) dengan opsi memicu kamera langsung di perangkat mobile.
        *   Mengambil parameter tanda tangan dari `signImagekit()`.
        *   Mengunggah file ke ImageKit REST API (`https://upload.imagekit.io/api/v1/files/upload`).
    *   **Pemrosesan Asinkron OCR & Shimmer Loading:**
        *   Saat proses unggah dimulai, tampilkan skeleton loading shimmer pada input Amount dan Description.
        *   Setelah unggahan selesai, kirim URL gambar ImageKit ke Server Action `processReceipt`.
        *   Selama Gemini memproses pembacaan struk belanja, input Amount dan Description tetap dalam status loading (shimmer skeleton).
        *   Setelah Gemini OCR mengembalikan data JSON terstruktur, isi otomatis input nominal (`totalAmount`) dan deskripsi (`vendorName` + detail barang).
    *   **Input Manual & Review:**
        *   Pengguna dapat memeriksa hasil ekstraksi nota dan merevisi Amount, Description, atau memilih budget item secara manual jika ada kesalahan.
    *   **Layout Ramah Satu Tangan (One-Hand Optimized):**
        *   Elemen-elemen kontrol input diposisikan rapat ke bawah viewport mobile.
        *   Touch targets minimal berukuran 44x44px.
        *   Tombol utama simpan dibuat besar (minimum 48px tinggi) dengan warna indigo solid khas iOS 26 Solid.
    *   **Submit Form:**
        *   Memicu Server Action `submitFieldRequest` dari `/app/actions/finance/field-requests` saat form di-submit.
        *   Menampilkan notifikasi umpan balik sukses/gagal di layar.

### 3. Komponen: Halaman Entry Pengeluaran

#### [MODIFY] [page.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/expenses/new/page.tsx)
*   Memuat daftar proyek PM dan item anggarannya di sisi server menggunakan Server Components (RSC) dengan filter keamanan scoping yang ketat.
*   Mengirimkan daftar proyek dan kategori anggaran tersebut sebagai props ke client component `ExpenseForm` agar data ter-render instan tanpa jeda pemanggilan API di sisi client.

---

## Verification Plan

### Automated Tests
*   Membuat berkas unit test baru `lib/finance/ocr-form.test.ts` atau scratch file untuk menguji simulasi alur:
    1. Pemanggilan API tanda tangan ImageKit `signImagekit` menghasilkan token & signature valid.
    2. Integrasi data OCR otomatis mengisi form masukan dan melempar payload valid ke `submitFieldRequest`.
    `bun test lib/finance/ocr-form.test.ts` (atau file test sejenis)

### Manual Verification
1. Jalankan server dev (`bun run dev`).
2. Masuk sebagai PM Budi Santoso di browser emulator mobile.
3. Buka halaman `/expenses/new`.
4. Unggah foto nota belanja marmer / semen.
5. Periksa transisi animasi skeleton shimmer selama proses OCR.
6. Konfirmasi bahwa nilai total nota terisi otomatis, lalu tekan tombol simpan untuk mengirim pengajuan biaya.
