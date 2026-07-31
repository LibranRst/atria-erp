# Bank Accounts Control Structural Refactor

## Goal

Separate bank-account presentation and finance-operation orchestration from the route-level control component without changing permissions, recovery behavior, ledger mutations, or visual hierarchy.

## Structure

- Keep `bank-accounts-control.tsx` as the composition boundary for overview and workflow sheets.
- Move account summary, empty state, preview carousel, and account rows into `bank-accounts-overview.tsx`.
- Move recovery state, action calls, optimistic account updates, and success payloads into `use-bank-accounts-control.ts`.
- Use the shared typed `AppIcon` instead of local Lucide add icons.

## UI Contract

- Preserve the cash summary, account identity gradients, grouped account rows, and all sheet states.
- Preserve owner-only create/archive permissions and dirty-form recovery.
- Motion: retain the existing account tap feedback and sheet transitions; add no entrance animation.

## Validation

- Prettier and ESLint for affected bank-account modules.
- Strict TypeScript compilation.
- Relevant finance action and presentation tests.
- `git diff --check`.
