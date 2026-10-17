# Paduna Build production web

The production candidate is based on the existing shipped API/web source, with CI/test orchestration and web branding in separate commits. Unrelated desktop/editor/mobile work in the primary checkout is excluded.

Approved hostname: `https://paduna-dekoria-app.netlify.app`. This is a free Netlify subdomain; no domain purchase or billing change is included. Existing site ID, API, database, tenant, accounts, signing secrets and private storage stay unchanged. Before renaming, add the new frontend to API trusted origins using the existing WEB_ORIGIN configuration. Keep the API NEXT_PUBLIC_APP_URL at the previous origin for old-origin auth/media compatibility, and set Netlify NEXT_PUBLIC_APP_URL to the new public web URL.

Netlify project rename changes its default URL; the old Netlify hostname does not automatically redirect. Existing users need to sign in and install/enable notifications on the new origin. The current site and its retained published deployment are the rollback targets; restore the old project name and public origins when reverting. Do not restore or reset database contents for an application rollback.

The candidate reuses the existing ProductLogo/Next Image wrapper, Button, FormSection, FormField, TextInput, shared shell, navigation, feedback and PWA owners. It carries only approved SVG/icon/share assets, visible product copy and metadata. RAB tenant/company identity and internal runtime names remain compatible.

Final commit, Actions and deployment evidence is recorded in `docs/plans/2026-10-17-ci-paduna-production-rollout.md` after verification. Anonymous/public smoke does not imply authenticated financial transactions have been tested against production.
