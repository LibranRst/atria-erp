# Backup database terjadwal pada Neon Free

Dimulai 30 September 2026. Keputusan pengguna: **tetap pada Neon Free**. Target pekerjaan ini adalah cadangan logis `atria-erp-prod/main/neondb` ke storage independen, dengan restore yang dapat diuji. Ini melanjutkan [keputusan recovery](2026-09-30-production-recovery-decision.md); retensi PITR Neon tetap enam jam. **Status: pengguna memilih Cloudflare R2 sebagai storage; workflow R2 siap dan belum aktif sampai langganan R2, bucket, dan credential backup siap.**

## Rencana implementasi

1. Tambahkan GitHub Actions terjadwal tiap hari pada default branch `development`, dengan tombol jalankan manual. Workflow tetap nonaktif sampai bucket, IAM OIDC, dan koneksi database khusus backup siap. Jangan memicu dump production dari PR atau branch lain.
2. Jalankan `pg_dump` PostgreSQL 18 memakai URL **direct** ke endpoint production yang diharapkan. Periksa host/database/SSL sebelum koneksi. Tulis arsip custom format dengan owner/ACL dilepas agar dapat dipulihkan pada database uji. Verifikasi arsip dengan `pg_restore` sebelum upload.
3. Upload ke Cloudflare R2 Standard memakai credential S3 API yang dibatasi hanya pada satu bucket private. R2 memakai enkripsi otomatis. Verifikasi Content-MD5 saat upload, ukuran/metadata lewat HeadObject, dan SHA-256 penuh setelah download ulang. Retensi 30 hari dan bucket lock 30 hari disiapkan di dashboard, bukan penghapusan oleh script. Token Object Read & Write dapat mengubah/menghapus objek, sehingga pembatasan bucket serta lock perlu diuji; tidak menyamakan hak token R2 dengan IAM AWS tanpa izin hapus.
4. Dokumentasikan aktivasi R2 (checkout/Terms), bucket Standard private, token, kredensial read-only Neon, pemeriksaan harian, dan restore ke database terpisah. Jangan pulihkan ke `main` pada drill.
5. Verifikasi sintaks workflow/script dan perilaku guard tanpa kredensial. Uji live pertama baru dianggap selesai setelah S3 dan credential disediakan; catat keterbatasan RPO hingga 24 jam serta file ImageKit di luar backup ini.

## Kriteria penerimaan

- Job terjadwal tidak berjalan sebelum `ATRIA_BACKUP_ENABLED=true`; setelah diaktifkan, satu run manual menghasilkan objek `.dump` nonkosong pada prefix production yang benar.
- Digest lokal dan metadata S3 cocok, `pg_restore` berhasil membaca seluruh archive, dan restore ke database disposable menghasilkan enam invariant yang sesuai data pada waktu backup.
- Credential R2 dibatasi pada satu bucket private dengan lock dan lifecycle 30 hari; tidak diberi hak admin bucket. Workflow hanya memakai secret pada default branch `development`. Data hasil upload memiliki SHA-256 yang sama setelah download ulang.
- Kegagalan job terlihat pada GitHub Actions dan ada penanggung jawab yang memeriksa run; status P0-03 tetap terbuka sampai uji restore dan penanganan ImageKit terbukti.

## Batas keselamatan

- Tidak menulis, reset, seed, atau restore ke production Neon dalam implementasi workflow.
- Tidak menaruh URL database, password, AWS credential, atau isi dump di Git, log, artifact GitHub, atau output tool.
- File UI pengguna yang sedang berubah di working tree tidak disentuh.

## Bukti awal AWS S3 — sebelum pilihan R2

- Workflow [production-db-backup.yml](../../.github/workflows/production-db-backup.yml) hanya dijadwalkan pada default branch `development` pukul **02.17 WIB** dan digate oleh `ATRIA_BACKUP_ENABLED=true`; trigger manual tersedia. GitHub Actions untuk repo private ini aktif, tetapi belum ada secret/variable backup yang diset. OIDC subject repo masih format standar, bukan immutable.
- [Script backup](../../scripts/backup-production-db.sh) menolak URL selain endpoint direct `atria-erp-prod/main/neondb`, pengguna selain `atria_backup`, atau SSL yang tidak diwajibkan. Script memakai `postgres:18-alpine`, memeriksa archive dengan `pg_restore`, mengunggah ke S3 dengan SSE-S3 dan checksum SHA-256 tanpa overwrite, lalu mencocokkan ukuran/digest dari `HeadObject`.
- `bash -n`, pemeriksaan format YAML/Markdown, dan smoke test dengan Docker/AWS palsu lulus untuk upload berhasil, penolakan host/role yang salah, pembersihan file sementara, serta tidak munculnya password pada output. Ini **bukan** bukti `pg_dump`/S3/restore live; daemon Docker lokal sedang tidak berjalan dan bucket/role AWS belum tersedia.
- [Runbook aktivasi dan restore](../guide/free-tier-s3-backup.md) mencakup IAM OIDC terbatas, lifecycle 30 hari, secret GitHub, dan drill ke database disposable. Nilai `ATRIA_BACKUP_ENABLED` tetap tidak diset sehingga job terjadwal akan skipped.
- Setelah push `5f0d3e4`, GitHub mengenali workflow ID `370456115`. [Trigger manual 36614979320](https://github.com/LibranRst/atria-erp/actions/runs/36614979320) selesai dengan job `backup` **skipped**, tepat sesuai guard tanpa variable enable. Tidak ada dump, akses Neon, atau objek S3 dari run tersebut.

## Revisi R2 — 30 September 2026

Pengguna memilih R2 setelah meninjau biaya AWS. Akun Cloudflare sudah login dan Account ID terverifikasi `222cd96d186c2a56d6d502ec4f96f94f`, tetapi halaman R2 masih meminta aktivasi langganan. Biaya layar US$0 saat ini/bulanan dalam kuota; overage dikenakan sesuai pemakaian. Tombol aktivasi menerima Terms dan langganan otomatis, sehingga perlu persetujuan pada langkah browser itu. Referensi setup aktif akan memakai [runbook R2](../guide/free-tier-r2-backup.md); bukti AWS di atas tetap historis.

### Hasil adaptasi R2

- AWS IAM/OIDC dan permission GitHub `id-token: write` dihapus dari workflow. Secret R2 hanya diberikan pada step dump/upload; endpoint dibentuk dari Account ID hex yang tervalidasi, memakai region `auto`.
- Header SSE-S3 dan checksum AWS diganti Content-MD5 yang didukung R2; SHA-256 diverifikasi terhadap byte hasil download ulang. Enkripsi R2 otomatis. Object Read & Write dibatasi satu bucket, dengan lock/lifecycle 30 hari sebagai rencana proteksi/retensi.
- `python3 scripts/test-backup-production-db.py`: **6 test lulus**, dengan subcases gagal dump/archive/upload, source owner/pooler/database/SSL salah, R2 account tidak valid, credential hilang, serta korupsi remote walaupun metadata cocok. Semua memakai fake Docker/R2, tidak menghubungi cloud; credential dummy tidak tampil di output dan file temporary dibersihkan.
- Runbook aktif [R2](../guide/free-tier-r2-backup.md) memisahkan aktivasi subscription, pembuatan token, dan penyimpanan secret dari verifikasi live. Account login sudah terbukti; subscription dan bucket belum dibuat.

### Status remote dan handoff aktivasi

Adaptasi R2 di-push ke `development` pada commit `5a6a8b3`; YAML remote GitHub telah diverifikasi memakai credential R2 tanpa AWS IAM/OIDC. Variable nonsecret `ATRIA_BACKUP_R2_ACCOUNT_ID` telah diset ke akun yang terlihat di browser. Gate enable, bucket, dan secret belum diset. Pengguna memilih mengaktifkan subscription R2 sendiri di browser; agen belum mengklik penerimaan Terms/langganan. Setup bucket/token dan test live menunggu aktivasi selesai.

### Checkout setelah otorisasi pengguna

Pengguna memberi otorisasi lanjutan pada 30 September 2026. Pemeriksaan subscription akun hanya menunjukkan Workers Free, tanpa metode pembayaran; R2 belum aktif. Agen melanjutkan tombol Add R2 subscription ke checkout yang meminta kartu/wallet, alamat billing, dan persetujuan charge atas overage. Pengisian serta penyelesaian checkout diserahkan kepada pengguna langsung di browser. Tidak ada bucket atau token yang dibuat, tidak ada charge yang dijalankan agen, dan gate backup tetap nonaktif.

### Preflight setelah bucket dan secrets dibuat manual

Pada 30 September 2026, nama secrets R2 dan variable bucket `atria-erp-backups` telah diverifikasi di GitHub. Query read-only production melalui connector Neon ditolak HTTP 402: account/project quota exceeded. Metadata project masih `free_v3`, retention enam jam, compute main idle/tidak disabled; jenis kuota penyebab belum dapat ditentukan dari metadata ini. Jangan membuat role/secret backup atau mengaktifkan jadwal sebelum SQL production kembali tersedia.

Rencana pekerjaan yang tidak bergantung pada Neon: tambahkan mode manual `check-storage` pada workflow. Mode ini mengunggah file diagnostik nonsecret kecil pada prefix `atria-erp/prod/_checks/`, lalu download ulang dan cocokkan digest. Objek `.probe` disimpan sebagai bukti, tanpa penghapusan otomatis oleh script; ini bukan backup database. Mode backup biasa tetap membutuhkan gate enable dan semua guard source.
