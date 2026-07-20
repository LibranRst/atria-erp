# Rencana Implementasi: Kategori Anggaran Proyek (Budget Category Grouping)

Rencana ini menjelaskan pembaruan pada modul rencana anggaran biaya (RAB / BoQ) proyek dan form pengajuan pengeluaran lapangan untuk mendukung pengelompokan item anggaran berdasarkan **Kategori Anggaran** (seperti *Pekerjaan Persiapan*, *Pekerjaan Sipil*, *Pekerjaan Finishing*) serta tetap mengaitkannya ke **Kelompok Biaya / Kategori Biaya** (seperti *Material*, *Operational*).

## User Review Required

> [!IMPORTANT]
> Perubahan ini menambahkan kolom `budget_category` baru pada skema database `project_budget_item`.
> Kita akan menggunakan `drizzle-kit push --force` untuk memperbarui skema PostgreSQL di lingkungan lokal.
> Data seeding di `db/seed.ts` dan unit test di `lib/finance/actions.test.ts` juga akan disesuaikan agar menyertakan parameter `budgetCategory`.

## Open Questions

*Tidak ada. Rencana ini sudah selaras dengan masukan pengguna.*

## Proposed Changes

### Komponen: Database Schema & Seeding

---

#### [MODIFY] [schema.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/db/schema.ts)
* Tambahkan kolom baru pada definisi tabel `projectBudgetItem`:
  * `budgetCategory`: `varchar("budget_category", { length: 255 }).notNull().default("Umum")`
  * Kolom ini bertindak sebagai nama kelompok pekerjaan anggaran (contoh: *Pekerjaan Dinding*, *Pekerjaan Lantai*).

---

#### [MODIFY] [seed.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/db/seed.ts)
* Perbarui data seed untuk tabel `projectBudgetItem` agar menyertakan kolom `budgetCategory`:
  * Item *Finishing Kabinet Dapur*: `budgetCategory: "Pekerjaan Dapur"`
  * Item *Carrara Marble Countertop*: `budgetCategory: "Pekerjaan Dapur"`

---

### Komponen: Validasi & Server Actions

---

#### [MODIFY] [budget.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/lib/validations/budget.ts)
* Modifikasi skema `createBudgetItemSchema` di Zod:
  * Tambahkan `budgetCategory: z.string().min(3, "Kategori anggaran minimal 3 karakter.").max(255, "Kategori anggaran maksimal 255 karakter.")`

---

#### [MODIFY] [budget.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/actions/project/budget.ts)
* Perbarui Server Action `createBudgetItem`:
  * Ambil field `budgetCategory` dari input ter-validasi.
  * Masukkan data `budgetCategory` ke dalam pemanggilan Drizzle `insert`.

---

### Komponen: Antarmuka UI (User Interface)

---

#### [MODIFY] [budget-manager.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/project/budget-manager.tsx)
* **Pembaruan Form Tambah Item**:
  * Tambahkan input teks baru: **Kategori Anggaran** (contoh placeholder: *Pekerjaan Persiapan, Pekerjaan Sipil, Pekerjaan Lantai*).
  * Lengkapi state komponen (`budgetCategory`) dan sertakan saat mengirim form ke server action `createBudgetItem`.
* **Pembaruan Daftar Item Anggaran (RAB)**:
  * Ganti pengelompokan yang sebelumnya berdasarkan `costCategory?.name` (Material/Operational) menjadi pengelompokan berdasarkan `budgetCategory` (Kategori Anggaran).
  * Di dalam setiap kelompok, tampilkan baris item anggaran lengkap beserta badge penunjuk kelompok biaya/cost category (contoh: badge `MATERIAL` atau `OPERATIONAL`).

---

#### [MODIFY] [expense-form.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/expense/expense-form.tsx)
* **Pembaruan Pilihan Item Anggaran (BoQ)**:
  * Kelompokkan item anggaran di select dropdown `<select>` menggunakan tag `<optgroup>` berdasarkan kolom `budgetCategory` (Kategori Anggaran), bukan `costCategory?.name`.
  * Pada label option item, cantumkan format yang menyertakan kelompok biaya, contoh:
    `[Kelompok: {item.costCategory?.name}] {item.name} ({qty} {unit} @ Rp {price} - Sisa: Rp {remaining})`

---

### Komponen: Unit Tests

---

#### [MODIFY] [actions.test.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/lib/finance/actions.test.ts)
* Perbarui panggilan uji coba `createBudgetItem` di dalam unit test dengan menambahkan parameter dummy `budgetCategory: "Pekerjaan Uji Coba"`.

---

## Verification Plan

### Automated Tests
* Jalankan suite pengujian untuk memverifikasi fungsionalitas server action dan tipe TypeScript:
  `bun test`
  `bun run build`

### Manual Verification
1. Sinkronisasi ulang database dengan schema terbaru:
   `bunx drizzle-kit generate`
   `bunx drizzle-kit push --force`
   `bun db:seed`
2. Jalankan aplikasi web lokal:
   `npm run dev`
3. Akses proyek **Sudirman Suites**, buat RAB draf baru, lalu tambahkan item anggaran dengan menentukan kategori anggaran (misalnya: *Pekerjaan Plafon*) dan kelompok biaya (misalnya: *Material*).
4. Pastikan tampilan RAB terkelompok dengan rapi berdasarkan *Kategori Anggaran* (misalnya: *Pekerjaan Plafon*), dan di dalamnya terdapat item detailnya beserta penanda kelompok biaya *Material*.
5. Buka menu **Add Expense / Pengeluaran Lapangan**, pilih proyek, lalu periksa dropdown select item anggaran. Verifikasi bahwa item terkelompok di bawah nama kategori anggaran (*Pekerjaan Plafon*) dan keterangannya memuat tipe kelompok biaya (*[Kelompok: MATERIAL]*).
