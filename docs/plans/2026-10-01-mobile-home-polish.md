# Mobile Home polish and connected preview

Scope: finish the existing native Dashboard/Home, preserving six peer tabs, native workspace chrome, effective permissions, project scope, shared calculations and the web Dashboard's visual grammar. Other unported workflows retain explicit browser actions.

## Implementation

- Replace the focal card's unsupported NativeWind opacity text styles with shared native tokens; expose project value, internal budget, consumed/remaining budget and projected margin before material detail. Include category usage in the overview.
- Keep priority previews bounded, grouped rows readable at 320–430pt, financial amounts on one line, exact secondary amounts, 48pt controls, semantic status and screen-reader labels.
- Reuse MoneyValue, MetricPill, GroupedSurface, BudgetSplitIndicator, SegmentedTabs, ScreenQueryState/ScreenRefreshNotice and native Stack/BottomSheet. Provide a native read-only account detail using the existing screen DTO; money movement stays in established explicit workflows.
- Match first-load skeleton to the selected tab; preserve cached data, scroll position, pull refresh and revoked-access behavior.
- Seed a separate development preview sandbox from the existing canonical connected seed, anchored to 1 October 2026 WIB. Preserve current UAT data and save the original local API connection privately. Verify financial, inventory and demo invariants and Home preview coverage.

## Verification

Run workspace typechecks, lint, formatting, mobile tests and native exports. Exercise all six tabs, account detail and return, project links, loading/recovery and refresh in the installed iOS development client. Inspect Home at 320/360/390/430pt plus current simulator width in one batch, repair together, and confirm once. Record Android/runtime or hardware limits explicitly.

## Status

Completed on 2 October 2026 WIB. The focal card now uses explicit native tokens, readable compact/exact money, all project budget values and margin; category rows are shared between overview and Budget. Priority previews are bounded and manual project attention no longer implies near-limit spending. Cash coverage reads the canonical payable due total. Native read-only account sheets reuse the ledger DTO and enforce the bank-view permission; account gradients retain Settings values. Shared tabs keep intrinsic widths, summary labels fit narrow cells, indicator captions preserve nominal values and inventory icons use a valid typed library export.

Canonical seed ran and verified on isolated branch `br-rough-sound-aoi4a26u` / `codex-mobile-home-preview-2026-10-01`, derived from development. Original UAT data and local env backups were preserved. Local API/Metro/web preview run on 3001/8081/3030, with loopback URLs for the simulator. The browser bridge successfully read the same seeded accounts. Temporary RN web inspection transport was restored byte-for-byte.

Verification: all three app typechecks, workspace lint, 30 mobile tests, 3 business-label tests, targeted formatting, iOS/Android exports and demo invariants passed. RN web content matrix 320/360/390/430px had no horizontal overflow. Native iOS 26.5 at 402pt verified seeded Home, accounts, gradient identity, half/full account sheet, transactions and dismissal to the original tab. Loading/offline/authorization/cache behavior has the existing real QueryObserver tests plus observed empty-data first audit; Android runtime, physical devices and large-text/screen-reader interaction remain unverified. No finance or stock UI mutation was performed.

Evidence and restart instructions: `docs/guide/mobile-home-preview.md` and `.atria-demo/verification/2026-10-01-mobile-home/`. Root format check still reports 418 pre-existing files outside this change; targeted formatting passes. The Impeccable sidecar predates DESIGN.md; this task followed current DESIGN.md and did not refresh unrelated design documentation.
