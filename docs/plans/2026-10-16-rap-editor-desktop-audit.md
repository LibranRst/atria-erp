# RAP desktop editor audit

## Scope and direction

Audit and refine the canonical project RAP workspace, the existing page-level editing surface at `/projects/[id]?tab=rap`, plus its item/package editor handoff. No separate full-page RAP editor route exists. Reuse the current Material/Tukang/Subcon/review progression and shared item sheets instead of introducing a parallel editor or changing saves into batch operations.

Preserve Atria Operate: compact Manrope, cool canvas, white owning panels, native HeroUI tables through public shared UI, capsule controls and restrained terracotta. Inspect many-row scanning, quantity/unit and exact-cost context, stage actions, keyboard entry/return, filter/sort/page state, permissions and draft/pending/source ownership. Mobile/native remain authoritative; calculations, baseline locking and stock/payment rules stay with existing domain owners.

## Execution and acceptance

1. Read Graft, design/product/sidecar, public shared UI and actual RAP owner/tests. Parallel read-only audits identify concrete defects before one coordinated fix batch.
2. Inspect authenticated dev-app RAP draft and locked states in a separate tab. Preserve the user's existing Stock Opname draft and confirmation; do not save/discard that draft or mutate development business data.
3. Fix proven desktop layout/interaction defects via existing shared primitives. Add meaningful real-owner regressions for behavior changes. Test pending/permission/failed-save cases with isolated fixtures, not live writers.
4. One bounded responsive acceptance pass at desktop 1024/1280/1440 and mobile 320/360/390/430, plus short viewport, native fallback, nested selector, keyboard and resize-draft continuity. Confirm corrected findings once, then stop polishing.
5. Run relevant tests, typechecks, lint, formatting, scoped HeroUI/tokens, detector and graph refresh. Keep heavy checks separate from timed DOM tests and avoid a Next build that would reload the original unsaved form. Update design/surface guidance and record evidence and limits.

## Findings and shipped behavior

| Finding                                                                                                             | Result                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Draft tables used their limited comparison space for actual cost while source unit price required a deeper read.    | Setup tables compare item, quantity/unit, source unit price, supplied estimated total and condition. Locked execution keeps actual cost. Complete-source price sorting retains cents, unlike units and pagination.                                                                                       |
| Editing a selected draft item required another read-only detail sheet before reaching its editor.                   | Selected context offers permitted Edit beside identity, using the same existing form opener. Material/package permissions remain independent; active packages and locked RAP never gain a shortcut around their status gates.                                                                            |
| Stage/collection choices were local-only and reset after peer return or reload.                                     | Desktop `rap-context` (RAP ID and revision), `rap-stage` and `rap-view` restore the matching revision. Invalid/locked external requests fall back safely. Local successful advancement remains visible until refreshed source props arrive. Unrelated query/hash and mobile/native local intent survive. |
| Failed saves left the editor open but rendered persistent feedback only behind the modal; the toast had two owners. | Existing `OperationalFormSheet.error` + `FormRiskNotice` show the failure in the active editor. The result emits one event-owned toast; opening another editing intent clears old feedback.                                                                                                              |
| Pending footer protection did not prevent another native form submit or changes through an already-open selector.   | Existing controls disable during the request, guarded form setters preserve the submitted intent, and submit handlers reject a second pending invocation. Failure retains the draft for correction and explicit retry.                                                                                   |

Reused public `DesktopTable`, controlled pagination, `MoneyValue`, `Button`, `FactRow`, existing form/select controls and `OperationalFormSheet`. No new primitive, route, batch-save contract, formula, permission, backend writer or database migration was introduced. Shared form and overlay owners remain stable.

## Live dev-app acceptance

Used the authenticated Owner session in the actual app at port 3004, with Cipete's existing 27-material RAP draft and Menteng's locked RAP. No business saves, stage advancement, finalization, cash/stock actions or uploads were performed.

- RAP → RAB → RAP and reload retained the selected Tukang stage; peer return had no skeleton. URL query state remained explicit.
- Keyboard row entry opened selected context and Edit opened the exact existing Material editor. Clean close restored the Edit invoker.
- Price header pointer/keyboard sorting, 25-row pagination with two records on the final page, and search resetting to page one operated on the complete collection. Final preview returns to 10 rows with no selected row or open form.
- Page layout passed 1024/1280/1440 and 320/360/390/430 with no document overflow. The open editor and selector retained a local test name through those widths and short 1024×600. Settled dialog/listbox bounds stayed inside the viewport. A 320px measurement made during sheet motion was confirmed after settlement; it was not a clipping defect.
- The source selector could change and restore its choice after resize. All local QA edits were returned to their original values and the form closed without saving.
- Native `surface=mobile` at 1440 retained the 448px mobile shell and existing composition. Locked RAP kept its Realisasi column and selected read-only context without Edit.
- The user's separate Stock Opname draft retained all 10 fields, two overlays and its original 1499×954 viewport. That tab was never reloaded, saved, discarded or navigated.

Evidence: `/tmp/atria-rap-editor-audit-2026-10-16/` contains page/editor viewport matrices, the settled 320px measurement, final desktop/mobile/native screenshots and the 1440px editor screenshot. The preliminary editor matrix interrupted by Fast Refresh was replaced after source freeze. Live checks cover real data/navigation/local drafts; pending/failure/permission cases use isolated mocked writers.

## Automated verification and limits

Actual-manager tests cover direct Material/package editor identity, exact focus return, pending/status/permission gates, source/resize continuity, failed save/correction/retry, already-open selector races, repeated native submit, stale-error isolation and one-toast results. The navigation fixture covers StrictMode, remount, revision/project identity, invalid/locked URLs, mobile/native preferences and delayed source adoption after stage advancement. Price-column regressions cover supplied cents, units and sorting before pagination.

Independent bounded review: **ship**, no material blockers in source or final desktop/nested-mobile screenshots. Existing review geometry and shared sheet dimensions were retained after real-data checks. The dedicated RAP/RAB actual-manager stories remain the representative synthetic states; no visual-world replacement or new component story was needed.

Inherited mobile-only styling and the draft-stage aggregate purchase-number display are retained local presentation, not new desktop rules or quantity conventions. This task does not canonize those existing details. No Next production build is run while the user's unsaved form is open; generated styles, types and live dev compilation provide the presentation checks without forcing a reload.

### Final check results

- Web `tsc --noEmit`, API typecheck and mobile typecheck passed. Workspace lint has zero errors/warnings. Global format, tokens, generated scoped HeroUI styles, Graft rebuild and the scoped Impeccable detector passed.
- Targeted new/editor suites passed: direct-edit and column tests (9 tests / 53 assertions), StrictMode navigation plus existing real-manager selection (2 tests), and actual-manager failure/pending/retry (1 fixture test). These fixtures assert substantive DOM/payload behavior inside their isolated processes, not only launcher assertions.
- Initial `bun run test`: **2,702 passed, 560 configured integration skips, 2 failures**. One was a timing assumption in the new RAP fixture's fixed 400ms close wait. It was replaced with bounded semantic polling for both actual exit and exact invoker focus; original assertions and outer deadline remain. The repaired fixture passed independently and in the complete web rerun.
- Complete web rerun: **1,223 passed / 1 failed across 267 files**. The sole remaining failure is the untouched `desktop-context-popover-dom.test.ts` 30-second child-lifecycle timeout, outside the RAP dependency path. An uncontended isolated rerun of that file passed in 7.58s. No timeout was increased and no unrelated production behavior was changed. The full suite is therefore explicitly not green.
- Final source review disposition remains **ship** for this RAP scope. Validation logs: `/tmp/atria-rap-editor-workspace-tests.log`, `/tmp/atria-rap-editor-web-tests-final.log`, `/tmp/atria-rap-editor-isolated-recheck.log`, `/tmp/atria-rap-editor-web-types.log`, `/tmp/atria-rap-editor-api-types.log`, `/tmp/atria-rap-editor-mobile-types.log`, `/tmp/atria-rap-editor-lint.log`, `/tmp/atria-rap-editor-format.log` and `/tmp/atria-rap-editor-style-check.log`.

Status: complete, with the unrelated full-suite timeout recorded above. The real dev preview remains open on Cipete's Material RAP, initially unselected and without an open editor. The user's Stock Opname draft remains untouched.
