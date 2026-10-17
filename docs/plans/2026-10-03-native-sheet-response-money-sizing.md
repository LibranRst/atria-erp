# Native sheet response and currency sizing

Fix two reported regressions through existing JS/shared adapters, using the installed iOS 26.5 client. No new runtime or native module.

Baseline: Project tap→native transition start 368ms; first layout 159ms; data ready 440ms; transition end 878ms. Check native large detents for known maximum forms and avoid intrinsic sizing/options updates on their first presentation. Keep content-fit behavior for shorter detail sheets and preserve footer clearance/dismissal contracts.

Ringkasan's 30pt hero rendered with a 2.88pt cap height (4pt actual font), despite adequate width. Installed RN 0.86 iOS auto-fit uses an absolute default 4pt minimum and does not use the supplied scale floor. Shared MoneyValue should measure natural text width without native auto-fit and calculate its own bounded font size. Preserve exact formatting, tabular numerals, color and hierarchy.

Validate tap timing, loading, warm/cold reopen, footer/keyboard clearance, large money values and narrow widths. Remove temporary probes. Typecheck/lint and targeted regression tests; no finance/stock mutations.

## Implemented

- Root native-stack routes use the maximum native detent for Project and Expense, before loading. Short detail sheets retain content-fit sizing. `BottomSheet` only updates intrinsic body height for content-fit sheets, leaving maximum geometry to native-stack.
- `WorkflowFormSheet` presents its lightweight shell first and mounts expensive form controls after native `transitionEnd`. `BottomSheet` records that event by bounded route session, so a slow loading-to-ready remount does not wait for an event that already happened. Directly opened first routes render immediately.
- `MoneyValue` measures natural text width at the requested font, computes a bounded size in JS, and uses natural paragraph height. Currency formatting, exact amounts, tone, tabular digits, and public signatures remain shared and unchanged. The invisible measurement is excluded from accessibility.
- Existing direct ScrollView topology, floating footer clearance, keyboard helpers, and dismissal guard remain in the shared sheet adapter.

## Evidence

Installed iPhone 17 Pro / iOS 26.5, 402pt logical width, existing development client:

| Project opening                    | Native transition start after tap | Transition end | Bootstrap data ready |
| ---------------------------------- | --------------------------------: | -------------: | -------------------: |
| Baseline warm open                 |                             368ms |          878ms |                440ms |
| Maximum detent + deferred controls |                             212ms |          724ms |                405ms |
| Delayed bootstrap fixture          |                             156ms |          669ms |               1857ms |

The actual native opening assertion failed above 250ms on the baseline and passed after the change. The slow-response fixture additionally forced the loading branch to stay mounted until after the animation; the ready form then appeared correctly. The fixture, all debug accessibility values, and the timing probe were removed. Production-code reopen visibly starts with a sheet shell, then shows the controls.

The actual Ringkasan hero line changed from 4pt (cap height 2.88pt) to 30pt (cap height 21.6pt), displaying `Rp 1.178.650.000`. The native assertion failed before and passed after. Unit tests cover initial/unmeasured layout, enough width, narrow long amounts, and the minimum scale; they do not claim to reproduce the UIKit font-fitting bug without a device.

`Catatan` is fully above the floating footer at the end of the maximum Project sheet. Clean native X dismissal and reopening passed. Software-keyboard visibility was not revalidated in this pass because the simulator used its hardware keyboard; the captured keyboard-clearance regression test from the preceding footer fix still passes. Android runtime and the complete viewport/font-scale/reduced-motion matrix were not exercised here.

- All 50 mobile tests pass.
- API, web, and mobile typechecks pass; workspace lint passes.
- Android JS export passes; its task-owned output was removed afterward.
- Changed code passes targeted Prettier and `git diff --check`. Workspace formatting still reports 419 files outside this narrow fix.
- No financial or stock mutation, native build, runtime download, or dependency install was performed.
- Native app input reported a false Mac-lock condition; actions succeeded through the existing simulator browser preview. No OS setting was changed.

Screenshots: `.atria-demo/verification/2026-10-03-sheet-response-money/` (`project-ready.png`, `project-footer.png`, `ringkasan.png`).
