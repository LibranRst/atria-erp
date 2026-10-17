# Publish current local Paduna web and API safely

## User-authorized scope

Publish the latest product source from the local workspace to the existing public Paduna domain, including the desktop redesign and supporting API/shared contracts. Push the reviewed source and test the hosted features, especially AI. Preserve every existing production account (including the dedicated dev Owner), credential, tenant and business record. Native application distribution is outside this web release.

## Candidate preparation

1. Capture a fixed local source inventory without changing the primary checkout/index. Base an isolated candidate on the verified live `2f9f2e1a` release.
2. Include current product source, required shared/native workspace dependencies, lockfile, tests, public assets and maintained documentation. Exclude local environment files, credentials, private notes, QA output, caches, generated native/build artifacts and personal IDE configuration.
3. Merge the local snapshot against the live source rather than blindly overwriting production fixes. Explicitly retain Paduna private-attachment legacy-origin compatibility, current CI/database isolation, bootstrap/staff membership and AI response-completion fixes.

## Production safety gate

- Verify the exact existing Netlify site, Railway API, production Neon database and rollback source/deployments. Retain domains, signing/bridge/storage/job/provider secrets, tenant, auth policies, hosting/billing and manual build/preview preferences.
- Complete and verify a fresh recoverable production backup before any migration or deployment. Compare migration journal entries and hashes with the candidate; preserve continuity. If any additions are needed, rehearse only those additions against an isolated private restore/branch and verify protected data before applying guarded additive migrations.
- Capture sanitized production table/account/credential fingerprints before and after rollout. Separate expected user sessions, AI chat/audit history and concurrent human activity from protected finance/material/account data. Never seed, reset, provision or restore over production.

## Validation and rollout

Run frozen installation, workspace unit tests, isolated Postgres integration suites, TypeScript, lint, formatting, shared style/token/security checks and API/web builds. Validate Linux API packaging and the updated web's transport requirements. Push an isolated candidate branch and wait for the exact GitHub Actions revision to pass before production rollforward.

Deploy a compatible API first when required, wait for readiness, then publish the matching Netlify web revision. Verify exact deployed commits and retain compatible application rollback targets. Fast-forward the production/default source branches only after the candidate passes, preserving unrelated local work.

## Hosted acceptance

Use the already signed-in dedicated dev Owner; never reset a personal Owner password. Check desktop Dashboard, Projects/Budget/RAP/RAB/Stock/Expenses/Payments/Margin, Expenses, Approvals, Reconciliation, Materials, Settings and Profile with read-only navigation, filters, tab retention and modal/nested selection controls. Check representative desktop and mobile widths and capture a bounded evidence pass.

Test AI streaming/completion/persistence, grounded read-only tools, error recovery and supported synthetic file/OCR/document previews through the public Netlify origin and existing approved API provider. Prefer synthetic content. Do not confirm finance/stock/administration proposals or create test business rows in production. Exercise mutation/domain invariants against isolated fixtures instead. Report exact passed coverage and any untested production actions honestly.

Completion requires a live matching release, verified account/data preservation, passing CI, hosted UI/AI evidence and documented rollback—not merely an anonymous health response.

## Hosted AI regression discovered during acceptance

The first candidate is live and its three CI runs pass. Public chat streaming works, but a fresh mixed project-count/current-balance question repeatedly ends with read cards and a procedural introduction, without a final answer or persisted assistant message. Read-only database inspection confirms that the final text was never stored; this is not merely the old rendering-after-reload symptom.

Two deterministic regressions now reproduce current-balance parsing: `saldo rekening saat ini` and `saldo total rekening yang tercatat saat ini` are incorrectly treated as an ambiguous/named account target. Existing invalid-input/retry SDK replay still publishes and persists a partial response, so a stale validation error alone does not explain the hosted failure. Preserve all permission, account identity, pagination and exact-money guards while fixing natural-language scope recognition.

The follow-up must also avoid treating a bank-only result as complete coverage of a requested project count, and must expose interrupted responses as incomplete rather than accepting a useful read card as proof of a terminal stream. Add red-before-green regressions at the factual renderer and actual SDK/UI stream seams. Re-run targeted tests, relevant broad checks and hosted reproduction before a follow-up release. No finance/material/account data repair or authorization widening is part of this fix.
