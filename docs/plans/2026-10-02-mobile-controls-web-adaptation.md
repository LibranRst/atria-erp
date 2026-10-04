# Mobile controls: web adaptation and lighter native chrome

User steering after Home parity: adapt segmented tabs to the current web composition, make action buttons visually smaller, and make the bottom navigation pill visibly Liquid Glass on iOS 26. Home content, permissions, routes, financial calculations and seeded data are preserved.

## Direction

- Extend the existing public SegmentedTabs adapter/local Expo view. Match the web compact inset-gray capsule, sliding ink active pill, icons, full Home labels and workload badges. UIKit buttons and horizontal UIScrollView preserve native hit-testing, momentum, accessibility and selection feedback. Keep the existing release/cancel/held edge-selection behavior as an enhancement without changing tap/scroll semantics; native indicator motion receives shared motion presets from JS. Use a tinted native glass selection surface on iOS 26 with a solid fallback before it. Do not render glass across Home content.
- Reduce shared native Button control size/font/content padding. Keep a 48pt native interaction/accessibility frame around the smaller 36–40pt visible capsule; loading/disabled/destructive/leading-icon states keep their existing contract. Avoid shrinking native header/back/dock targets.
- Preserve UIKit bottom navigation and its menu/dismissal ownership. Remove its white underlay and keep the UIKit bar canvas transparent so the standard iOS 26 glass samples the page. Use a clear untinted glass variant for the separate quick-action surface. Do not style private UIKit subviews or lower the whole dock opacity.

## Verification and storage

Run focused mobile typecheck/lint/tests and native semantic build. Inspect Home tabs, horizontal scroll/selection, full labels/counts, compact buttons with and without icons, read-sheet footer, bank gradients beneath the floating dock, and quick-action menu/dismissal. Batch inspection once, then fix observed defects together and confirm once. Record timing/device limits honestly.

Use only the already installed iOS 26.5 runtime and existing simulator. Reuse the same task-specific external SSD DerivedData path for the required native rebuild (previously measured ~3.3 GB), then remove it after installing/verifying the client. No runtime/package downloads or additional simulator devices.

## Delivered and verified

- Existing SegmentedTabs/local Expo adapter now renders the web composition using native UIKit buttons, SF Symbols, count badges and native horizontal scrolling. The active ink capsule uses a tinted iOS 26 glass effect; indicator geometry animates from shared spring tokens and selection provides one native feedback event. Native button selected-state background is transparent so it does not introduce a system-blue halo. Permission filtering and URL-backed content selection are preserved.
- Shared native Button uses regular/small system control sizing, smaller native labels and 20pt icon slots. Visible capsules are smaller while their interaction/accessibility frame remains 48pt. Loading, disabled and destructive roles retain their existing contract. Android Button uses native 40dp visual sizing within its existing 48dp host/material interaction area.
- The white dock underlay was active after tabs loaded; it has been removed. UIKit owns the floating navigation's material on a transparent canvas; the quick-action glass is untinted clear. Visual QA confirmed bank gradient color visible through the dock. Existing menu and dismissal ownership are retained.
- Mobile typecheck/lint, 34 tests, final native build and iOS/Android exports passed. iOS 26.5 / iPhone 17 Pro / 402pt inspection covered tab labels/icons/counts, tap/scroll, compact action with/without icons, read-sheet actions and dock over bank gradients. One batch removed the observed blue selected halo and a final inspection confirmed the ink state.
- Physical-device haptic feel, timed hold/edge cancellation, other viewport sizes and Android runtime remain unverified. No financial or inventory mutation was performed. Final client installed; 3.3 GB of task-specific external build cache and 26 MB of temporary exports removed. No new runtime, packages or simulator devices downloaded/created.

## Follow-up: contextual button sizing

User feedback: the uniformly reduced buttons are too thin. Use compact section-header actions around 40pt, regular page actions around 44pt, and fuller sheet actions around 50–52pt. Preserve the effective 48pt native interaction frame. Add a shared size context at the existing sheet owners (React provider only, no extra native wrapper), with explicit size props taking precedence. Keep segmented tabs/glass unchanged. This is a JS adapter change: verify through the installed client without creating another native build cache.

Mobile typecheck/lint passed after the contextual-sizing change. The installed iOS 26.5 client shows the fuller Project form footer. Screenshot: `.atria-demo/verification/2026-10-02-controls-refinement/button-context-sheet.png`. The open form was preserved; no form submission, native rebuild or build cache was created.

## Section-header drill-down actions

Improve “Lihat semua” / “Buka semua” through the existing shared Button: a neutral native pill, compact 40pt visual with a 48pt interaction frame, clearer native label and decorative trailing chevron. Use a semantic `section` variant so these drill-downs stay quieter than finance/mutation actions. Extend the native adapters' existing bounded icon slots for trailing content; do not add another press/overlay owner. Home DashboardSection uses the new treatment consistently, preserving its destinations and contextual accessibility labels. JS-only refinement, no native rebuild.

Section-action verification: mobile typecheck/lint passed. iOS 26.5 preview shows neutral filled native pills with clearer labels and trailing SF chevrons across Home sections. Tapping “Lihat semua” on Perlu keputusan opened the matching approval tab; “Buka semua” uses the same treatment. The decorated icon is excluded from the native button's accessibility label. Screenshot: `.atria-demo/verification/2026-10-02-controls-refinement/section-actions-final.png`. No native rebuild or financial mutation.

Later user feedback supersedes the section pill: `section` now uses a native plain/text button, smaller semibold label, tighter padding and small trailing chevron, without a visible background. The 48pt interaction frame remains. Mobile typecheck/lint and iOS preview passed; sheet/page sizing is unchanged. Screenshot: `section-inline-final.png`. No native rebuild.

Budget risk count refinement: DashboardSection groups title + neutral compact count badge on the left, with the drill-down action independent on the right. Count data is unchanged; no severity tint or second action added. iOS 26.5 Budget preview and mobile typecheck/lint passed. Screenshot: `budget-count-final.png`.

Progress spacing refinement: compared the web indicator’s 10px top margin with native’s additional 12pt margin plus owner gaps. Shared BudgetSplitIndicator now adds only the 4pt base token; the inverse overview budget inset uses an 8pt gap instead of 12pt. This reduces value-to-bar gaps to roughly 8–12pt across Budget/Material/category/overview contexts. Material preview, mobile typecheck/lint passed. Geometry, values and captions remain unchanged; no native rebuild. Screenshot: `progress-spacing-final.png`.

## Floating dock separation on bright content

User requests topbar-style separation for bottom navigation/FAB. Preserve the existing native glass/material and geometry; apply the shared floating-depth token through the native container's alpha-aware layer shadow. A transparent native root lets the shadow follow the rendered tab platter and FAB rather than a new solid rectangle. Add the native counterpart of the existing floating token centrally, not component-local arbitrary values. Do not reintroduce an opaque white underlay, change navigation targets or add an interaction owner. JS-only, use the installed client; inspect bright surfaces and colored bank content.

Dock depth verification: shared native floating shadow counterpart applied to the transparent iOS dock root. Native preview on light grouped content and colored bank gradients shows added separation while glass remains translucent. Mobile typecheck/lint and diff checks passed. No interaction/layout owner changed, financial mutation or native rebuild. Screenshot: `dock-depth-final.png`.
