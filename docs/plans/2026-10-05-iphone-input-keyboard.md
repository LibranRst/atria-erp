# iPhone web input and keyboard repair

## Report and scope

The user reports that the production web app unexpectedly zooms when an iPhone browser focuses inputs, and that the keyboard then covers the active field. Android is comfortable. Repair the shared web form/overlay behavior and publish the tested frontend; preserve user/company data, auth, finance/material behavior, Android layout handling, manual pinch zoom and unrelated original-checkout work.

## Evidence and verification

Shared text/numeric/money/textarea/stepper/search controls currently use 14px editable text; HEX uses 12px and chat14px. Safari focus zoom is a likely trigger that needs observed browser evidence. Larger 17px AI controls should stay larger. Root viewport already permits zoom and uses interactiveWidget=resizes-content; do not disable scaling.

BottomSheet measures visualViewport.height but stays at layout bottom0; its height cap uses100dvh. DialogFrame follows visual viewport top/height but child caps still use78dvh, and neither overlay reveals the active input after geometry changes. The sheet minimum196px can exceed a keyboard-reduced landscape viewport.

Build a red/green computed-font and real form-sheet loop using existing no-auth Storybook controls. Prefer Safari in an already-installed iOS Simulator for keyboard evidence; simulator activation follows the applicable skill's human authorization. Desktop device emulation and unit geometry checks do not establish physical iPhone acceptance.

## Implementation

1. Add a shared mobile/touch editable-control font floor of16px, scoped to relevant text controls and preserving larger typography/desktop behavior. Extend current controls/tokens rather than creating a replacement primitive; cover raw search/chat/HEX outliers.
2. Add shared viewport/focused-field visibility geometry within existing overlay owners. Account for height+offsetTop, immediate keyboard bottom clearance, real available max height, header/footer occlusion and top-overlay ownership. Scroll only the owning body by the minimum required amount.
3. Separate manual zoom/pan from keyboard compensation; keep current Android viewport metadata, focus traps, dismissal, motion presets and accessibility.
4. Write meaningful regressions for actual resize/focus paths and geometry boundaries, verify320/360/390/430 and desktop1024/1280/1440, then build/deploy the reviewed web candidate to the existing Netlify site. Do not reset, seed, create company users or change hosting plans.
5. Record tested source/deploy identity and browser evidence, preserve Netlify badge off, and leave actual boss-phone confirmation explicit if unavailable.
