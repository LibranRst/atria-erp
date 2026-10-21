# Push/PR CI with isolated database coverage

## Objective

Run the complete workspace unit/regression suite and the proven PostgreSQL integration command automatically on every branch push and pull request. Keep the existing workflow name and quality/postgres-integration job identities, read-only permissions and production/backup workflows intact. CI must not receive development/production database or application/provider credentials.

## Findings and implementation

- The current local workflow is untracked, limits push to development/main and tests only core/API/web in its quality job.
- Its integration job already uses a disposable service plus per-file clones, but duplicates setup rather than using the newly verified root command and omits the new orchestration safety tests.
- Remove push branch filters; retain ordinary pull_request and manual dispatch. Never use pull_request_target, application environment bindings, cloud login or production secrets for these jobs.
- Use root bun run test for every workspace and repository-script unit test; install locked Playwright Chromium plus system dependencies first so the six browser-backed fixture tests execute. Run existing backup/discovery and new isolated-orchestrator Python regressions.
- Use root bun run test:integration in the PostgreSQL job. It owns a fresh loopback Docker container, new storage/credentials, synthetic templates and a clone per suite, fails on skips/incomplete coverage, and verifies cleanup/source/config stability.
- Publish only sanitized per-suite results JSON on completion/failure, without raw logs. Preserve stable job IDs and ordinary failure propagation.
- Add a parsed workflow contract regression for triggers, comprehensive test commands, no credentials/dev DB injection, supported hosted runner and safe artifact scope. Validate YAML/actions syntax and run applicable tests locally.

## Remote boundary

Inspect remote workflow status read-only if authentication is available. Do not publish unrelated working-tree changes or alter repository rules. Local workflow changes activate on GitHub when their implementation and dependencies are committed/pushed. A local validation is not a claim that a remote Actions run has passed.

## Verification

- Complete workspace unit/regression command: 2,749 pass, 0 fail, 566 skip before Chromium installation. The 560 database skips are exercised by the separate integration job; six browser-backed tests were skipped only because Chromium was absent locally.
- After installing the locked Playwright Chromium runtime: all six browser fixture tests plus all six final workflow contracts pass (12 pass, 0 fail, 179 assertions). These synthetic HTML/CSS fixtures do not touch browser profiles, sessions, or application data.
- The parsed workflow contracts caught the original gaps (5 failing contracts) and the absent Chromium installation step (one additional failing contract) before their corresponding fixes.
- Python safety regressions: backup pilot 6 pass, backup production 6 pass, integration orchestrator 18 pass, per-suite local PostgreSQL runner 16 pass.
- The unchanged integration command already has real PostgreSQL evidence from the preceding database-isolation task: 58 suites, 478 pass, 0 fail, 0 skip. This includes all 472 named integration cases and six mixed-file unit tests; the old 560 skip figure also counted 88 hook placeholders. The source/environment fingerprints remained unchanged and the owned container was removed. CI now calls this exact command.
- Final workflow syntax: actionlint 1.7.12, official release archive SHA256 verified, exit 0. Web TypeScript and repository-wide Prettier checks pass. Independent read-only review found no actionable CI defect; checkout action SHA resolves to v4. Full workspace lint passes with exit 0; Graft refresh completed successfully (2,661 files).

Status: CI implementation is pushed as bb11c664; remote Actions 39050071484 passed quality and all 58 PostgreSQL integration suites. The follow-on branding/race-assertion/default-branch rollout is tracked in 2026-10-17-ci-paduna-production-rollout.md. Required-check/branch-protection settings are not changed.
