# Paduna Build production web

The production candidate is based on the existing shipped API/web source, with CI/test orchestration and web branding in separate commits. Unrelated desktop/editor/mobile work in the primary checkout is excluded.

Approved hostname: `https://paduna-dekoria-app.netlify.app`. This is a free Netlify subdomain; no domain purchase or billing change is included. Existing site ID, API, database, tenant, accounts, signing secrets and private storage stay unchanged. Before renaming, add the new frontend to API trusted origins using the existing WEB_ORIGIN configuration. Keep the API NEXT_PUBLIC_APP_URL at the previous origin for old-origin auth/media compatibility, and set Netlify NEXT_PUBLIC_APP_URL to the new public web URL.

Netlify project rename changes its default URL; the old Netlify hostname does not automatically redirect. Existing users need to sign in and install/enable notifications on the new origin. The current site and its retained published deployment are the rollback targets; restore the old project name and public origins when reverting. Do not restore or reset database contents for an application rollback.

The candidate reuses the existing ProductLogo/Next Image wrapper, Button, FormSection, FormField, TextInput, shared shell, navigation, feedback and PWA owners. It carries only approved SVG/icon/share assets, visible product copy and metadata. RAB tenant/company identity and internal runtime names remain compatible.

Final commit, Actions and deployment evidence is recorded in `docs/plans/2026-10-17-ci-paduna-production-rollout.md` after verification. Anonymous/public smoke does not imply authenticated financial transactions have been tested against production.

## Verified publication — 18 October 2026

Production: [Paduna Build](https://paduna-dekoria-app.netlify.app). Netlify deployment `6ad3abefdaf738826f268b93` publishes application commit `6cf502418c738622cb9ecd81f1bbcd1c366edcbe`; build/deploy completed in 84 seconds. Site ID is unchanged. Production branch is now `development`, build status is restored to Stopped, and previews remain disabled. GitHub Actions still runs on every push and PR; it does not automatically publish the site.

Railway deployment `adcc3037-db1e-48c8-ac28-c0d679c00437` is ACTIVE on the retained API source. Only WEB_ORIGIN changed to the new frontend URL. Twenty-nine live public/anonymous checks passed, including new-origin CORS and auth validation, foreign-origin rejection, private bridge/SSE denial and database readiness. Seven login widths pass without horizontal overflow. No ordinary production account, private attachment, notification delivery, installed-device PWA or business transaction was exercised by this rollout smoke.

The worker is served at the origin root with must-revalidate. Netlify omits the redundant Service-Worker-Allowed response header; root scope remains valid because the script itself is `/notification-sw.js`, per the [Service Worker update algorithm](https://w3c.github.io/ServiceWorker/spec/service_worker/#update-algorithm). This is asset/scope-policy verification, not a claim of a production push/offline-device test.
