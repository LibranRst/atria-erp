# Seed Repair and Expense UI Runtime Verification

## Goal

Restore deterministic `db:seed` cleanup after the inventory-opening, stock-transfer, stock-count, and adjacent schema additions, then verify the refined Kas & Tagihan rows in the authenticated mobile UI.

## Database contract

- Delete child tables before every restricted parent relation.
- Keep cleanup and reseeding inside the existing transaction.
- Cover all current schema tables so a previously used sandbox can be reset, not only a pristine database.
- Do not use raw SQL or weaken foreign-key behavior.

## UI verification contract

- Check Tagihan Vendor, Rencana Bayar, and Pengeluaran Lapangan at 320, 360, 390, and 430 px when an authenticated browser session is available.
- Confirm grouped-row hierarchy, non-wrapping primary amounts, spacing/leading, row and nested-action behavior, tab position stability, and console output.
- Motion: no page, list, or tab-content animation; retain only existing tab-pill, sheet, tap, and meaningful progress motion.

## Verification

- Run `db:seed` against the configured sandbox database.
- Run TypeScript, focused lint/tests, and diff checks.
- Start the local application and inspect the authenticated expense route in-browser.

## Implementation record

- Seed cleanup now covers every current schema table omitted by the previous cleanup, with inventory-opening, transfer, count, bank-import, attachment, draft, auth, and RAB children deleted before restricted parents.
- Added one deterministic `PENDING` vendor payment to the sandbox so Tagihan and Rencana Bayar runtime states can both be exercised without creating a cash transaction.
- Vendor bill sub-tabs and status filters retain the reading position and reserve the prior result height while content is replaced.
- Activity detail validation accepts canonical PostgreSQL UUID text used by legacy sandbox records while continuing to reject arbitrary IDs.
- `db:seed` completed successfully twice after the repair, including the planned-payment fixture.
- Authenticated UI checked at 320, 360, 390, and 430 px for Pengeluaran Lapangan, Tagihan Vendor, and Rencana Bayar: no horizontal document overflow; card details for all three flows loaded canonical records; tab/filter content remained stable with user-style clicks; browser console reported no warnings or errors.
- TypeScript and focused ESLint passed. Focused tests passed: 10 tests, 0 failures, 40 assertions. Targeted `git diff --check` passed.
