# Render frontend QA trial

## Objective and boundaries

Run the notification-enabled Atria frontend on Render Free for a one-month
internal evaluation. Use the existing synthetic QA API and database. The pilot
frontend, API, database, credentials, worker and source branch stay untouched.
No reset, migration, reseed, finance or stock mutation is part of this work.

Start from notification release `ba1780ad` on `codex/render-qa-frontend`.
Do not push this configuration to the Netlify-linked notification branch.

## Deployment configuration

- Reproducible frontend-only configuration lives in `render-frontend-qa.yaml`.
  Preserve the existing root `render.yaml` API blueprint exactly.
- Render workspace: Dekoria's workspace; service: `atria-dekoria` (user-requested
  product name). It still points to the isolated synthetic QA API/database.
- Free web service, native Node runtime, Singapore region, one instance.
- Repository root remains the build root because web imports workspace packages
  and generates declaration-only API contracts.
- Pin Bun 1.3.14 and Node 22.23.2 to the locally verified runtimes.
- Install from the frozen lockfile, verify generated shared styles, and build
  `@atria/web` only. Never invoke the root all-app build or a database script.
- Run `next start` with `0.0.0.0` and Render's `PORT`, not the development server.
- Use `/manifest.webmanifest` as a cheap frontend HTTP readiness check. Login
  also renders the API-backed application shell; it is not a cheap isolated
  liveness probe. Manifest readiness does not assert backend/database readiness.
- Disable automatic deploys during this trial. No artificial keep-alive traffic.
- Server-only `API_ORIGIN` points to
  `https://atria-verification-api-production.up.railway.app`.
- Server-only `API_BRIDGE_SECRET` must match the QA API. The dashboard transfer
  requires the Browser sensitive-data confirmation before entering its value.
- Both build and start derive `NEXT_PUBLIC_APP_URL` from Render's documented
  `RENDER_EXTERNAL_URL`, avoiding a guessed hostname or extra rebuild after
  Render assigns its actual new HTTPS origin.
- Database, auth signing, VAPID private key and provider secrets stay in the API.

## API origin cutover

After Render assigns its actual HTTPS origin, configure only the QA API's
frontend origin so authentication and direct upload CORS accept the new host.
Record the existing nonsecret origin values first for rollback. Keep the QA
API public URL, database, auth/bridge/VAPID credentials and worker destination.
Use an existing additional Better Auth origin field to retain the old QA login
origin if possible. Never widen origins to a wildcard.

Private attachment references are absolute and currently allow `WEB_ORIGIN`
plus `API_PUBLIC_URL`. Inspect/test existing QA references before declaring
attachment migration complete. Do not rewrite stored references or delete
attachments to make a test pass. If legacy QA-host references need compatibility,
implement explicit additive origin support separately and verify its access
controls before deploying the API change.

## Verification

1. Validate deployment YAML, run web typecheck/lint, and build in production with
   an invalid dummy API origin so local verification cannot contact a database.
2. Start that exact production output locally and verify the login page, manifest,
   worker response/security headers, and responsive app assets in Browser.
3. Verify the Render dashboard selected Free, Singapore, the isolated branch,
   full production build/start commands, pinned runtimes and correct QA API.
4. Obtain the required Browser confirmation at the secret/origin access boundary;
   then deploy and verify the exact published commit.
5. Exercise QA login, scoped project reads, profile, authenticated action transport,
   notification SSE, manifest/worker availability and private media permissions.
6. Measure a small number of warm page/API requests and observe error/memory logs.
   Avoid load testing or repeated finance mutations.
7. Observe one genuine idle/sleep/wake cycle without keep-alives; distinguish warm
   response time from Render cold-start delay.
8. Ask the user to install the new URL, login and opt in again on the physical
   device; verify background push, destination navigation and automatic read.

## Performance limits and rollback

Free currently supplies 0.1 CPU/512 MB and sleeps after 15 minutes idle. A first
request may take about one minute to wake it. Performance is measured, not
guaranteed. Push delivery remains on Railway, but tray navigation can wait for
the frontend to wake. Resource, bandwidth and build limits still apply.

Rollback restores the recorded QA API frontend origin and uses the already
published Netlify QA build. Do not create a new Netlify production deploy merely
to roll back. No pilot state participates in rollback.

## Progress

- Source/release boundary verified; Render already has access to the Atria repo.
- Existing pilot and Netlify-linked branches preserved.
- Deployment and runtime verification pending.
- Web typecheck, all-workspace lint and isolated production build passed. The
  production process started in 108 ms locally. With the intentionally invalid
  API, login correctly cannot render its API-backed shell; use real QA transport
  for the later hosted login check, not a fabricated backend response.
- Local production manifest and notification worker both returned 200, `nosniff`
  and revalidation headers. Worker scope `/` and tray-read marker were verified.
- Preparation commit `6a72ceb46a7a17edd995550043ec290af26fb88e` is pushed only to
  `codex/render-qa-frontend`. The API blueprint and all application code are
  unchanged by this preparation commit. Local smoke-test server was stopped.
- User approved storing the QA bridge secret at Render, updating the QA frontend
  origin and deploying. They requested the frontend service name `atria-dekoria`.
  The product-name change does not authorize connecting or modifying pilot data.
