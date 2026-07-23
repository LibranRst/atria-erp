# Plan to Simplify Bottom Sheet/Drawer Form Button Labels

Simplify button labels (primary, secondary, and submit labels) inside forms rendered within bottom sheets and drawers (`WorkflowFormSheet` and `OperationalFormSheet` instances) to single, clear Indonesian words. This prevents layout wrapping/shifting into two lines on narrow mobile screens (320px–430px wide).

## Proposed Changes

## Audit Follow-up

- `WorkflowFormSheet` uses equal-width actions when two actions are shown, so the one-word labels retain practical space at 320 px.
- Button labels are explicitly non-wrapping; workflow meaning remains in the sheet title and review content.
- Owner onboarding progress is a static, accessible status indicator. It must not use a continuous pulse or custom CSS transition.
- Motion: existing sheet/modal slide-fade and snappy tap feedback only; no page, tab, or decorative progress animation.

We will audit and modify button labels across the 22 components that use `WorkflowFormSheet` and `OperationalFormSheet`. All labels will be simplified to a single word that remains clear and operational.

---

### Features: Expenses & Payments

#### [MODIFY] [expense-form.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/expenses/components/expense-form.tsx)

- Change `primaryLabel="Tinjau Pengeluaran"` to `"Tinjau"`
- Change `secondaryLabel="Simpan & Tutup"` to `"Simpan"`
- Change `primaryLabel="Ajukan Pengeluaran"` to `"Ajukan"`
- Change `secondaryLabel="Kembali Mengedit"` to `"Ubah"`
- Change `primaryLabel="Lihat Pengajuan"` to `"Lihat"`
- Change `secondaryLabel="Tambah Pengeluaran Lagi"` to `"Tambah"`

#### [MODIFY] [expense-line-editor.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/expenses/components/expense-line-editor.tsx)

- Change `primaryLabel="Simpan Item"` to `"Simpan"`

#### [MODIFY] [expense-list-dialogs.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/expenses/components/expense-list-dialogs.tsx)

- Change `primaryLabel={reviewing ? "Konfirmasi Pencairan Dana" : "Tinjau Pencairan"}` to `reviewing ? "Cairkan" : "Tinjau"`
- Change `secondaryLabel={reviewing ? "Ubah Data" : undefined}` to `reviewing ? "Ubah" : undefined`

#### [MODIFY] [vendor-bill-form.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/expenses/components/vendor-bill-form.tsx)

- Change `primaryLabel={reviewing ? "Buat Tagihan Vendor" : "Tinjau Tagihan"}` to `reviewing ? "Buat" : "Tinjau"`
- Change `secondaryLabel={reviewing ? "Ubah Data" : undefined}` to `reviewing ? "Ubah" : undefined`
- Change `<button>Muat Versi Server</button>` to `"Muat"`
- Change `<button>Simpan Salinan</button>` to `"Salin"`
- Change `secondaryLabel="Tambah Tagihan Lagi"` in `FinanceSuccessSheet` call to `"Tambah"`

#### [MODIFY] [vendor-payment-sheets.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/expenses/components/vendor-payment-sheets.tsx)

- Change `primaryLabel={reviewing ? "Jadwalkan Pembayaran" : "Tinjau Jadwal"}` to `reviewing ? "Jadwalkan" : "Tinjau"`
- Change `secondaryLabel={reviewing ? "Ubah Data" : undefined}` to `reviewing ? "Ubah" : undefined`
- Change `primaryLabel={reviewing ? "Konfirmasi Pembayaran Vendor" : "Tinjau Pembayaran"}` to `reviewing ? "Bayar" : "Tinjau"`
- Change `secondaryLabel={reviewing ? "Ubah Data" : undefined}` to `reviewing ? "Ubah" : undefined`

---

### Features: Finance Dashboard & Bank Accounts

#### [MODIFY] [account-form-sheet.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/finance-dashboard/components/bank-accounts/account-form-sheet.tsx)

- Change `primaryLabel={reviewing ? (draft.id ? "Perbarui Rekening" : "Tambah Rekening") : "Tinjau Rekening"}` to `reviewing ? (draft.id ? "Simpan" : "Tambah") : "Tinjau"`
- Change `secondaryLabel={reviewing ? "Ubah Data" : undefined}` to `reviewing ? "Ubah" : undefined`

#### [MODIFY] [movement-sheet.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/finance-dashboard/components/bank-accounts/movement-sheet.tsx)

- Change `primaryLabel={reviewing ? "Catat Mutasi Kas" : "Tinjau Mutasi"}` to `reviewing ? "Catat" : "Tinjau"`
- Change `secondaryLabel={reviewing ? "Ubah Data" : undefined}` to `reviewing ? "Ubah" : undefined`

#### [MODIFY] [transfer-sheet.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/finance-dashboard/components/bank-accounts/transfer-sheet.tsx)

- Change `primaryLabel={reviewing ? "Catat Transfer Rekening" : "Tinjau Transfer"}` to `reviewing ? "Transfer" : "Tinjau"`
- Change `secondaryLabel={reviewing ? "Ubah Data" : undefined}` to `reviewing ? "Ubah" : undefined`

---

### Features: Materials & Inventory

#### [MODIFY] [opening-inventory-workspace.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/materials/components/opening-inventory-workspace.tsx)

- Change `submitLabel="Balik saldo awal"` to `"Balik"`

#### [MODIFY] [emergency-adjust-sheet.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/materials/components/emergency-adjust-sheet.tsx)

- Change `primaryLabel={reviewing ? "Posting Penyesuaian Stok" : "Tinjau Penyesuaian"}` to `reviewing ? "Posting" : "Tinjau"`
- Change `secondaryLabel={reviewing ? "Kembali Mengedit" : undefined}` to `reviewing ? "Ubah" : undefined`

#### [MODIFY] [goods-receipt-sheet.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/materials/components/goods-receipt-sheet.tsx)

- Change `primaryLabel={reviewing ? "Posting Penerimaan Barang" : "Tinjau Penerimaan"}` to `reviewing ? "Posting" : "Tinjau"`
- Change `secondaryLabel={reviewing ? "Kembali Mengedit" : undefined}` to `reviewing ? "Ubah" : undefined`
- Change `secondaryLabel="Terima Barang Lagi"` in `MaterialSuccessSheet` call to `"Tambah"`

#### [MODIFY] [inventory-location-sheet.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/materials/components/inventory-location-sheet.tsx)

- Change `primaryLabel="Tambah Lokasi"` to `"Tambah"`

#### [MODIFY] [project-material-operation-sheet.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/materials/components/project-material-operation-sheet.tsx)

- Change `primaryLabel={reviewing ? \`Catat \${operationLabel}\` : \`Tinjau \${operationLabel}\`}`to`reviewing ? "Catat" : "Tinjau"`
- Change `secondaryLabel={reviewing ? "Kembali Mengedit" : undefined}` to `reviewing ? "Ubah" : undefined`

#### [MODIFY] [stock-count-sheet.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/materials/components/stock-count-sheet.tsx)

- Change `primaryLabel={reviewing ? "Kirim untuk Persetujuan" : "Tinjau Stock Opname"}` to `reviewing ? "Kirim" : "Tinjau"`
- Change `secondaryLabel={reviewing ? "Kembali Mengedit" : "Simpan Draft"}` to `reviewing ? "Ubah" : "Draft"`

#### [MODIFY] [transfer-sheet.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/materials/components/transfer-sheet.tsx)

- Change `primaryLabel={reviewing ? "Posting Transfer Stok" : "Tinjau Transfer Stok"}` to `reviewing ? "Posting" : "Tinjau"`
- Change `secondaryLabel={reviewing ? "Kembali Mengedit" : undefined}` to `reviewing ? "Ubah" : undefined`

---

### Features: Project Detail & Budget/RAP/RAB

#### [MODIFY] [budget-item-form.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/projects/detail/components/budget/budget-item-form.tsx)

- Change `submitLabel="Tambahkan Item Budget"` to `"Tambah"`

#### [MODIFY] [client-invoice-form.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/projects/detail/components/invoices/client-invoice-form.tsx)

- Change `primaryLabel={reviewing ? "Buat Invoice Klien" : "Tinjau Invoice"}` to `reviewing ? "Buat" : "Tinjau"`
- Change `secondaryLabel={reviewing ? "Ubah Data" : undefined}` to `reviewing ? "Ubah" : undefined`
- Change `secondaryLabel="Buat Invoice Lagi"` in `FinanceSuccessSheet` call to `"Tambah"`

#### [MODIFY] [client-payment-sheet.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/projects/detail/components/invoices/client-payment-sheet.tsx)

- Change `primaryLabel={reviewing ? "Catat Pembayaran Klien" : "Tinjau Penerimaan"}` to `reviewing ? "Catat" : "Tinjau"`
- Change `secondaryLabel={reviewing ? "Ubah Data" : undefined}` to `reviewing ? "Ubah" : undefined`

#### [MODIFY] [project-activation-sheet.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/projects/detail/components/project-activation-sheet.tsx)

- Change `primaryLabel="Aktifkan proyek"` to `"Aktifkan"`
- Change `secondaryLabel="Nanti saja"` to `"Nanti"`

#### [MODIFY] [rab-bundle-drawer.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/projects/detail/components/rab/rab-bundle-drawer.tsx)

- Change `submitLabel={editingBundleId ? "Perbarui Paket RAB" : "Simpan Paket RAB"}` to `editingBundleId ? "Perbarui" : "Simpan"`

#### [MODIFY] [rab-change-order-drawers.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/projects/detail/components/rab/rab-change-order-drawers.tsx)

- Change `submitLabel="Tinjau Change Order"` to `"Tinjau"`

#### [MODIFY] [rab-item-edit-drawer.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/projects/detail/components/rab/rab-item-edit-drawer.tsx)

- Change `submitLabel="Simpan Perubahan"` to `"Simpan"`

#### [MODIFY] [rab-source-drawers.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/projects/detail/components/rab/rab-source-drawers.tsx)

- Change `submitLabel={rabEstimate?.status === "APPROVED" ? "Buat Draft Revisi RAB" : "Buat Draft RAB"}` to `rabEstimate?.status === "APPROVED" ? "Revisi" : "Buat"`
- Change `submitLabel="Tambahkan Item RAB"` to `"Tambah"`

#### [MODIFY] [category-plan-form-drawer.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/projects/detail/components/rap/category-plan-form-drawer.tsx)

- Change `submitLabel={editingCategoryPlanItemId ? "Perbarui Paket" : "Tambahkan Paket"}` to `editingCategoryPlanItemId ? "Perbarui" : "Tambah"`

#### [MODIFY] [rap-material-form-drawer.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/projects/detail/components/rap/rap-material-form-drawer.tsx)

- Change `submitLabel={editingRapItemId ? "Perbarui Material RAP" : "Tambahkan Material RAP"}` to `editingRapItemId ? "Perbarui" : "Tambah"`

#### [MODIFY] [rap-revision-drawer.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/projects/detail/components/rap/rap-revision-drawer.tsx)

- Change `submitLabel="Buat Draft Revisi"` to `"Buat"`

#### [MODIFY] [stock-operation-sheet.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/projects/detail/components/stock/stock-operation-sheet.tsx)

- Change `primaryLabel={reviewing ? \`Catat \${operation ? LABELS[operation] : "Operasi"}\` : \`Tinjau \${operation ? LABELS[operation] : "Operasi"}\`}`to`reviewing ? "Catat" : "Tinjau"`
- Change `secondaryLabel={reviewing ? "Kembali Mengedit" : undefined}` to `reviewing ? "Ubah" : undefined`

---

### Features: Project List & Settings

#### [MODIFY] [project-drawer.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/projects/list/components/project-drawer.tsx)

- Change `submitLabel={editProject ? "Tinjau Perubahan" : "Tinjau Proyek"}` to `"Tinjau"`
- Change `primaryLabel={editProject ? "Perbarui Proyek" : "Buat Proyek"}` to `editProject ? "Simpan" : "Buat"`
- Change `secondaryLabel="Kembali Mengedit"` to `"Ubah"`

#### [MODIFY] [category-settings-manager.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/settings/components/category-settings-manager.tsx)

- Change `submitLabel="Simpan Perubahan"` to `"Simpan"`

#### [MODIFY] [library-settings-manager.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/settings/components/library-settings-manager.tsx)

- Change `submitLabel="Simpan Template"` to `"Simpan"`
- Change `submitLabel="Simpan Komponen"` to `"Simpan"`

#### [MODIFY] [material-import-sheet.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/settings/components/material-import-sheet.tsx)

- Change `primaryLabel="Import material"` to `"Import"`

#### [MODIFY] [material-settings-manager.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/settings/components/material-settings-manager.tsx)

- Change `submitLabel="Simpan Material"` to `"Simpan"`
- Change `submitLabel="Tambahkan Kategori"` to `"Tambah"`
- Change `submitLabel="Simpan Default Inventori"` to `"Simpan"`

## Verification Plan

### Automated Verification

We will run:

- `bun run lint` to verify syntax and rules.
- `bun run build` to verify that Next.js type checking and builds pass successfully without any regression.

### Manual Verification

Reviewing the UI alignment on a simulated mobile viewport width (e.g. 320px–430px) to confirm no text wrapping happens on these buttons and that the visual readability is correct.
