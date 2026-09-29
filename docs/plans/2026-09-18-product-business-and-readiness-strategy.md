# Atria: arah produk, bisnis, dan kesiapan operasional

Tanggal: 18 September 2026

Status: rekomendasi strategi; bukan persetujuan membuka tenant kedua atau mengubah scope produk.

Tindak lanjut: [baseline readiness dan backlog P0/P1](2026-09-18-readiness-baseline-and-backlog.md).

## Tujuan akhir

Atria menjadi Project Finance & Material Control untuk perusahaan interior/design & build. Dekoria menjadi pengguna pembuktian pertama. Janji produk: Owner memahami sisa budget, kebutuhan material, dan risiko margin sebelum proyek selesai; Finance, Purchasing, dan PM bekerja pada data yang sama dengan jejak audit.

Pertahankan lima kategori Material, Tukang, Operasional, Lain-lain, dan Subcon. Material control memperkaya budget proyek, bukan menggantikannya. RAP tetap internal; RAB dan ekspor klien tidak boleh membawa biaya internal, markup, margin, atau catatan vendor internal.

Sumber keputusan: [PRODUCT.md](../../PRODUCT.md), [fondasi tenant](2026-08-27-tenant-foundation.md), [readiness sebelumnya](2026-07-16-production-readiness-implementation-roadmap.md), dan [restore drill](../guide/restore-drill.md). Status historis dalam dokumen tersebut harus diverifikasi ulang sebelum dipakai sebagai bukti release terkini.

## Posisi awal

- Monorepo memisahkan `apps/web`, `apps/mobile`, dan logika bersama `packages/core`.
- Jalur use-case bersama memungkinkan web dan mobile memakai aturan bisnis yang sama.
- Infrastruktur domain sudah mencakup budget, pengeluaran, approval, ledger, rekonsiliasi, RAP/RAB, dan material/stock control.
- Test, invariant checker, dan prosedur restore tersedia; keberadaan alat tidak otomatis membuktikan konfigurasi produksi atau seluruh workflow saat ini sehat.
- Tenant foundation mencatat Fase 0 selesai: schema scaffolding bukan isolasi antarperusahaan yang aktif. `Actor` yang diperiksa belum membawa tenant context.
- Catatan restore 28 Agustus menyebut retensi enam jam. Itu fakta historis, bukan hasil pembacaan konfigurasi cloud pada 18 September.
- Dokumentasi web/mobile dan keputusan arsitektur perlu mengikuti implementasi terbaru.

## Model bisnis dan tenancy

SaaS adalah cara menjual dan mengoperasikan layanan berlangganan. Single/multi-tenant adalah cara memisahkan pelanggan dan data; keduanya bukan pilihan yang saling meniadakan. SaaS dapat memakai resource terpisah, bersama, atau kombinasi ([AWS SaaS Lens](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/silo-pool-and-bridge-models.html)).

| Tahap               | Bentuk operasi                                               | Gerbang menuju tahap berikutnya                                            |
| ------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Pembuktian internal | Dekoria sebagai satu tenant operasional                      | Siklus transaksi nyata stabil, angka dapat direkonsiliasi, recovery teruji |
| Pilot eksternal     | Vertical SaaS dengan onboarding dibantu                      | Isolasi tenant, otorisasi, dan recovery lulus; provisioning terkontrol     |
| Pertumbuhan         | Multi-tenant dengan provisioning/billing/monitoring otomatis | Pelanggan berulang, onboarding dapat diulang, biaya support terukur        |
| Enterprise opsional | Dedicated environment berbayar                               | Kebutuhan pelanggan dan pendapatan menutup biaya operasi tambahan          |

Lanjutkan keputusan existing: satu schema, `tenant_id`, dan RLS. Jangan membuka tenant kedua hanya karena schema memiliki kolom tenant. Tenant context harus berasal dari membership yang diverifikasi server; role runtime DB harus terbatas; storage, cache, export, worker, notification, dan audit juga harus terisolasi. Relasi antar-record harus menolak referensi lintas tenant yang tidak sah. Kolaborasi antarperusahaan memakai grant eksplisit dengan proyeksi data yang dibatasi.

Catatan terhadap alasan lama: database terpisah tetap dapat mendukung kolaborasi melalui API atau pertukaran data. Pilihan shared database merupakan tradeoff kompleksitas dan operasional, bukan karena kolaborasi dengan database terpisah mustahil.

## Penawaran komersial awal

Hipotesis yang perlu divalidasi: **biaya implementasi awal + langganan per perusahaan berdasarkan skala proyek aktif**.

- Implementasi mencakup migrasi data, konfigurasi, training, dan pendampingan.
- Langganan mencakup perusahaan dan kuota proyek aktif, dengan akses tim lapangan yang cukup longgar agar pencatatan tidak terhambat biaya per pengguna.
- Integrasi khusus, kapasitas lebih besar, support SLA, dan dedicated environment dapat menjadi tambahan berbayar bila ada permintaan nyata.
- Sampai pelanggan kelima, ikuti rencana existing: invoice manual, transfer, dan perjanjian tertulis; payment gateway bukan prasyarat validasi produk.
- Hindari fork kode per pelanggan. Gunakan konfigurasi dan perluasan domain yang berlaku umum.

Uji penawaran pada 3–5 calon pelanggan yang menyerupai Dekoria. Belum ada harga atau willingness-to-pay yang tervalidasi. Catat kebutuhan, harga yang bersedia dibayar, waktu onboarding, biaya support, penggunaan berulang, dan alasan memperpanjang/berhenti.

Budget dan purchase-order control juga ditawarkan pemain konstruksi seperti [Buildertrend](https://buildertrend.com/financial-tools/construction-purchase-order-software/). Diferensiasi Atria harus dibuktikan melalui workflow interior Indonesia, keterhubungan budget-material-margin, dan adopsi tim; bukan klaim bahwa kompetitor tidak memiliki fitur tersebut.

## Urutan pekerjaan engineering

| Prioritas | Fokus                                                                    | Bukti selesai                                                             |
| --------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| P0        | Integritas pembayaran, stock, retry, concurrency, reversal, rekonsiliasi | Tidak ada double posting; saldo/stock dan audit konsisten                 |
| P0        | Otorisasi setiap mutation dan jalur akses sensitif                       | Tes negatif membuktikan akses tanpa izin/di luar proyek ditolak           |
| P0        | Backup dan recovery DB beserta lampiran                                  | Restore terukur, retensi sesuai siklus rekonsiliasi, data dipulihkan utuh |
| P1        | Performance                                                              | Baseline p50/p95, ukuran data dan payload, hasil sebelum/sesudah          |
| P1        | Batas arsitektur                                                         | Satu aturan bisnis digunakan web/mobile; guard tidak berbeda antarlapisan |
| P1        | Operasional release                                                      | Monitoring, alert, migration checks, rollback/recovery runbook            |
| P2        | SaaS readiness                                                           | Tenant context + RLS + constraint + storage/cache/jobs isolation terbukti |
| P2        | Operasional komersial                                                    | Onboarding, export/offboarding, dan biaya layanan dapat diukur            |

P0/P1 di atas adalah urutan area kerja, bukan pernyataan bahwa seluruh area memiliki bug. Audit membedakan cacat terkonfirmasi, risiko, dan bukti yang belum tersedia. Isolasi tenant menjadi blocker mutlak sebelum pelanggan kedua, tanpa mewajibkan migrasi tenancy saat pilot internal berlangsung.

Pertahankan modular monolith. Jangan menambah microservices tanpa kebutuhan terukur. Ukur query, loader, payload, pagination, cold start, dan pengalaman jaringan lapangan sebelum mengoptimasi. Cache angka finansial wajib memiliki invalidasi yang menjaga kebenaran data.

## Prioritas fitur

Lengkapi satu siklus: **budget → komitmen pembelian → goods receipt → tagihan → pembayaran → pemakaian material → rekonsiliasi → penutupan proyek**, termasuk pembatalan, penolakan, dan reversal.

Kandidat peningkatan setelah blocker ditutup:

1. Proyeksi biaya akhir: aktual + komitmen yang belum masuk aktual + estimasi pekerjaan tersisa yang belum terikat komitmen. Definisi harus mencegah hitung ganda dan menampilkan asumsi.
2. Paket kerja/area sesuai rencana existing, tetap satu tenant saat pembuktian internal.
3. Kelengkapan Change Order: hubungan scope, nilai kontrak, budget, dan persetujuan.
4. Adopsi lapangan: draft tahan gangguan koneksi, pengiriman bukti, status pengajuan, dan pemulihan setelah respons pembayaran terputus.
5. Onboarding: impor data awal, saldo/stock pembukaan, dan kesiapan operasional.

Ini daftar evaluasi, bukan klaim fitur tersebut seluruhnya belum ada. Audit gap terhadap implementasi sebelum menambah fitur. AI CFO tetap deferred menurut PRODUCT.md. Full accounting, payroll, dan marketplace vendor bukan fokus fase ini.

## Tahap pelaksanaan dan indikator hasil

1. Baseline readiness dan backlog P0/P1 berbukti.
2. Pilot Dekoria pada satu siklus proyek nyata; tutup blocker sebelum perluasan.
3. Wawancara/demo pasar dapat berjalan paralel tanpa memasukkan data pelanggan ke environment yang belum terisolasi.
4. Aktifkan tenant kedua setelah tes isolasi dan recovery lulus.
5. Otomatisasi SaaS setelah pola onboarding/support terbukti berulang.

Ukur kelengkapan pencatatan, waktu rekonsiliasi, selisih saldo/stock yang belum dijelaskan, waktu mendeteksi risiko margin, pengguna aktif per peran, waktu onboarding, biaya layanan per pelanggan, dan renewal. Ambil baseline sebelum menetapkan target numerik; tidak ada klaim ROI atau customer traction dalam dokumen ini.

## Bentuk bantuan engineering

Siklus kerja: audit → backlog berurutan → rencana perubahan → implementasi terbatas → verifikasi → bukti release. Tiap item memiliki reproduksi/evidence, dampak bisnis, acceptance criteria, dependensi, dan status. Keberhasilan dinilai dari workflow dan data yang benar, bukan jumlah file atau fitur yang ditambahkan.
