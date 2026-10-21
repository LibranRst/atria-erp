# Isolated PostgreSQL integration test setup

## Goal and safety boundary

Provision a dedicated local PostgreSQL test service and run all previously skipped database integration coverage, preserving development data, credentials and app sessions. Reuse the repository's disposable preparation, local TCP test preload and per-suite clone runner. Do not reset, seed, migrate or connect test processes to the application's development database; do not rewrite app env files or change dev ports3001/3004.

## Approach

1. Inventory every seeded, empty and special development-seed integration guard. Check fail-closed discovery against newer test files before connecting a database.
2. Start the installed container engine if needed, then create a new test-only container with independent storage, generated credentials, an ownership label and a loopback-only unused port. Never reuse an existing app database/container or mount its data.
3. Keep test credentials in an ignored restrictive local file, outside application env files. Assert that the test endpoint differs from every configured dev endpoint and persist only redacted metadata/env hashes in QA evidence.
4. Prepare fresh synthetic seeded and empty templates through the existing guarded migration operator. Run each suite against its own generated clone, with both DB selectors replaced and dotenv auto-loading disabled. Explicit mutations and destructive fixtures are restricted to those clones, which the runner removes after each suite.
5. Record exact discovered test coverage, passed/failed/skipped results and failures. Fix verified harness/fixture or product defects without weakening assertions; verify fixes in fresh clones. No skip becomes a pass without execution.
6. Add a safe repeatable local command and concise setup/stop documentation. Verify guards, type/lint/format and unchanged dev env fingerprints/listeners. Leave the test service reusable or clearly document its lifecycle.

## Implementation and isolation evidence

- Started the already-installed OrbStack daemon; existing containers and dev services were not selected for testing. Reused the same `postgres:17-alpine` image family as CI; the isolated server reported PostgreSQL 17.11.
- A manual fresh labelled container on 127.0.0.1:32768, with new anonymous storage and generated credentials, prepared all repository journal migrations plus synthetic seeded/empty templates. It inherited no app/provider credentials. The clone runner completed 58 suite files: 478 pass, 0 fail, 0 skip.
- All per-suite clones were removed. Before stopping that exact owned container, only baseline/empty/system databases remained. Development envfile hashes matched their pre-run values. The manual container and its private generated credential-state file were removed; reusable evidence retains only hashes and redacted facts.
- Fail-closed discovery correctly rejected six newer PGlite/mock subprocess wrappers. Their exact reviewed paths now join the existing allowlist, still requiring both explicit selector clears and no extra unreviewed live guard.16 Python discovery/guard tests pass. Recognized integration guards remain included even in reviewed files.
- Added root `bun run test:integration` via `scripts/test-integration.py`: a fresh unique owned container, random loopback port, no application mounts, minimal environment, generated in-memory credentials, `--no-env-file`, existing template preparation and isolated per-file clone execution. Source and env hashes accompany private results; a nonzero result, skipped suite, incomplete evidence, changed input or failed cleanup fails the command.
- Docker endpoint validation follows effective context precedence and pins the verified local endpoint for subsequent commands and cleanup. Ownership checks use the exact returned container ID plus run-specific labels before stopping it. Ctrl+C/timeouts terminate the owned step process group and clean up only this container.
- Initial end-to-end command exposed a real cold-start race: Unix-socket `pg_isready` could accept the image's temporary init server, then migration lost the connection as it shut down. The image entrypoint confirms `listen_addresses=''` for that temporary server. Readiness now checks TCP 127.0.0.1 explicitly; regression tests preserve that command. The failed run cleaned up its own container, with unchanged source/env fingerprints.

## Coverage reconciliation

The prior Bun 1.3.14 default run's 560 skip count includes 472 named integration cases and 88 unnamed beforeAll/afterAll placeholders. It prints the skipped list twice. Comparison against the real isolated run found all 472 named cases passed, with none missing; six existing unit cases in a mixed permissions file account for the actual 478 pass total. A minimal no-DB Bun reproduction confirmed skipped hooks inflate skip counts while successful hooks are not reported as passed tests.

Evidence: `output/qa/integration-test-2026-10-17/coverage-reconciliation.json`, `baseline-run/results.json`, `isolation-before.json` and `isolation-after.json`. These records do not contain connection strings/passwords or app env contents.

## Final verification

The final `bun run test:integration` completed successfully on a second fresh container after the TCP-readiness and Docker-context fixes:

- 58 suite files; 478 passed, 0 failed, 0 skipped, exit 0. All 472 actual named integration cases were executed, plus 6 mixed-file unit cases.
- Run ID `b764222903d24e35b1bff8f85fa8889c`; private complete results under `output/test-integration/<run-id>/`. `run.json` reports passed, sourceUnchanged=true, environmentFilesUnchanged=true, cleanup=stopped-owned-container and exitCode0. A separate Docker label query confirms no container from that run remains.
- The environment-file fingerprints before/after match; dev API 3001/web 3004 still have their original 3599/3605 listener PIDs. Tests never selected a dev URL or copied dev business data.
- 18 orchestrator Python tests, 16 discovery Python tests, and 20 existing Bun disposable/preload guard tests pass. Fresh bounded read-only review found no material isolation/cleanup blocker.
- Global lint, API typecheck and global format check passed. No application schema/mutation logic, stored grants or UI changed. Standard unit tests retain their safe DB gates; full PostgreSQL coverage is an explicit independent command with one database clone per file.

Status: completed. Repeatable isolated database setup and all named integration cases are verified; development configuration/listeners are preserved and owned test containers are removed.
