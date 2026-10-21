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

The broad CI guard correctly flagged the new snapshot because only the historical-report reader had a named transaction exception. Extend that exact-path exception to `project-tools.ts` with the same TypeScript AST verification: exactly one transaction, literal `repeatable read` plus `read only`, no dynamic configuration or ordinary transaction. All direct/transaction insert, update, delete and raw-execute bans remain active and are exercised for both named readers. The database also enforces read-only mode. This does not grant model write authority.

## Verified candidate and initial hosted coverage

Runtime source: `056ed79f6ff8c7d1e505b463e4eb79f9fc299345`; exact candidate CI [39066911189](https://github.com/LibranRst/atria-erp/actions/runs/39066911189) is green. It contains 2,774 passing workspace tests and 481 passing PostgreSQL integration cases across 58 suites, with zero integration skips. Production migration journal continuity is exact across all 49 hashes. The fresh private backup workflow [39059594848](https://github.com/LibranRst/atria-erp/actions/runs/39059594848) completed before publication.

Hosted desktop navigation, the six Dashboard tabs, table select/unselect, tab cache retention, notification dismissal, profile controls, nested modal/select ownership and a focused form across resize passed. Desktop widths 1024/1280/1440 and mobile 320/360/390/430 plus the native-pinned fallback were checked without horizontal overflow. Existing shared desktop tables, form/selection controls, overlays, navigation and motion owners are reused. No new UI primitive is introduced by this release follow-up.

Production project workflow gates were respected: the current RAP baseline is locked and RAB has no estimate. No draft estimate, approved baseline, financial payment, stock movement or administrative grant was created for testing. Synthetic PNG and one-page PDF analysis returned the correct vendor, date, quantities, prices and total and restored completed replies after reload. One PDF stream initially remained incomplete; its retry completed. The existing stop predicate already rejects follow-up-only turns, so the unproven early-stop hypothesis did not justify a code change.

A mid-rollout comparison finds exact hashes for all 66 non-chat/upload tables, including accounts, credential rows, role grants, tenant, projects, budgets, ledger and stock. Expected differences in the other four tables belong only to the dedicated dev Owner's synthetic AI conversations/messages, private uploads and upload audit entries. Final deployment IDs and post-acceptance fingerprints are recorded after the final hosted pass.

## Corrected aggregate retry evidence

A real hosted replay correctly read two projects and the account balance, but retained an earlier project-count validation failure after a successful retry. The invalid first call requested `limit: 100` and carried `_introduction`; the valid retry requested `limit: 20`. Presentation-only introduction metadata made the two aggregate lookup keys differ. Red tests reproduce both the factual renderer and the actual SDK publication/persistence path before the fix. Ignore that metadata when comparing read identity, retaining every business filter and target; preview size is already excluded only for authoritative project totals.

The activity presenter separately recognizes only an oversized unfiltered project-preview retry followed by a validated aggregate. It does not recover access denials, filtered/different targets, incomplete legacy previews, inconsistent counts or later failures. Regression tests cover these limits. The original failure remains available in the persisted tool history; only the final recovery classification changes.

## Bound factual cards to verified scope

The hosted unknown-bank test found a separate presentation leak: final text correctly refused an unknown bank, but a successful broad balance-read card still displayed the company total. Four actual ChatMessage render regressions reproduce unsupported waiting/partial/verified source cases and a named-account subset before the fix. Reuse the existing card-aware answer projection and result renderer owners: final factual cards require the same tool-call source, and a company-total bank card requires the complete verified account set. A narrower account answer keeps its complete canonical text instead of recomputing finance amounts in the UI. Legacy/advisory cards and human project-choice candidates retain their established contracts; activity/errors remain visible. No authorization or business mutation changes.

## Completed hosted publication

- Runtime commit: `cf3963cbd6298971fe971633a4008a797074a888`. Exact candidate [CI 39069395447](https://github.com/LibranRst/atria-erp/actions/runs/39069395447) passes 2,782 workspace cases, 481 PostgreSQL integration cases (58 suites, no skips), types, lint, format/style/token/security checks and API/web builds. Superseded intermediate runs are retained as diagnostic history.
- Existing API: Railway `1a35f69c-00b6-4f4e-b440-db51dd1726e7`, ACTIVE with health/readiness 200. Existing web: Netlify `6ad3e69f0841839deb0cdaaf`, Published at the same runtime commit. Default and API source branches were fast-forwarded atomically after the candidate passed. Build preference is restored to Stopped; preview/branch restrictions are unchanged.
- Final hosted reproduction completes both requested read domains and persists the answer. Unknown-bank history displays its explicit unresolved state without the unrelated company-total card. PNG/PDF readings, document follow-up context, proposal preview and nested unit selection/cancellation work. Final Dashboard opens without alerts or horizontal overflow. Public/anonymous smoke passes all 33 checks; private synthetic attachment access is 401/no-store for anonymous requests.
- Every original account, credential, grant, tenant and business row is preserved; all 49 migration rows remain byte-identical. The final 70-table fingerprint comparison has 64 fully unchanged tables. The other six tables contain only the dev Owner’s added conversations/messages, two uploads and upload audit entries, one unconsumed synthetic MATERIAL_MASTER_IMPORT draft and its completed analysis job. Original rows in those tables remain identical; the draft/analysis tables were initially empty. There are no new Material Master rows, business confirmations or stock/cash movements. Retain this owned QA metadata without deleting production rows.
- Source hotfixes and operator docs were backported to the primary checkout only after prior-content equality checks; its index and unrelated local work are preserved. Native distribution, installed-device push/offline testing and production financial mutations remain outside the hosted acceptance scope. Existing gated production projects were not advanced for testing.

Sanitized detailed evidence is kept in `output/qa/local-parity-release-2026-10-18/` (ignored by Git), including runtime CI logs, before/after fingerprints, ownership proof, media/AI/UI checks and the final public Dashboard screenshot. The production guide records compatible application rollback IDs. Post-publication documentation changes are separate from the tested/runtime commit.
