# Backup database production saat Neon Free

Disusun 30 September 2026 untuk `atria-erp-prod/main/neondb`. Pengguna memilih mempertahankan Neon Free. Workflow [production-db-backup.yml](../../.github/workflows/production-db-backup.yml) dan [backup-production-db.sh](../../scripts/backup-production-db.sh) menyiapkan dump harian ke AWS S3; **backup belum aktif** sampai konfigurasi di bawah lengkap dan run manual berhasil.

Neon Free tetap menyimpan riwayat PITR hanya enam jam. Backup harian memberi titik pemulihan di luar jendela itu, dengan potensi kehilangan data mendekati **24 jam** bila insiden terjadi tepat sebelum dump berikutnya. File ImageKit, termasuk nota dan cover, berada di luar archive Postgres. Jalur ini tidak memenuhi usulan RPO database satu jam pada [keputusan recovery](../plans/2026-09-30-production-recovery-decision.md).

## Yang sudah diperiksa

- Repository GitHub private `LibranRst/atria-erp` memakai default branch `development`; GitHub Actions aktif. OIDC repository memakai subject standar, bukan format immutable. Jadwal `17 19 * * *` berarti 02.17 WIB; GitHub bisa memulai run terlambat saat padat.
- Workflow hanya berjalan pada `development` ketika variable repository `ATRIA_BACKUP_ENABLED` bernilai `true`. Status awal tanpa variable adalah **skipped**; tidak ada dump atau akses production.
- Endpoint direct production yang dikunci script adalah `ep-wispy-unit-az0r7nao.c-3.ap-southeast-1.aws.neon.tech`, database `neondb`, TLS wajib. URL dengan host pooled, project/branch lain, atau database lain ditolak sebelum koneksi.
- Tidak ada AWS CLI/kredensial lokal atau bucket/role/secrets GitHub yang tersedia pada saat penyusunan. Karena itu run S3 dan restore live **belum diuji**.

## Siapkan bucket dan role AWS

Gunakan bucket S3 private di `ap-southeast-1` dengan Block Public Access aktif dan enkripsi default SSE-S3. Simpan backup pada prefix `atria-erp/prod/`. Atur lifecycle berikut pada bucket, setelah memastikan tidak ada aturan lain yang bertabrakan:

```json
{
  "Rules": [
    {
      "ID": "atria-prod-backups-30-days",
      "Status": "Enabled",
      "Filter": { "Prefix": "atria-erp/prod/" },
      "Expiration": { "Days": 30 }
    }
  ]
}
```

Tambahkan penyedia OIDC `token.actions.githubusercontent.com` di IAM dengan audience `sts.amazonaws.com`. Trust policy role backup harus membatasi subject tepat ke repo dan branch ini; ganti `<AWS_ACCOUNT_ID>` dengan akun bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:LibranRst/atria-erp:ref:refs/heads/development"
        }
      }
    }
  ]
}
```

Role cukup diberi dua izin pada prefix ini, tanpa `s3:DeleteObject` atau izin bucket lain. `GetObject` diperlukan untuk pemeriksaan `HeadObject` setelah upload:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::<BUCKET_NAME>/atria-erp/prod/*"
    }
  ]
}
```

Workflow memakai kredensial AWS sementara lewat OIDC, mengirim objek dengan SSE-S3, checksum SHA-256, dan `If-None-Match: *` agar kunci lama tidak tertimpa. Role tidak dapat membersihkan backup; penghapusan setelah 30 hari adalah tugas lifecycle bucket. AWS S3 dapat menimbulkan biaya terpisah meskipun paket Neon tetap Free. [Panduan OIDC GitHub](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws), [IAM GitHub trust policy](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html), [lifecycle S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-configuration-examples.html).

## Siapkan koneksi Neon khusus backup

Buat role Postgres bernama **`atria_backup`** yang hanya bisa membaca data pada `atria-erp-prod/main/neondb`, termasuk schema `public` dan `drizzle`, lalu validasi bahwa role itu dapat menjalankan `pg_dump` PostgreSQL 18. Berikan hak baca untuk tabel/sekuens saat ini dan default privileges untuk tabel/sekuens baru setelah migrasi. Script menolak nama pengguna selain `atria_backup`, sehingga URL owner aplikasi tidak bisa dipakai tanpa mengubah workflow. Simpan **URL direct** role tersebut sebagai secret GitHub `ATRIA_BACKUP_DATABASE_URL`; jangan memakai URL pooled runtime atau menulis URL ke repository, issue, log, dan artifact Actions. Password role backup dapat dirotasi dengan mengganti satu secret tersebut.

Inspeksi read-only pada 30 September menunjukkan semua 67 tabel `public`, satu tabel migrasi, dan satu sekuens `drizzle` dimiliki `neondb_owner`. Setelah role login dibuat di Neon, grant berikut dapat dijalankan sebagai owner pada `main` (tanpa memasukkan password ke SQL atau Git):

```sql
GRANT CONNECT ON DATABASE neondb TO atria_backup;
GRANT USAGE ON SCHEMA public, drizzle TO atria_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public, drizzle TO atria_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public, drizzle TO atria_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public, drizzle
  GRANT SELECT ON TABLES TO atria_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public, drizzle
  GRANT SELECT ON SEQUENCES TO atria_backup;
```

Grant di atas memberi akses baca ke tabel baru yang dibuat oleh `neondb_owner`; bila pemilik objek migrasi berubah, perbarui default privileges juga. Uji `pg_dump` dari role ini sebelum mengaktifkan jadwal. Role backup tidak diberi hak tulis.

Pembuatan role dan grant adalah perubahan hak akses production. Lakukan setelah bucket/role AWS siap agar credential tidak menganggur tanpa tujuan. Gunakan database role terpisah dari akun owner aplikasi; pastikan dump sudah mencakup 42 migrasi dan semua data yang diperlukan, termasuk Better Auth.

## Aktifkan dan verifikasi

Di GitHub repository **Settings → Secrets and variables → Actions**, set:

| Nama                        | Jenis                      | Nilai                                                              |
| --------------------------- | -------------------------- | ------------------------------------------------------------------ |
| `ATRIA_BACKUP_AWS_REGION`   | Variable                   | `ap-southeast-1`                                                   |
| `ATRIA_BACKUP_S3_BUCKET`    | Variable                   | Nama bucket private                                                |
| `ATRIA_BACKUP_AWS_ROLE_ARN` | Variable                   | ARN IAM role OIDC backup                                           |
| `ATRIA_BACKUP_DATABASE_URL` | Secret                     | URL **direct** role baca Neon production, dengan `sslmode=require` |
| `ATRIA_BACKUP_ENABLED`      | Variable, set **terakhir** | `true` setelah semua pengaturan siap                               |

Aktifkan variable terakhir, lalu jalankan workflow `Production database backup` secara manual dari branch `development`. Run harus menghasilkan objek `atria-erp/prod/YYYY/MM/DD/neondb-....dump` yang tidak kosong dan mencetak ukuran serta SHA-256. Periksa objek dengan `HeadObject`, enkripsi `AES256`, checksum/metadata, serta aturan lifecycle. Setelah itu pantau run terjadwal berikutnya dan tetapkan penanggung jawab pemeriksaan kegagalan Actions.

Archive berada sementara hanya di direktori privat runner; script menghapusnya setelah selesai, termasuk saat gagal. GitHub Actions tidak menerima dump sebagai artifact. `pg_restore --file=/dev/null` membaca isi archive sebelum upload, tetapi **belum membuktikan restore ke database**.

## Drill restore yang wajib sebelum menyatakan backup aktif

Unduh satu objek dari S3 ke host audit, cocokkan SHA-256 dengan metadata objek, lalu pulihkan dengan PostgreSQL 18 ke **database kosong disposable**, bukan `main` atau branch production. Contoh urutan, setelah `BUCKET`, `KEY`, dan `RESTORE_TEST_DATABASE_URL` ditetapkan secara aman di shell lokal:

```bash
aws s3api get-object --bucket "$BUCKET" --key "$KEY" --region ap-southeast-1 backup.dump
aws s3api head-object --bucket "$BUCKET" --key "$KEY" --region ap-southeast-1 --query 'Metadata.sha256' --output text
shasum -a 256 backup.dump
pg_restore --list backup.dump
pg_restore --exit-on-error --no-owner --no-acl --dbname "$RESTORE_TEST_DATABASE_URL" backup.dump
```

Sebelum menjalankan `pg_restore`, periksa host/nama target **secara manual** dan pastikan server itu benar-benar disposable. Gunakan checker enam invariant aplikasi pada database hasil restore dan cocokkan hitungan proyek, budget, ledger, stok, audit, serta jumlah migrasi dengan metadata pada waktu dump. Uji juga login dan pembacaan satu sampel lampiran ImageKit lewat aplikasi preview; file tersebut perlu proses recovery terpisah. Catat durasi penuh dan hasilnya pada [rencana backup](../plans/2026-09-30-free-tier-nightly-backup.md). P0-03 tetap terbuka sampai drill ini lulus.
