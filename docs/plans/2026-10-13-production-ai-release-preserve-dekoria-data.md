# Production release: responsive web, independent API and AI v1

Status: published and verified on 2026-10-13. The user authorized deploying the current updates to the existing Atria Dekoria production Netlify site and API after safety checks. No separate frontend preview was created. Both services run the fixed release commit, and the post-release production data comparison passed.

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

## Completed release

- Source: `442ecb9484011085d271ea9c29bffa0320253860`, branch `codex/ai-v1-production-20261013`. The original working checkout and index were preserved.
- Final CI: [38417321674](https://github.com/LibranRst/atria-erp/actions/runs/38417321674), successful quality and Postgres integration jobs. Frozen Linux amd64 API container build also passed.
- Verified backup: [38400828119](https://github.com/LibranRst/atria-erp/actions/runs/38400828119). Exact migrations 0044–0048 were rehearsed against a private restored copy before the guarded production transaction committed. No production reset, seed or restore ran.
- Migration: 44 to 49 journal entries; three new empty feature tables and the expected Purchasing `use:ai_chat` grant. All 66 other existing tables remained identical.
- Railway: deployment `82294f20-9dff-44a5-a5e7-b24ef5827fa9`, exact release commit, successful health/readiness. All 30 configured variables and the service configuration retained their fingerprints.
- Netlify: deployment `6ace49aca9f5a26ff42ff637`, published with its explicit release commit link. Build time 100 seconds. Builds were restored to Stopped; previews remain disabled and no extra deploy is queued.
- Hosted smoke: 38/38 checks passed for health/readiness, login/assets, route protection, bridge and anonymous AI/media/job/SSE denial. No production business confirmation or upload was attempted.
- Final data readback at 15:15:55 UTC: all 70 post-migration table hashes, journal and grants remained unchanged after both deployments. Finance/stock invariants matched the restored production proof with zero violations across 13 applicable rows; two checks had zero applicable rows.

Production URLs: [Atria Dekoria](https://atria-dekoria-app.netlify.app) and [API readiness](https://atria-pilot-api-production.up.railway.app/ready). Sanitized evidence and screenshots are in `output/production-release-2026-10-13/`; private recovery data and credentials are excluded from Git and deploy uploads.

Authenticated production AI streaming, role-scoped facts, OCR/export and business confirmations were not exercised without an ordinary approved production account. The earlier live conversation and transaction acceptance evidence belongs to the disposable QA environment. Railway remains on its existing Trial with 21 days remaining at preflight; no paid plan or billing preference was changed.

Rollback: republish Netlify deployment `6ac46b688a5b63f1cb9b49ba` and reconnect/redeploy the retained compatible API source `06b4b6fb838df30d4c71b40a629272668ad01192` on `codex/notifications-production`. Railway marks the superseded runtime deployment REMOVED, so use the retained source rather than assuming its instance remains available. Keep additive schema and newer business records; never restore a database dump over subsequent transactions as an application rollback.
