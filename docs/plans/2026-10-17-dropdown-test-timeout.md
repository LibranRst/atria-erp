# Desktop dropdown test timeout

## Objective

Make the existing nested desktop selection regression deterministic and fast without weakening its behavior assertions or extending the outer timeout. Keep real HeroUI/React Aria and shared overlay ownership, including normal-motion exit/focus behavior. Preserve all unrelated work, the user's browser state and development data.

## Evidence and approach

- Previous full root suite: nested selection fixture exceeded60s; isolated confirmation passed34.68s.
- Fresh baseline `cd apps/web && bun test components/ui/desktop/desktop-modal-select-dom.test.ts`:1pass in34.73s. Fixture contains48 fixed650+25ms waits, accounting for32.4s idle before useful work.
- Ranked causes: accumulated fixed waits under suite contention; animation/frame scheduling overhead; a timed-out child without a bounded lifecycle adding later contention.
- Establish a shorter child deadline as a red-capable bound, retain all original assertions, and replace blanket waiting with observable state/exit/focus conditions plus React/frame flushing. Do not mock away production focus/dismissal behavior. Supplement reduced-motion only if useful.
- Give the isolated child an explicit deadline and guaranteed cleanup, with a focused regression proving a hanging child is terminated. Use the running Bun executable.
- Run targeted tests, type/lint/format checks, then the full root `bun run test`. Resolve further confirmed failures without changing assertions merely to obtain green.

## Findings and implemented change

The accumulated fixed waits were the demonstrated cause of the slow feedback loop. The launcher also lacked bounded child cleanup; that was a lifecycle weakness, not a proven separate cause of the original full-suite timeout.

- Before changing the fixture, the new 10s child deadline failed the unchanged fixture in 10.01s, killed it and reported its identity. Pristine fixture SHA256: 274e1d28a2f9540d8b06b93b170a02e003c389459c60257cee405b65b80a5aa5. The original 34.73s passing baseline and the previous 60s full-suite failure were retained as evidence.
- Replace blanket 650+25ms sleeps with React act/two-frame flushing and named bounded predicates for menu removal, destination modal focus, sequential reopen and Escape restoration. The selection-triggered confirmation is checked after old-menu removal plus an additional frame. All original behavior assertions remain, and real normal-motion HeroUI/React Aria/shared sheets remain in use. Production code, motion presets and reduced-motion behavior were not changed or mocked.
- Add runDomFixture using process.execPath, a 10s child deadline inside the unchanged 60s outer timeout, concurrent output capture, timer cleanup and guaranteed child termination/reaping. Focused lifecycle tests cover success, nonzero exit and a hanging child; the latter proves the child PID is gone and useful output survives in the failure diagnostic.

## Verification so far

- Corrected nested-select fixture: 1 pass in 3.78s (about 89% below the 34.73s baseline).
- Two concurrent stress invocations: each 4 tests/0 fail, select scenarios 5.25s and 5.03s, including successful hanging-child cleanup.
- Lifecycle helper: 3 tests pass; scoped strict lint and final web TypeScript pass. A void-return test callback typing error found by TypeScript was corrected without changing its runtime assertion.
- Bounded independent review confirmed original assertion coverage, normal-motion exit/focus boundaries and child cleanup are intact.
- Full root `bun run test` passed: 2750 tests passed, 560 existing integration skips, 0 failures. Web: 1234 tests/274 files in 276.90s; the formerly timing-out nested-select test passed in 3.44s inside that full run. The existing skips require a configured disposable database and were not converted into passes or removed.
- Global `bun run lint`, global `bun run format:check`, final web TypeScript and deterministic graph refresh all passed. Development API3001/web3004 listeners remain running.

Status: completed. Full suite, types, lint and formatting are clean. No browser interaction, finance/material writer, development data, UI styling or product behavior changed.

Database coverage follow-up: `docs/plans/2026-10-17-isolated-integration-database.md` now verifies every previously skipped named integration case on isolated PostgreSQL. Bun's former 560 skip report included 88 lifecycle-hook placeholders; the actual run passed 472 integration cases plus 6 mixed-file unit cases, with 0 fail/0 skip.
