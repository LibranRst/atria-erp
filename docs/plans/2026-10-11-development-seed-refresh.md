# Development data refresh for dashboard review

The user explicitly approved replacing existing practice project/material data with the complete development seed. Target only the configured `atria_practice_20261005` database in development mode. No schema reset, production override or environment change.

Before reset, save a fresh private repeatable-read snapshot of all application tables and the current users/auth accounts/sessions/tenant memberships. Preserve Libran's identity, credential hash and active session; do not change the password. Use the existing guarded development reset/seed and invariant verifier, then restore the saved identity additively in a transaction. Resolve any demo-email collision only on the synthetic demo user. Keep the private backup outside Git.

Verify complete dataset counts and finance/stock/planning invariants, identity preservation and the real local dashboard reads. Record command outcomes and the backup directory without exposing tokens or credentials. The replacement data is synthetic and used for local visual/workflow review.

## Completion

- Fresh private snapshot: `.atria-dev/backups/2026-10-10T18-31-37-599Z` (UTC directory timestamp; taken on 11 October in Jakarta). Repeatable-read data snapshot covers 69 tables and 311 rows. Snapshot serialization/readback verified before reset; this is a data backup, not a successful pg_dump archive.
- `bun run db:dev:reset --confirm-reset` completed on `atria_practice_20261005` only, retaining schema/migrations. The development seed's own finance, stock, workflow and planning invariant checks pass.
- Libran's profile, existing credential hash, tenant membership and five sessions were restored transactionally. Credentials were compared with the backup and confirmed unchanged. The existing role-guide acknowledgment was restored; the browser remains logged in as Libran without another sign-in.
- `bun run db:dev:verify` passes after restoration: 9 projects, 8 budgets, 8 RAPs with 231 lines, 67 work packages, 8 RABs with 52 bundles/326 lines, 20 library items, 54 vendor bills, 90 expenses, 86 ledger records, 124 stock movements, 25 notifications and 5 AI conversations. There are 4 bank accounts and 25 inventory rows.
- Real local web/API reads show all six desktop tabs populated: 4 pending approval rows, 5 active-budget projects, 5 due documents, 4 accounts, and paginated material issues. No read error appeared. The existing Segarkan action clears cached route data after the direct seed; users should refresh the page or click Segarkan before reviewing.
- Dashboard evidence: `/tmp/atria-complete-seed-dashboard.png`. Operator log and identity-restore helper stay private under ignored `.atria-dev`; no app source, environment, password or production database was changed.
