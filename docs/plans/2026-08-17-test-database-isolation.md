# Isolasi Database Test

**Tanggal:** 2026-08-17
**Status:** Selesai (Langkah 1 dari rangkaian "web ready to use")

## Masalah

`bun run test` menulis ke database yang sama dengan `DATABASE_URL` milik dev server.

Sebelas file test mengimpor `@/db` sungguhan dan sepuluh di antaranya menjalankan
Server Action asli di atas fixture seed (`BCA_ACC_ID`, project MENTENG/SUDIRMAN).
Hook `afterAll` menghapus baris anak, tetapi tidak memulihkan seluruh state induknya.

Bukti pada database development saat ditemukan:

- `material_inventory` untuk `Multipleks 18mm @ Gudang Utama` berisi **194 unit**,
  sedangkan seluruh `stock_movement`-nya berjumlah **35**. Sebelas baris inventory
  lain konsisten.
- **53 baris audit `EXPENSE_STOCK_IN`** menyimpan `stockMovementId`; **nol** dari
  ID itu ada di `stock_movement` — baris movement-nya dihapus cleanup, kenaikan
  `current_stock` dan baris auditnya tidak.
- 110 `INFLOW_BANK_ACCOUNT` + 111 `OUTFLOW_BANK_ACCOUNT` menumpuk; saldo BCA tidak
  lagi sama dengan ledger-nya.
- `bun run db:demo:verify` gagal pada 6 invariant.

Satu run test yang tercatat pada `2026-08-17 09:29:51` membuat 3 project, 5 vendor
bill, memindahkan saldo rekening, dan menaikkan stok 191 → 194.

Komentar di `lib/finance/actions-field.test.ts` sudah mencatat pola yang sama
sebelumnya ("120 baris cash_transaction menumpuk di BCA_ACC_ID"); perbaikan waktu
itu menutup `cash_transaction`, tetapi tidak menutup inventory dan audit.

Dampak yang sebenarnya: **tidak ada angka UAT yang bisa dipercaya**, karena setiap
`bun run test` bisa menggeser angka yang sedang diperiksa manusia.

## Keputusan

Suite yang menyentuh Postgres menjadi **opt-in**, bukan default.

Alternatif yang ditolak:

- _Melengkapi cleanup._ Kebocoran memang tertutup, tetapi test tetap menulis ke
  database bersama selama run, dan run yang mati di tengah tetap meninggalkan drift.
- _Membungkus tiap test dalam transaksi yang di-rollback._ Tidak bisa: Server Action
  membuka `db.transaction` sendiri di atas `db` global.

## Perubahan

1. **`lib/testing/integration-db.ts`** — `describeIntegration` bernilai `describe`
   saat `ATRIA_TEST_DATABASE_URL` terisi, dan `describe.skip` saat kosong.

2. **`scripts/test-preload.ts`** — menimpa `DATABASE_URL` sebelum modul mana pun
   memuat `db/index.ts`:
   - ada `ATRIA_TEST_DATABASE_URL` → seluruh koneksi test diarahkan ke sana;
   - tidak ada → `DATABASE_URL` menunjuk `127.0.0.1:1` supaya koneksi yang lolos
     gagal cepat dan terlihat, bukan diam-diam menulis ke data development.

   Poin kedua adalah jaring pengaman: test DB baru yang lupa digerbangi akan
   meledak, bukan mengotori.

3. **Sebelas suite digerbangi** dengan `describeIntegration`.

4. Dua hook dipindahkan agar ikut tergerbang:
   - `afterEach` di `lib/project/activation-action.test.ts` tadinya di scope modul;
   - test "UNKNOWN untuk UUID peran acak" di `lib/auth/permissions.test.ts` pindah
     ke describe bergerbang, karena `resolveRoleName` menelan error database dan
     mengembalikan `"UNKNOWN"` — tanpa database, test itu lulus karena koneksi
     gagal, bukan karena barisnya tidak ada.

5. **`.env.example`** mendokumentasikan `ATRIA_TEST_DATABASE_URL`, dan menambahkan
   `ATRIA_BOOTSTRAP_SECRET` yang selama ini hilang padahal wajib untuk `/setup`.

## Hasil

| Gerbang                                  | Sebelum          | Sesudah                     |
| ---------------------------------------- | ---------------- | --------------------------- |
| `bun run test`                           | 550 pass         | 491 pass · 71 skip · 0 fail |
| Durasi suite web                         | 32,8 s           | 8,5 s                       |
| Baris database tersentuh oleh `bun test` | ratusan          | **nol**                     |
| `bun run build`                          | ✓                | ✓                           |
| `bun run lint`                           | 0 error (1 warn) | 0 error (1 warn)            |

Dengan `ATRIA_TEST_DATABASE_URL` terisi, suite bergerbang terbukti tetap berjalan
dan hijau (13 test pada `bank-accounts` + `workflow-rework`).

## Konsekuensi yang harus diingat

- **71 test hanya berjalan pada database ber-seed demo.** Suite itu memakai fixture
  `db:demo:reset`; pada database kosong hasil `db:reset` ia tidak bisa dijalankan.
  Menjalankannya butuh database sekali pakai, bukan database yang sedang dipakai UAT.
- Angka baseline gerbang berubah dari 550 menjadi 491 pass + 71 skip. Skip di sini
  **bukan** test merah yang disembunyikan.
