# Native menu navigation continuity

## Approved direction

Preserve floating native chrome, compact single-line labels and the centered dock. User rejected waiting for closing animation and rejected the UIKit checkmark. Content and title must change immediately together, while closing morph continues. Active items use filled SF Symbols without checkmarks. Safari may occlude closing as part of its own system presentation. No finance/material mutations.

## Implementation

- One persistent WorkspaceHeaderMenu lives beside RootNavigator's Stack in the authenticated shell. Per-screen iOS headers retain native back/AI/notification/profile controls but leave the center title empty. The persistent menu keeps the same native button while tab/stack pages change. It hides on form sheets without unmounting.
- The shared ActionMenu uses the existing AtriaNativeDock module's named UIKit view. UIAction immediately stages the destination button title and emits navigation. Props can update the title during dismissal; only rebuilding menu children waits for UIKit completion. No navigation timer or private view traversal.
- Shared catalog route matchers choose filled SF Symbols for the active destination. UIAction stays `.off` so UIKit does not draw a checkmark. Generic fallback uses filled icon weight and selected accessibility state.
- Main destinations use router.navigate; form/detail routes retain push. Root workspace tabs and Persetujuan disable stack slide transitions for page selection. Header leading actions distinguish workspace roots from detail back-navigation, including return from Persetujuan.
- Mobile menu copy omits web suffix and secondary descriptions. Permissions and destinations remain catalog-driven. The dock FAB still finishes native menu dismissal before opening forms; this request's instant navigation applies to the persistent page menu.

## Verification

- Native build/run passed in 23 seconds. Typecheck/lint, all 10 mobile tests, and git diff --check passed. Final JS corrections also passed typecheck/lint.
- Simulator iOS 26.5 portrait, 402 pt: video frames show Proyek title and structural page loading state while the native menu is still morphing closed. Full page data follows normally. The button anchor survives; no wait for closing before route change and no fresh dismissal-preview override was needed.
- Filled Proyek and Persetujuan icons inspected with no checkmark and all rows one line. Dashboard → Persetujuan → Proyek succeeds; AI/notification/profile controls are present after returning to the workspace.
- Evidence: `.atria-demo/verification/2026-10-01-native-chrome/instant-menu-navigation.mp4`, `filled-project-menu.jpg`, and `filled-approval-menu.jpg` (gitignored). Android runtime, landscape, large accessibility text and Safari closing visibility were not verified.

## Superseded approach

## Rapid reopen / duplicate title correction

An iOS headerTitle returning null falls back to UIKit's own title. Use an explicit empty custom title view while the persistent pill owns the visible title. Menu data stays frozen during closing, but must refresh before UIKit captures a new configuration when reopening. Stage the native active icon at selection, and use a presentation generation guard so an old dismissal completion cannot change a newly opened menu's lifecycle state. Normal and selected symbols are separate typed DTO fields; no private APIs or timeout.

Validation: native build/run passed in 25 seconds; typecheck/lint and diff whitespace passed. Dashboard resting screenshot shows one title. Proyek reopen shows filled Proyek; batched Proyek → Dashboard selection/reopen with 450ms between taps shows Dashboard filled and Proyek outline. The 150ms batch attempt with perBatch AX cache did not leave Dashboard, so it is inconclusive for navigation/reopen and is not counted as proof. Evidence screenshots: `single-header-title.jpg`, `reopen-project-active.jpg`, `reopen-dashboard-active.jpg` in the same local verification folder. Both fixes extend the shared ActionMenu/native button lifecycle.

The earlier adapter dispatched actions after the native dismissal animator and used UIAction `.on` for a checkmark. It built and navigated correctly but did not meet the user's instant-navigation requirement. The current page menu supersedes that behavior; historical evidence remains in the local verification folder.
