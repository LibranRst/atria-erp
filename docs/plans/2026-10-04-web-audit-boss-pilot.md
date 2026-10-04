# Web audit remediation and free-hosted boss pilot

Status, 4 October 2026: local remediation and isolated verification completed; source is ready for candidate freeze: the clean candidate suite passed 1,588 tests with zero failures, with lint and API/web/mobile typechecks passing. The pilot cloud database is provisioned, and the API Docker candidate can read it. Netlify is reserved but the web/API applications are not deployed. Real-data AI remains blocked because Gemini is still on the free API policy and no permitted provider has been approved. No pilot go-live approval is implied by a successful build.

## Agreed pilot

- Two weeks, one existing project, real company data, Owner/Finance/PM/Purchasing accounts, laptop and mobile web.
- Finance and material workflows, including AI chat and OCR, run alongside the current authoritative bookkeeping.
- Finance agrees a cutoff and baselines for contract/RAB, category allocations/consumed/paid, payables/receivables, stock/reservations and bank balance.
- Bank validation covers the cutoff snapshot plus pilot transaction deltas; it does not represent all company bank movements.
- Frontend/backend hosting must remain Rp0 within free quotas. AI uses existing approved services/credits. Never send confidential data to an unapproved free provider.

## Implementation

1. Preserve current workspace work and public web action/tRPC compatibility. Add changes to the independent API, shared contracts and existing UI primitives.
2. Patch production dependencies after checking actual registry/advisory availability; distinguish production reachability from development tooling.
3. Apply database-backed permissions and project scope to AI budget creation, payments and retained dashboard operations. Write audits inside transactions.
4. Lock receipt state before reversal approval, preventing concurrent double consumption; use persisted expense approval requirements at payment.
5. Make AI confirmations and their business mutation commit atomically and recover idempotently.
6. Refresh dashboard approvals and bank account snapshots correctly while preserving pending optimistic actions; remove static-role permission checks in affected UI.
7. Authorize private attachments at upload/download and AI processing. Enforce HTTPS/storage identity, redirect, size, MIME, time and usage limits. Send bank-statement file references rather than large Base64 Server Action bodies.
8. Harden shared keyboard/touch controls and defer export-only dependencies. Reuse MoneyValue, SegmentedTabs, FormSection, semantic sheets/dialogs, useCan and desktop adapters.
9. Add request correlation, CI gates, browser smoke/E2E, isolated database verification and viewport evidence.
10. Configure Netlify Free Next runtime, Render Free Bun Docker service, isolated Neon Free pilot DB and private ImageKit attachments. Preserve independent API notification scheduling. Write deployment, backup/restore, quota, rollback and 15-minute boss walkthrough instructions.

## Release acceptance

### Local implementation and isolated evidence

- [x] Earlier API/web typecheck, workspace lint, styles and production builds passed; safe core 322 / web 819 passed; final API safe run 336 passed / 160 skipped / 0 failed (923 assertions, 86 files, 10.81 s). Web 819 is the broad run before the final UI correction, supplemented by 31 focused passing tests; final serial web typecheck and the separate mobile check passed. These are local reported runs, not a claim that cloud CI executed.
- [x] Latest finance candidate: API TypeScript, focused ESLint and diff check passed; 10 focused tests covered native HTTP/PGlite, role permissions, stock links and valuation.
- [x] PostgreSQL disposable: 24 suites were executed; the only final-run failure was the new mixed-case scope case. Its fix passed a targeted receipt/reversal rerun (7 tests, 60 assertions), warehouse (8), and auth permission (13); preserve the original failure log rather than claim one clean full rerun.
- [x] Receipt concurrency/idempotency, approval-versus-rejection, later-item rollback, and actual AI confirmation persistence failure/retry were tested on real local PostgreSQL. Finance/expense confirmation rollback and persisted approval requirements have separate focused coverage.
- [x] Stock-link fixture covered six movement entrypoints, project/category/SKU/RAP/pending/gross quantity-value guards, return-credit/re-use restoration, and paid Material purchase -> receipt -> use recognition once without extra cash.
- [x] Private media malicious URL/ownership/MIME/size/ticket/provider-policy and large-file transport have automated local coverage; OCR/storage providers were mocked for these tests.
- [x] Local synthetic Playwright: 11 tests passed in 17.3 s (Owner login/dashboard/accounts/admin, PM direct admin/ledger denial, keyboard login, Finance cash posting/compensation plus Owner detail refresh, seven viewport widths). Targeted 320 px notice contrast/reduced-motion hydration check also passed.
- [x] Dashboard screenshots at 320/360/390/430/1024/1280/1440 are saved. Desktop Dashboard evidence does not replace the pending full desktop-admin viewport matrix.
- [x] Actual local web outage/reconnect PWA check passed: anonymous offline-only cache, no finance data offline, recovery after reconnect, no POST queue/retry.
- [x] Pilot Netlify/Render configs, CI and disposable preparation guards are written. Local preparation migrated/seeded a fresh test database and refused a second preparation; 12 dangerous-target guard tests passed.
- [x] Pilot backup code is separate and opt-in: six fake Docker/R2 tests passed, six production backup tests still passed, and a synthetic local dump/restore passed six actual invariants over 83 rows (44 migrations, five users). No dump was uploaded to cloud.
- [x] Root rebuilt `atria-pilot-api:local` after fixing the Docker build invocation and asserting a nonempty dist bundle. Runtime on local port 3212 returned `/health` 200 and `/ready` 200 against the new pilot Neon database, without business mutation.
- [x] Clean candidate final gate: core 322 + mobile 105 + API 336 + web 819 + dev scripts 6 = 1,588 passed / zero failed (API live integration cases remain skipped in the safe run). Workspace lint and API/web/mobile typechecks passed. Production dependency audit: one moderate, zero high; secret-pattern scan: 3,002 candidate files, zero findings. This pattern scan is not proof that every possible secret is absent. API declaration generation was run serially to avoid concurrent writer/read races.
- [ ] Source candidate commit/push and actual GitHub CI execution; append commit identity and CI run URL after they exist.

### Hosted and real-data pilot gates — pending

- [ ] Render API and Netlify web deployed from the same approved source candidate; HTTPS cookie/auth flow, cold-start recovery, bounded AI stream/OCR, notification scheduler and quota behaviour verified on those deployments.
- [ ] Browser password change/logout, revoked/custom roles and PM unassigned-project denial; full desktop-admin 1024/1280/1440 focus/keyboard matrix. Unit/server coverage does not substitute for these browser checks.
- [ ] Complete browser budget -> private OCR expense -> human approval -> payment -> category/cash delta, vendor/client payment, reconciliation, material receive/reserve/use/return/reversal and client-safe RAB export.
- [ ] Actual private ImageKit upload/unauthorised download and attachment-byte restore; credentials, account quota, retention and private access verified.
- [ ] Approved AI provider/upstream billing, privacy and fallback verified for real data. Keep `AI_APPROVED_PROVIDERS` empty and `GEMINI_PAID_DATA_POLICY_CONFIRMED=false` while Gemini API remains free; do not enable a policy flag to bypass the decision.
- [ ] Backup before real baseline import, actual private R2 archive+manifest verified, nightly pilot backup succeeds, and actual pilot data/attachments restore into an isolated target. Local synthetic drill is mechanism proof only.
- [ ] Owner/Finance/PM/Purchasing pilot accounts created safely, Finance signs off cutoff/baseline and bank snapshot plus pilot deltas, and Owner demonstrates project understanding within 30 seconds. No business baseline has been imported.

## Deployment contract

- Netlify Free: repository root base, apps/web package, apps/web/.next publish; Bun pinned to workspace; styles check followed by build:web. Site variables use all four platform scopes, production context only, without paid Secrets Controller/is_secret flags; narrowing scopes requires Pro/Enterprise. API origin/bridge names stay server-only (never NEXT_PUBLIC), with no DB/AI keys. Disable auto/branch/preview deploys through site settings; keep CLI-generated .netlify artifacts ignored.
- Render: repository-root Docker context, apps/api/Dockerfile, configurable PORT/HOST, /health liveness and /ready database readiness. API owns database/auth/AI/storage/job secrets.
- Neon: separate pilot project/database; no reset, seeding or migration of the current live database. No copying production data into generic test fixtures.
- ImageKit: private finance assets with short-lived authorised delivery. Public avatar/cover behaviour stays compatible.
- Free quotas can pause services and Render can sleep. Keep current bookkeeping available; never automatically retry a money mutation after an ambiguous timeout.

## Evidence log — 4 October 2026

### Cloud preparation, not application deployment

- Neon project `polished-glade-93740595`, branch `br-lucky-heart-b3qmgl34`, database `atria_pilot`; PostgreSQL 17 in Singapore, compute min/max 0.25 CU, Free storage quota 1 GiB. Provisioning passed: 44 migrations, 67 tables, four system roles, zero users. The database is fresh and contains no company business data.
- Netlify site reserved: `c316f6d9-328f-4702-b5ea-dfc8c75c4ce3`, <https://atria-boss-pilot.netlify.app>. Root confirmed the Free team and verified metadata for seven environment keys with a fresh bridge secret, without database/AI keys: each has exactly one production context and all four platform scopes, matching private configuration without printing values. Free does not permit selective scopes; the earlier scope-narrowing attempt returned 403 and was replaced with this supported configuration using the actual account ID. Site reservation is not proof that the Atria web app is serving.
- Render application deployment has not completed. The local Bun image tag `oven/bun:1.3.14` was confirmed available for amd64/arm64. Initial Docker metadata retrieval stalled; the subsequent corrected image built and started successfully. The original `bun --cwd apps/api run build` emitted help with exit 0; the Dockerfile now uses `bun run --cwd apps/api build` and checks the dist bundle exists.
- Actual hosted app URLs, deployment IDs/commits, provider approval, billing caps and Finance baseline signoff must be appended after verification. Do not record passwords, tokens or connection strings.

### Inspectable local evidence

- Browser captures: `output/pilot-browser-evidence/dashboard-{320,360,390,430,1024,1280,1440}.png`.
- Historical full PostgreSQL logs: `output/pilot-postgres-integration/` and `output/pilot-postgres-final/results.json`. The latter retains the now-resolved mixed-case failure; targeted reruns passed and were reported separately.
- Role-name regression uses actual PGlite and existing stock guards: mixed casing, literal `%`/`_`, wildcard decoy, ambiguity denial, and Purchasing `NONE` with explicit warehouse permissions.
- Restore drill: 324,027-byte custom archive; SHA-256 `c02d5b6bbd4052a0d9bc17c62be38bac1f6e6d8852a76d655d84519f1159002b`; six invariants passed over 83 rows. Archive/manifest/log stayed in a private task-local directory; target restore database was dropped. The manifest labels the data synthetic and does not imply cloud or attachment-byte recovery.
- API/web build, safe tests, isolated domain checks and source graph were refreshed during remediation; the clean candidate final 1,588-test run, workspace lint and API/web/mobile typechecks passed; commit/push and actual CI run remain to be recorded. The deployment/backup/restore/quota/rollback and 15-minute Owner walkthrough is [free boss pilot](../guide/free-boss-pilot.md).
