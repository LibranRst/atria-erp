# CI and Paduna production rollout

## Authorized scope

Commit and push only the CI changes, their required testing dependencies, and the separately requested Paduna web branding rollout. Preserve unrelated local app/mobile work. Verify GitHub Actions until all tests pass. Update the existing Netlify production app, and use the user-selected free Netlify hostname `paduna-dekoria-app.netlify.app` if available, preserving production data and trusted-origin/auth functionality.

## Isolation

The active checkout contains extensive unrelated changes and predates the latest production branch. Work in a separate branch/checkout based on verified production source `8d64cf128dd08fc7d61d239882fd3ae736682cbc`. Commit CI and branding separately. Do not reset/stash or stage the user's working checkout.

## Steps

1. Verify live Netlify/API identities, current deployment/source, hostname availability, credentials and rollback reference using read-only metadata.
2. Apply the new CI workflow, isolated integration wrapper plus actual preparation/runner dependency deltas, root script and regression test/docs. Frozen install/test from this checkout; push and monitor Actions, fix only attributable failures.
3. Port display-branding/assets/metadata and PWA-compatible updates without unrelated desktop redesigns, native identifiers, backend business logic or migrations. Verify production build and anonymous browser/asset/auth gates.
4. Publish the exact tested web revision to the existing site. Retain API/database/secrets and hosting preferences. For hostname change, update only required public web/trusted origins, preserve old-origin compatibility where supported, and verify CORS/login routing. Do not buy a domain or change billing.
5. Record exact commit/run/deploy URLs, preservation and rollback evidence; distinguish public/read-only smoke from authenticated business actions.

## Safety

No development or production reset/seed, business mutation, schema migration, database restore or secret rotation is authorized or needed for this rollout. CI receives disposable PostgreSQL only. Production login/session/auth origins require consistent configuration before completing a hostname change.

## Source verification and CI finding

- CI commit `bb11c664` includes only 11 CI/orchestration/documentation files, on top of the previously shipped source. [Actions 39050071484](https://github.com/LibranRst/atria-erp/actions/runs/39050071484) passed both jobs: 58 integration suites, 478 pass, 0 fail, 0 skip. Workspace tests and safety/type/lint/security/API/web-build checks passed.
- Branding is separate commit `e9cf7b26`: approved display assets, metadata/PWA and product copy only. No API runtime, schema, financial/material formula, native identifier or later local desktop redesign is included. Frozen install, web TypeScript/lint/production build and seven login viewport captures (320/360/390/430/1024/1280/1440px) pass; no horizontal overflow, exact SVG and public asset/manifest/worker checks pass.
- [Actions 39050867975](https://github.com/LibranRst/atria-erp/actions/runs/39050867975) passed quality but exposed a scheduling-dependent assertion in the pre-existing expense batch integration test. Manual submission legitimately returns the AI-created group idempotently; counting successful responses as exactly one falsely failed. A controlled AI-first replay reproduced the old assertion 3/3 times (expected one response, received two).
- The test correction checks one persisted group, exactly two cost rows and matching receipt/row IDs for every successful response. Added explicit AI-first/manual-first cases pass alongside the controlled race in three disposable clones (9 pass, 0 fail, 0 skip). Application transaction code is unchanged. Both diagnostic containers verified cleanup; the longer exploratory run was deliberately interrupted and cleaned up, not reported as successful coverage.
- User explicitly approved fast-forwarding GitHub `development` to the tested production base plus CI/branding. No force push or primary-checkout reset is permitted. Netlify site ID remains `6d79424c-4b7b-45ea-be7c-3394b9dd71cd`; rollback deploy `6acf56d7707354c65b780f55` / source `8d64cf12` is retained.

Hosted rollout IDs, final Actions status and timestamped smoke evidence are recorded in `output/qa/paduna-production-2026-10-17/rollout-evidence.json` and the final handoff after publication. This file records the accepted rollout procedure; it does not claim production business transactions were performed.

## Completed publication — 18 October 2026

- Final application source: `6cf502418c738622cb9ecd81f1bbcd1c366edcbe`. [Candidate Actions 39051765382](https://github.com/LibranRst/atria-erp/actions/runs/39051765382) and [development Actions 39052457815](https://github.com/LibranRst/atria-erp/actions/runs/39052457815) passed quality and PostgreSQL integration. Integration: 58 suites, 480 pass, 0 fail, 0 skip; all suite coverage markers complete. Normal unit mode skips these database cases deliberately, then the isolated job executes them.
- `origin/development` fast-forwarded from `99e3bbf7` to the tested source without force or primary-checkout/index reset. New commits are separated into CI (`bb11c664`), branding (`e9cf7b26`) and the verified race-test correction (`6cf50241`). No unrelated local desktop/mobile/core/runtime changes were published. The primary checkout retains its WIP; only the bounded race-test correction was also applied there.
- Netlify `6ad3abefdaf738826f268b93` is published, with the explicit source-commit link verified. Build/deploy: 84 seconds. Existing site ID preserved; new project/subdomain `paduna-dekoria-app.netlify.app`; no domain purchased or paid plan changed. Production branch is development. Build status restored to Stopped; branch/PR previews remain disabled.
- Railway `adcc3037-db1e-48c8-ac28-c0d679c00437` is ACTIVE on existing runtime source. The reviewed provider diff contained exactly one variable: WEB_ORIGIN from the older frontend URL to `https://paduna-dekoria-app.netlify.app`. Existing API URL, NEXT_PUBLIC_APP_URL compatibility origin, database, tenant, auth/bridge/provider secrets and service sizing were retained.
- Live smoke: 29/29 checks pass for public branding/PWA assets, exact SVG bytes, route guards, session/auth bridge, API health/readiness, private SSE/bridge denial and trusted/foreign origins. Browser login captures at 320/360/390/430/1024/1280/1440px all load the approved 176px logo with no document overflow. No authenticated business mutation, account creation or production data seed/reset/restore was performed.
- Timestamped sanitized evidence: `output/qa/paduna-production-2026-10-17/rollout-evidence.json`, `hosted-smoke.json`, `production-responsive-login.json` and screenshots. Raw diagnostic logs remain private/ignored. The former Netlify hostname has no automatic redirect; existing bookmarks/PWA installations must move to the approved new origin.

Rollback: keep the existing Netlify deployment `6acf56d7707354c65b780f55` and source `8d64cf12`. Restore the previous project name/public origins and republish that artifact if application rollback is needed. Railway marks superseded deployments REMOVED, so restore the retained source plus prior WEB_ORIGIN instead of assuming the old instance can be reused. Never reset or restore business data for this branding rollback.

A documentation-only follow-up records this publication; its CI does not change the deployed application revision.
