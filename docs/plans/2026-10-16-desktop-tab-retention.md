# Retain visited desktop tab data across workspaces

## Scope

Extend the accepted Reconciliation behavior to remaining desktop peer tabs: a successfully loaded exact query returns immediately on revisit without another collection read or skeleton. First visits, new queries and invalidated generations still load honestly. Inventory all routes and distinguish already supplied/client-filtered snapshots from independent async reads and conditional owners that discard completed reads.

Use a small shared owner-local retained-query hook for independently fetched collections, with an explicit finite slot list and at most one exact query result per slot. Preserve public feature contracts, server filtering/pagination, per-view URL state, source timestamps, errors/retry, permission-denial purging and late-response cancellation. Refresh, successful changes and authoritative source generation changes invalidate retained data. No persistent/global cache, prefetch, timer TTL, dependency, backend query or finance/material mutation is introduced.

Known independent reads: Dashboard approvals/budget/due/material tables and 6/12-month cash trend; Material movement/receipt/transfer/count activity; Reconciliation remains the reference and adopts the shared mechanism with its existing metadata/candidate guards. Cash-flow state must live above its conditional overview presenter. Audit Settings/Administration role loads and project expense draft recovery or other conditional async owners; retain their completed reads in the correct owner without bypassing dirty/pending/authorization gates. Snapshot-supplied Project, Expense, Approval, Settings and Profile tables already returning instantly should keep that behavior.

## Work allocation

- Root: shared retained-query owner, Reconciliation integration, whole-route audit completion, documentation, final verification and live preview.
- Dashboard: table/trend integrations, stable ownership, invalidation and focused behavioral tests.
- Material: activity-kind integration, owner lifecycle checks and focused behavioral tests.
- Remaining route audit: identify conditional async owners and implement only justified fixes after interface coordination.

## Acceptance

Use deferred real-hook/presenter tests for visited-tab reads/skeleton counts, exact filter/page isolation, bounded slots, refresh/mutation generation invalidation, inactive/suspended work, permission changes, error/retry and out-of-order responses. Keep selection optional and candidate/detail evidence independently fresh before explicit actions. No development database mutations or reset/seed.

Verify representative live routes, desktop 1024/1280/1440px and mobile 320/360/390/430px/native fallback in bounded passes. Run appropriate feature/shared tests, TypeScript, workspace lint, formatting and isolated builds. Preserve the recently clean lint/format gates. Update DESIGN, sidecar/surface briefs and this record; refresh Graft and perform a bounded independent review.

## Implemented

- Added `useRetainedQueryPages`: mounted-owner storage with a finite slot list, one normalized exact query per slot, generation/revision fencing, explicit retry, late-response cancellation and complete purge on unexpected authorization denial. No global or persistent cache and no speculative reads.
- Dashboard uses one six-slot owner for four desktop table reads and the six/twelve-month trend. The chart owner now survives Ringkasan unmounts. Known missing domain permissions remain local restricted states; an unexpected server denial clears the retained generation.
- Material retains the four activity kinds across activity/outer-tab changes. Manual refresh and successful operations invalidate immediately, before delayed server props arrive, including receipt saves and a successful count save followed by a failed submit.
- Reconciliation adopts the same helper. Candidate details remain independently fresh after tab, viewport or overlay suspension; retained collection rows cannot substitute for current action evidence.
- Settings retains the lazy Peran read above main/entity tab conditionals. Project tabs retain the private expense-draft recovery read above their conditional presenters. Both retain scope/session fences and existing pending/dirty form ownership.
- Audited remaining portfolio, expense/vendor, approval, settings/catalog, project planning/stock/payment/margin, profile and AI segments. Their supplied snapshots, local filtering or already-stable owners do not perform a new collection read on ordinary tab revisits, so no redundant cache was added.
- Updated DESIGN, the Impeccable sidecar and Dashboard/Material/Settings/Project surface briefs. Shared `SegmentedTabs`, `DesktopTable` and overlay primitives are reused without a new visual primitive.

## Verification

- Deferred real-owner DOM fixtures cover exact-query revisit/read counts, loading behavior, filter/page isolation, scope and permission changes, errors/retry, stale completion cancellation, refresh and successful-operation invalidation. Mocked writes only; no development database changes.
- Live development app: Dashboard table round-trips and twelve-month trend return, all four Material activity kinds and outer-tab return, Settings Peran across entity/main tabs, project Stok/Pengeluaran/main tabs, and Reconciliation history revisit. Successfully loaded queries returned without visible collection skeletons.
- Responsive live pass: desktop 1024/1280/1440 and mobile 320/360/390/430, no document overflow; desktop cache survived mobile/desktop resize. At desktop width, `surface=mobile` retained the 448px mobile shell. Evidence: `/tmp/atria-desktop-tab-retention-2026-10-16/`.
- Workspace lint, global format check, web TypeScript, token synchronization and scoped HeroUI styles check passed. Full API/web/admin/mobile build passed using an isolated Next output directory. Expo emitted only the process environment's NO_COLOR/FORCE_COLOR warning.
- First full workspace test run passed every suite except one existing ContextPopover DOM test timing out while build ran concurrently. Its isolated sequential rerun passed (1/1, 7.39s). The full workspace rerun without concurrent build passed, including all 1,199 web tests and the development-script tests. Logs: `/tmp/atria-desktop-tab-retention-tests-final.log` and `/tmp/atria-desktop-context-popover-isolated.log`.
- The mobile build generated two Git-ignored metadata JSON files without Prettier formatting; formatted those artifacts before the final global format pass, without changing ignore policy or source behavior.
- Independent focused review of shared hook and Dashboard permission/invalidation integration found no concrete remaining issues.

Status: complete. Implementation, focused review, live acceptance and workspace checks passed; Graft refreshed after the final source edits.
