# Connected Demo Seed and Walkthrough

## Objective

Turn the development seed into a safe, resettable learning sandbox whose finance, approval,
project-budget, reconciliation, and stock records are internally connected and can be exercised
through the current UI.

## Decisions

- `db:seed` is insert-only and refuses a non-empty or production database.
- Destructive reset is exposed separately as `db:demo:reset --confirm-reset`.
- Demo dates are relative to the seed day in Asia/Jakarta, with an optional fixed anchor for tests.
- The baseline mixes completed history with open, actionable scenarios.
- Every initially open reconciliation row has one unambiguous counterpart.
- The production-style empty-database UAT guide remains separate from the seeded walkthrough.

## Implementation

1. Add a shared demo contract for timeline, money parsing, scenario constants, and generated CSV
   fixtures.
2. Harden the seed preflight and repair connected finance, transfer, reconciliation, canonical
   expense, profitability, and audit records.
3. Add a read-only demo verifier plus a confirmed reset/seed/verify orchestrator.
4. Replace stale seed documentation and add a role-based interactive walkthrough.
5. Verify command safety, focused tests, TypeScript, lint, build, database seed, and the documented
   flows without overwriting unrelated worktree changes.

## Acceptance

- Seed cannot silently erase existing or production data.
- Financial and stock aggregates equal their detail records.
- Reconciliation history and open work queues are one-to-one and auditable.
- A developer can reset the sandbox, switch roles, run the documented scenarios, import generated
  bank CSV files, and understand every resulting value and status.
