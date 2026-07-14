# Plan: Unify UI Corners (Full Rounded / iOS 27 Style)

We will audit all pages and components to make sure that inputs (single-line text, money, numeric, select, combobox, datepicker trigger buttons, etc.) and action buttons (CTA, cancel, save, primary, secondary, operations, segment controls) use the `rounded-full` class (fully rounded) consistently, matching the iOS 27 visual language. Textareas will maintain `rounded-2xl` or `rounded-3xl` for multiline layout purposes.

## Proposed Changes

We will systematically modify files across the following components:

### Core UI Component

- Modify `components/ui/form-controls.tsx`:
  - Change single-line inputs (`TextInput` wrapper, `SearchField` wrapper, `QuantityStepper` wrapper) from `rounded-xl`/`rounded-2xl` to `rounded-full`.
  - Increase text input padding from `px-3` to `px-5` to look proportional with fully rounded edges.
  - Change trigger buttons (`SheetSelect` trigger, `ComboboxField` trigger, `DatePickerField` trigger) from `rounded-xl` to `rounded-full` and padding `px-3` to `px-5`.
  - Change day buttons and month switcher buttons in `DatePickerField` from `rounded-xl` to `rounded-full`.
  - Change `ChoiceRow` button from `rounded-2xl` to `rounded-full`.
  - Keep multiline `Textarea` controls on `rounded-xl` (from `controlClass`) or adjust to a more suitable multiline corner radius (`rounded-[20px]`).

- Modify `components/ui/settings-ui.tsx`:
  - Change `inputClass` from `rounded-xl px-3` to `rounded-full px-5`.
  - Change `ConfirmationSheet` buttons (Batal, Confirm) from `rounded-xl` to `rounded-full`.

### Layout Components

- Modify `components/layout/bottom-nav.tsx`:
  - Change FAB button container from `rounded-[28px]` to `rounded-full`.
  - Change FAB action items from `rounded-2xl` to `rounded-full`.

- Modify `components/layout/sidebar.tsx`:
  - Change logout button from `rounded-xl` to `rounded-full`.

### Pages and Feature Components

- Modify `components/expense/expense-form.tsx`:
  - Change primary submit button (`Save Expense`) from `rounded-xl` to `rounded-full`.

- Modify `components/expense/expense-list.tsx`:
  - Change tab switcher buttons (Pengeluaran Lapangan / Tagihan Vendor) from `rounded-2xl` to `rounded-full`.
  - Change disburse buttons (Batal, Cairkan Dana) from `rounded-xl` to `rounded-full`.

- Modify `components/expense/vendor-bill-form.tsx`:
  - Change action buttons (Batal, Simpan Tagihan) from `rounded-xl` to `rounded-full`.

- Modify `components/expense/vendor-bill-list.tsx`:
  - Change schedule/disburse buttons from `rounded-xl` to `rounded-full`.

- Modify `components/material/goods-receipt-sheet.tsx`:
  - Change trigger button from `rounded-2xl` to `rounded-full`.
  - Change action buttons (Review Receipt, `+ Item`) from `rounded-xl` to `rounded-full`.

- Modify `components/material/materials-control-center.tsx`:
  - Change quick operations buttons from `rounded-2xl` to `rounded-full`.
  - Change search input wrapper from `rounded-2xl` to `rounded-full`.
  - Change Link button (`Buka RAP Project`) from `rounded-xl` to `rounded-full`.
  - Change `Load more` button from `rounded-xl` to `rounded-full`.
  - Change action buttons inside bottom sheet dialogs (Catat, Post Transfer, Tambah, Save & Submit, Post Emergency, Request Reversal) from `rounded-xl` to `rounded-full`.
  - Change `ApprovalRow` buttons (Reject, Approve) from `rounded-xl` to `rounded-full`.
  - Change `ItemRows` button (`Tambah Material`) from `rounded-xl` to `rounded-full`.

- Modify `components/project/budget-manager.tsx`:
  - Change standard buttons (Tambah, Simpan, Batal, Reject, Approve) from `rounded-xl` to `rounded-full`.
  - Change inputs from `rounded-xl px-3` to `rounded-full px-5`.

- Modify `components/project/client-invoice-form.tsx`:
  - Change action buttons (Batal, Simpan Tagihan) from `rounded-xl` to `rounded-full`.

- Modify `components/project/project-drawer.tsx`:
  - Change action buttons from `rounded-xl` to `rounded-full`.

- Modify `components/project/project-invoices.tsx`:
  - Change action buttons (Batal, Simpan) from `rounded-xl` to `rounded-full`.

- Modify `components/settings/budget-settings-manager.tsx`:
  - Change action button (Simpan semua) from `rounded-xl` to `rounded-full`.

- Modify `components/settings/category-settings-manager.tsx`:
  - Change action button (Simpan perubahan) from `rounded-xl` to `rounded-full`.

- Modify `components/settings/library-settings-manager.tsx`:
  - Change action buttons (Tambah template, Simpan template, Komponen) from `rounded-xl` to `rounded-full`.

- Modify `components/settings/material-settings-manager.tsx`:
  - Change action buttons (Tambah material, Simpan material, Batal, Tambah, + Buat kategori material, Simpan defaults) from `rounded-xl` to `rounded-full`.

- Modify `app/login/page.tsx`:
  - Change input fields from `rounded-xl px-3.5` to `rounded-full px-5`.
  - Change submit button from `rounded-xl` to `rounded-full`.

## Verification Plan

- Run Next.js build (`next build`) to ensure there are no compilation errors.
- Manually check the styling.
