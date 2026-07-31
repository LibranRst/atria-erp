# Reconciliation Actions Structural Refactor

## Goal

Separate reconciliation workspace reads from manual/CSV statement mutations while preserving the public action module.

## Structure

- Keep `reconciliation-workspace.ts` as a compatibility export hub.
- Move response contracts into `reconciliation-workspace-types.ts`.
- Move session authorization, normalization, fingerprinting, and matching helpers into `reconciliation-action-utils.ts`.
- Move workspace aggregation into `reconciliation-workspace-query.ts`.
- Move manual and CSV statement writes into `reconciliation-statement-actions.ts`.

## Safety Contract

- Preserve reconciliation permission checks.
- Preserve transactional statement imports and audit rows.
- Preserve duplicate fingerprints and candidate suggestion behavior.
- Keep Drizzle APIs and introduce no raw SQL.

## Validation

- Prettier and ESLint for affected reconciliation modules.
- Strict TypeScript compilation.
- Bank account/reconciliation tests.
- `git diff --check`.
