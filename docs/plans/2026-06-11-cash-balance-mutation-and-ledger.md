# Rencana Implementasi: TSK-006 Engine Mutasi Saldo Kas & Option A Ledger

Rencana ini menjelaskan arsitektur dan langkah-langkah implementasi untuk fungsi helper transaksional `mutateBalance`. Fungsi ini bertanggung jawab melakukan mutasi kas masuk (`DEBIT`) dan kas keluar (`CREDIT`) secara aman dengan perlindungan balapan data (_race conditions_) melalui penguncian baris pesimistis (_pessimistic locking_), validasi saldo, pencatatan otomatis pada buku besar (_ledger_), serta perekaman riwayat audit secara _immutable_.

---

## User Review Required

> [!IMPORTANT]
> **Penguncian Baris Pesimistis (Pessimistic Locking):**
> Kueri pembacaan saldo awal akun bank menggunakan `.for('update')` di dalam transaksi database. Ini mengunci baris data akun bank target sehingga transaksi paralel lainnya harus menunggu hingga transaksi aktif selesai (_commit_ atau _rollback_). Ini mencegah celah kerentanan _double-spending_ atau salah hitung saldo.

> [!WARNING]
> **Presisi Matematika Finansial Murni:**
> Drizzle menyimpan tipe `numeric(15, 2)` sebagai string di Javascript. Untuk menghindari isu pembulatan _floating point_, kita akan menulis helper konversi presisi ke satuan sen (BigInt) secara murni dengan membagi string berdasarkan karakter titik desimal (tanpa konversi `float` di awal) untuk keandalan 100%.

> [!CAUTION]
> **Perlindungan Data Buku Besar Terpilih (Reconciled Ledger):**
> Transaksi buku besar yang telah ditandai `reconciled = true` bersifat permanen dan tidak boleh diubah/dihapus. Kita akan mengimplementasikan fungsi pembatas `checkReconciledTransaction` untuk menolak mutasi langsung pada entri buku besar yang telah direkonsiliasi.

---

## Proposed Changes

### Komponen: Keuangan & Buku Besar (Finance & Ledger)

#### [NEW] [balance-mutation.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/lib/finance/balance-mutation.ts)

- **Helper Presisi Keuangan:**
  - `parseNumericToCents(val: string): bigint`: Mengonversi string desimal (misal `"1250.50"`) menjadi bigint sen (`125050n`) secara presisi.
  - `fromCents(cents: bigint): string`: Mengonversi kembali bigint sen ke string desimal format `.2` desimal (misal `125050n` ke `"1250.50"`).
- **Helper Proteksi Rekonsiliasi:**
  - `checkReconciledTransaction(tx, transactionId)`: Memeriksa apakah `cash_transaction` berstatus `reconciled = true` dan memblokir modifikasi jika ya.
- **Fungsi Inti `mutateBalance`:**
  - Menerima parameter transaksional `tx`, `bankAccountId`, `type` (`DEBIT`/`CREDIT`), `amount` (string), `category`, `description`, `referenceType`, `referenceId`, `userId`, `ipAddress`, dan `userAgent`.
  - Melakukan kueri `.for('update')` pada baris `bank_account`.
  - Memvalidasi sisa saldo untuk transaksi `CREDIT`. Jika saldo tidak mencukupi, lempar error `INSUFFICIENT_FUNDS` untuk memicu rollback otomatis.
  - Memperbarui saldo bank dengan kriteria verifikasi tepat 1 baris yang terupdate (`updated.length === 1`).
  - Menyisipkan entri kas baru pada tabel `cash_transaction` dengan status `reconciled = true` dan tanggal rekonsiliasi saat ini.
  - Menyisipkan riwayat aktivitas pada tabel `audit_log` lengkap dengan status data asli (_original state_) dan data baru (_new state_).

### Komponen: Pengujian Konkurensi (Concurrency Testing)

#### [NEW] [test-transaction-locking.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/scratch/test-transaction-locking.ts)

- Menyusun pengujian simulasi konkurensi di direktori `scratch/`.
- Memicu 5 transaksi keluar paralel secara bersamaan (konkuren) senilai masing-masing Rp 3.000.000,00 dari akun Petty Cash Office yang memiliki saldo awal Rp 13.000.000,00.
- Memastikan bahwa:
  1.  Tepat 4 transaksi berhasil sukses dan memotong saldo dengan benar hingga tersisa Rp 1.000.000,00.
  2.  Transaksi ke-5 otomatis gagal dengan error `INSUFFICIENT_FUNDS` karena saldo tersisa tidak mencukupi untuk memotong Rp 3.000.000,00 lagi.
  3.  Saldo akhir terverifikasi konsisten (Rp 1.000.000,00) tanpa adanya kondisi balapan data (_race condition_).

---

## Verification Plan

### Automated Tests

- Menjalankan pengujian skrip konkurensi Bun:
  `bun scratch/test-transaction-locking.ts`
  _Outcome:_ Laporan pengujian mencetak detail eksekusi paralel, menunjukkan kegagalan saldo pada kueri ke-5, dan saldo akhir akun bank tercatat tepat Rp 1.000.000,00.
- Kompilasi TypeScript dan build Next.js:
  `bun run build`
  _Outcome:_ Proyek sukses terkompilasi tanpa error tipe TypeScript.
