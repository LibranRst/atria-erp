# Keputusan recovery production Atria

Disusun 30 September 2026. Keputusan pengguna: **tetap pada Neon Free**; jalur B memakai Cloudflare R2 Standard dan sedang disiapkan melalui [rencana backup terjadwal](2026-09-30-free-tier-nightly-backup.md). Dokumen ini melanjutkan [drill pemulihan historis](2026-09-20-postgres-integration-and-recovery.md#drill-pemulihan-historis-production--30-september-2026) dan gerbang [P0-03](2026-09-18-readiness-baseline-and-backlog.md#p0-03--bukti-recovery-produksi-perlu-diperbarui).

## Kondisi yang terukur

- Vercel Production memakai Neon `atria-erp-prod` / `main` / `neondb` di Singapore. Project berada di organisasi `Dekoria` pada paket `free_v3`. History retention **21.600 detik (6 jam)**, jadwal snapshot kosong. Branch `main` berukuran logis sekitar **37,5 MB** saat diperiksa.
- [Drill 30 September](2026-09-20-postgres-integration-and-recovery.md#drill-pemulihan-historis-production--30-september-2026) membuktikan pemulihan ke titik sebelum migrasi 0041 pada branch terpisah tanpa mengubah `main`. Tabel ledger, stok, dan pembayaran vendor production masih kosong, sehingga pemulihan transaksi nyata belum terbukti.
- Snapshot manual `snap-wild-silence-az8k410t` tetap disimpan sebagai bukti. Paket Free membatasi **satu** snapshot manual per project; slot production saat ini terpakai. Branch hasil drill tetap ada dengan compute dinonaktifkan.
- Bukti unggahan aplikasi (termasuk nota expense), cover proyek, avatar, dan file AI memakai **ImageKit** melalui `apps/web/lib/media/upload-to-imagekit.ts`; database menyimpan referensi URL. Restore Postgres tidak memulihkan byte file yang hilang di ImageKit. Kebijakan retensi/ekspor dan uji unduh file harus menjadi jalur recovery tersendiri.

## Target operasional yang diusulkan

| Ukuran                      | Usulan untuk pilot dengan transaksi bisnis                                   | Cara membuktikan                                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Jendela menemukan kesalahan | Minimal **7 hari**, satu siklus rekonsiliasi                                 | Titik tujuh hari lalu tersedia pada project production; uji restore ke branch terpisah setelah jendela benar-benar terisi                 |
| RPO database                | Maksimal **1 jam** data hilang pada insiden yang memerlukan pemulihan        | Buat transaksi fixture bertanda waktu pada branch uji, pulihkan ke titik yang dipilih, cocokkan ledger, stock movement, audit, dan budget |
| RTO layanan                 | Maksimal **4 jam** sampai login dan alur baca/tulis penting tersedia lagi    | Simulasikan cutover pada deployment preview dan database fixture, ukur dari keputusan insiden sampai pemeriksaan aplikasi lulus           |
| Bukti unggahan              | File yang direferensikan transaksi tetap bisa diambil dan hak aksesnya benar | Sampel nota/proyek pada environment uji, verifikasi URL/file setelah recovery database dan prosedur recovery ImageKit                     |

Angka RPO/RTO ini **target usulan**, bukan SLA atau hasil pengujian. Owner/Finance perlu mengonfirmasi toleransi kehilangan data dan waktu henti sebelum pilot berisi transaksi riil.

## Pilihan dan rekomendasi

| Pilihan                                                              | Kemampuan                                                                                                                                         | Batas yang perlu diterima                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Launch + history 7 hari + snapshot harian** (direkomendasikan) | PITR ke waktu spesifik sepanjang satu siklus rekonsiliasi; snapshot terjadwal memberi titik pemulihan tambahan. Uji ulang pada branch terisolasi. | Paket berbayar berlaku pada **organisasi**, bukan hanya project ini. Biaya compute, storage, history, dan snapshot mengikuti pemakaian. Tidak mem-backup ImageKit.                                                                                                    |
| **B — Tetap Free + ekspor `pg_dump` terjadwal ke storage terpisah**  | Salinan database independen bisa membantu pemulihan saat masalah terdeteksi setelah enam jam.                                                     | Tidak memberi PITR kontinu tujuh hari. Dengan dump harian, kehilangan data dapat mendekati 24 jam dan restore memerlukan langkah lebih panjang. Butuh bucket, kredensial terbatas, enkripsi, retensi, monitoring, dan uji restore berkala. Tidak mem-backup ImageKit. |

**Keputusan saat ini:** pengguna memilih B agar Neon tetap Free. `pg_dump` harian adalah penahan sementara dengan potensi kehilangan data hingga sekitar 24 jam; ini tidak mencapai usulan RPO satu jam atau PITR kontinu tujuh hari. Untuk pilot yang akan memproses uang dan stok nyata, Owner/Finance perlu menerima batas itu secara sadar atau menambah proteksi sebelum go-live. Snapshot manual satu kali tidak memenuhi kebijakan backup berkala.

Menurut [harga Neon saat dokumen dibuat](https://neon.com/pricing.md), Launch tidak memiliki biaya minimum bulanan: compute **US$0,106/CU-jam**, storage **US$0,35/GB-bulan**, history **US$0,20/GB-bulan**, dan snapshot **US$0,09/GB-bulan**. Pada ukuran compute production sekarang **0,25 CU**, biaya compute ilustratif untuk satu compute adalah sekitar **US$6,36/bulan** bila aktif 8 jam/hari atau **US$19,08/bulan** bila aktif 24 jam/hari selama 30 hari. Ini **bukan estimasi tagihan organisasi**: jam aktif sebenarnya, project lain, branch uji, volume WAL tujuh hari, penyimpanan snapshot, transfer, dan pajak belum dihitung. Neon menyatakan history Free maksimal 6 jam, Launch maksimal 7 hari, serta snapshot terjadwal hanya tersedia pada paket berbayar di [dokumentasi history](https://neon.com/docs/postgres/backup-restore/history-window.md) dan [backup/restore](https://neon.com/docs/guides/backup-restore.md).

## Urutan penerapan setelah keputusan biaya

1. Owner/Finance mengesahkan pilihan paket serta RPO/RTO. Periksa perkiraan biaya dan billing **seluruh organisasi Dekoria** di Neon sebelum upgrade; catat batas pengeluaran/alert. Perubahan paket, history retention, dan jadwal snapshot belum dilakukan oleh pekerjaan dokumen ini.
2. Bila A disetujui: upgrade organisasi ke Launch, atur `history_retention_seconds=604800` untuk project production, lalu verifikasi pembacaan ulang nilai 7 hari. Pengaturan project memengaruhi seluruh branch; jangan menganggap titik tujuh hari lalu langsung tersedia setelah perubahan. Atur snapshot harian **18:00 UTC (01:00 WIB)** dengan retensi **30 hari** (`retention_seconds=2592000`), cek jadwal lewat API, dan jaga snapshot manual drill sampai kebijakan pengarsipan disetujui. [Neon mendukung jadwal harian dan retensi hingga 35 hari](https://neon.com/docs/guides/backup-restore.md#create-backup-schedules).
3. Isi branch fixture terpisah dengan alur keuangan/material yang menghasilkan ledger, stock movement, audit, budget, dan minimal satu file ImageKit **uji**. Buat titik pemulihan sebelum dan sesudah perubahan terkontrol, pulihkan ke branch baru, jalankan enam invariant aplikasi serta periksa file. Jangan menulis penanda atau transaksi uji ke `main`.
4. Simulasikan preview aplikasi terhadap branch hasil recovery dengan secret/environment yang terpisah. Ukur RPO/RTO end-to-end, termasuk login, proyek, finance, material, dan rollback URL preview. Production tidak dipindahkan selama drill.
5. Setelah jendela tujuh hari berjalan, ulangi restore production ke branch terpisah dari titik mendekati tujuh hari lalu. Audit ukuran WAL, biaya, kepemilikan prosedur insiden, dan jadwal pengulangan kuartalan.

## Gerbang keputusan

Belum boleh menandai P0-03 selesai atau menganggap data tenant berbayar terlindungi. Keputusan saat ini mempertahankan Neon Free; storage backup independen bisa tetap memiliki biaya menurut penyedianya. Penghapusan snapshot/branch drill juga keputusan terpisah karena snapshot itu bukti pemulihan dan penghapusannya tidak dapat dibatalkan.

## Destination dipilih — Cloudflare R2

Pengguna menyetujui R2 pada 30 September 2026. Referensi aktif adalah [runbook R2](../guide/free-tier-r2-backup.md). Kuota gratis bulanan bukan batas tagihan keras; kelebihan tetap berbayar. Langganan dan bucket R2 kemudian disiapkan pengguna secara manual; uji transport R2 sukses pada run `36672683964`. Backup database masih tertahan HTTP 402 dari Neon karena kuota akun/project. Opsi A/Launch di atas disimpan sebagai alternatif historis, bukan tindakan yang akan dijalankan.
