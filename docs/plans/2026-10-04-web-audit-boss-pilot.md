# Web audit remediation and free-hosted boss pilot

Status, 4 October 2026: local remediation and isolated verification completed; the clean candidate suite passed 1,588 tests with zero failures, with lint and API/web/mobile typechecks passing. Source candidate `b0e78152e97717f0576c32ea8eb928153a4fde25` is pushed and its GitHub CI quality and disposable PostgreSQL jobs passed. The pilot cloud database is provisioned, and the local API Docker candidate can read it. Netlify is reserved and its build metadata corrected; hosted web/API acceptance is not verified. Railway Trial/Free without a card is selected after the user declined Render card verification. One API service and a domain are allocated, source/variables connected, and deploy settings staged; actual runtime and Full Trial/outbound verification remain gates. Trial resource controls are disabled at a maximum of two vCPU/1 GB RAM, so a 512 MB/one-vCPU cap is not claimed as configured. Real-data AI remains blocked because Gemini is still on the free API policy and no permitted provider has been approved. No pilot go-live approval is implied by a successful build.

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
10. Configure Netlify Free Next runtime, one Railway Trial/Free Bun Docker service without a card or paid upgrade, isolated Neon Free pilot DB and private ImageKit attachments. Preserve independent API notification scheduling. Write deployment, backup/restore, quota, rollback and 15-minute boss walkthrough instructions. Retain the Render blueprint as an optional historical artifact; it is not the selected pilot host.

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
- [x] Pilot Netlify config, CI and disposable preparation guards are written. Railway dashboard setup is documented; no deprecated railway.json/TOML is added. Render blueprint remains optional and unselected. Local preparation migrated/seeded a fresh test database and refused a second preparation; 12 dangerous-target guard tests passed.
- [x] Pilot backup code is separate and opt-in: six fake Docker/R2 tests passed, six production backup tests still passed, and a synthetic local dump/restore passed six actual invariants over 83 rows (44 migrations, five users). No dump was uploaded to cloud.
- [x] Root rebuilt `atria-pilot-api:local` after fixing the Docker build invocation and asserting a nonempty dist bundle. Runtime on local port 3212 returned `/health` 200 and `/ready` 200 against the new pilot Neon database, without business mutation.
- [x] Clean candidate final gate: core 322 + mobile 105 + API 336 + web 819 + dev scripts 6 = 1,588 passed / zero failed (API live integration cases remain skipped in the safe run). Workspace lint and API/web/mobile typechecks passed. Production dependency audit: one moderate, zero high; secret-pattern scan: 3,002 candidate files, zero findings. This pattern scan is not proof that every possible secret is absent. API declaration generation was run serially to avoid concurrent writer/read races.
- [x] Source candidate [`b0e78152e97717f0576c32ea8eb928153a4fde25`](https://github.com/LibranRst/atria-erp/commit/b0e78152e97717f0576c32ea8eb928153a4fde25) committed/pushed from an isolated snapshot, preserving original development work; [draft PR #2](https://github.com/LibranRst/atria-erp/pull/2) attached. Actual [GitHub CI run 37181391341](https://github.com/LibranRst/atria-erp/actions/runs/37181391341) succeeded: quality 5 m 4 s and disposable PostgreSQL integration 1 m 14 s. This cloud CI evidence is separate from the historical local failed-run log and its targeted fixes.

### Hosted and real-data pilot gates — pending

- [x] One Railway API service/source and public domain allocated with repository-root context; user-authorized runtime variables imported without AI keys. `/ready`, Wait for CI and Serverless are staged before deployment. This is setup metadata, not runtime verification.
- [ ] Railway Full Trial/outbound verification completed without a card or paid upgrade; one API replica and no Railway database/volume/extra service. Record actual trial limits (currently max two vCPU/1 GB with resource sliders disabled), peak usage and the later Free limits of 512 MB/one vCPU; no configured 512 MB cap is claimed.
- [ ] Railway API and Netlify web deployed from the approved source candidate; HTTPS cookie/auth flow, `/ready` deployment readiness, `/health` liveness, cold-start recovery, bounded AI stream/OCR, notification scheduler and quota behaviour verified on those deployments. A generated/reserved URL is not acceptance evidence.
- [ ] Railway Serverless enabled and redeployed, then actual sleep/wake verified after closing web/SSE and letting outbound connections go idle. Record actual region, credit expiry/reset and daily usage; review day 14 and before trial/credit expiry. Singapore/global-region access is not promised after trial becomes Free.
- [ ] Browser password change/logout, revoked/custom roles and PM unassigned-project denial; full desktop-admin 1024/1280/1440 focus/keyboard matrix. Unit/server coverage does not substitute for these browser checks.
- [ ] Complete browser budget -> private OCR expense -> human approval -> payment -> category/cash delta, vendor/client payment, reconciliation, material receive/reserve/use/return/reversal and client-safe RAB export.
- [ ] Actual private ImageKit upload/unauthorised download and attachment-byte restore; credentials, account quota, retention and private access verified.
- [ ] Approved AI provider/upstream billing, privacy and fallback verified for real data. Keep `AI_APPROVED_PROVIDERS` empty and `GEMINI_PAID_DATA_POLICY_CONFIRMED=false` while Gemini API remains free; do not enable a policy flag to bypass the decision.
- [ ] Backup before real baseline import, actual private R2 archive+manifest verified, nightly pilot backup succeeds, and actual pilot data/attachments restore into an isolated target. Local synthetic drill is mechanism proof only.
- [ ] Owner/Finance/PM/Purchasing pilot accounts created safely, Finance signs off cutoff/baseline and bank snapshot plus pilot deltas, and Owner demonstrates project understanding within 30 seconds. No business baseline has been imported.

## Deployment contract

- Netlify Free: actual UI Base field blank (repository root), apps/web package, apps/web/.next publish; Bun pinned to workspace; styles check followed by build:web. Build metadata is verified with builds stopped for manual CLI deployment. The earlier Base apps/web + Package apps/web wizard combination doubled the path to apps/web/apps/web and failed config/script discovery; it was corrected. Site variables use all four platform scopes, production context only, without paid Secrets Controller/is_secret flags; narrowing scopes requires Pro/Enterprise. API origin/bridge names stay server-only (never NEXT_PUBLIC), with no DB/AI keys. Disable auto/branch/preview deploys through site settings; keep CLI-generated .netlify artifacts ignored.
- Railway Trial/Free: no card, top-up, Hobby/Pro or paid upgrade. One API service from authorized private GitHub source; repository-root Docker context, RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile, existing Docker CMD, HOST=0.0.0.0/PORT=3001 and one replica. Actual trial UI has disabled resource sliders at maximum two vCPU/1 GB RAM; the Free plan after trial allows 512 MB/one vCPU, not a cap already configured on this trial service. No Railway DB/volume/Redis/extra worker. Use /ready deployment healthcheck and /health liveness; API owns database/auth/AI/storage/job secrets. New projects use dashboard settings: Config as Code is deprecated and no railway.json/TOML is added. [Dockerfiles](https://docs.railway.com/builds/dockerfiles), [Config as Code deprecation](https://docs.railway.com/config-as-code/reference).
- Trial: US$5 for up to 30 days, then Free US$1/month without rollover. Automatic GitHub verification must allow outbound access; prove actual Neon/storage/provider connectivity. Singapore trial ID asia-southeast1-eqsg3a is conditional on account availability; pricing excludes global regions on post-trial Free. The official configurable workspace hard limit starts at US$10, so do not claim a configured US$1 hard cap. Keep no payment method/paid upgrade, monitor credit, export pilot deltas and backup before expiry, and review continuation with Owner on day 14. [Trial](https://docs.railway.com/pricing/free-trial), [Pricing](https://railway.com/pricing), [Usage controls](https://docs.railway.com/cli/usage).
- Railway Serverless detects outbound inactivity and normally sleeps after 5–10 minutes; a toggle read-back is insufficient until the service is redeployed. API uses pg-compatible @neondatabase/serverless Pool, not postgres-js; a constructor-only inspection without database access confirmed installed defaults idleTimeoutMillis=10000/min=0/max=10/allowExitOnIdle=false. No explicit idle override exists, but released idle clients already expire after 10 seconds. Actual runtime sleep remains unverified; allowExitOnIdle does not close sockets and postgres-js idle_timeout is not the applicable option. Avoid added keep-alive/polling. Free quota exhaustion can stop services until the next cycle; database stays separate in Neon. [Serverless](https://docs.railway.com/deployments/serverless), [Pool API](https://node-postgres.com/apis/pool).
- Neon: separate pilot project/database; no reset, seeding or migration of the current live database. No copying production data into generic test fixtures.
- ImageKit: private finance assets with short-lived authorised delivery. Public avatar/cover behaviour stays compatible.
- Free quotas can pause services and Railway can sleep. Keep current bookkeeping available; never automatically retry a money mutation after an ambiguous timeout. Render card verification/US$1 hold was declined; render.yaml is optional historical setup only.

## Evidence log — 4 October 2026

### Cloud preparation, not application deployment

- Neon project `polished-glade-93740595`, branch `br-lucky-heart-b3qmgl34`, database `atria_pilot`; PostgreSQL 17 in Singapore, compute min/max 0.25 CU, Free storage quota 1 GiB. Provisioning passed: 44 migrations, 67 tables, four system roles, zero users. The database is fresh and contains no company business data.
- Netlify site reserved: `c316f6d9-328f-4702-b5ea-dfc8c75c4ce3`, <https://atria-boss-pilot.netlify.app>. Root confirmed the Free team and verified metadata for seven environment keys with a fresh bridge secret, without database/AI keys: each has exactly one production context and all four platform scopes, matching private configuration without printing values. Free does not permit selective scopes; the earlier scope-narrowing attempt returned 403 and was replaced with this supported configuration using the actual account ID. Corrected build metadata is Base blank/repo root, Package apps/web, publish apps/web/.next, builds stopped/manual CLI. Initial wizard path doubling/config-script failure is resolved; local Next plugin build succeeded in 32 s. Site reservation, metadata and local plugin build are not proof that the hosted Atria web app is serving.
- Railway Trial/Free selected because the user declined Render card verification/US$1 hold. Project 9c8944bb-9dff-43a6-816e-73dac641d371, environment 72e54b77-9adb-4691-856c-087d112bdbea and API service 217d3e44-824c-46d6-af53-fab21ca28407 are created; source root is blank/repository root and user-authorized runtime variables imported without AI keys. Domain <https://atria-pilot-api-production.up.railway.app> is allocated to target port 3001; this is not a verified serving URL. /ready, Wait for CI and Serverless are staged before deployment. Actual Full Trial/outbound/runtime and sleep/wake remain pending. Trial sliders are disabled at maximum two vCPU/1 GB RAM; Free post-trial limits are 512 MB/one vCPU. The local Bun image tag oven/bun:1.3.14 was confirmed available for amd64/arm64. Initial Docker metadata retrieval stalled; the subsequent corrected image built and started successfully. The original bun --cwd apps/api run build emitted help with exit 0; the Dockerfile now uses bun run --cwd apps/api build and checks the dist bundle exists.
- Actual hosted app URLs, deployment IDs/commits, provider approval, billing caps and Finance baseline signoff must be appended after verification. Do not record passwords, tokens or connection strings.

### Inspectable local evidence

- Browser captures: `output/pilot-browser-evidence/dashboard-{320,360,390,430,1024,1280,1440}.png`.
- Historical full PostgreSQL logs: `output/pilot-postgres-integration/` and `output/pilot-postgres-final/results.json`. The latter retains the now-resolved mixed-case failure; targeted reruns passed and were reported separately.
- Role-name regression uses actual PGlite and existing stock guards: mixed casing, literal `%`/`_`, wildcard decoy, ambiguity denial, and Purchasing `NONE` with explicit warehouse permissions.
- Restore drill: 324,027-byte custom archive; SHA-256 `c02d5b6bbd4052a0d9bc17c62be38bac1f6e6d8852a76d655d84519f1159002b`; six invariants passed over 83 rows. Archive/manifest/log stayed in a private task-local directory; target restore database was dropped. The manifest labels the data synthetic and does not imply cloud or attachment-byte recovery.
- API/web build, safe tests, isolated domain checks and source graph were refreshed during remediation; the clean candidate final 1,588-test run, workspace lint and API/web/mobile typechecks passed. Candidate b0e78152e97717f0576c32ea8eb928153a4fde25 and [GitHub CI success](https://github.com/LibranRst/atria-erp/actions/runs/37181391341) are recorded above; this does not prove hosted/browser/provider acceptance. The deployment/backup/restore/quota/rollback and 15-minute Owner walkthrough is [free boss pilot](../guide/free-boss-pilot.md).

### Private storage runtime check — release gate

A live synthetic ImageKit upload and metadata request returned 200 with `isPrivateFile=true`; the exact QA files were deleted (204, followed by metadata 404). Disposable HTTP checks returned upload-ticket 200 for a legacy PostgreSQL UUID-shaped project, anonymous download 401 and foreign-project PM denial. Owner authorization reached delivery, which failed certificate validation. The CDN `ik.imagekit.io` presented a certificate valid from 6 March to 4 June 2026; Bun, system curl and OpenSSL rejected it on 4 October. No TLS checks were disabled. Unsigned denial and signed exact-byte delivery remain unverified; real-data attachment/OCR pilot stays blocked until a valid configured delivery endpoint is verified.

The two project-ID upload schemas now accept PostgreSQL UUID-shaped legacy IDs with `z.guid()` while preserving permission/scope checks. Nine focused cases with 49 assertions, API TypeScript and focused ESLint passed.

### Hosted candidate — 4 October 2026

Runtime release source: `ce6276aa510c90489216d4d230f36db28dd5e61b` ([passing CI](https://github.com/LibranRst/atria-erp/actions/runs/37185289687)). Railway deployment `7bbb22fb-9146-4567-876d-54751decc94b` is active in US West with one replica. HTTPS [API](https://atria-pilot-api-production.up.railway.app) returned `/health` 200 and `/ready` 200, proving the new pilot Neon connection. No AI keys or original database credentials were copied.

Netlify production deployment `6ac1fed28e544d47da3b4274` is published from a local Next.js runtime build of the same clean checkout. Provider `commit_ref` is unset for the manual artifact upload; deployment title records `ce6276a`. [Web](https://atria-boss-pilot.netlify.app) remains protected by Netlify team access; HTTPS `/login` and first-Owner `/setup` rendered in the authorized browser. Owner credential entry/submission is handed to the user. Public boss access, authenticated workflow smoke, real cutoff/baseline, storage delivery, approved AI and actual idle sleep remain gates.

### Pilot notification scheduler

The separate `atria-pilot-notification-scheduler` Cloudflare Worker is deployed using `apps/api/workers/notification-scheduler/wrangler.pilot.jsonc`; the existing scheduler config is preserved. It binds only the pilot API URL and a fresh notification job secret. Cron schedules are every 30 minutes plus 17:00 UTC daily. Manual HTTPS checks with the explicit Atria readiness user agent returned anonymous 401 and authorized reconcile 200/upstream 200; the default Python user agent was rejected by the edge with 1010 before reaching the Worker. No edge protection was disabled. Actual Cron firing/recovery and delivery of real pilot notifications remain acceptance checks.

### Final web artifact and temporary Owner

Corrected production deployment: `6ac20cc355a894774f00a5a4`. Manual `netlify build` restores raw `.next` after the Next plugin runs; a subsequent no-build deploy must publish `apps/web/.netlify/static`, retaining the internal SSR/edge cache. Normal plugin builds still use configured publish `apps/web/.next`. The earlier raw-artifact deployment `6ac1fed28e544d47da3b4274` produced JavaScript 404s and was deleted with explicit user approval; metadata now returns Not Found. A required application chunk changed from 404 to 200/JavaScript with 304,125 bytes after the corrected upload.

Production visibility is Public with Deploy Previews Private, approved by the user. The private edge-access layer had intercepted the captured login request before Atria; no auth code was changed. User-authorized operator bootstrap created one temporary Owner (`dekoria.office@gmail.com`) without business transactions. HTTPS browser login succeeded, issued a Secure/HttpOnly/Lax session cookie, and reached the welcome onboarding screen. The temporary password is only in a local 0600 file; an authenticated, database-target-guarded operator transaction marked it temporary, wrote an audit and revoked its sessions. Password replacement by the user is required before real business use.

### Manual Netlify artifact command and password gate proof

Build from the clean release checkout with production environment variables:

```sh
bunx netlify-cli build --filter @atria/web --context production
bunx netlify-cli deploy --filter @atria/web --dir apps/web/.netlify/static --no-build --site c316f6d9-328f-4702-b5ea-dfc8c75c4ce3 --prod
```

Do not combine `--context` with `--no-build` in the tested CLI version. Do not upload raw `.next` after a standalone build: its layout differs from the transformed static artifact and includes server artifacts. Production login is publicly reachable (200); anonymous `/ledger`, `/admin`, and `/projects` returned 307 to `/login`. A fresh temporary-Owner sign-in was redirected to `/profile/password`, proving the password-change gate. No project, balance, stock, vendor/client transaction or real attachment has been imported into the pilot.
