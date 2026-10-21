# FAB sheet response and floating glass

Follow-up: Proyek baru must begin sheet presentation as soon as its FAB menu item is selected. The previous direct-button timing did not include FAB's UIKit dismissal queue.

Reuse the existing NativeNavigationDock/AtriaMenuButton adapter. Remove the dock's wait until menu dismissal completion before emitting the selected action. Leave sign-out teardown's guard in the separate shared header action menu. Native-stack continues owning the sheet, loading, geometry and dismissal.

Use public UIKit targeted previews/menu attachment geometry to lift the opened FAB preview and menu above the tab bar, returning to the resting anchor on dismissal. Keep the real FAB frame and touch target stable. Use existing regular light tinted glass on the plus button to match the brighter floating chrome.

Validate the actual FAB menu path, outside dismissal, repeated open/select/close, intact tab navigation, loading and last-field clearance. Measure input dispatch to native transition start, and inspect recorded native frames. No form submission or finance/stock mutation.

Changes to the existing native adapter require an incremental rebuild of the existing client. Reuse `.atria-demo/native-builds/floating-chrome` and the installed iOS26.5 simulator. Do not download runtimes, add native modules/dependencies, create a fresh DerivedData directory, run prebuild/pods, or clean the existing cache.

Remove all temporary probes after measurement. Run appropriate typecheck/lint/tests and native build; report actual coverage and storage change.

## Implementation and observed evidence

- Dock UIAction now emits selection immediately. Previously every selection was stored in `pendingAction` until UIKit's closing animator completion. The separate header menu still waits for sign-out teardown only.
- Dock opts into a preview lift of its button height + 12pt. Public `menuAttachmentPoint(for:)` and `UITargetedPreview.retargetedPreview(with:)` shift the opened preview/menu while the native dismissal preview targets the original button. Other menus default to zero lift. No frame changes, private view traversal, custom animation, or new bridge props.
- FAB uses existing regular light tinted glass instead of clear glass. Resting tab/FAB alignment and 64pt native touch area remain stable.
- The shared bottom-bar adapter uses public `router.prefetch` to prepare the permitted Project screen. Bootstrap data remains focus-gated. Shared header and intrinsic-geometry options wait for the route to become focused, as placeholder navigation cannot set options. The presentation gate distinguishes the actual first active route from a hidden preloaded route. Once promoted, the native transition listener is attached to the real route; no timer or network wait gates presentation.

The actual input-dispatch → native transition-start loop failed at **2102ms** before the fix. Immediate native action delivery passed at **228ms** on a warm route. Preparing the screen in advance passed at **453ms** on the first selection from a freshly launched app process. The form rendered after that transition, including its selectors. These include browser forwarding overhead and are simulator observations, not physical-device guarantees. A temporary CUA assertion rejected measurements over 500ms; all timing probes were removed afterward. Pure Bun tests cannot reproduce UIKit menu/presentation timing, so these actual simulator traces are the regression evidence for this change.

Captured baseline video: first visible menu dismissal at 8.388333s → first sheet surface/grabber at 10.141667s (**1753ms**). After removing the queue, the corresponding visual seam was 31.018333s → 31.448333s (**430ms**, before JS code warming). The sheet stayed open; later X-driven dismissal is distinct from opening. Native recordings are variable-frame-rate, so original frame timestamps were used.

Native build/install/launch succeeded on the existing iPhone17Pro/iOS26.5. The same preexisting build cache peaked at 3545252KiB from 3458412KiB (about **85MiB** additional) and ended at 3535144KiB (about **75MiB** additional); no new runtime, dependency, module, or DerivedData directory was created. The installed SDK and existing runtime are separate.

All 50 mobile tests, mobile typecheck/lint and diff whitespace check pass. Final coverage includes open/cancel/reopen, clean X, and native menu geometry; Android/physical iPhone/full width/accessibility-motion matrix are not runtime evidence in this pass. No form was submitted.

Evidence: `.atria-demo/verification/2026-10-03-fab-instant-sheet-glass/`.

Public UIKit references: [menu attachment point](<https://developer.apple.com/documentation/uikit/uicontrol/menuattachmentpoint(for:)>) and [retargeted native preview](<https://developer.apple.com/documentation/uikit/uitargetedpreview/retargetedpreview(with:)>).
