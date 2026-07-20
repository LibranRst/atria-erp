# Account Review Drawer Rework

## Goal

Make the bank-account review drawer readable and consistent with Atria's mobile finance design language before the account mutation is confirmed.

## Scope

1. Replace compressed `FieldContextLine` identity text with full-width grouped review rows.
2. Use one grouped balance-impact surface with an informational row and a divided before/after comparison; avoid nested cards and duplicated summary amounts.
3. Give the primary confirmation action full width while keeping edit as a clear secondary action.
4. Verify the review state at 320, 360, 390, and 430 px with no clipping or horizontal overflow.

## Safety

- Do not change account validation, ledger mutation, opening-balance behavior, or audit logging.
- Keep the existing two-stage edit → review → save workflow.
- Keep the shared bottom-sheet motion and focus behavior.

## Verification

- ESLint and targeted TypeScript/test checks for the touched components.
- Browser verification of text wrapping, action hierarchy, and console state.
