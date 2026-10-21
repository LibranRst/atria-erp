# Quick Start & Kesiapan Operasional

Dokumen ini adalah panduan canonical first-run Paduna Build untuk organisasi baru yang baru saja di-bootstrap.

Contoh input lengkap—default 90/92, proyek Fit-Out Studio Apartemen Bassura City Rp50.000.000, 3 akun tim, dua rekening operasional, 6 Material Master, saldo awal stok gudang, Vendor, dan Library—tersedia pada bagian A1–A2 [`financial_workflow_guide.md`](financial_workflow_guide.md#a1-onboarding-quick-start-owner-v2).

## 1. Quick Start Owner

Setelah bootstrap (`/setup`) dan login pertama sebagai Owner, sistem otomatis mengarahkan ke `/onboarding`.

1. **Pengenalan (Welcome)** — Layar menjelaskan hasil quick start, estimasi 10–15 menit, dan penegasan bahwa belum ada kas atau stok yang bergerak.
2. **Default finansial** — Review batas budget internal (Cap 90%), lima kategori biaya kanonis (Material 38%, Tukang 28%, Subcon 20%, Operasional 4%, Lain-lain 2%), total alokasi 92%, dan buffer 8%. Simpan perubahan bila perlu, lalu pilih **Gunakan default ini**.
3. **Project pertama** — Isi nama project, klien baru/tersimpan, nilai project, dan RAB disetujui. PM boleh **Belum ditugaskan** selama project masih Draft.
4. **Preview budget awal** — Cocokkan budget internal, target gross, buffer cadangan, dan alokasi per kategori sebelum memilih **Buat project Draft**.
5. **Sukses** — Proyek Draft, canonical category budget, audit log, event quick start, dan completion state terbentuk dalam satu transaksi database atomik.

Quick start selesai saat proyek Draft nyata berhasil dibuat. Membuka `/onboarding` setelah selesai otomatis dialihkan ke `/settings?tab=readiness`.

## 2. Kesiapan Operasional (Settings > Kesiapan)

Dashboard menampilkan kartu kesiapan organisasi selama masih ada requirement wajib yang belum terpenuhi. View permanennya berada di **Pengaturan → Kesiapan** (`/settings?tab=readiness`).

### Requirement Wajib:

- **Tim Inti**: Akun aktif Finance Admin, Project Manager, dan Purchasing.
- **Rekening Perusahaan**: Minimal satu rekening bank/kas perusahaan aktif dengan saldo awal.
- **Fondasi Material**: Minimal satu lokasi gudang dan satu Material Master aktif.
- **Keputusan Saldo Awal Stok**: Batch stok fisik awal sudah disetujui & diposting (maker-checker flow) atau Owner/Purchasing menyatakan tidak ada stok lama.

### Data yang Direkomendasikan:

- **Vendor Master**: Pemasok bahan baku dan subkontraktor spesialis.
- **Library Item & Harga**: Template harga komponen RAP dan RAB klien.
  _(Vendor dan Library tidak mengurangi persentase kesiapan wajib)._

CTA bersifat _role-aware_: Owner mengelola keseluruhan, Finance meninjau saldo awal/rekening sesuai izin, Purchasing mengelola material dan stok, sedangkan peran tanpa izin hanya membaca status.

## 3. Guard Operasional

- Proyek Draft hasil quick start boleh belum memiliki PM, tetapi aktivasi proyek membutuhkan PM aktif, RAP terkunci, dan RAB disetujui.
- Pergerakan stok operasional ditolak sampai keputusan saldo awal stok gudang final.
- Seluruh arus kas keluar/masuk wajib memilih rekening eksplisit dan dicatat di ledger.
- Quick start v2 tidak menggerakkan saldo kas atau persediaan barang.

## 4. UAT Minimum First-Run

- Jalankan fresh install pada viewport mobile 320, 360, 390, dan 430 px.
- Uji jeda/lanjutkan (_pause & resume_) pada langkah default finansial dan proyek pertama.
- Pastikan nilai project & RAB disetujui wajib positif dan klien wajib dipilih/dibuat.
- Klik ganda saat pembuatan proyek tidak boleh membuat proyek duplikat (idempotent guard).
- Verifikasi kartu Dashboard hilang setelah seluruh requirement wajib siap, sementara tab Pengaturan tetap dapat diakses untuk evaluasi berkala.
