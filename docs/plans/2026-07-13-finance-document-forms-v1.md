# Fase 3 — Finance Document Forms V1

## Outcome

Finance operators can prepare vendor bills, client invoices, receipts, disbursements, manual cash movements, and account transfers without accidental data loss or an irreversible write before an explicit review. Every balance-changing form shows the account balance before and after the operation and ends in a durable success state.

## Audit findings

| Flow                        |  Frequency |     Risk | Finding                                                                                                                | Treatment                                                                          |
| --------------------------- | ---------: | -------: | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Vendor bill creation        |       High | Critical | Writes the final bill and approved canonical expense directly; no recovery or review; auto-closes after submit         | Server-backed input draft, local recovery, category impact review, durable success |
| Vendor payment schedule     |       High |     High | Defaults are helpful but no review of remaining bill or approval path; auto-closes                                     | Local recovery/dirty guard, review, explicit scheduling result                     |
| Vendor payment disbursement |       High | Critical | Balance mutation is atomic, but UI hides before/after until account is chosen and auto-closes                          | Balance impact review, insufficient-funds block, durable success                   |
| Client invoice creation     |     Medium |     High | Good defaults, but directly creates immutable invoice and auto-closes                                                  | Local recovery, explicit review, durable success                                   |
| Client payment receipt      |     Medium | Critical | Atomic ledger mutation exists; no overpayment warning or durable result                                                | Remaining-invoice and balance impact review, durable success                       |
| Field expense disbursement  |       High | Critical | Atomic ledger mutation exists; no before/after review and auto-close                                                   | Balance impact review, explicit confirmation, durable success                      |
| Manual cash movement        |     Medium | Critical | Before/after preview exists, but primary CTA posts immediately; close loses input; reload is the only success handling | Local recovery, review state, dirty guard, durable success                         |
| Account transfer            |     Medium | Critical | Atomic paired ledger mutation exists, but only source after-balance is prominent; close loses input                    | Source and destination before/after review, dirty guard, durable success           |
| Bank account create/edit    | Low/Medium |     High | Opening balance creates ledger entry; form has no close protection                                                     | Local recovery/dirty guard and opening-balance consequence review                  |

## Locked business boundaries

- Preserve Better Auth session checks, RBAC, project scoping, canonical budget sync, approval creation, and Drizzle transaction boundaries.
- A draft must not create `vendor_bill`, `project_expense`, approval, `cash_transaction`, budget mutation, or audit log.
- Reconciled cash transactions remain immutable; correction uses a new compensating operation, never edit/delete.
- Amounts, bank accounts, and cash direction are never inferred silently.
- Vendor bill submission remains the only point that creates the final vendor bill and canonical expense.

## Implementation slices

### 1. Shared finance workflow patterns

- Add finance-specific money impact, review summary, durable success, and unsaved-change sheets using the shared rounded controls and motion tokens.
- Add typed local recovery for short finance forms with versioned payloads, immediate local persistence, unload protection, and explicit clear after success/discard.
- Use `WorkflowFormSheet` for a two-state prepare/review interaction; final CTA names the mutation.

### 2. Vendor payable

- Add a Zod-validated `VENDOR_BILL` payload stored in `form_draft`, with ownership, project scoping, optimistic revision, 30-day expiry, list/get/save/discard/submit actions, and field-path errors.
- Submit claims an active revision and calls the existing vendor bill business write within one transaction boundary; failure restores the draft to active.
- Show active vendor drafts with vendor, project, amount, category, and last-save time.
- Review vendor, project, category remaining before/after, package link, amount, due date, and expected approval/payment state.
- Scheduling remains a short form; show bill remaining and approval trigger before creation.
- Disbursement shows source balance before/after and blocks a known insufficient balance.

### 3. Client receivable

- Keep invoice creation short with local recovery and a close guard.
- Review invoice identity, stage, amount, due date, and total project invoiced impact before creating it.
- Payment receipt reviews invoice remaining, received amount, possible overpayment, account balance before/after, and reference.

### 4. Expense disbursement and cash ledger

- Field expense disbursement reviews project, amount, account before/after, approval consequence, and reference.
- Manual movement and account transfer gain prepare/review states, local recovery, close guards, and durable success states.
- Transfer review displays both source and destination balances before/after.
- Account create/edit gets dirty protection; opening balance states that it creates an audited ledger row.

### 5. Verification gate

- Unit tests for finance local recovery, money impact, vendor draft schema, optimistic revision, and overpayment/insufficient-funds calculations.
- Integration tests for vendor draft ownership/scoping, no mutations before submit, atomic submit, and failed-submit recovery.
- Regression tests for payments, balance helpers, approvals, and immutable reconciled transactions.
- Browser verification at 320, 390, and 430 px for all migrated prepare/review/success/close paths without posting production-like money mutations.
- TypeScript strict, lint, full tests, build, and `git diff --check` pass.

## Implementation record

Completed on 2026-07-13.

- Added a server-backed, versioned vendor-bill draft contract with multiple active drafts, 30-day expiry, optimistic revision conflict handling, ownership/project scoping, discard, and atomic idempotent submit. Draft autosave does not create a vendor bill, canonical expense, approval, budget mutation, cash transaction, stock movement, or audit event.
- Added immediate versioned local recovery and unload protection to short finance forms: client invoice, client receipt, vendor schedule/disbursement, field-expense disbursement, bank account create/edit, manual movement, and account transfer. Success/discard clears the corresponding recovery key.
- Migrated all listed finance forms to named prepare/review/final actions, durable success sheets, explicit unsaved-change choices, and calm Indonesian operational copy. Balance-changing reviews show before/after values; transfers show both accounts; opening balance explains the ledger/audit consequence.
- Extracted the canonical vendor-bill transaction writer so direct submission and draft submission share the same RBAC, budget sync, project-expense, approval, and audit behavior.
- Added unit coverage for local recovery and vendor-bill draft validation plus integration coverage for revision conflicts and atomic/idempotent vendor-bill submission.
- Browser QA covered 320, 390, and 430 px without clicking a final money mutation. Evidence: `vendor-bill-review-390.png`, `client-invoice-review-430.png`, `client-payment-review-430.png`, `vendor-payment-schedule-review-390.png`, `field-disbursement-review-390.png`, `bank-transfer-review-320.png`, and `bank-account-review-320.png` under `output/playwright/`.
- Acceptance gate: TypeScript strict passed, ESLint passed, `git diff --check` passed, all 125 tests passed, and the Next.js production build produced `.next/BUILD_ID`.
