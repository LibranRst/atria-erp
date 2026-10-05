# Self-guided Atria workflow and clean production setup

## User-authorized scope

Rewrite `docs/guide/financial_workflow_guide.md` for a reader without finance experience: explain what each app value means, why it matters, how it changes, and a repeatable setup-to-closing practice with expected numbers. Cover current web finance, material, RAB, AI/media, roles and operational boundaries. The user will run the workflows personally and create the production accounts with the boss.

The user explicitly requested resetting the database served by https://atria-dekoria.netlify.app. Reset only the main isolated Neon database `atria_pilot` on `ep-damp-resonance-b36gzzjo.c-4.ap-southeast-1.aws.neon.tech`. Preserve schemas, 44 migration records, database roles/grants and the required tenant scaffolding. Existing users/sessions and application rows are intentionally removed. Never reset the development database or disposable QA database as part of this request.

## Execution

1. Inspect graph/source for current setup, metrics, transitions, UI labels and local runtime ownership. Parallel read-only finance/material/runtime reviews inform the guide; primary owns edits and reset.
2. Verify the exact production host/database/role and current row counts. Capture a fresh private backup before reset, verify archive integrity, and retain restore evidence. Use the existing guarded reset operator with an explicit production override; no application SQL or source secrets.
3. Verify zero application users/financial/material rows, unchanged migration count and tenant scaffolding, then verify `/setup` is available and authenticated routes require fresh setup/login. Do not submit the new Owner credentials for the user.
4. Inspect sanitized local API/web environment destinations; establish whether `bun dev` alone starts the full stack and whether it can mutate production. Provide tested startup commands and stop behavior. Do not overwrite existing development data or secrets.
5. Replace the old oversized/copy-password guide with a plain Bahasa Indonesia manual: concepts, setup, deterministic example, role-specific steps, expected checkpoints, independent stock/cash checks, negative tests, reconciliation/closing, AI approval, troubleshooting and a feature checklist. Keep seed-filled demos separate from an empty-from-setup run.
6. Validate arithmetic against implemented derivations, links/routes and formatting. Run relevant runtime checks if startup implementation changes; documentation alone does not justify repeating unrelated broad builds. Refresh the context graph after changes and preserve the original checkout's unrelated work.

## Confirmed blockers and development isolation

- A complete reset removes `role_permission`, while current first-owner bootstrap inserts roles without their grants. Authorization correctly treats empty grants as revoked. Repair first-owner canonical permission initialization atomically, preserving configured/customized existing grants; test real authorization and rollback before production reset.
- Existing development database `atria_uat_guard` has 5 users, 9 projects, 11 cash transactions and existing stock. It is remote Neon storage, distinct from production, and must be preserved. It has 43/44 applied migrations. Prepare a newly named rehearsal database on the development compute, apply all 44 migrations without demo seed, and keep the old local environment recoverable before selecting rehearsal locally.
- Root `bun dev` currently starts only web. The API needs `bun run dev:api`; neither command performs reset/migration/seed. Verify loopback API/web origins and matching bridge secret before the user follows the two-terminal startup instructions.

## Acceptance

- The main production instance is ready for a new first Owner; no demo/test data is inserted after reset.
- A fresh verified pre-reset archive is private and recoverable; secrets never appear in the guide or tool output.
- Development startup instructions identify web, API and database separately, including what `bun dev` actually does.
- The user can track expected budget/actual/paid/remaining/margin, bank cash, receivables/payables and stock through one complete practice without double counting.
- Unimplemented accounting/tax/bank-transfer automation and human/provider checks are described accurately.

## Executed result — 5 October 2026

- Bootstrap default initialization now lives in the typed `db/initialize-system-roles.ts` helper, called inside the serialized first-owner transaction. The architecture guard remains intact. Six new PGlite behavior cases cover functional fresh grants, scaffold/customized grants, repeat/invalid rejection and rollback; 16 affected checks and API typecheck/lint/format passed. Source `63185199` passed [CI 37258645841](https://github.com/LibranRst/atria-erp/actions/runs/37258645841), including disposable PostgreSQL and production builds. Railway deployment `762e2719-9655-4e7c-b68b-66afe6c83be8` was Active before reset.
- Fresh pre-reset main archive captured all 67 public table counts and 44 migrations with verified TLS, SHA-256 and archive readback. Private local recovery is retained under `.atria-demo/main-reset-backups/`; [R2 backup run 37256451251](https://github.com/LibranRst/atria-erp/actions/runs/37256451251) independently succeeded before reset. Remote archive: `atria-erp/pilot/2026/10/05/atria_pilot-20261005T024323Z-37256451251-1.dump`, 307419 bytes, SHA-256 `1a45b7d8162b3b8b584ecf1999a7d212cbcb4c8938dabf7e95248ed4741df382`.
- The user-authorized main reset used the existing explicit production operator after exact host/database/owner and backup-count guards. All 67 public tables were verified empty except the single required tenant scaffold; 44 migrations remain. Users, projects and cash transactions are zero. API health/readiness are 200; production `/setup` is 200 and renders first Owner setup. No replacement user or demo data was inserted.
- Development rehearsal `atria_practice_20261005` was created on the existing development compute and provisioned with 44 migrations, zero users/projects/cash transactions. Existing `atria_uat_guard` was preserved. Private prior `.env.local` snapshots and provisioning manifest are retained under `.atria-demo/development-rehearsal/2026-10-05/`. Selected local ports are web3010/API3011; the unrelated service on3000 was preserved. Startup through the documented root commands returned health/readiness and bootstrap required=true; the browser rendered first Owner setup.
- Guide was fully rewritten and reviewed independently against finance/material code, with the parsed eight-row bank CSV and exact arithmetic. Corrections include permissions for RAP finalization/RAB generation, real form fields, inventory-versus-expense accounting, explicit project activation/client CO confirmation, one-to-one reconciliation and conservative/final margin differences.
- Both setup pages remain ready for the human to enter Owner name/email/password. Bootstrap secrets are masked in the browser and privately recoverable; no secret or shared password appears in source/guide. Local services remain running for the user's practice.
- Local CDN reachability remains an external network limitation: a fresh `https://ik.imagekit.io/` probe fails with `CERT_HAS_EXPIRED`, consistent with the earlier ISP DNS misroute. TLS validation was preserved; no OS DNS/network setting was changed. The guide distinguishes verified local startup/manual finance/material from blocked local media/OCR and warns against pointing the local web at the production API as a workaround.
