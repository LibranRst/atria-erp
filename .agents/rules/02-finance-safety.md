# Rule: Financial Integrity & Ledger Safety (Option A Model)

This rule strictly enforces database transaction patterns, cash ledger immutability, audit logging, and category budget boundaries for **Atria ERP**.

## 1. Option A Ledger Architecture
- Every financial balance mutation (expense payout, vendor bill payment, client payment received, account transfer) MUST run inside `db.transaction`.
- Sequence for balance mutations:
  1. Lock account row (`for update` via query builder).
  2. Verify sufficient funds (for disbursements/outflows).
  3. Update account balance.
  4. Insert immutable `cash_transaction` row.
  5. Insert `audit_log` row recording actor, action, previous state, and new state.

---

## 2. Cash Reconciliation & Immutability Rules
- **Reconciled Records are Immutable**: Once a `cash_transaction` row is reconciled (`reconciliation_status = 'RECONCILED'`), it MUST NEVER be edited, soft-deleted, or removed.
- **Correction via Compensating Entries**: Any discrepancy or mistake in a reconciled transaction must be resolved by creating a compensating reversal transaction with an explicit audit note.
- **Bank Statement Imports**: Bank mutations (`bank_mutation`) imported via CSV are matched against Atria cash records (`cash_transaction`) 1-to-1 or 1-to-N with documented approval.

---

## 3. Canonical Expense Categories
Budget and expense allocations belong exclusively to these five code-locked categories:
1. `MATERIAL`: Linked to Material Master, RAP items, stock purchases, and vendor bills.
2. `TUKANG`: Linked to Tukang Work Packages and field wage claims (no stock behavior).
3. `OPERASIONAL`: Simple field operations (transport, meals, minor tools, consumables). Kept lightweight without heavy RAP.
4. `LAIN_LAIN`: Unforeseen miscellaneous project expenses.
5. `SUBCON`: Linked to Subcon Packages and third-party subcontractor bills.

---

## 4. Approval Thresholds & Role Scoping
- **Field Expenses & Vendor Payments ≥ Rp 5,000,000**: Require explicit Owner approval (`APPROVAL_STATUS = 'PENDING_OWNER'`).
- **Over-Budget Expenses**: Any transaction that exceeds the allocated category budget requires an over-budget override approved by Owner/Finance Admin.
- **Project Manager Scoping**: PMs and Field Designers are strictly restricted to projects assigned to them. They cannot view global company bank balances or unrelated project margins.

---

## 5. Audit Logging Invariant
Every action modifying financial records must write an entry to `audit_log` with:
- `entity_type`: e.g. `'cash_transaction'`, `'project_budget'`, `'vendor_bill'`.
- `entity_id`: UUID of the affected entity.
- `action`: e.g. `'CREATE'`, `'UPDATE'`, `'APPROVE'`, `'RECONCILE'`.
- `actor_id`: User ID from the authenticated session.
- `payload`: JSON containing previous vs new state details.
