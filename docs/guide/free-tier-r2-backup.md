# Backup database production ke Cloudflare R2

Diperbarui 30 September 2026. Pengguna memilih **Neon Free + Cloudflare R2 Standard**. [Workflow](../../.github/workflows/production-db-backup.yml) dijadwalkan **02.17 WIB** pada branch `development`; gate `ATRIA_BACKUP_ENABLED=true` tetap belum diaktifkan. Backup live belum berjalan.

## Aktivasi akun dan biaya

Cloudflare Account ID yang terlihat setelah login adalah `222cd96d186c2a56d6d502ec4f96f94f`. Halaman R2 masih meminta aktivasi langganan: US$0 saat ini dan US$0 bulanan dalam kuota, dengan biaya atas kelebihan pemakaian. Tombol aktivasi menerima Terms dan langganan otomatis; persetujuan harus diberikan pada langkah itu. Bila checkout meminta metode pembayaran, pemilik akun mengisinya langsung di browser.

[Kuota gratis R2 Standard](https://developers.cloudflare.com/r2/pricing/) per bulan: **10 GB-month storage, 1 juta Class A, 10 juta Class B**, dan egress gratis. Pemakaian di atas kuota tetap ditagih; Infrequent Access tidak termasuk kuota gratis. Ukuran database yang terlihat sebelumnya sekitar 37,5 MB. Ukuran itu bukan ukuran dump atau jaminan total penggunaan storage; ukur archive dan pemakaian akun setelah run pertama.

## Bucket dan retensi

1. Buat bucket baru **`atria-erp-backups`** dengan storage class **Standard**, default jurisdiction, dan lokasi otomatis atau petunjuk lokasi Asia-Pacific. Bucket khusus ini dipakai hanya untuk backup Atria.
2. Pertahankan akses private: public `r2.dev` dan custom domain tidak diaktifkan. R2 [mengenkripsi data otomatis saat disimpan dan dikirim](https://developers.cloudflare.com/r2/reference/data-security/).
3. Siapkan bucket lock untuk prefix `atria-erp/prod/` selama **30 hari**. Lock melindungi objek dari hapus/overwrite selama periode itu; pengelola bucket masih dapat mengubah konfigurasi lock. [Bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/).
4. Siapkan lifecycle expiration **30 hari** untuk prefix yang sama, tanpa perpindahan ke Infrequent Access. Lifecycle menghapus backup lama secara permanen; sebelum menyimpan rule lewat browser, pemilik akun perlu menyetujui retensi/penghapusan ini. Lock berlaku lebih dahulu bila aturannya lebih ketat. [Object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).

## Credential dan GitHub

Buat token R2 bernama `atria-prod-backup` dengan **Object Read & Write**, dibatasi **hanya bucket `atria-erp-backups`**. Jangan memberi Admin Read & Write. Izin menulis objek juga memungkinkan perubahan/penghapusan objek; jangan menganggap token ini setara IAM AWS tanpa izin hapus. Bucket lock adalah perlindungan tambahan. Pembuatan token memperluas akses ke cadangan database, sehingga konfirmasi browser diperlukan tepat sebelum token dibuat. [Authentication R2](https://developers.cloudflare.com/r2/api/tokens/).

Access Key ID dan Secret Access Key hanya ditampilkan sekali. Simpan langsung sebagai GitHub Actions secrets melalui UI/CLI yang aman; jangan menaruh credential di chat, Git, log, screenshot, atau clipboard output. Workflow memakai AWS CLI sebagai **klien S3-compatible untuk R2**; akun AWS, AWS STS, dan AWS IAM tidak diperlukan.

| Nama GitHub                         | Jenis                  | Nilai                                                           |
| ----------------------------------- | ---------------------- | --------------------------------------------------------------- |
| `ATRIA_BACKUP_R2_ACCOUNT_ID`        | Variable               | `222cd96d186c2a56d6d502ec4f96f94f`                              |
| `ATRIA_BACKUP_R2_BUCKET`            | Variable               | Nama bucket yang sudah dibuat dan diverifikasi                  |
| `ATRIA_BACKUP_R2_ACCESS_KEY_ID`     | Secret                 | Access Key ID token khusus bucket                               |
| `ATRIA_BACKUP_R2_SECRET_ACCESS_KEY` | Secret                 | Secret Access Key token tersebut                                |
| `ATRIA_BACKUP_DATABASE_URL`         | Secret                 | URL direct login `atria_backup` pada Neon production dengan TLS |
| `ATRIA_BACKUP_ENABLED`              | Variable, set terakhir | `true` setelah akun, bucket, token, dan role baca siap          |

Buat role Neon **`atria_backup`** dengan hak baca tabel/sekuens saja; [grant dan default privileges](free-tier-s3-backup.md#siapkan-koneksi-neon-khusus-backup) dari runbook awal tetap berlaku. URL owner aplikasi ditolak oleh script. Jangan membuat credential produksi sebelum destination backup siap.

## Verifikasi run pertama

Script menolak source selain direct endpoint `ep-wispy-unit-az0r7nao.c-3.ap-southeast-1.aws.neon.tech`, database `neondb`, login `atria_backup`, dan SSL wajib. Account ID R2 harus 32 karakter hex sehingga endpoint hanya dibentuk sebagai `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

`pg_dump` PostgreSQL 18 membuat custom archive, lalu `pg_restore --file=/dev/null` membaca seluruh isi. Upload memakai Content-MD5 yang didukung R2 dan `If-None-Match: *`, serta SHA-256 di metadata. AWS SSE-S3/checksum headers tidak dikirim karena API R2 memiliki [dukungan berbeda](https://developers.cloudflare.com/r2/api/s3/api/). Sesudah upload, script memeriksa ukuran/metadata, **download ulang objek**, dan mencocokkan SHA-256 byte remote. Archive lokal dan salinan verifikasi dibersihkan saat selesai atau gagal; tidak diupload sebagai artifact GitHub.

Aktifkan gate terakhir, jalankan `Production database backup` manual dari `development`, dan pastikan run sukses serta objek muncul di R2. Verifikasi public access tetap mati, lock/lifecycle terpasang, dan run terjadwal berikutnya berjalan. Tetapkan penanggung jawab pemeriksaan failure dan pemakaian kuota; GitHub schedule dapat terlambat atau terlewati sehingga interval harian bukan jaminan RPO 24 jam.

## Drill restore dan batas perlindungan

Download backup ke host audit menggunakan AWS CLI dengan endpoint R2 dan `--region auto`; gunakan credential terbatas yang diisi secara lokal, bukan dicetak dalam perintah. Contoh setelah variable nonsecret dan credential dipasang aman:

```bash
aws s3api get-object --endpoint-url "$R2_ENDPOINT" --region auto --bucket "$BUCKET" --key "$KEY" backup.dump
aws s3api head-object --endpoint-url "$R2_ENDPOINT" --region auto --bucket "$BUCKET" --key "$KEY" --query 'Metadata.sha256' --output text
shasum -a 256 backup.dump
pg_restore --list backup.dump
pg_restore --exit-on-error --no-owner --no-acl --dbname "$RESTORE_TEST_DATABASE_URL" backup.dump
```

Target restore harus **database kosong disposable** yang identitasnya diperiksa sebelum eksekusi. Jalankan enam invariant aplikasi pada hasil restore, cocokkan migration/schema/data, lalu uji login dan alur penting lewat aplikasi preview. Hasil penuh ini belum terbukti.

Neon PITR tetap **6 jam**. Dump harian memberikan titik pemulihan lebih lama tetapi kehilangan data dapat mendekati 24 jam saat run sehat, dan lebih lama bila run gagal/terlambat. File ImageKit belum dicadangkan oleh dump Postgres. P0-03 tetap terbuka sampai run pertama, restore transaksi terisi, RPO/RTO, dan recovery lampiran terbukti.
