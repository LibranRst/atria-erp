# Pilot loading and local disk — 4 October 2026

The user confirmed that login redirects eventually work, but authenticated navigation through `/` to onboarding feels slow. Measure server work separately from cached assets; keep authorization and onboarding gates intact.

## Measured baseline

- Authenticated production `/`: document TTFB **4,067 ms**, response complete **5,303 ms**.
- `/onboarding?step=welcome`: document TTFB **2,110 ms**; the loading skeleton was still visible at the recorded accessibility snapshot.
- Cached assets: mostly **23–35 ms**.
- API `/health`: **242–311 ms**; `/ready`: **500–1,253 ms**.
- Railway API is in US West; the pilot Neon database is already in Singapore. This is a verified placement mismatch, not a quantified attribution of all delay.
- Removing redundant generated copies reclaimed **4.704 GiB**. Actual free disk increased from approximately **3 GiB to 7.7 GiB**. Preserve source, credentials, and needed build/deployment evidence.

## Phase 1 — change one deployment variable

Move the **existing single API replica** to Singapore, which the current Trial UI offers. Keep its source, domain, environment, database, replica count, and volume configuration unchanged; do not create a second service or move the database.

After it is healthy, repeat `/health`, `/ready`, and the same authenticated browser navigation. Record warm runs separately from a first request and compare document TTFB, response completion, and visible loading duration. Retain the measured baseline; do not claim a regional improvement before comparison. If deployment or readiness fails, restore the previous region. Singapore availability after Trial remains a separate free-plan check.

## Phase 2 — small source changes, regression first

Only after phase 1 measurement:

1. Collapse the Home page's three serial calls (`requireServerSession`, `resolveActor`, `resolveHomeDestination`) into one authenticated navigation RPC. The existing `getPostLoginRedirectDestination` checks the server Actor, prioritizes forced password/onboarding gates, and maps `surface=mobile`. Home must pass no `returnTo`, preserving its default home behavior. Verify cookie-response handling when calling the existing facade from a Server Component.
2. Memoize the API's zero-argument session read within its existing `RequestContext`. The compatibility session gate and loader currently read the same session twice. Never share authentication/permissions across requests, introduce a TTL cache, or weaken fresh revocation/password checks. Retain an explicit fresh-read path for mutations that need updated session state. Existing role access already has request-local caching.

Use isolated behavioral regressions: count Home bridge requests while asserting anonymous, password, onboarding, normal home, and mobile destinations; count session reads within one request and prove a new request reads again after a changed/revoked session. Include any mutation fresh-read case identified by caller review. Run focused tests, typecheck, and lint before deploying; repeat the same timings afterward.

Welcome uses the current QuickStart loader, not the legacy eight-loader workspace. It skips financial/project payloads but awaits thirteen parallel organization-readiness reads. The welcome UI itself renders static guidance. A smaller welcome-state contract may be considered only if timings still justify it; keep Settings readiness truthful and preserve legacy onboarding-state interpretation.

No source change or extra cleanup is authorized by this document alone; region execution and subsequent patches remain coordinated in the active task.

## Phase 1 result

Railway applied only the region mapping changes: removed the SFO replica and added one `asia-southeast1-eqsg3a` replica. Deployment `7e0687e9-0a87-473c-b634-1088611936b4` became Active from unchanged source `753f6714`; the current account still displayed Trial with 30 days or US$4.99 remaining. No plan, credentials, domain, replica count, sleeping or resource limits changed.

Direct anonymous checks after rollout: `/health` 200 in 78–197 ms and `/ready` 200 in 81–88 ms across three runs each. Authenticated direct welcome navigation measured TTFB 856 ms, body complete 859 ms and browser document complete 968 ms; root-to-visible welcome measured 3,024 ms, with destination TTFB 1,098 ms. Pre-change direct welcome TTFB was 2,243 ms and complete 3,036 ms. These small samples demonstrate improvement in the measured warm workflow, not an SLA or cold-start result. Phase 2 still targets redundant Home bridge/session work.

## Phase 2 implementation and local checks

Home now calls the existing authenticated destination operation once, retaining anonymous, password/onboarding, project and native-surface behavior. The API session reader reuses the existing request-local cache primitive; explicit header reads stay uncached. A new request rechecks changed roles, temporary-password state and revoked sessions, including when the same Request object is reused. An independent caller/security review found no mutation requiring a post-write zero-argument reread.

Regression-first results: old Home produced three serial bridge calls; seven destination scenarios now produce one. Old session reads produced four sequential, three concurrent or three anonymous lookups; all now produce one per request. Eight API regressions and twenty related web/HTTP tests passed after final formatting. API, web and mobile typechecks, workspace lint and production API/Netlify web builds passed. Edited files pass targeted Prettier; the full workspace formatting check still reports historical drift outside this patch and was not auto-rewritten.

The first workspace lint run traversed generated Netlify provider bundles and failed; web global ignores now exclude `.netlify/**`, and the repeated source lint passed. No UI primitive or styling was added; existing server navigation and request-cache contracts are reused. Hosted timings after publishing remain the final verification step.

## Integration fixture boundary correction

The first source CI passed the safe suites/typechecks but failed thirteen assertions across three PostgreSQL finance suites. Those workflow tests changed mocked users inside one `withTestRequest`; a real HTTP action receives a new request context. An isolated regression through the actual public receipt action reproduced `[Owner, Owner]` instead of `[Owner, PM]` under that fixture pattern. Wrapping each public action invocation with the existing `withTestRequest` fixes the test boundary; internal domain calls, transactions, guards and every business assertion remain unchanged. The isolated suite now passes nine cases, including the action-boundary regression.

The PostgreSQL operator now adds bounded failure labels, scalar assertions and test-frame locations to its existing results JSON when a suite fails. Known credential values are redacted; raw request/DB/provider payloads are excluded. Three Python regressions cover redaction, payload exclusion and output limits. The full disposable PostgreSQL CI rerun remains the release gate for the API memoization; production continued on its prior verified API release while that gate failed. The published web artifact is `6ac25e081377cb4f761147ff` from runtime source `d7389afe` and passed twenty-two anonymous deployed checks.
