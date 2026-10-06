# Notification release with existing boss data

## Current request and release boundary

The user requests a new Netlify frontend URL for another boss test, including
the notification fixes and preserving all data previously entered in the
existing production app. This explicitly authorizes planning a release against
the existing production API/database; it supersedes the earlier QA-only release
constraint for this request. Keep the isolated QA app/database separate.

Start from reviewed notification release `ba1780ad`, whose two notification
commits follow the existing production source `c8b1a7fd`. The diff contains no
database migrations or schema change. Do not release the dirty development
checkout, standalone admin work, Render-specific configuration, or unrelated
local adjustments as part of this notification release.

## Observed hosting state on 6 October 2026

- Existing Netlify owner/team: `dekoria-office`; production project
  `atria-dekoria`, QA project `atria-verification`.
- Dashboard reports operational credits: published sites remain live, while
  production deployments are paused. The displayed billing period is
  4 October–3 November. No paid plan or recharge is authorized.
- A different hosting account has not been created or selected by this task.
  The human must identify its owner and complete account agreement/login.
  Do not automate duplicate account creation. Account access, GitHub grants and
  transfer of the server-only bridge credential are separate access boundaries.

## Data preservation

Use the existing production Railway API and its unchanged Neon connection,
auth signing secret, tenant and storage configuration. Copying a frontend does
not copy or reset a database. Existing users log in with their existing Atria
accounts; cookies and PWA installations are scoped to their respective origins.
Never use the synthetic QA API/database for the boss's existing data.

Before publishing, make a backup through the existing approved backup workflow
and record its completion. Verify database identity privately before and after
the API deployment. Do not reset, provision, seed, import, delete or restore
over the existing database. Do not create test finance/stock mutations in it.

## Coordinated frontend and API release

1. Verify the exact release commit and existing CI acceptance. Keep release
   branches separate from QA and development; no push to an auto-deploy branch
   until its target service and release settings are reviewed.
2. Build only the web frontend on Netlify using root build context, package
   `apps/web`, publish `apps/web/.next`, and the existing `netlify.toml` command.
   The frontend receives the main API origin, server-only bridge credential,
   actual frontend URL and existing public configuration. Private DB, VAPID,
   storage and AI credentials stay in the API.
3. Review production API deployment/configuration before releasing the matching
   notification backend. Preserve current production VAPID keys if configured;
   do not reuse QA keys or rotate existing keys merely for a new frontend.
4. Add the exact new HTTPS origin to authentication and upload CORS. Preserve
   necessary old-origin compatibility. Current release permits only WEB_ORIGIN
   and API_PUBLIC_URL for upload CORS and private attachment reference parsing:
   changing WEB_ORIGIN alone can reject stored old-origin references. Resolve
   and test explicit old/new reference compatibility before cutover. Do not
   use wildcard origins or rewrite/delete stored attachment records.
5. Publish without the Netlify badge, retaining the normal Atria login and
   permissions. Avoid creating needless production rebuilds; keep automated
   deployment and preview credentials explicitly scoped to approved releases.
6. Smoke-test anonymous auth gates, manifest/icons/worker, actual API transport,
   existing project/finance/material reads and an authorized existing private
   attachment. Record failures separately from successful login.
7. The boss reinstalls the new URL and explicitly opts into notifications on
   their physical device. Verify background reception, intended navigation and
   automatic read status using the per-session test or an agreed business event.
   Do not generate unsolicited bulk pushes or finance/stock mutations.

## Acceptance and rollback

Success requires a published exact-commit frontend, compatible production API,
unchanged database identity and existing data visible through the same Atria
accounts. Android notification acceptance on QA does not prove the new domain
or a physical iPhone works. A new origin needs its own device subscription.

Keep the original deployment and recorded API origin configuration for rollback.
Application rollback does not restore a database or delete newly entered data.
No final production release has been performed by this preparation task.

## Compatibility implementation

Explicit `WEB_ADDITIONAL_ORIGINS` is parsed as a bounded list of exact origins.
API authentication, upload CORS and private-reference reads share this allowlist.
The original WEB_ORIGIN can remain as the stable storage reference origin.
Web HTTP DTOs and authenticated upload results rebase only valid private UUID
references to the new frontend proxy, preserving its same-origin session.
Stored database references remain unchanged. Submitted expense proofs remain
protected from draft cleanup across every configured origin.

## Release verification on 6 October

- Production backup GitHub run `37408047374` completed successfully before any
  hosted API or database configuration was changed. The main Railway database
  is still `atria_pilot`; its bridge matches the original frontend.
- Local checks: core 323, API 370, web 862, mobile 105 and operator tests 6
  passed (164 API integration tests skipped without disposable PostgreSQL).
  API/web typechecks, workspace lint and API/web production builds passed.
- CI `37408356000` passed disposable PostgreSQL integration but rejected the
  newly reviewed source-map-js advisory GHSA-68fv-2mgg-jv7q (reviewed 5 October).
  Patch only source-map-js 1.2.1 → 1.2.2 through the root override and lockfile.
  Production classification now passes the unchanged high-severity gate; the
  inherited moderate uuid advisory is not an assertion of exploitability.
- Netlify account session is now the human-authorized new account; the import
  form targets team `atria-team`, source `codex/notifications-production`,
  Next.js `apps/web`, name `atria-dekoria-app` (availability confirmed).
  Selecting Next.js sets UI base to apps/web; root netlify.toml overrides the
  effective base/build/publish configuration. Verify those resolved build logs.
- The bridge field is still empty. New-account credential transfer, exact new
  origin trust and production VAPID installation await the Browser confirmation
  at their access boundary. No public application was deployed by preparation.
