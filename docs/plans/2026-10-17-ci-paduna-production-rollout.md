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

Status: plan saved before candidate modifications; metadata/preflight in progress.
