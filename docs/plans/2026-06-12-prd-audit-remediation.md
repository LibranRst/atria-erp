# Rencana Implementasi: Remediasi Gap Audit PRD, Workflow Finansial, dan Kualitas UI/UX

Rencana ini menindaklanjuti audit kesesuaian Atria ERP terhadap PRD/MVP Blueprint. Fokus utama bukan menambah fitur besar secara acak, melainkan menutup gap yang berisiko terhadap workflow finansial, kepatuhan guardrail, dan pemahaman pengguna lapangan.

---

## User Review Required

> [!IMPORTANT]
> **Perubahan State Machine Finansial:**
> Server Actions untuk pengajuan biaya lapangan akan dikunci agar mengikuti alur PRD:
> `SUBMITTED -> VERIFIED -> APPROVED/REJECTED -> PAID`.
>
> Dampaknya:
>
> - Owner tidak bisa approve request yang belum diverifikasi Admin.
> - Finance Admin/Owner tidak bisa mencairkan request yang belum `APPROVED`.
> - Request kecil yang tidak perlu approval Owner tetap harus punya jalur eksplisit yang jelas. Dalam rencana ini, request tetap masuk `SUBMITTED`, diverifikasi Admin menjadi `VERIFIED`, lalu harus disetujui Owner sebelum `PAID` agar MVP konsisten dengan PRD. Jika nanti bisnis ingin auto-approve nominal kecil, itu perlu aturan produk terpisah.

> [!IMPORTANT]
> **Lint Harus Hijau Sebelum Fitur Baru Besar:**
> Saat audit, `bun run lint` gagal karena penggunaan `any` dan beberapa unused import. Rencana ini memasukkan cleanup TypeScript sebagai bagian dari definisi selesai, bukan pekerjaan sampingan.

---

## Audit Baseline

### Hasil Verifikasi Saat Ini

- `bun run build`: sukses.
- `bun test`: sukses setelah network diizinkan, 33 pass, 0 fail.
- `bun run lint`: gagal dengan 28 error dan 29 warning.

### Gap Utama dari PRD

1. State transition biaya lapangan belum dikunci penuh di backend.
2. OCR receipt parser belum memvalidasi hasil AI dengan Zod setelah `JSON.parse`.
3. Admin verification UI untuk `SUBMITTED -> VERIFIED` belum tersedia.
4. Rekonsiliasi bank belum tersedia sebagai flow UI, meskipun schema `bank_statement_import` dan `bank_statement_row` sudah ada.
5. Vendor/AP workflow belum punya permukaan UI khusus.
6. Role-specific navigation masih kurang presisi untuk Owner, Finance Admin, dan PM.
7. Banyak `any`/`as any` melanggar aturan Strict TypeScript proyek.

---

## Proposed Changes

### 1. Backend Guardrails: Field Request State Machine

#### [MODIFY] `app/actions/finance/field-requests.ts`

- Tambahkan validasi status di `approveFieldRequest`:
  - hanya boleh approve/reject jika `projectCost.status === "VERIFIED"`;
  - jika status bukan `VERIFIED`, return `FORBIDDEN` dengan pesan operasional yang jelas.
- Tambahkan validasi status di `payFieldRequest`:
  - hanya boleh mencairkan jika `projectCost.status === "APPROVED"`;
  - `PAID`, `REJECTED`, `SUBMITTED`, dan `VERIFIED` harus ditolak.
- Pastikan `verifyFieldRequest` tetap hanya menerima `SUBMITTED`.
- Tambahkan audit log yang tetap mencatat status lama dan status baru.
- Hindari mutasi saldo langsung di luar transaction.

#### [MODIFY] `lib/finance/actions-field.test.ts`

- Tambah test negatif:
  - Owner gagal approve request `SUBMITTED`.
  - Finance Admin/Owner gagal pay request `SUBMITTED`.
  - Finance Admin/Owner gagal pay request `VERIFIED`.
  - Finance Admin/Owner gagal pay request `REJECTED`.
- Pertahankan test happy path yang sudah ada.

---

### 2. Strict TypeScript Cleanup

#### [MODIFY] Files with `any`/`as any`

- Ganti `catch (error: any)` menjadi `catch (error: unknown)` dan gunakan helper lokal untuk membaca message secara aman.
- Hilangkan `as any` pada props dengan tipe terstruktur:
  - `app/projects/[id]/page.tsx`
  - `app/expenses/page.tsx`
  - `components/layout/bottom-nav.tsx`
  - test AI yang memakai mock contents.
- Hapus unused imports yang memicu warning lint.
- Pertahankan `step="any"` pada input HTML karena itu atribut valid, bukan tipe TypeScript.

#### [NEW] `lib/utils/error-message.ts` (jika diperlukan)

- Helper kecil:
  - `getErrorMessage(error: unknown, fallback: string): string`
- Dipakai di Server Actions dan Client Components untuk menghindari pengulangan parsing error.

---

### 3. OCR Receipt Validation

#### [MODIFY] `app/actions/ai/process-receipt.ts`

- Tambahkan Zod schema untuk output OCR:
  - `vendorName`: string, min 1.
  - `transactionDate`: datetime/string ISO yang valid.
  - `subtotal`, `tax`, `totalAmount`: number non-negative, `totalAmount` positive.
  - `items`: array item dengan name, quantity, unitPrice, totalPrice.
- Setelah `JSON.parse`, jalankan `safeParse`.
- Jika parsing JSON gagal atau Zod gagal:
  - update `ai_run.status = "FAILED"`;
  - return `VALIDATION_ERROR` agar UI bisa fallback ke input manual.
- Tetap jaga AI sebagai draft read-only: hasil OCR hanya mengisi form, tidak mencatat ledger.

#### [MODIFY] `lib/ai/gemini.test.ts`

- Tambah test untuk respons AI invalid agar action mengembalikan failure yang bisa ditangani UI.

---

### 4. Admin Verification UI for Field Requests

#### [MODIFY] `components/expense/expense-list.tsx`

- Tambahkan tombol **Verifikasi** untuk role `FINANCE_ADMIN`/`OWNER` ketika status request `SUBMITTED`.
- Tombol memanggil `verifyFieldRequest(projectCostId)`.
- Setelah berhasil:
  - tampilkan feedback sukses;
  - refresh data.
- Tampilkan stepper status ringkas pada setiap card:
  - Diajukan
  - Diverifikasi
  - Disetujui
  - Dicairkan
- Ubah filter copy agar user tahu bedanya:
  - `Butuh Verifikasi`
  - `Butuh Approval`
  - `Siap Cair`
  - `Lunas`
  - `Ditolak`

#### [MODIFY] `app/expenses/page.tsx`

- Pastikan data yang dikirim ke `ExpenseList` typed tanpa `as any`.
- Pastikan PM hanya melihat request miliknya, sedangkan Finance/Owner melihat semua.

---

### 5. Role-Specific Navigation Refinement

#### [MODIFY] `components/layout/bottom-nav.tsx`

- Hapus cast `session.user as any` dengan tipe session user yang eksplisit.
- Sesuaikan navigasi:
  - Owner: Today, Projects, Payments, Expenses, AI Brief.
  - Finance Admin: Today, Projects, Expenses, AI Brief; tambahkan entry rekonsiliasi nanti bila route sudah ada.
  - Project Manager: Projects, Expenses.
- Pertahankan FAB `+` untuk cepat masuk `/expenses/new`.
- Pastikan touch target tetap minimal 44px.

---

### 6. Minimal Bank Reconciliation Surface

> Catatan: scope ini bisa dikerjakan setelah state machine dan lint beres. Jika ingin rilis cepat, bagian ini boleh masuk fase kedua.

#### [NEW] `app/reconciliation/page.tsx`

- Halaman awal untuk Finance Admin/Owner:
  - pilih rekening bank;
  - lihat imported bank statement rows;
  - lihat unmatched rows;
  - lihat ledger transactions terbaru.
- Untuk iterasi pertama, boleh read-only jika belum ada import UI.

#### [FUTURE SERVER ACTIONS]

- `importBankStatement`
- `matchBankStatementRow`
- `unmatchBankStatementRow`

Karena ini menyentuh rekonsiliasi kas, setiap mutasi matching harus punya Zod validation, RBAC, audit log, dan tidak boleh raw SQL.

---

### 7. Vendor/AP Workflow Surface

> Catatan: scope ini juga bisa fase kedua agar patch pertama tidak terlalu besar.

#### [NEW] `app/payables/page.tsx`

- Tampilkan vendor bills dan vendor payments:
  - Unpaid bills
  - Scheduled payments
  - Need Owner approval
  - Completed payments
- Hubungkan action yang sudah ada:
  - `submitVendorBill`
  - `scheduleVendorBillPayment`
  - `approveVendorPayment`
  - `payVendorBill`

---

## Implementation Order

1. Kunci backend state machine untuk field request.
2. Tambah/update tests untuk state machine.
3. Bereskan `any`, `as any`, dan unused imports sampai `bun run lint` hijau.
4. Tambahkan Zod validation OCR output.
5. Tambahkan Admin verification UI di expense list.
6. Refinement role navigation.
7. Jalankan verifikasi penuh.
8. Setelah patch inti aman, lanjutkan fase 2: reconciliation dan payables pages.

---

## Verification Plan

### Automated

- `bun run lint`
- `bun test`
- `bun run build`

### Manual

1. Login sebagai PM, submit expense baru. Pastikan status awal `SUBMITTED`.
2. Login sebagai Owner, coba approve request `SUBMITTED`. Harus ditolak.
3. Login sebagai Finance Admin, verifikasi request. Status menjadi `VERIFIED`.
4. Login sebagai Owner, approve request `VERIFIED`. Status menjadi `APPROVED`.
5. Login sebagai Finance Admin, cairkan request `APPROVED`. Status menjadi `PAID`, saldo bank berkurang, ledger `CREDIT` tercatat, audit log tertulis.
6. Coba cairkan request `SUBMITTED`, `VERIFIED`, atau `REJECTED`. Semua harus ditolak.
7. Upload receipt dengan OCR valid. Form terisi otomatis.
8. Simulasikan OCR invalid. UI tetap memungkinkan input manual.
9. Cek mobile viewport: tidak ada overlap, tab bar tetap usable, touch target tetap aman.

---

## Definition of Done

- State machine finansial biaya lapangan sesuai PRD.
- `bun run lint` hijau.
- `bun test` hijau.
- `bun run build` hijau.
- OCR output tervalidasi Zod.
- Admin bisa menjalankan verifikasi dari UI.
- PM/Owner/Admin melihat navigasi dan workflow yang sesuai role.
- Tidak ada raw SQL baru.
- Tidak ada `any` baru.
- Tidak ada placeholder `TODO`/`TBD`.
