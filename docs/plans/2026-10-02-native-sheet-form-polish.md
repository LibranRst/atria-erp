# Native sheet and form polish

Implement the approved sheet plan on the installed iOS 26.5 client through JS and shared adapters. No native module, runtime download, new workflow, backend calculation, finance or stock mutation is required.

## Shared contract

- Native stack owns presentation, static headers, system X and native menu actions. Keep ScrollView as the first direct native child, with at most one floating footer sibling. Selector presenters live inside the body slot.
- iOS uses fitToContents with a measured bounded body. Known long forms start at maximum height. Content can grow, never shrink during a route session; reopening starts fresh. Android editable forms use a full height native modal; details retain sheet presentation.
- One shared usePreventRemove guard handles X, swipe and Back, dirty confirmation, pending blocking and success bypass. Local Expense autosave remains; server draft saving moves to a header menu.
- Grouped fields retain labels above borderless controls, compact 56pt simple rows, 4pt label gap and 12–16pt group rhythm. Inputs and selectors match; textareas grow. Inline errors register fields for focus and scrolling.
- One contextual floating capsule footer, native material/shadow, subtle edge fade, measured scroll clearance and keyboard avoidance. Remove bottom close/cancel duplicates. Account actions become a permission aware native menu.

## Migration

Project and Expense forms; Home account/activity/approval details and their loading states; Vendor Bill and Invoice web bridge sheets; selector presenter close and focus preservation. Existing destinations and mutation contracts remain unchanged.

## Validation

Meaningful regression tests for sizing, monotonic growth, reset and dismissal decisions; mobile typecheck/lint; existing mobile tests. Installed iOS preview checks short and long sheets, loading, fields/errors, keyboard, selector parent retention, clean/dirty close and discard. Do not submit finance or stock transactions in QA. Verify responsive layout assumptions at 320/360/390/430 and large font/reduced motion. Report Android/runtime or gesture automation limits honestly. Keep temporary exports/build caches out of the workspace.

## Implementation and evidence

Extended the existing BottomSheet/WorkflowFormSheet, FormField, FormSection, TextInput, SheetSelect, Button, ActionMenu and ChromeButton. Shared geometry, route headers, dismissal and field references live in the public mobile UI inventory. ScrollView remains the first native child, with only the footer beside it; selector hosts stay in the body slot. Dynamic Type recreates body measurements while keeping the native ScrollView, presenter and parent controlled draft.

Project and Expense have one floating primary action. Expense server saving moves to the native header menu; serialized local writes protect discard/success from older autosaves. Account actions reuse the native menu and existing permissions/destinations. Activity/approval keep a contextual CTA. Empty/loading/detail/bridge states share the same header and canvas.

Verified on installed iPhone 17 Pro / iOS 26.5 (402pt): maximum Project/Expense forms, shorter account sizing, loading→ready, clean X, dirty X and pull-bar swipe, continue/discard, added client/material fields, selector parent values, inline first-invalid-field focus/scroll, final textarea with software keyboard, account menu, live text resizing and native dismissal with the Reduce Motion toggle. Original text-size/motion settings restored. Screenshots are in `.atria-demo/verification/2026-10-02-sheet-polish/`.

Gates: 45 mobile tests; API/web/mobile typechecks; root lint; changed-file formatting; read-only demo invariants (11 cash rows, 12 inventory rows, 6 pending approvals). Android JS export passes and temporary output is removed. No runtime/device/module download or native build.

Limits: no connected Android device/emulator, so Android Back/modal behavior needs a device run. Physical width matrix 320/360/390/430 was not run; visual evidence is 402pt and geometry tests cover compact/rotated bounds. Network pending/success mutation paths were reviewed at the policy boundary; QA executed no finance or stock mutations. Whole-repo format check reports drift in 423 pre-existing/generated files; changed files are clean. Existing Vendor Bill/Invoice actions still open web directly, and retained bridge routes use the shared adapter.

## Comfortable density refinement

User feedback replaces the initial 56pt simple-row target: grouped rows now start at 72pt, with 8pt vertical inset, 8pt label/control gap and 32pt input/select/money control height. Section headings use the support scale and a 12pt heading-to-panel gap. Group separation stays 16pt, while grouped textareas start at 80pt and still grow with content. Changes extend the same shared form primitives; sheet geometry, native controls, footer and draft behavior remain intact.

The comfortable variant also uses 12pt grouped labels, 17pt field values (text/select/money), and 14pt section headings. This restores clear label/value hierarchy instead of placing very small text inside taller rows. Standalone text/select controls retain their existing styles.

## Last-field scroll limit fix

Reproduced the Project notes obstruction at maximum scroll on iOS 26.5, without keyboard or form data. Native UIScrollView reported an 812pt viewport while its React wrapper measured 744pt. At offset 225/225, the final field ended at 772pt, below the 720pt safe boundary above the footer. Existing 110pt content padding was present; the native viewport discrepancy made it insufficient.

BottomSheet now reserves the measured occluded viewport above the footer, subtracting native keyboard insets so space is not counted twice. A conservative iOS header allowance covers the first layout before native scroll metrics arrive. Caller numeric padding is retained as a minimum and cannot remove the required clearance. The direct ScrollView/one-footer native structure remains intact.

Captured geometry is replayed through the production clearance helper in a regression test (red before fix, green afterward). Native repeat: offset 293/293, field end 704pt, safe limit 720pt. Keyboard repeat: inset 405pt, offset 616/616, field end 381pt, safe limit 397pt. Temporary accessibility probes and inspector harness were removed; stable sheet test IDs remain. No transaction or stock mutation was performed.
