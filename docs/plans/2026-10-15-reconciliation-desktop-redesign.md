# Rekonsiliasi desktop

## Direction and scope

Extend the accepted Atria Operate desktop grammar from Dashboard, Pengeluaran and Persetujuan into `/reconciliation`. Preserve the current mobile/native composition, canonical URL, session/permission checks, matching semantics, import/manual entry, exception notes, immutable matched records and existing mutation owners.

Desktop starts at 1024px. Lead with the compact title/actions and one divided summary band, then Mutasi bank / Catatan Atria / Riwayat peer tabs and compact controls. Use native shared HeroUI `DesktopTable`, precise money, readable statuses and an independently sized context panel from 1280px. Smaller desktop progresses from list to detail with a Back action; it never highlights a hidden fallback selection. Empty results use the complete width. Do not add a bulk matching or payment workflow.

## Data and state

Audit the existing 100 unresolved / 500 history read caps before implementing pagination. Desktop totals, filtering and sorting must describe their actual source. If capped previews remain, label their limit and separate source totals from displayed results; never call a limited preview the complete queue. Prefer a bounded server desktop read if the existing architecture provides a proportionate extension. Mobile loader signature/payload remains compatible. Keep selection, manual/import drafts, pending operations and outer overlay ownership stable across resize. No development database reset or financial mutation during QA.

## Implementation

1. Inspect the existing workspace, backend query/writer, public UI, stories and design contracts.
2. Add desktop table/detail composition and structural skeletons using public primitives; retain workflow callbacks and sheet owners.
3. Add representative safe stories/fixtures for all views, candidate/exception/history/empty states, narrow detail and drafts across resize. Verify filter/sort/page behavior and exact cents.
4. Batch browser verification at desktop 1024/1280/1440 and mobile 320/360/390/430, plus native mobile hint, keyboard/reduced motion and overlay recovery.
5. Run appropriate workspace checks, scoped HeroUI/token checks, detector and fresh finish review. Record inherited failures separately. Update DESIGN, sidecar, surface brief and this plan with shipped evidence.

## Acceptance

Finance can distinguish unmatched bank evidence, Atria records requiring action, documented exceptions and confirmed history, inspect a candidate before explicit confirmation, and find import/manual entry without losing a draft on resize. Counts and source limitations are explicit; loading/error/empty are distinct. Shared focus, dismissal and mutation safety remain authoritative.

## Implemented result

Implemented. The stable workspace still owns all manual/import/exception/matching drafts and existing overlays. Desktop mounts alongside the hidden mobile presenter; it keeps table/filter/selection state through resize and freezes source refresh while an overlay is open. Public DesktopTable, DesktopTablePagination, FilterSelect, SearchInput, SegmentedTabs, GroupedSurface.desktopPanel, FactRow, MoneyValue, status and shared sheet primitives provide the interaction contracts.

Added a declaration-only shared core contract, explicit compatibility operations and typed web facades for a paged desktop read and exact matching context. Complete tenant-scoped collections remain server-only; only a filtered/sorted page crosses HTTP. This follows the Dashboard source strategy; SQL-level pagination is a future scaling improvement. Existing mobile query retains its signature and preview caps. Both reconciliation entry paths now require reconcile:ledger plus GLOBAL scope and tenant fences, without changing writers or money movement. The two new read adapters are documented in the fixed AI operation coverage inventory; no new AI tool was introduced.

Safe stories include 25 cash records, 27 bank mutations, 12 matched records, single/multiple/absent candidates, exceptions, cents, long descriptions, empty/error/loading, pending actions and native fallback. No development DB reset, seed or real mutation occurred. Desktop 1024/1280/1440 and mobile 320/360/390/430 were checked. Narrow lists have no active fallback row; one click/Enter opens detail and Back restores the list. Source sort/page/25rows/search-zero, manual/import/matching selects, safe-failure feedback, nested dirty discard, keyboard/reduced motion and a manual draft across390↔1440 were exercised. The actual DOM regression protects focused search during pending reads, stale response rejection, per-tab URL/hash preservation, truthful server totals, page resets and selection through resize.

The fresh finish review identified one material source mismatch: history displayed bank dates while sorting confirmation dates. Fixed the history column to Dikonfirmasi/reconciledAt and added a DOM regression with deliberately different bank and confirmation dates. History bank dates remain in evidence detail. Shared history money summary preserves cents. Initial modal/list/native screenshots caught compositor transition frames; settled viewport CDP recaptures provide the review evidence.

Proof: output/qa/reconciliation-desktop-2026-10-15/. Initial hook scan found no new desktop issues; six font/icon-size findings in the preserved mobile primitives predate this task, whose only change there is decimal precision. No ignores or unrelated typography changes were added.

Live local /reconciliation redirects to /login?returnTo=%2Freconciliation because the session is inactive. Authenticated live data/mutations were not reverified. Existing API 3001/web 3004 preset remains running. Build/test/finish-review results are recorded below when complete.

## Checks and finish verdict

Full workspace build passed (API, web, transitional admin and Android Expo export); web was rebuilt successfully after the final history-date fix. API declaration generation/API and mobile TypeScript, full workspace lint, scoped HeroUI styles and token checks pass. Lint retains the unrelated AI Material Master proposal missing-effect-dependency warning. Scoped source/doc formatting passes; repository-wide formatting reports the same 85 pre-existing unrelated files.

Focused reconciliation tests pass, including import readiness, real desktop DOM state, matching context beyond old preview limits, all-result pagination/sort, legacy direction/cents, tenant/global authorization and source error vs empty. Fixed the initial aggregate run's AI-operation inventory mismatch by documenting the two read adapters; its four consistency tests/359 assertions pass.

The fresh Impeccable review initially returned fix. Its final verdict after the source correction/regression and settled viewport recaptures is **ship**: (1) history-date fidelity resolved; (2) complete manual/import bodies/actions, populated 1024 list and native ink active tab resolved; remaining clear. The stable screenshot set includes `history-1280-fixed.png`, `manual-draft-1440-cdp.png`, `import-1440-cdp.png`, `statement-1024-settled.png` and `native-fallback-1440-settled.png`. Earlier animation-frame captures are retained as diagnostic evidence, not acceptance proof.

Final aggregate `bun run test`: icons 4, core 482, mobile 107, API 832, API-client 14 and transitional admin 27 pass; 560 disposable-database API cases skip. Web has 1129 pass and one 30s timeout in the existing `desktop-context-popover-dom.test.ts`. That suite passed in the earlier full run and its isolated rerun passes in 8.28s; it remains a failed aggregate result and is not reported green. The separate dev-script suite passes 15 tests. The new reconciliation real-DOM regression and the final history-date regression pass. Canonical API health is healthy; `/reconciliation` returns the expected authentication redirect. Isolated Storybook 6018 and private browser tab were cleaned; canonical web/API processes remain running.
