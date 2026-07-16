# Stack Decision - Atria ERP

Dokumen ini menjelaskan keputusan pemilihan unit teknologi (*tech stack*) yang digunakan untuk membangun Atria ERP. Pemilihan teknologi ini berfokus pada kecepatan pengembangan (*developer velocity*), ketahanan data transaksi (*data integrity*), efisiensi biaya (*cost efficiency*), serta performa aplikasi yang optimal pada perangkat seluler bagi Project Manager (PM) di lapangan.

---

## 1. Pemilihan Komponen Stack & Rasionil

Berikut adalah keputusan pemilihan komponen teknologi beserta pertimbangannya:

### 1.1 Next.js App Router
Next.js dengan arsitektur App Router dipilih sebagai fondasi utama framework aplikasi.
*   **Rasionil Finansial & Operasional:** Menyediakan kemampuan *Server-Side Rendering* (SSR) dan *React Server Components* (RSC) yang membuat pemuatan data keuangan awal sangat cepat, bahkan pada koneksi internet seluler di lokasi proyek.
*   **Fitur Teknis Utama:**
    *   **Server Components & Actions:** Mengurangi pengiriman *Javascript bundle* ke browser client, sehingga meningkatkan kinerja perangkat seluler.
    *   **Parallel & Intercepting Routes:** Memudahkan pembuatan antarmuka modal overlay dan *bottom sheets* ala aplikasi native iOS 26 tanpa merusak status navigasi URL browser.
    *   **Built-in Routing & API:** Menghilangkan kebutuhan untuk memelihara server API terpisah, menyederhanakan *deployment pipeline*.

### 1.2 Bun
Bun digunakan sebagai JavaScript runtime, package manager, dan test runner.
*   **Rasionil Finansial & Operasional:** Bun menawarkan kecepatan eksekusi dan instalasi dependensi yang jauh lebih cepat dibandingkan Node.js dan npm. Hal ini menghemat waktu tunggu pada *Continuous Integration* (CI) pipeline dan meminimalkan biaya komputasi server.
*   **Fitur Teknis Utama:**
    *   **Fast Package Manager:** Instalasi modul yang instan mempercepat siklus *development* lokal.
    *   **Native TypeScript Support:** Bun menjalankan file `.ts` secara langsung tanpa proses kompilasi tambahan (*transpilation step*), menyederhanakan konfigurasi.
    *   **Built-in Test Runner:** Kecepatan eksekusi unit test menggunakan Bun Test mendukung implementasi *Test-Driven Development* (TDD) secara instan.

### 1.3 Neon PostgreSQL
Neon digunakan sebagai serverless database PostgreSQL utama untuk Atria ERP.
*   **Rasionil Finansial & Operasional:** Neon mengadopsi model *serverless storage* yang memisahkan komputasi (*compute*) dan penyimpanan (*storage*). Ini memungkinkan database melakukan *scale-to-zero* saat tidak ada aktivitas (misalnya di luar jam kerja proyek), menekan biaya operasional seminimal mungkin.
*   **Fitur Teknis Utama:**
    *   **Database Branching:** Memungkinkan pembuatan *database branch* instan dalam hitungan detik untuk setiap *Git branch*, mempermudah proses testing terisolasi.
    *   **Connection Pooling:** Mendukung ribuan koneksi konkuren dari Next.js Serverless Functions tanpa risiko kehabisan slot koneksi database.
    *   **PostgreSQL Compliance:** Menjamin dukungan penuh terhadap tipe data numerik presisi tinggi dan fitur *pessimistic locking* yang diperlukan untuk keandalan buku besar finansial (*ledger*).

### 1.4 Drizzle ORM
Drizzle ORM digunakan sebagai Object-Relational Mapping (ORM) utama.
*   **Rasionil Finansial & Operasional:** Berbeda dengan ORM tradisional seperti Prisma yang memiliki overhead runtime besar, Drizzle bertindak sebagai query builder yang sangat tipis dengan performa mendekati SQL murni. Ini meminimalkan waktu respon serverless action.
*   **Fitur Teknis Utama:**
    *   **Strict Type-Safety:** Skema database didefinisikan dalam kode TypeScript murni yang secara otomatis menghasilkan tipe data TypeScript untuk input dan output query.
    *   **Drizzle Relational Queries (DRQ):** Memudahkan penarikan data relasional kompleks secara deklaratif dengan type-safety penuh tanpa overhead query ganda.
    *   **Pessimistic Locking Support:** Mendukung sintaks `.for('update')` secara native untuk mengunci baris data akun bank saat terjadi mutasi kas.

### 1.5 Tailwind CSS & shadcn/ui
Menggunakan kombinasi Tailwind CSS untuk penataan gaya utilitas dan shadcn/ui untuk komponen antarmuka.
*   **Rasionil Finansial & Operasional:** Mempercepat tim pengembang dalam mendesain antarmuka mobile-first yang seragam tanpa perlu menulis CSS kustom yang rumit. Tampilan akhir sangat premium, konsisten dengan prinsip estetika iOS 26 Solid.
*   **Fitur Teknis Utama:**
    *   **Tailwind CSS Utility Classes:** Mempermudah penyesuaian *touch target* efektif minimal 48x48 piksel secara langsung di elemen HTML, termasuk saat tombol terlihat lebih compact.
    *   **shadcn/ui Copy-Paste Model:** Komponen disalin langsung ke dalam repositori aplikasi, memungkinkan kustomisasi penuh pada level kode tanpa terikat dependensi pustaka pihak ketiga yang kaku.

### 1.6 Better Auth
Better Auth dipilih sebagai kerangka kerja autentikasi dan sesi pengguna.
*   **Rasionil Finansial & Operasional:** Dibandingkan dengan solusi SaaS seperti Clerk, Better Auth sepenuhnya gratis (open-source) dan menyimpan seluruh data sesi dan pengguna di dalam database lokal milik perusahaan.

Berikut adalah perbandingan mendalam yang mendasari keputusan memilih Better Auth dibandingkan Clerk:

| Aspek Perbandingan | Better Auth (Terpilih) | Clerk (Ditolak) |
| :--- | :--- | :--- |
| **Penyimpanan Data (Data Location)** | **Lokal di Database Perusahaan:** Semua tabel `user`, `session`, dan `account` disimpan langsung di Neon PostgreSQL melalui Drizzle ORM. | **Cloud Pihak Ketiga (SaaS):** Data pengguna disimpan di server Clerk. Sinkronisasi memerlukan webhook atau sync engine eksternal yang kompleks. |
| **Sesi & Verifikasi (Sessions)** | **Self-contained & Lokal:** Verifikasi sesi langsung membaca database lokal atau memvalidasi JWT secara lokal tanpa memicu request API eksternal. | **API Round-Trip:** Memerlukan komunikasi jaringan eksternal ke server Clerk untuk memvalidasi token sesi secara remote. |
| **Struktur Biaya (Pricing)** | **Gratis & Open Source:** Berjalan di dalam infrastruktur serverless Next.js tanpa batasan jumlah pengguna aktif bulanan (MAU). | **Berdasarkan Pengguna Aktif:** Gratis untuk skala awal, namun biaya meningkat secara eksponensial seiring bertambahnya pengguna dan fitur enterprise. |
| **Ekstensi Skema & RBAC** | **Sangat Mudah & Relasional:** Karena tabel berada di database lokal, menambahkan kolom kustom seperti `role_id` yang mereferensikan tabel `role` dapat dilakukan langsung menggunakan relasi Drizzle. | **Metadata Terbatas:** Memerlukan konfigurasi metadata JSON di konsol Clerk yang sulit untuk dijoin secara relasional dengan tabel data SQL. |

### 1.7 ImageKit
ImageKit digunakan sebagai media storage dan manipulasi gambar bukti pengeluaran proyek (nota/struk).
*   **Rasionil Finansial & Operasional:** Menyediakan optimasi gambar otomatis (misal: mengubah format menjadi `.webp` yang ringan) dan CDN bawaan. Ini mempercepat pemuatan bukti nota pada koneksi seluler PM di lapangan.
*   **Fitur Teknis Utama:**
    *   **Direct Upload Integration:** Mengizinkan client melakukan upload berkas langsung ke ImageKit menggunakan token tanda tangan (*signed token*) yang dibuat oleh server Next.js. Ini mencegah penumpukan memori dan bandwidth pada server Next.js saat memproses file besar.
    *   **Real-time Transformation:** Memungkinkan pemotongan (*cropping*) dan kompresi instan pada gambar nota yang diunggah oleh PM dari ponsel mereka.

### 1.8 Gemini AI (Gemini 1.5 Flash / Pro)
Gemini AI digunakan sebagai mesin kecerdasan buatan untuk parsing nota pengeluaran (OCR) dan penyusunan laporan ringkasan CFO harian (*AI Daily Financial Briefing*).
*   **Rasionil Finansial & Operasional:** Gemini 1.5 Flash menawarkan harga per token yang sangat murah dengan kecepatan inferensi yang luar biasa cepat. Context window sebesar 1 juta+ token memungkinkan pengiriman data laporan keuangan yang komprehensif tanpa takut terpotong (*truncated*).
*   **Fitur Teknis Utama:**
    *   **Multimodal Capabilities:** Mampu membaca gambar nota proyek beresolusi tinggi langsung untuk mengekstrak data toko, tanggal, item barang, total nominal, dan pajak secara akurat ke format JSON terstruktur.
    *   **Structured Output (JSON Mode):** Memastikan output analisis AI selalu mematuhi skema JSON yang didefinisikan aplikasi agar aman diproses oleh Server Actions.

---

## 2. Analisis Tradeoffs (Pertukaran Nilai)

Setiap teknologi yang dipilih membawa konsekuensi tersendiri yang harus dikelola oleh tim pengembang:

### 2.1 Serverless Cold Starts vs Response Time
Next.js App Router yang dideploy di Vercel Serverless Functions dapat mengalami *cold starts* (jeda waktu saat serverless function diaktifkan kembali).
*   **Mitigasi:** Atria ERP menerapkan strategi prefetching pada tautan navigasi kritis (seperti tombol Ledger dan Projects) menggunakan `next/link`. Saldo bank di-cache secara relasional pada halaman read-only untuk meminimalkan durasi *cold start*.

### 2.2 Drizzle ORM Developer Overhead vs Performance
Berbeda dengan Prisma yang menghasilkan client otomatis yang tebal, Drizzle ORM mewajibkan penulisan definisi skema relasi secara manual di kode TypeScript.
*   **Mitigasi:** Tim menggunakan alat bantu generator migrasi otomatis dari Drizzle Kit (`drizzle-kit generate` dan `drizzle-kit push`) untuk memastikan konsistensi skema lokal dengan Neon PostgreSQL secara otomatis.

### 2.3 Local Authentication Management (Better Auth) vs Managed SaaS
Menggunakan Better Auth berarti tim internal bertanggung jawab penuh atas pemeliharaan tabel autentikasi, pengiriman email verifikasi (via SMTP/Resend), dan keamanan sesi.
*   **Mitigasi:** Tim mengotomatiskan setup Better Auth dengan mengikuti dokumentasi boilerplate resmi dan mengamankan kunci enkripsi menggunakan variabel lingkungan (*environment variables*) yang dienkripsi ketat di Vercel dashboard.

---

## 3. Kelayakan Proyek untuk Tim Kecil (Feasibility Analysis)

Dengan ukuran tim pengembang yang kecil (1-3 engineer), stack ini dinilai sangat layak (*highly feasible*) karena:
1.  **Zero Server Management:** Vercel (frontend & actions) dan Neon (database) sepenuhnya dikelola (*fully managed*), sehingga tim tidak perlu mengalokasikan waktu untuk konfigurasi server Linux, OS patching, atau setup database replication.
2.  **Unified Language:** Seluruh komponen aplikasi menggunakan bahasa TypeScript (Next.js, Drizzle, Better Auth, Tailwind). Ini meminimalkan hambatan kognitif bagi pengembang karena tidak perlu berpindah bahasa pemrograman.
3.  **TDD & Testing Speed:** Integrasi Bun Test memungkinkan penulisan tes komparatif saldo kas yang berjalan dalam hitungan milidetik, menjamin guardrail finansial terverifikasi sebelum masuk ke tahap production.
