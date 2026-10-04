# Independent Atria backend

## Agreed destination

Hono on Bun owns all backend execution in `apps/api`. Next.js remains a rendering and HTTP adapter client; Expo connects directly to the API. Existing database schema, transactions, permissions, calculations, UI and native-to-browser navigation are preserved. No deployment or production database mutation is authorized by this implementation.

## Migration matrix

| Subsystem                                           | Destination                  | Web boundary                           | Acceptance                                          |
| --------------------------------------------------- | ---------------------------- | -------------------------------------- | --------------------------------------------------- |
| Database, migrations, seed/provision/backup tooling | API                          | No DB imports or credentials           | Existing history and root db commands preserved     |
| Better Auth, Actor, RBAC and scope                  | API                          | Cookie/session HTTP forwarding         | Cookie and native bearer parity                     |
| Existing mobile tRPC                                | API                          | HTTP forwarding for compatibility      | Native screens with Next stopped                    |
| Server Actions and feature loaders                  | API portable backend modules | Typed allowlisted private HTTP adapter | Existing return values, validation and transactions |
| Settings, finance, material and project workflows   | API                          | Successful mutation revalidation       | Ledger/stock/audit and concurrency invariants       |
| AI, SSE and notification jobs                       | API                          | Streaming forwarding                   | Abort/reconnect and commit-before-delivery          |
| Shared calculations/DTOs/Zod                        | Pure core                    | Shared imports                         | No runtime backend code in clients                  |

The private web bridge is a server-to-server compatibility adapter with an explicit operation allowlist and a dedicated transport credential. It cannot load arbitrary modules or accept executable code. API authorization continues to derive the user from forwarded session credentials; client-provided Actors are replaced with the authenticated Actor for actor-based loaders. A database transaction is never divided between HTTP requests.

## Implementation and defaults

1. Capture the working source and baseline checks without overwriting existing work.
2. Build the standalone API, request-scoped auth/cache/navigation adapters and independent database ownership.
3. Move native contracts and split API (:3001) / web (:3000) origins. Mobile local runner starts API + Metro only.
4. Move backend bodies and dependencies while leaving typed web forwarding facades.
5. Move streaming/jobs, prepare Docker and strengthen architecture guards.
6. Run workspace checks, disposable DB invariants, standalone boot/HTTP tests and comparable process/resource measurements; document exact results and limitations.

Authenticated reads are uncached across requests. Role/settings memoization is request-local. Browser auth remains same-origin; native/browser sessions remain separate. Notification outbox durability and current schedule remain intact. Release clients require explicit API and web URLs. API startup never runs migrations or seeds automatically.

## Baseline and verification log

Before implementation the shared working tree had 319 changed/untracked paths (214 web, 69 mobile and other documentation/config changes). Existing source was captured outside the repository in `/tmp/atria-backend-source-baseline`; do not restore it wholesale over ongoing work. Initial workspace test output is `/tmp/atria-backend-baseline-tests.log`. Verification results and remaining work will be appended here as the migration progresses.

## Completed implementation and verification — 1 October 2026

All matrix rows are implemented. The API owns database/schema/migrations/operator tools, auth/RBAC, 21 existing native procedures, 268 allowlisted web compatibility operations, screen loaders, finance/material/project workflows, AI and notification jobs. Web implementation files are type/HTTP facades; generated contracts are declaration-only. API imports/dependencies exclude Next/React/web; web runtime excludes DB/backend/server-auth implementations. Pure money helpers and tool-output schemas are shared in core.

Both jobs are API-owned: 30-minute delivery fallback and nightly 00:00 WIB recovery. Web has no cron configuration. Raw chat/SSE, native tRPC and compatibility operations enforce active-session/temporary-password policy, with the existing developer simulation exception. The nonsecret switcher flag is retained in both presentation and API environments. AI provider cancellation follows the request and a 60-second deadline; aborted streams cannot launch fallback. Docker context excludes active/local backup environment files.

Final checks: **1,446 passed, 151 explicitly skipped Postgres integration tests, zero failures**. Workspace lint, API/web/mobile typechecks, API production bundle, Next production build and iOS/Android exports passed. All 170 original baseline test files are preserved exactly once. Graft was rebuilt successfully (1,594 indexed files). Task formatting and `git diff --check` passed; unrelated pre-existing formatting remains outside this migration.

The isolated PGlite HTTP case starts the real Hono transport and Better Auth/native tRPC with no Next process. It exercises cookie/bearer login; dashboard/project/expense/form reads; draft/submit/verify/pay; duplicate submission/payment protection; assigned-PM scope and forged-Actor rejection; inactive/temporary-password rejection including raw AI/SSE; and all six ledger/stock/audit invariants. Provider-mock tests exercise stream abort/deadline, preserved normal fallback and persistence. These tests never open the application's DATABASE_URL or call live AI providers.

[Performance evidence](../guide/backend-performance.md) reports a limited unauthenticated comparison (original API-only Next reconstruction using Webpack versus Hono/Bun): warm process-tree RSS 1,081.6 MiB versus 227.9 MiB. The report explicitly excludes real logged-in workload, full frontend/Metro and production claims.

No deployment, production migration or live database mutation was performed. Docker image execution is unverified because the local Docker daemon is unavailable. Dedicated live Postgres integration suites remain gated until a disposable Postgres target is supplied; the disposable PGlite HTTP and invariant checks above passed. Existing shared development servers were left running; stop old Next/Metro instances before starting `bun run dev:mobile` for the intended mobile-only resource footprint.
