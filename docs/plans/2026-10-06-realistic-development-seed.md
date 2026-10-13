# Realistic development dataset

## Goal

Provide a repeatable development seed using the existing Neon connection whose projects, category budgets,
RAP material plans, Tukang/Subcon packages, client-safe RABs, finance and inventory
history form one connected dataset suitable for visual and workflow testing.

## Approach

- Preserve the existing `db:seed` / connected demo walkthrough and stable IDs.
- Add a `development` seed profile, populated atomically in the existing seed
  transaction after the demo baseline has passed its checks.
- Expand planning by actual rooms and scopes, with explicit units, buffers, material
  cost baselines, labor/subcon packages, source lineage and client-facing bundles.
  Calculate line totals and document totals from their children; preserve revision
  and Change Order relationships and the pending setup gates.
- Enrich Settings/library, all role notification histories, editable stock drafts,
  and completed-project cost history. No external provider calls are simulated as
  successful live transactions.
- Add `db:dev:seed`, `db:dev:reset --confirm-reset`, and `db:dev:verify` from the
  root. Read the existing API `DATABASE_URL`; preserve the native Neon driver.
  Guard before importing database runtime: Neon or explicit loopback PostgreSQL,
  never production. A loopback TCP adapter is optional for disposable testing. Seed refuses existing business data; reset is
  an explicit separate operation.
- Verify balances, stock, cross-project references, canonical/legacy expenses,
  planning arithmetic, RAB totals and lineage, revision chains and feature coverage.

## Validation

Run pure fixture/command guard tests, API/web/mobile typechecks, workspace lint and
format checks. Execute the seed and verifier on a newly created disposable local
PostgreSQL database with the complete migration history; re-run seed to check its
non-empty guard and test explicit reset. Never use the development or pilot database
for automated destructive checks. Refresh the Graft index after code changes.

## Delivery

Document commands, existing Neon environment usage, accounts, project scenario map, actual
dataset counts, adjustable fixture sources and limitations in a development seed
guide. Seed values are synthetic planning assumptions rather than vendor quotes.

## Implementation evidence

- Existing Neon connection read successfully without mutations; seed commands retain
  the configured Neon driver. No environment files were changed.
- Seed/reset and read-only verifier passed on migrated disposable PostgreSQL.
  A deliberately failing seed rolled back every business insert; the non-empty
  guard rejected a repeated seed without removing rows.
- Final dataset: 9 projects, 8 budgets, 8 RAP documents / 231 material lines,
  67 work packages, 8 RAB documents / 52 bundles / 326 detail lines,
  54 vendor bills, 90 expenses, 86 ledger entries and 124 stock movements.
- 70 focused unit/contract tests and 5 PostgreSQL invariant corruption tests passed.
- Actual API login, project-detail loaders, PM scoping and all eight client-safe
  RAB exports passed on an isolated clone. Test API and database container cleaned up.
- Workspace lint and targeted changed-file formatting passed. Repository-wide
  formatting reports existing issues outside this task's files.
- Final API, web and mobile TypeScript checks passed.
