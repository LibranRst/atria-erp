# Backup database terjadwal pada Neon Free

Dimulai 30 September 2026. Keputusan pengguna: **tetap pada Neon Free**. Target pekerjaan ini adalah cadangan logis `atria-erp-prod/main/neondb` ke storage independen, dengan restore yang dapat diuji. Ini melanjutkan [keputusan recovery](2026-09-30-production-recovery-decision.md); retensi PITR Neon tetap enam jam. **Status: workflow dan runbook siap tetapi belum aktif karena bucket/role AWS serta credential backup belum tersedia.**

## Rencana implementasi

1. Tambahkan GitHub Actions terjadwal tiap hari pada default branch `development`, dengan tombol jalankan manual. Workflow tetap nonaktif sampai bucket, IAM OIDC, dan koneksi database khusus backup siap. Jangan memicu dump production dari PR atau branch lain.
2. Jalankan `pg_dump` PostgreSQL 18 memakai URL **direct** ke endpoint production yang diharapkan. Periksa host/database/SSL sebelum koneksi. Tulis arsip custom format dengan owner/ACL dilepas agar dapat dipulihkan pada database uji. Verifikasi arsip dengan `pg_restore` sebelum upload.
3. Upload ke AWS S3 memakai GitHub OIDC dan role yang hanya dapat menulis/membaca prefix backup; tidak memakai AWS access key statis dan tidak memberi izin hapus. Aktifkan enkripsi SSE-S3. Verifikasi ukuran objek setelah upload. Retensi 30 hari diatur lewat lifecycle bucket oleh pengelola AWS, bukan penghapusan di workflow.
4. Dokumentasikan setup IAM/bucket, kredensial read-only Neon, aktivasi, pemeriksaan harian, dan restore ke database terpisah. Jangan pulihkan ke `main` pada drill.
5. Verifikasi sintaks workflow/script dan perilaku guard tanpa kredensial. Uji live pertama baru dianggap selesai setelah S3 dan credential disediakan; catat keterbatasan RPO hingga 24 jam serta file ImageKit di luar backup ini.

## Kriteria penerimaan

- Job terjadwal tidak berjalan sebelum `ATRIA_BACKUP_ENABLED=true`; setelah diaktifkan, satu run manual menghasilkan objek `.dump` nonkosong pada prefix production yang benar.
- Digest lokal dan metadata S3 cocok, `pg_restore` berhasil membaca seluruh archive, dan restore ke database disposable menghasilkan enam invariant yang sesuai data pada waktu backup.
- IAM role GitHub hanya menerima repo `LibranRst/atria-erp` pada branch `development`; role S3 tidak dapat menghapus objek. Bucket nonpublik dan lifecycle 30 hari terpasang.
- Kegagalan job terlihat pada GitHub Actions dan ada penanggung jawab yang memeriksa run; status P0-03 tetap terbuka sampai uji restore dan penanganan ImageKit terbukti.

## Batas keselamatan

- Tidak menulis, reset, seed, atau restore ke production Neon dalam implementasi workflow.
- Tidak menaruh URL database, password, AWS credential, atau isi dump di Git, log, artifact GitHub, atau output tool.
- File UI pengguna yang sedang berubah di working tree tidak disentuh.

## Hasil implementasi dan verifikasi lokal

- Workflow [production-db-backup.yml](../../.github/workflows/production-db-backup.yml) hanya dijadwalkan pada default branch `development` pukul **02.17 WIB** dan digate oleh `ATRIA_BACKUP_ENABLED=true`; trigger manual tersedia. GitHub Actions untuk repo private ini aktif, tetapi belum ada secret/variable backup yang diset. OIDC subject repo masih format standar, bukan immutable.
- [Script backup](../../scripts/backup-production-db.sh) menolak URL selain endpoint direct `atria-erp-prod/main/neondb`, pengguna selain `atria_backup`, atau SSL yang tidak diwajibkan. Script memakai `postgres:18-alpine`, memeriksa archive dengan `pg_restore`, mengunggah ke S3 dengan SSE-S3 dan checksum SHA-256 tanpa overwrite, lalu mencocokkan ukuran/digest dari `HeadObject`.
- `bash -n`, pemeriksaan format YAML/Markdown, dan smoke test dengan Docker/AWS palsu lulus untuk upload berhasil, penolakan host/role yang salah, pembersihan file sementara, serta tidak munculnya password pada output. Ini **bukan** bukti `pg_dump`/S3/restore live; daemon Docker lokal sedang tidak berjalan dan bucket/role AWS belum tersedia.
- [Runbook aktivasi dan restore](../guide/free-tier-s3-backup.md) mencakup IAM OIDC terbatas, lifecycle 30 hari, secret GitHub, dan drill ke database disposable. Nilai `ATRIA_BACKUP_ENABLED` tetap tidak diset sehingga job terjadwal akan skipped.
- Setelah push `5f0d3e4`, GitHub mengenali workflow ID `370456115`. [Trigger manual 36614979320](https://github.com/LibranRst/atria-erp/actions/runs/36614979320) selesai dengan job `backup` **skipped**, tepat sesuai guard tanpa variable enable. Tidak ada dump, akses Neon, atau objek S3 dari run tersebut.
