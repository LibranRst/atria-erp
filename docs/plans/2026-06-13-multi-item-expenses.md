# Rencana Implementasi: Form Pengeluaran Multi-Item (Satu Nota Banyak Item)

Rencana ini menjelaskan pembaruan pada modul Pengeluaran Lapangan (Field Claims / Project Cost) untuk mendukung pengisian banyak detail barang belanja sekaligus (*multi-item lines*) di bawah satu unggahan nota fisik yang sama.

## User Review Required

> [!IMPORTANT]
> Perubahan ini menambahkan kolom `receipt_group_id` baru pada tabel `project_cost` di skema database.
> Kita akan melakukan sinkronisasi database menggunakan `drizzle-kit generate` dan `drizzle-kit push --force`.
> Logika validasi dan Server Action baru `submitFieldRequests` akan dibuat untuk memproses data pengeluaran majemuk dalam satu transaksi database.

## Open Questions

*Tidak ada. Pengguna telah menyetujui opsi (Recommended) Satu Pengajuan Banyak Item.*

## Proposed Changes

### Komponen: Database Schema

---

#### [MODIFY] [schema.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/db/schema.ts)
* Tambahkan kolom baru pada definisi tabel `projectCost`:
  * `receiptGroupId`: `uuid("receipt_group_id")`
  * Kolom ini opsional (nullable) dan menyimpan UUID yang sama untuk semua item pengeluaran yang diunggah bersama di dalam satu nota fisik yang sama. Ini berguna untuk pengelompokan riwayat klaim oleh Finance/Owner.

---

### Komponen: Validasi & Server Actions

---

#### [MODIFY] [finance.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/lib/validations/finance.ts)
* Tambahkan skema validasi baru `submitFieldRequestsSchema`:
  * `projectId`: `uuid` wajib.
  * `receiptImageUrl`: `string` (url/empty/null) opsional.
  * `items`: Array dari objek detail pengeluaran:
    * `projectBudgetItemId`: `uuid` wajib.
    * `amount`: `number` positif.
    * `description`: `string` (minimal 5 karakter, maksimal 500).

---

#### [MODIFY] [field-requests.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/actions/finance/field-requests.ts)
* Buat Server Action baru `submitFieldRequests(input: SubmitFieldRequestsInput)`:
  * Lakukan pengecekan sesi aktif, otorisasi peran (`create:cost`), dan pembatasan akses proyek untuk PM (`assertProjectAccess`).
  * Jalankan transaksi database (`db.transaction`):
    * Hasilkan satu `receiptGroupId` acak menggunakan `crypto.randomUUID()`.
    * Lakukan iterasi pada setiap detail pengeluaran (`items`):
      * Cek budget overrun berdasarkan sisa plafon item BoQ terkait.
      * Jika nominal pengeluaran $\ge$ Rp 5.000.000 atau terjadi budget overrun, buat pengajuan persetujuan (approval) berstatus `PENDING` yang tertaut pada item `project_cost` tersebut.
      * Masukkan record `projectCost` baru ke database lengkap dengan `receiptGroupId` bersama.
    * Kembalikan array berisi seluruh record pengeluaran yang berhasil dibuat.

---

### Komponen: Antarmuka UI (User Interface)

---

#### [MODIFY] [expense-form.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/expense/expense-form.tsx)
* **Pembaruan State & Tampilan**:
  * Ubah state pemilihan budget item, nominal, dan keterangan tunggal menjadi state berbentuk array:
    `const [lines, setLines] = useState<Array<{ projectBudgetItemId: string; amount: number | ""; description: string }>>([{ projectBudgetItemId: "", amount: "", description: "" }])`
  * Tampilkan daftar baris detail pengeluaran di bawah area foto nota secara dinamis.
  * Sediakan tombol **"Tambah Baris Pengeluaran"** untuk menyisipkan baris input baru dan tombol **"Hapus"** pada setiap baris (minimal harus ada 1 baris).
  * Tampilkan kalkulator visual total belanja nota (penjumlahan otomatis dari seluruh baris nominal input PM) di bagian bawah form.
  * Hubungkan form ke Server Action baru `submitFieldRequests`.

---

### Komponen: Unit Tests

---

#### [MODIFY] [actions-field.test.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/lib/finance/actions-field.test.ts)
* Tambahkan test case baru di bawah suite *"Field Claims (Project Cost) Flow"*:
  * Uji pengiriman pengajuan biaya lapangan majemuk (multi-item) melalui `submitFieldRequests`.
  * Pastikan seluruh record pengeluaran terbuat dengan `receiptGroupId` yang identik dan status persetujuan yang tepat.

---

## Verification Plan

### Automated Tests
* Jalankan pengujian otomatis untuk memverifikasi fungsionalitas server action:
  `bun test`
* Verifikasi kebersihan build aplikasi:
  `bun run build`

### Manual Verification
1. Sinkronisasi skema database:
   `bunx drizzle-kit generate`
   `bunx drizzle-kit push --force`
   `bun db:seed`
2. Jalankan server lokal (`npm run dev`) dan buka halaman **Add Expense** sebagai PM Budi.
3. Unggah satu contoh struk, tambahkan 2 baris pengeluaran (misal: satu item Material *Granit*, satu item Operational *Transportasi*), isi nominal masing-masing, dan simpan.
4. Pastikan form berhasil disubmit sekaligus tanpa eror, dan di halaman riwayat pengeluaran tampil detail masing-masing item belanja Anda.
