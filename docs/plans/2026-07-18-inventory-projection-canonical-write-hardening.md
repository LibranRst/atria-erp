# Inventory Projection and Canonical Write Hardening

## Goal

Close the material-control correctness holes found after the recent Antigravity changes and remove legacy budget mutations from active finance write paths without deleting compatibility data required by existing records.

## Scope

1. Introduce one movement-based project material projection used by RAP detail, shortage reads, and project stock summaries.
2. Make reservation, usage, return, waste, receipt, and receipt-reversal calculations consistent and covered by table-driven unit tests.
3. Prefill Goods Receipt from outstanding RAP quantity and outstanding vendor-bill value rather than the original full quantity/value.
4. Enforce cumulative RAP quantity and vendor-bill value limits inside the Goods Receipt transaction.
5. Keep package detail drawers open while mutations are pending or fail.
6. Map vendor payment states exhaustively so only eligible pending payments expose a disbursement action.
7. Remove legacy `project_budget_item.actual_spent` mutations from vendor and field-payment flows. Canonical `project_budget_category` and `project_expenses` remain the active accounting source.
8. Stop active expense OCR and vendor/expense draft submissions from writing legacy budget-item links. Existing legacy rows remain readable and can still be backfilled into canonical categories.
9. Replace the material movement prop-sync effect with an explicit server/local pagination model that passes lint.

## Compatibility Boundary

- Preserve `project_budget`, `project_budget_item`, and `project_cost` schema and relations.
- Preserve read fallbacks for historical records that have no canonical category yet.
- New active submissions must require `projectBudgetCategoryId` and write legacy budget-item links as `null`.
- Historical compatibility must never update legacy budget balances after canonical category accounting is available.

## Verification

- Unit tests for project material projection and Goods Receipt prefill/outstanding limits.
- Unit tests for payment presentation states and canonical-only submission mapping.
- TypeScript and targeted ESLint.
- Relevant material, approval, finance, draft-validation, and UI presentation tests.
- Production build if the targeted checks pass.

