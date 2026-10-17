# Material analysis polling hook dependency

Fix the remaining `react-hooks/exhaustive-deps` warning in MaterialMasterProposalCard without suppressing lint or changing timer cadence. The polling effect uses a render-created `accept` handler, which also serves explicit draft/selection operations. Keep those operation paths intact and use a poll-only React Effect Event for response acceptance; the effect remains synchronized to draft identity and analysis status.

Preserve disposed/request-epoch guards, revision ordering, optimistic selection and bookmark restoration. Reuse the locally supported React 19.2.4 API, already used by the bank-account owner; no package, visual, backend, permission or mutation change. The official timer guidance is [React useEffectEvent](https://react.dev/reference/react/useEffectEvent#using-a-timer-with-latest-values).

Verification: extend the existing actual-card DOM fixture with a bounded polling phase, retain its selection/editor/resize scenarios, and run scoped tests and TypeScript. Run workspace lint with zero warnings and global format check, then refresh Graft.

Status: completed. The poll-only `acceptProgress` Effect Event receives successful or failed poll responses after the existing disposal/epoch checks. Ordinary `accept` calls for explicit operations remain unchanged. No lint suppression or rule/configuration change was added.

## Verification

- Workspace `bun run lint` passes with zero errors and zero warnings. The affected component and fixture also pass strict `--max-warnings 0` checks.
- The existing actual-card DOM suite passes with a bounded polling phase: same-identity rerenders retain timer cadence; QUEUED/PROCESSING progress is accepted; a disposed interval's late response is ignored; READY and unmount clear polling. Existing optimistic-selection, revision, dirty-editor and resize checks remain intact; business save calls stay zero.
- Final web TypeScript passes, including API declaration generation. Browser-only test timers use typed property descriptors at the HappyDOM/global timer boundary, without casts or `any`.
- Global format check passes. The design hook's generated cache was normalized again after the final fixture edit, and all touched files pass scoped formatting. Graft refreshed after the source changes.
- Logs: `/tmp/atria-lint-clean-final-2026-10-16.log`, `/tmp/atria-lint-clean-typecheck-verified-2026-10-16.log`, `/tmp/atria-lint-clean-format-final-2026-10-16.log`, and `/tmp/atria-material-polling-dom-final.log`.
