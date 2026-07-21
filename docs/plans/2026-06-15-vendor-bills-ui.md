# Plan - Vendor Bills & Accounts Payable UI Module

We will implement a clean, premium, mobile-first UI module for managing **Vendor Bills & Accounts Payable** inside the existing `/expenses` view.

All backend tables, validations, and Server Actions (`submitVendorBill`, `scheduleVendorBillPayment`, `payVendorBill`) are already fully implemented and verified. We just need to build the user interface using our iOS 26 Solid design aesthetics.

---

## Proposed Changes

### 1. Data Fetching & Scoping Layer

#### [MODIFY] [app/expenses/page.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/expenses/page.tsx)

- Query all vendor bills (`vendorBill`) and scheduled payments (`vendorPayment`), including their relations (`vendor`, `project`, `budgetItem`).
- If the user role is `PROJECT_MANAGER`, filter both field costs and vendor bills to display only those associated with projects where the PM is explicitly assigned.
- Fetch metadata required for submission forms: list of `vendors`, active `projects`, bank `accounts`, and project `budgetItems`.
- Pass all compiled data to the updated `ExpenseList` component.

### 2. Tab Shell Switcher

#### [MODIFY] [components/expense/expense-list.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/expense/expense-list.tsx)

- Add an elegant **Segmented Control** (iOS-style pill switcher) at the top of the page:
  - **Tab 1**: _Pengeluaran Lapangan_ (Field Claims - existing UI)
  - **Tab 2**: _Tagihan Vendor_ (Vendor Bills - new UI)
- Dynamically switch views based on the selected tab.
- Delegate the rendering of the vendor bills tab to a new dedicated sub-component `VendorBillList`.

### 3. Vendor Bills UI Module

#### [NEW] [components/expense/vendor-bill-list.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/expense/vendor-bill-list.tsx)

Create a new file containing the UI elements and interactions for managing vendor bills:

- **Vendor Bills View**:
  - List all bills in a dense card layout showing: Vendor Name, Bill Number, Amount (formatted IDR), Due Date, and Status Badge (`UNPAID` as amber, `PAID` as green, etc.).
  - For unpaid/partially paid bills, display a **"Jadwalkan Bayar" (Schedule)** action button (accessible to Owner/Finance Admin).
- **Scheduled Payments View (Daftar Rencana Pembayaran)**:
  - Show a dedicated list of payments scheduled for vendor bills.
  - For `PENDING` payments:
    - If approval is required (>= 5M or budget overrun) and not yet approved, display an amber badge: **"Menunggu Approval Owner"**.
    - If ready (approved or no approval needed), display a green **"Cairkan (Pay)"** button (accessible to Finance Admin/Owner). Clicking this opens a bottom sheet sheet requesting the bank transaction reference number.
- **Floating Action Button (FAB) / Add Bill Dialog**:
  - Allow Finance Admin and PMs to submit new bills.
  - Form fields: Vendor, Project (filtered if PM), Budget Item (filtered dynamically by selected project), Bill Number, Amount, Due Date, and Notes.
  - Calls `submitVendorBill` Server Action.

---

## Verification Plan

### Automated Verification

- Run the existing unit tests to ensure no regressions are introduced:
  ```bash
  bun test
  ```
- Run production build checks to ensure compile-time TypeScript safety:
  ```bash
  bun run build
  ```

### Manual Walkthrough Skenario 4 (Baru)

1. **Login sebagai Finance Lisa** (`lisa@dekoria.com`).
2. Buka tab **Expenses** -> Pilih tab **Tagihan Vendor**.
3. Anda akan melihat tagihan **PT Cahaya Mas Panel (`BILL-2026-091`)** sebesar **Rp 20.000.000** berstatus **APPROVED** (Belum Dibayar).
4. Klik **Jadwalkan Bayar**:
   - Pilih bank **BCA Operasional**.
   - Atur nominal bayar: **Rp 20.000.000**.
   - Atur tanggal pembayaran: hari ini, lalu simpan.
5. **Alur Otorisasi**:
   - Karena nominalnya Rp 20.000.000 ($\ge$ Rp 5.000.000), pembayaran ini otomatis masuk ke status `PENDING` di antrean Owner.
6. **Login sebagai Owner Ronald** (`ronald@dekoria.com`), masuk ke halaman **Approvals / Persetujuan**, lalu klik **Approve** pada pengajuan pembayaran vendor PT Cahaya Mas Panel tersebut.
7. **Login kembali sebagai Lisa**, masuk ke tab **Expenses** -> **Tagihan Vendor**, temukan pembayaran yang telah disetujui di bagian daftar rencana pembayaran, lalu klik **Cairkan**.
8. Masukkan nomor referensi bank, lalu simpan. Verifikasi bahwa saldo kas BCA Operasional terpotong Rp 20.000.000 dan status tagihan berubah menjadi **PAID**.
