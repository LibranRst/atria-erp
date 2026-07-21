# Kas & Rekening Bank v1

## Summary

Turn the dashboard bank-account cards from a passive balance snapshot into a usable cash-control workspace. Users can add and edit bank accounts, post audited cash movements, transfer money between accounts, and customize card gradients with a lightweight Arc-style color editor.

## Implementation Notes

- Bank account balance remains ledger-derived. Metadata edits never mutate `balance`.
- `bank_account` gains card color fields and `is_active` so accounts with transaction history can be archived safely.
- Opening balance, manual cash movements, and bank transfers write `cash_transaction` and `audit_log` inside transactions.
- `/ledger` gains an Accounts tab and dashboard preview cards open detail/action sheets.

## Verification

- Cover bank-account actions with finance tests for create, update, manual movement, transfer, archive, and RBAC.
- Check mobile dashboard layout at common narrow widths after implementation.
