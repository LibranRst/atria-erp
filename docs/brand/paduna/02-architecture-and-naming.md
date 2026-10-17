# Arsitektur brand dan aturan penamaan

## Struktur yang dipakai

| Lapisan                           | Nama              | Fungsi/status                                                   |
| --------------------------------- | ----------------- | --------------------------------------------------------------- |
| Brand induk                       | **Paduna**        | Identitas software operasional bisnis.                          |
| Produk saat ini                   | **Paduna Build**  | Kendali biaya dan material proyek.                              |
| Produk terpisah yang direncanakan | **Paduna Office** | ERP untuk operasional perusahaan; modul masih perlu divalidasi. |

Gunakan pola **Paduna + label produk**. Pada logo, Paduna tetap dominan; label produk mengikuti aturan Manrope 500 yang sama. Dalam teks biasa, tulis kedua kata dengan kapital awal, dipisahkan satu spasi. Hindari `PadunaERP`, `PADUNA BUILD` dalam body copy, `Paduna Finance Interior`, dan nama produk baru yang hanya mengulang modul.

Sebutan singkat **Build** atau **Office** boleh dipakai setelah nama lengkap muncul dan konteks produk sudah jelas. Gunakan **Paduna Build** untuk judul aplikasi, judul dokumen produk, dan kontak pertama.

## Makna Build dan Office

Build berfokus pada keuangan pelaksanaan proyek: anggaran, pengeluaran kategori, pembayaran, material/RAP, stok, dan margin. Istilah ini tidak menjadikan produk ERP manufaktur/perencanaan produksi penuh.

Office dikembangkan sebagai produk terpisah. Kebutuhan calon pelanggan di bisnis perkabelan menjadi bahan discovery, bukan pembatas identitas brand. HR, inventory umum, sales, atau modul lain hanya boleh disebut tersedia setelah dibangun dan divalidasi.

Integrasi kelak dapat dimulai dari pertukaran data, akses, atau portal. Branding tidak menentukan satu database, codebase, atau hak akses lintas produk.

## Nama project dan workspace

Konvensi target berikut ditetapkan untuk persiapan rollout. Nilai teknis aktif belum diganti.

| Objek                        | Nama target                                                     |
| ---------------------------- | --------------------------------------------------------------- |
| Project/repo produk saat ini | `paduna-build` / display **Paduna Build**                       |
| Root package workspace Build | `paduna-build-workspace`                                        |
| Project/repo Office nanti    | `paduna-office` / display **Paduna Office**                     |
| Web Build                    | `@paduna/build-web`                                             |
| API Build                    | `@paduna/build-api`                                             |
| Mobile Build                 | `@paduna/build-mobile`                                          |
| Domain murni Build           | `@paduna/build-core`                                            |
| Klien API Build              | `@paduna/build-api-client`                                      |
| Paket ikon / token           | `@paduna/icons` / `@paduna/tokens`                              |
| Admin transisi               | `@paduna/build-admin`, hanya selama aplikasi transisi masih ada |

Namespace `@paduna/*` di sini adalah konvensi workspace internal; kepemilikan/publikasi npm tidak diasumsikan. Paket ikon/token belum menjadi layanan lintas produk hanya karena namanya umum.

Nama layanan mengikuti `<brand>-<product>-<service>`, misalnya `paduna-build-web`, `paduna-build-api`, dan `paduna-build-worker`. Environment ditambahkan bila diperlukan: `paduna-build-api-staging`. Nilai tersebut adalah target penamaan, bukan bukti layanan telah dibuat atau diganti.

## Nama yang perlu keputusan migrasi tersendiri

- Folder checkout `atria-erp`, remote GitHub, dan project Codex dapat mengikuti `paduna-build` setelah pemetaan dependensi selesai. Jangan mengganti folder aktif sebagai bagian dari penulisan brand book.
- Native URL scheme baru yang direncanakan: `padunabuild`. Scheme `atria` memerlukan kompatibilitas deep link dan auth selama transisi.
- Bundle identifier, Android application ID, EAS project ID, signing, domain, cookie, dan origin tidak diturunkan otomatis dari nama brand. Gunakan identitas terdaftar/domain milik organisasi saat tersedia, dengan audit dampaknya.
- Prefix environment `ATRIA_*` tetap kompatibel sampai migrasi konfigurasi dirancang. Prefix target baru adalah `PADUNA_BUILD_*`, dengan pemetaan eksplisit per variabel, bukan penggantian teks menyeluruh.

## Penamaan modul dan data pelanggan

Di dalam Build, pertahankan istilah yang jelas: Proyek, Anggaran Proyek, Pengeluaran, Material, Stok, Tagihan Vendor, Pembayaran Klien, dan Rekonsiliasi. RAP/RAB tetap mengikuti definisi produknya.

Jangan menambahkan awalan Paduna pada setiap modul. Nama proyek pelanggan tetap memakai konteks pelanggan, misalnya `Renovasi Kantor - [Nama Klien]`; jangan mengganti proyek nyata atau nama perusahaan menjadi Paduna.

## File brand

Gunakan slug huruf kecil dengan tanda hubung, misalnya `paduna-primary.svg`, `paduna-build-primary.svg`, `paduna-office-white.svg`. Dokumen rilis memakai versi: `paduna-brand-book-v1.pdf`. Nama aset siap pakai tidak perlu kata `final-final`, nama desainer, atau tanggal pada setiap file.
