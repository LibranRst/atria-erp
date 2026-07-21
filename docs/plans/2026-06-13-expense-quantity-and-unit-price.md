# Rencana Implementasi: Penambahan Quantity dan Unit Price pada Pengeluaran Lapangan

Rencana ini menjelaskan penambahan kolom `quantity` (kuantitas) dan `unitPrice` (harga satuan) pada entitas pengeluaran lapangan (`project_cost`). Hal ini akan meningkatkan akurasi data finansial, memudahkan audit internal, serta menyelaraskan input otomatis hasil AI OCR dengan baris formulir secara presisi.

## User Review Required

> [!IMPORTANT]
> Pembaruan ini melibatkan migrasi database untuk menambahkan kolom baru `quantity` dan `unit_price` pada tabel `project_cost`.
> Form **Add Expense** akan menghitung **Total Biaya secara otomatis** ($\text{Kuantitas} \times \text{Harga Satuan}$) untuk setiap baris pengeluaran.
> AI OCR akan langsung mengisi kolom Kuantitas, Harga Satuan, dan Deskripsi barang secara otomatis dari struk belanja.

## Proposed Changes

### 1. Skema Database

#### [MODIFY] [schema.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/db/schema.ts)

- Tambahkan kolom `quantity` dan `unitPrice` pada tabel `projectCost`:
  ```typescript
  quantity: numeric("quantity", { precision: 12, scale: 2 }).default("1.00").notNull(),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).default("0.00").notNull(),
  ```

### 2. Validasi & Server Actions

#### [MODIFY] [finance.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/lib/validations/finance.ts)

- Perbarui `submitFieldRequestSchema` dan `submitFieldRequestsSchema` agar memvalidasi `quantity` (positif, minimal 0.01) dan `unitPrice` (non-negatif).

#### [MODIFY] [field-requests.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/actions/finance/field-requests.ts)

- Perbarui aksi `submitFieldRequest` dan `submitFieldRequests` untuk menerima parameter `quantity` dan `unitPrice` serta menyimpannya ke database.
- Pastikan nominal total `amount` rill dihitung/divalidasi sebagai hasil perkalian `quantity * unitPrice` untuk menjamin integritas data matematika keuangan.

### 3. Database Seeding

#### [MODIFY] [seed.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/db/seed.ts)

- Perbarui entri seed `projectCost` dengan menyertakan nilai `quantity` dan `unitPrice` yang logis (contoh: 24 lembar Multipleks @ Rp 250.000).

### 4. Antarmuka UI (User Interface)

#### [MODIFY] [expense-form.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/expense/expense-form.tsx)

- Perbarui `ExpenseLine` interface agar memuat `quantity` dan `unitPrice`.
- Ubah tata letak baris input pada formulir agar memiliki input **Kuantitas** (lebar kecil) dan **Harga Satuan** (lebar besar), disandingkan dengan label **Satuan** (contoh: `lembar`, `pcs`, `box`) yang dimuat dari item anggaran yang dipilih.
- Jumlah total baris dihitung otomatis: `line.amount = line.quantity * line.unitPrice`.
- Hubungkan parsing Gemini OCR ke kolom baru: hasil AI OCR (`parsedData.items`) akan langsung memetakan `quantity` dan `unitPrice` rill ke form lines secara otomatis.

## Verification Plan

### Automated Tests

- Jalankan migrasi skema database lokal:
  `bunx drizzle-kit generate`
  `bunx drizzle-kit push --force`
  `bun db:seed`
- Perbarui unit test di `lib/finance/actions-field.test.ts` untuk memverifikasi payload `quantity` dan `unitPrice`.
- Jalankan pengujian: `bun test`
- Jalankan build produksi: `bun run build`

### Manual Verification

1. Buka formulir pengeluaran dengan menekan tombol `+`.
2. Pilih proyek, lalu unggah struk belanja.
3. Pastikan AI OCR memecah item struk belanja ke baris form secara individu dengan mengisi kolom Kuantitas dan Harga Satuan secara tepat.
4. Ubah kuantitas atau harga satuan di form, pastikan nominal subtotal baris dan nominal total nota di bagian atas ter-update seketika.
