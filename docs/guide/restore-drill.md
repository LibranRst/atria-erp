# Latihan Pemulihan Database

**Tanggal:** 2026-08-27
**Prasyarat #3** dari `docs/plans/2026-08-27-tenant-foundation.md`
**Status:** dijalankan 2026-08-28 — **LULUS**, dengan satu peringatan (lihat Catatan hasil)

> Catatan historis: prosedur `neonctl` di bawah mencatat latihan Agustus pada project/database lama. Untuk target production sekarang `atria-erp-prod/main/neondb`, lihat [drill 30 September 2026](#drill-production-30-september-2026). Jangan jalankan perintah lama dengan ID project tersebut sebagai asumsi target live.

## Kenapa ini ada

Backup yang belum pernah diuji restore bukan backup — ia perasaan. Yang perlu
dibuktikan bukan "backup menyala", melainkan tiga hal berbeda:

1. Riwayat disimpan cukup lama untuk berguna.
2. Data bisa dikembalikan ke **titik waktu tertentu**, bukan sekadar disalin apa
   adanya dari sekarang.
3. Yang kembali **utuh** — bukan sekadar ada.

Butir 2 dan 3 yang paling sering dilewati, dan keduanya yang paling penting.
Dokumen ini memberi kriteria lulus/gagal untuk ketiganya.

Latihan ini **tidak menyentuh data bisnis**. Penandanya tabel sekali pakai
(`restore_drill_marker`) yang dibuat lalu dibuang; buku besar yang append-only
tidak ikut disentuh sedikit pun.

## Sebelum mulai

Jalankan latihan ini terhadap database yang **akan benar-benar menyimpan data
bisnis Dekoria** — bukan database lain yang kebetulan lebih aman. Yang diuji adalah
pengaturan retensi database itu sendiri, dan pengaturan itu tidak ikut berpindah.

## Langkah 1 — Nyalakan retensi riwayat (di console Neon)

Ini satu-satunya langkah yang tidak bisa diotomatiskan; ia mengubah pengaturan
akun.

1. Buka project Atria di console Neon.
2. Cari pengaturan **retensi riwayat** untuk project itu (Neon pernah menamainya
   _history retention_, _restore window_, atau _PITR window_ — labelnya berubah
   antar versi console, tetapi fungsinya satu: berapa jauh ke belakang restore
   masih bisa menjangkau).
3. Naikkan ke jangkauan terpanjang yang diizinkan paket langganan kalian.

**Berapa yang cukup?** Aturan praktisnya: **lebih lama dari jeda antara kesalahan
terjadi dan kesalahan disadari.** Untuk ERP keuangan yang direkonsiliasi
mingguan, kesalahan pencatatan bisa baru ketahuan berhari-hari kemudian —
retensi 24 jam berarti pada saat kalian sadar, titik pemulihannya sudah lewat.
Kalau paket sekarang hanya memberi 24 jam, itu **alasan bisnis yang sah untuk
naik paket**, bukan detail teknis.

Catat angka yang akhirnya dipilih di bagian **Catatan hasil** di bawah.

## Langkah 2–6 — Jalankan lewat `neonctl`

Seluruh bagian tengah bisa diotomatiskan; yang tersisa di console hanya Langkah 1.
Urutan di bawah adalah yang benar-benar dijalankan pada 2026-08-28.

```bash
# Pasang variabel project sekali
P=rapid-mountain-50889409
NEONDB=$(bunx neonctl@latest connection-string production --project-id $P --database-name neondb)

# 2. Tulis penanda — ke neondb, bukan ke database yang menyimpan data
cd apps/web && MARKER_DATABASE_URL="$NEONDB" \
  bun --conditions react-server scripts/restore-drill.ts mark
```

Catat waktu penanda dari keluarannya, lalu pilih titik restore beberapa menit
**sebelum** waktu itu. Tidak perlu menunggu: titik lampau mana pun di dalam
jendela retensi bisa dipakai.

```bash
# 3. Buat branch dari titik lampau
B=restore-drill-$(date -u +%Y-%m-%d)
bunx neonctl@latest branches create --project-id $P --name $B \
  --parent <ISO timestamp beberapa menit sebelum penanda> --no-secrets

# 4. Verifikasi branch hasil restore
GUARD=$(bunx neonctl@latest connection-string $B --project-id $P --database-name atria_uat_guard)
MARK=$(bunx neonctl@latest connection-string $B --project-id $P --database-name neondb)
cd apps/web && DATABASE_URL="$GUARD" MARKER_DATABASE_URL="$MARK" \
  bun --conditions react-server scripts/restore-drill.ts verify

# 5. Bereskan
cd apps/web && MARKER_DATABASE_URL="$NEONDB" \
  bun --conditions react-server scripts/restore-drill.ts clean
bunx neonctl@latest branches delete $B --project-id $P
```

Perintah verifikasi menjalankan dua uji:

| Uji                  | Lulus bila                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Perjalanan waktu** | Tabel `restore_drill_marker` **tidak ada**. Ketiadaannya membuktikan pemulihan benar-benar mundur, bukan menyalin keadaan sekarang.        |
| **Keutuhan data**    | Keenam invarian di `lib/finance/ledger-invariants.ts` terpenuhi atas data hasil pemulihan, dan jumlah baris yang diperiksa lebih dari nol. |

Keluar dengan kode 1 bila salah satu gagal.

**Kalau uji perjalanan waktu gagal**, hampir selalu penyebabnya titik waktu yang
dipilih terlalu baru. Hapus branch, ulangi dengan titik lebih mundur.

**Kalau uji keutuhan gagal**, berhenti. Data yang dipulihkan tidak konsisten, dan
itu temuan besar — jauh lebih baik ditemukan sekarang daripada saat benar-benar
dibutuhkan.

> **Jangan** memakai tombol yang memulihkan branch utama di tempat. Latihan ini
> menguji kemampuan memulihkan, bukan mengganti database yang sedang dipakai.

> **Pastikan `neonctl` login sebagai pemilik project.** Lihat temuan sampingan
> nomor 2 di bawah — akun yang salah berarti mengatur database yang salah.

## Langkah 7 — Catat

Isi bagian di bawah, lalu ubah **Status** di kepala dokumen ini menjadi tanggal
pelaksanaan. Latihan yang tidak tercatat akan diperdebatkan enam bulan lagi.

## Catatan hasil

| Butir                | Isi                                                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tanggal latihan      | 2026-08-28                                                                                                                                                                                                                 |
| Project              | `atria-erp` (`rapid-mountain-50889409`), org `Dekoria`                                                                                                                                                                     |
| Database yang diuji  | `atria_uat_guard` di branch `production` (`br-holy-frost-ao2muwah`)                                                                                                                                                        |
| Retensi riwayat      | **6 jam** (21600 detik) — maksimum paket Free, sudah mentok                                                                                                                                                                |
| Jarak mundur restore | 6 menit                                                                                                                                                                                                                    |
| Branch latihan       | `restore-drill-2026-08-28` (`br-icy-flower-ao169ha0`), sudah dihapus                                                                                                                                                       |
| Uji perjalanan waktu | ✅ Lulus — tabel penanda tidak ada di branch hasil restore                                                                                                                                                                 |
| Uji keutuhan data    | ✅ Lulus — keenam invarian terpenuhi                                                                                                                                                                                       |
| Baris diperiksa      | 82                                                                                                                                                                                                                         |
| Lama seluruh proses  | ± 2 menit, seluruhnya lewat `neonctl`                                                                                                                                                                                      |
| Catatan              | Penanda ditulis ke `neondb`, bukan ke `atria_uat_guard`, sehingga database yang menyimpan data tidak menerima satu pun tulisan selama latihan. Branch Neon mencakup seluruh database, jadi uji perjalanan waktu tetap sah. |

### Peringatan yang menyertai kelulusan ini

**Mekanismenya terbukti. Jangkauannya belum memadai.**

Retensi 6 jam adalah batas paket Free dan sudah berada di maksimum. Latihan ini
hanya membuktikan bahwa pemulihan berfungsi **dalam** jendela itu — dan jendela
itu lebih pendek daripada risiko yang sebenarnya dihadapi.

Risiko dominan pada ERP ini bukan kesalahan yang disadari dalam hitungan menit,
melainkan **salah catat yang baru ketahuan saat rekonsiliasi** — berhari-hari
kemudian. Pada saat itu, titik pemulihannya sudah lama lewat.

Retensi yang dibutuhkan minimal **satu siklus rekonsiliasi penuh: 7 hari**.
Paket berbayar Neon menyediakan hingga 30 hari. Sampai itu dibeli, prasyarat #3
berstatus **lulus secara mekanis, belum memadai secara operasional**, dan
kelulusan ini tidak boleh dibaca sebagai "backup production sudah aman".

### Temuan sampingan yang perlu ditindaklanjuti

1. ~~**Project `atria-erp` hanya punya satu branch, `production`.**~~
   **✅ Ditindaklanjuti 2026-08-28.** Branch `development`
   (`br-autumn-wind-aok3wub0`) dibuat dari `production`, dan `apps/web/.env`
   kini menunjuk ke sana. Connection string production disimpan di berkas yang
   sama sebagai komentar `# PRODUCTION_DATABASE_URL=` — supaya jelas ke mana
   harus kembali, bukan untuk dipakai. Cadangan berkas lama: `.env.bak-before-dev-branch`.
2. **Ada dua akun Neon yang mudah tertukar.** `libran.dev7@gmail.com` hanya
   Editor pada project lain (`dekoria-erp` di org `Dekoria Living`, berisi
   `neondb` kosong). Pemilik `atria-erp` adalah `dekoria.office@gmail.com` di org
   `Dekoria`. Pengaturan retensi, paket, dan pembuatan branch restore semuanya
   menempel pada project — jadi memakai akun yang salah berarti mengatur database
   yang salah, persis seperti yang sempat terjadi saat menyiapkan latihan ini.

## Kapan diulang

- **Sebelum penggunaan bisnis production** — wajib, ini prasyarat #3.
- **Setelah setiap migrasi besar.** Migrasi 0035 menyentuh 61 tabel; migrasi RLS
  di Fase 3 akan menyentuh jumlah yang sama.
- **Setiap kuartal**, atau setiap kali paket Neon berubah — retensi bisa ikut
  berubah tanpa pemberitahuan yang kalian sadari.
- **Sebelum tenant kedua hidup.** Mulai saat itu, pemulihan yang gagal bukan lagi
  masalah internal Dekoria, melainkan kegagalan memenuhi janji ke pelanggan yang
  membayar.

## Drill production 30 September 2026

Target live saat ini adalah Neon `atria-erp-prod` (`little-river-44246623`) / `main` (`br-super-tree-azh1p78r`) / `neondb`, yang dilayani Vercel Production. Retensi historis terukur **6 jam** dan jadwal snapshot production kosong. Drill ini memakai perubahan schema migrasi 0041 sebagai penanda yang sudah ada; tidak membuat tabel penanda ataupun mengubah data bisnis.

1. Buat snapshot manual dari `main` untuk **2026-09-29 14:30 UTC**, sebelum migrasi 0041, ketika timestamp masih berada di jendela enam jam. Snapshot `snap-wild-silence-az8k410t` bernama `prod-pre-0041-recovery-drill-20260930`; parent timestamp aktualnya 14:29:49 UTC (`0/B455C30`).
2. Pulihkan snapshot ke **branch baru** dengan `finalize: false`: `recovery-drill-pre-0041-20260930` (`br-green-smoke-azl7gnni`). Branch siap sekitar sembilan detik setelah snapshot dibuat. Jangan gunakan finalisasi restore pada drill karena itu dapat memindahkan compute aplikasi ke data lama.
3. Baca migration count dan metadata kolom pada kedua branch. Hasil: branch pemulihan **41** migrasi dan `item_nature` tidak ada; `main` **42** migrasi dan `item_nature` ada. Kedua branch memiliki lima alokasi budget tanpa pelanggaran rasio. Ledger, stock, dan pembayaran vendor masing-masing masih kosong.
4. Nonaktifkan compute branch drill (`ep-ancient-cherry-azrptstd`) setelah pemeriksaan. Branch dan snapshot tetap disimpan untuk audit; keduanya belum dijadikan target deployment. Compute `main` dan domain aplikasi tetap pada branch production saat ini.

**Status:** perjalanan waktu dan pemulihan schema pada target production **lulus secara mekanis**. Keutuhan transaksi nonkosong, waktu pemulihan aplikasi end-to-end, lampiran eksternal, dan kemampuan kembali tujuh hari **belum terbukti**. Sebelum go-live dengan transaksi nyata, tetapkan RPO/RTO, perluas jendela pemulihan minimal sepanjang satu siklus rekonsiliasi atau sediakan cadangan independen yang setara, lalu ulangi drill dengan fixture transaksi di branch terpisah. Snapshot manual ini adalah satu titik historis, bukan pengganti jadwal backup berkelanjutan.

Pilihan paket, target RPO/RTO yang diusulkan, dan urutan uji berikutnya ada pada [keputusan recovery production](../plans/2026-09-30-production-recovery-decision.md). Paket Free hanya menyediakan satu snapshot manual per project dan slot production sedang dipakai snapshot drill ini; jangan menghapusnya tanpa keputusan pengarsipan bukti.
