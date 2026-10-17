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
