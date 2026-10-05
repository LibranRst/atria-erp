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

## Native Safari follow-up

The first patch passed computed CSS and DOM resize tests, but repeating the software keyboard on iPhone 17 Pro Simulator (iOS 26.5) exposed a remaining footer bug. Safari reported `innerHeight=518`, document height `714`, document scroll `196`, visual height `377`, visual offset `196`, and scale `1`. The bottom-fixed sheet ended at client coordinate `518`; its footer remained behind Safari's accessory bar. Deriving a bottom inset from `innerHeight` produced zero and mixed coordinate spaces.

Use a top-positioned fixed visual-viewport host with the sheet anchored inside it, matching the existing dialog host. Focus reveal must compare field/body bounds with the actual host's client bounds. Preserve the last unzoomed host geometry during manual zoom and preserve top-overlay ownership. The local Storybook diagnostic variant uses synthetic values only and does not call the API.

## Final verification

- The same native Safari keyboard geometry now places the sheet/its footer at client bottom `377`, with the whole input and Save button above Safari's accessory bar. Visual scale remains `1`. Repeated focus/software-keyboard presentation passed on the clean default Storybook fixture after the diagnostic panel was removed from that default story.
- Computed-style checks cover mobile 320/360/390/430, fine-pointer desktop 1024/1280/1440 and large coarse-pointer screens. Editable mobile text computes to 16px; 17px inputs, compact supporting copy and fine-pointer desktop control sizes remain intact.
- Final focused suites: 37 tests, 223 Bun expectations, plus real rendered-overlay DOM assertions. Coverage includes Safari's document/client pan mismatch, minimal field reveal, header/footer occlusion, scroll extent, stacked overlay ownership, short landscape viewports, zoom preservation and Android layout resize.
- Web typecheck and full web lint pass. Independent React review found no concrete regression in event/observer cleanup, hooks, overlay focus ownership, pointer events or motion.
- Reused/extended primitives: existing TextInput/textarea/control typography tokens, OperationalFormSheet, BottomSheet and DialogFrame. Public action signatures and company data are untouched. Physical boss-iPhone acceptance remains a follow-up; this evidence is an installed iOS 26.5 Simulator and automated browser/DOM checks.

## Published candidate

- Runtime source: `84a120b2ef5f2c0071232ac209605416d1a495d4` (with the preceding typography repair `0cf0437c`). [CI 37279175273](https://github.com/LibranRst/atria-erp/actions/runs/37279175273) passed both quality and disposable PostgreSQL integration jobs.
- Official Netlify production build completed in 40.5 seconds. Deployed the transformed `apps/web/.netlify/static` artifact, including its packaged functions/edge adapter, to existing site `c316f6d9-328f-4702-b5ea-dfc8c75c4ce3`; published deploy `6ac3550b9fa3f1330360c366` at [Atria](https://atria-dekoria.netlify.app).
- Fresh production login at 390px has email/password inputs at 16px, no document overflow, and the existing zoom-permitting viewport metadata. No Netlify badge appears in the rendered DOM or fresh HTML. API `/health` and `/ready` both return 200. Synthetic Storybook submit still closes the shared sheet after its exit animation.
- Proof saved privately in the original checkout's `.atria-demo/iphone-input-qa/`: `safari-footer-diagnostic-before.jpg`, `safari-footer-diagnostic-after.jpg`, `safari-sheet-final.jpg`, and `production-login-final.png`.
- Shut down only the Simulator booted for this task and stopped the temporary Storybook server. The user's local web/API on 3010/3011 remain running. Generated release build caches can be regenerated; keep source, Netlify site linkage and verification evidence.
