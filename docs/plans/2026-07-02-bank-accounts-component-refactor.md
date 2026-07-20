# Bank Accounts Component Refactor

## Summary
Refactor fitur Kas & Rekening dari satu file komponen besar menjadi modul kecil yang jelas: types/constants, helpers, workspace card, transaction rows, detail sheet, form sheet, movement sheet, transfer sheet, dan control orchestration.

## Scope
- Keep existing behavior, server actions, ledger safety, RBAC behavior, and UI copy.
- Preserve `features/finance-dashboard/components/bank-accounts-control.tsx` as the public entry point.
- Move implementation into `features/finance-dashboard/components/bank-accounts/`.
- Avoid new dependencies.

## Target Structure
- `types.ts`: shared feature types.
- `constants.ts`: presets and select options.
- `utils.ts`: draft factories, formatting options, account update helper.
- `color-editor.tsx`: card color customization UI.
- `account-transaction-rows.tsx`: recent transaction rows.
- `account-workspace-card.tsx`: full account card plus quick actions.
- `account-detail-sheet.tsx`: account detail bottom sheet.
- `account-form-sheet.tsx`: create/edit account sheet.
- `movement-sheet.tsx`: manual cash movement sheet.
- `transfer-sheet.tsx`: transfer sheet.
- `bank-accounts-control.tsx`: orchestration/state/action handling.

## Verification
- Run `bunx tsc --noEmit`.
- Run `npm run lint`.
- Browser smoke check `/ledger?tab=accounts` opens and account cards/actions still render.
