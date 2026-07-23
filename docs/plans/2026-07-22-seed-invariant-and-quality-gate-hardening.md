# Seed Invariant and Quality Gate Hardening

## Objective

Make the expanded sandbox seed trustworthy for finance, inventory, onboarding, and UI verification without discarding the user's current local UI work.

## Scope

- Reconcile opening inventory, GRN, transfers, stock counts, and stock movements.
- Ensure pending opening inventory uses the canonical approval state and contains reviewable items.
- Link completed payments and paid field costs to cash transactions and reconcile bank balances.
- Preserve maker-checker and audit evidence in seeded workflow history.
- Repair the global structural loading state and harden formatting scripts/tests against canonical Tailwind rewrites.
- Add focused seed invariant tests where practical.

## Safety

- Keep changes additive and localized to the current seed/tooling/UI regression.
- Do not run `db:seed` until static checks and tests pass because it clears the configured database.
- Preserve all unrelated uncommitted changes.
- Keep stock and money records internally consistent with the same transaction rules used by production actions.

## UI Contract

- Global loading remains a one-column structural skeleton inside the fixed mobile shell.
- No new focal surface, control, interaction, or animation is introduced.
- Motion: no animation; existing route and sheet behavior remains unchanged.

## Verification

- Seed invariant checks for canonical statuses, linked movements, balances, and maker-checker separation.
- ESLint with zero warnings, TypeScript, focused tests, full test suite, and production build.
- Inspect the structural loading state at 320, 360, 390, and 430 px when browser tooling is available.

## Completed

- Reconciled all seeded bank balances against their cash transactions.
- Reconciled inventory per material/location against opening, receipt, usage, transfer, adjustment, and count movements.
- Added canonical Tukang and Subcon work packages for the active project budgets.
- Added a transaction-local invariant gate so invalid seed relationships roll back with a targeted error.
- Updated legacy-budget and Tailwind presentation tests to assert the current canonical behavior.
- Verified `bun db:seed`, `bunx tsc --noEmit`, `bun run lint`, `bun test`, and `bun run build` successfully.
