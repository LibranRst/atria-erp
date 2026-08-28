# Menyiapkan Instance Atria untuk Satu Perusahaan

**Tanggal:** 2026-08-28
**Terkait:** `docs/plans/2026-08-27-tenant-foundation.md`

## Bentuk yang dijual

**Satu instance melayani satu perusahaan.** Database mereka sendiri, deployment
mereka sendiri, Owner mereka sendiri. Tidak ada satu pun baris milik dua
perusahaan yang pernah bertemu.

Isolasinya karena itu dijamin **batas database**, bukan oleh ingatan menulis
`WHERE tenant_id = ?` di 865 tempat. Untuk pelanggan yang menaruh seluruh
keuangan perusahaannya di sini — dan yang tahu Dekoria adalah kompetitornya —
itu jawaban yang bisa diucapkan tanpa harus menjelaskan Postgres.

Yang **tidak** didapat dari bentuk ini: project kolaborasi lintas perusahaan.
Dekoria tidak bisa melihat paket vendor lain, karena datanya memang tidak ada di
tempat yang sama. Itu Fitur C, dan ia menuntut satu database dengan RLS — lihat
Fase 3 dan 4 pada dokumen rencana.

## Prasyarat

- Database Postgres kosong. Di Neon: satu project baru, atau satu branch baru.
- Nilai environment yang **baru untuk setiap pelanggan**, bukan disalin:
  `BETTER_AUTH_SECRET`, `ATRIA_BOOTSTRAP_SECRET`, `NEXT_PUBLIC_APP_URL`.

> Menyalin `BETTER_AUTH_SECRET` antar pelanggan berarti sesi yang ditandatangani
> untuk satu perusahaan berlaku di perusahaan lain. Itu satu variabel yang
> membatalkan seluruh pemisahan di atas.

## Langkah

```bash
# 1. Buat database kosong (contoh: project Neon baru)
bunx neonctl@latest projects create --name atria-vendor-nusantara

# 2. Siapkan skema dan identitasnya
DATABASE_URL="<connection string database kosong>" \
  bun run db:provision --name "PT Vendor Interior Nusantara" --slug vendor-nusantara
```

`db:provision` menolak database yang sudah berisi data — menimpa instance
pelanggan yang sudah berjalan karena salah menyalin connection string adalah
kesalahan yang tidak boleh mungkin terjadi.

Setelah selesai, ia memeriksa empat hal dan menolak menyatakan siap bila salah
satu gagal:

| Pemeriksaan | Membuktikan |
| --- | --- |
| Tabel terbentuk | Seluruh migrasi jalan, bukan sebagian |
| Peran sistem punya cakupan | Owner `GLOBAL`, bukan `NONE` — tanpa ini setiap daftar proyek kosong tanpa error |
| Belum ada pengguna | Instance benar-benar baru, bukan salinan milik orang lain |
| Baris pertama bisa ditulis | Onboarding benar-benar bisa dimulai, bukan hanya terlihat kosong |

Pemeriksaan terakhir yang paling berharga: ia menangkap kelas kesalahan di mana
database terlihat bersih tetapi menolak tulisan pertama karena baris perancah
yang hilang.

```bash
# 3. Deploy aplikasi dengan environment milik pelanggan
# 4. Buka /setup, buat Owner pertama mereka
# 5. Ikuti onboarding enam langkah
#    docs/guide/financial_workflow_guide.md §A1–A2
# 6. Setelah data pertama masuk:
bun run db:check-invariants
```

## Identitas perusahaan

Nama yang diberikan ke `--name` masuk ke `tenant.name`, dan dari sana dibaca
`lib/company/identity.ts`. Aplikasi memakainya di tempat yang dilihat pengguna —
termasuk asisten AI, yang memperkenalkan diri sebagai asisten perusahaan
**mereka**.

`lib/architecture/single-company-boundaries.test.ts` menggagalkan build bila nama
perusahaan mana pun ditulis mati kembali ke kode runtime. Kebocoran seperti itu
tidak menghentikan apa pun dan tidak melempar apa pun — ia hanya terbaca sebagai
kecerobohan oleh orang yang baru saja membayar.

Mengganti nama perusahaan setelah berjalan cukup satu baris:

```sql
UPDATE tenant SET name = 'Nama Baru', slug = 'nama-baru';
```

## Yang harus diulang untuk setiap pelanggan

| Hal | Kenapa |
| --- | --- |
| Migrasi | Instance terpisah, jadi tidak ikut naik sendiri saat instance lain di-deploy |
| Retensi riwayat + latihan restore | Menempel pada project, bukan pada kode — lihat `restore-drill.md` |
| Pemeriksaan invarian malam | Satu jadwal per instance |
| Backup dan pemulihan | Tidak ada yang berbagi |

Ini harga sebenarnya dari isolasi lewat batas database: **setiap pekerjaan
operasional dikali jumlah pelanggan.** Di dua sampai lima pelanggan itu masih
ringan. Di belasan, ia menjadi alasan nyata untuk pindah ke satu database dengan
RLS — dan pada titik itu pendapatannya sudah cukup untuk membiayai pekerjaan itu.

Jangan pindah lebih cepat dari itu. Row-level tenancy menukar kerja operasional
yang terlihat dengan risiko kebocoran yang tidak terlihat, dan pertukaran itu
baru layak setelah jumlahnya memaksa.

## Sudah pernah dijalankan

2026-08-28, terhadap database yang benar-benar dikosongkan lebih dulu:

```
✓ 36 migrasi diterapkan
✓ Instance dinamai "PT Vendor Interior Nusantara"
✓ Tabel terbentuk — 63
✓ Peran sistem punya cakupan — 4 peran, owner=GLOBAL
✓ Belum ada pengguna — 0
✓ Baris pertama bisa ditulis — berhasil, di-rollback
✓ Instance siap.
```

Diverifikasi lebih jauh: `getCompanyIdentity()` mengembalikan nama vendor, baris
pertama system prompt AI menyebut vendor itu dan tidak menyebut Dekoria sama
sekali, ketujuh loader halaman berjalan, dan menjalankan ulang `db:provision`
terhadap instance yang sudah berisi ditolak.
