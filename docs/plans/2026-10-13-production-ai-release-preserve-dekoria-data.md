# Production release: responsive web, independent API and AI v1

Status: preparation in progress. The user authorized deploying the current updates to the existing Atria Dekoria production Netlify site and API after safety checks. A separate public frontend preview is not requested; production data preservation and hosted acceptance remain required.

## Candidate and scope

Capture a fixed, reviewable source revision from the current workspace, including the independent API, shared packages, responsive web and completed AI workflows. Preserve the user's working checkout and staged changes. Exclude local environment files, credentials, QA outputs, generated previews, debug logs, Python caches and build artifacts. Verify the deployed service identities before any push or deployment; do not push to an auto-deploy branch accidentally.

The retained production targets are the existing Netlify Atria Dekoria site and Railway API, using the existing Neon database, tenant, auth/session signing, private storage, job secrets and approved AI provider. No new database, seed, reset, provision or restore over production is part of this release. Native source may be included in the revision; app-store publication is outside this request.

## Data and schema gate

1. Read production service metadata, migration journal and database identity privately. Record current web/API deployments and rollback targets; never log credentials or business rows.
2. Create and verify a fresh recoverable production backup through the established workflow. Rehearse the exact pending migrations against an isolated private copy/branch with the candidate, and compare business records, finance/cash/stock invariants and expected schema/RBAC-only differences.
3. Review every pending migration against the applied journal and deployed source. Preserve all prior migration hashes. Use a direct connection and guarded migration tools; no broad bootstrap/reset script. Stop before production changes if the backup, identity, migration continuity, preservation or compatibility checks fail.

## Build and deployment gate

Run the candidate's workspace tests, strict typechecks, lint, security checks, API/web production builds and frozen container build. Resolve packaging gaps in the workspace manifests and deployment ignore rules. Verify exact production API/web origins and matching bridge, retained old-origin/private attachment compatibility, real-data policy, existing approved provider, storage/job configuration and developer simulation disabled.

Preflight identified an unconditional one-minute Material analysis recovery poll. Make recovery queue-aware so an empty worker does not issue recurring database queries, while startup recovery, explicit enqueue/retry, future leases and concurrent work remain recoverable. Verify idle and lost-wake regressions before freezing the final candidate; this does not alter business transactions or require another schema migration.

Deploy schema additions only after rehearsal and backup pass, then deploy the compatible API and wait for readiness before the matching Netlify web. Keep the old deploys available. Application rollback uses compatible source/deployments and never restores over newer business data. Preserve automatic-build/preview and account/billing preferences unless the release requires an explicitly authorized change.

## Hosted acceptance

Check production health/readiness, anonymous auth gates, login assets, old/new transport compatibility, cancellation/streaming, persisted AI replies and existing private file access/export. Use an ordinary existing account only when its credentials are available through the approved session or user input. Production smoke is read-only: no test projects, payments, stock movements, approvals or synthetic finance records. Verify database identity and protected business-record preservation after rollout; distinguish legitimate concurrent activity from deployment changes.

Record exact source/deployment IDs, migration/backup evidence, checks, known limits and rollback instructions in the final handoff. Do not claim production release success from local QA or anonymous HTTP reachability alone.
