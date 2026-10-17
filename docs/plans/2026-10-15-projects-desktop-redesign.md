# Proyek desktop redesign

## Confirmed scope and direction

The user chose daftar portfolio + Ringkasan/Budget detail. Other detailed workflows, full RAP/RAB editors and their specialized compositions remain existing. Extend the accepted Atria Operate desktop grammar: Manrope, cool canvas, compact white grouped owners, native shared HeroUI tables, capsule controls and restrained ink/terracotta. This is a specified continuation of the accepted system, not an open new identity or concept exercise.

Portfolio leads with a compact header/action and one divided financial band for active project value, internal budget, consumed and remaining budget, followed by stable peer/status views, inline filters and comparison table. Each project retains real status, budget availability and effective risk, client/PM identity and source dates. At >=1280px a selected/current row supplies an independent 18rem contextual detail; narrower desktop progresses list/detail with Back. Empty results use full width and hidden detail never highlights a fallback row. All supported desktop roles remain within domain/project scope.

Detail Ringkasan and Budget inherit the same compact financial hierarchy and category comparison. Keep project value, internal cap, consumed, paid, remaining, category usage and margin context before material readiness. Do not duplicate calculations or mix consumed budget with paid cash. Missing budget/source failure is not healthy-zero. Reuse existing shared summaries, effective-health calculations, data loaders and protected actions; preserve specialized budget editing and all other tabs.

## Data, ownership and safeguards

Audit list/detail loader completeness, domain permissions, tenant and assigned-project scope before extending reads. Filter/sort full authorized collections before10/25/50 pagination, with accurate totals and per-view query state. Reuse existing DTOs and add small explicit read metadata only when necessary to distinguish missing/restricted/unavailable data. Backend behavior remains in API; web typed facades keep public signatures.

Keep create/edit/assign/budget drafts, selection, pending work and outer overlays stable across resize; avoid refreshing dirty/open forms and ignore stale incoming reads. Use public DesktopTable/desktopTablePage, DesktopTablePagination, SegmentedTabs, SearchInput/FilterSelect, GroupedSurface.desktopPanel, MoneyValue, statuses/facts/disclosures and existing sheets. No new bulk workflows, stock/cash mutation, financial formula, database reset/seed or deployment.

## Work and acceptance

1. Inspect portfolio/detail sources, current UI/stories/tests and shared contracts.
2. Implement compact portfolio table/detail and confirmed Ringkasan/Budget presenters plus structural skeletons; retain mobile/native composition and special editors.
3. Provide representative safe fixtures for all project statuses, absent/draft/locked/overrun budgets, cents, risk, long names, assigned/custom/read-only roles, source errors/empty and draft resize.
4. Verify sorting/filtering/pagination totals, navigation/context actions, creation/editing/assignment/budget entry, focus/nested overlays/reduced motion and stable drafts.
5. Batch desktop1024/1280/1440 and mobile320/360/390/430 visual evidence, bounded fixes, fresh finish review and scoped documentation.
6. Run workspace typechecks/build/tests/lint, scoped formatting/HeroUI/token checks. Record existing failures separately. Use disposable fixtures/databases for mutation scenarios.

## Status

Implemented portfolio and Ringkasan/Budget scope. Specialized RAP/RAB, other detail tabs and existing mobile/native presentation remain in their existing owners. Budget is part of Ringkasan, not a new route or tab. Desktop project links explicitly choose `?tab=overview`; bare locked-project URLs retain their existing planning default.

### Read contracts and access

- Existing complete list loader supplies the authorized collection; desktop filters and sorts it before 10/25/50 pagination, retaining `portfolio-*` URL query state and unrelated query/hash. No capped preview is repurposed as a complete list.
- Optional list metadata identifies the actual budget, paid/pending values and canonical margin/target values. Missing budget is distinct from an approved zero budget; exact details retain cents.
- List reads reuse the canonical budget dashboard adapter and effective-health helper, including category/margin risks and the existing stored-risk floor. This removes the old duplicated list calculation; inconsistent legacy snapshots can produce a different derived list risk, without changing a finance formula or stored data.
- Read paths enforce domain permission, assigned project access and tenant predicates. Related foreign clients are masked. One eligible-PM predicate serves list/detail/bootstrap and preserves currently assigned inactive PMs.
- Global create bootstrap requires `create:project`; edit bootstrap requires existing budget-editor rights plus project scope. Update-only bootstrap exposes related clients only. Transitional admin consumes already-scoped loader options, preserving its existing update-only editor.
- Detail source metadata distinguishes ready, missing, restricted and unavailable. Source failure never becomes healthy zero or a fabricated margin.

### Interaction and visual evidence

- Reused public DesktopTable, desktopTablePage, DesktopTablePagination, SegmentedTabs, SearchInput/FilterSelect, GroupedSurface.desktopPanel, MoneyValue, statuses, FactRow, PageState and existing form/sheet/confirmation owners. New feature presenters compose those contracts; the skeleton matches the portfolio and five-category detail hierarchy.
- Both responsive presenters keep state above layout changes. Selection, sort, create/edit/allocation drafts and pending confirmations survive resize; incoming source refresh waits while an owner is open or pending.
- Isolated stories provide 36 representative projects, permissions/assigned variants, missing/zero/risk/source-error/empty/loading states and safe failing writes. No development database reset or mutation was used.
- Browser matrix covered desktop 1024/1280/1440 and mobile 320/360/390/430. Settled layouts fit their viewport. Native-pinned 1280 retains the mobile composition. The initial quick mobile capture caught the existing search-control resize spring in flight; settled measurements confirmed no permanent overflow, so shared motion was preserved.
- Browser exercised narrow first-click detail/Back, search/URL reset, select choice, client/PM selectors inside create, nested review, dirty dismissal, allocation safe failure, keyboard category selection, reduced motion, pending decision guards and focused draft retention through desktop/mobile resize.
- Finish review: initial `disposition: fix` identified a conflicting synthetic health verdict. Fixture inputs now use the canonical helper, and the production panel also receives the existing stored-risk floor used by the identity header. Recaptured 1440/1024 both show Awas. Verdict: resolved; remaining clear; **disposition: ship**.
- Proof directory: `/tmp/atria-projects-proof/`. Valid top captures include `portfolio-review-1440.png`, `portfolio-review-1280.png`, `overview-reviewed-1440.png`, `overview-reviewed-1024.png`, `portfolio-320-settled.png`, `overview-320.png`, source-state and structural-loading captures. Some earlier `portfolio-final-*`/create-review captures retained modal page scroll and are superseded; they are not evidence of the shipped layout.

### Verification

- `bun run build`: passed API, web, transitional admin and Expo iOS/Android builds, including their TypeScript/declaration gates. Final scoped web TypeScript also passed after the source-freeze regression was added.
- Application suites passed: icons 4, core 482, mobile 107, API 834, API client 14, admin 27 and web 1,150; no application failures. The API suite intentionally skipped 560 live/disposable-Postgres integration cases without `ATRIA_TEST_DATABASE_URL`; read-contract/security scenarios use isolated PGlite fixtures.
- Root `bun run test` initially exited nonzero only at the final dev-script suite: the pre-existing Ctrl-C descendant-cleanup case exceeded its 5-second deadline. An unchanged isolated `bun run test:dev-scripts` rerun passed all 15 cases in 6.83 seconds. This lifecycle timing failure was recorded separately; no unrelated process-tooling code was changed.
- Workspace lint passed with the existing AI Material Master missing-effect-dependency warning. Final health/source-freeze source files passed scoped ESLint.
- Scoped HeroUI styles and native token checks passed; the one scoped Impeccable detector pass returned no findings. `graft build` completed after executable changes.
- Global format check still reports the same 85 existing files. All touched source, fixture, plan, DESIGN, sidecar and route-brief files passed scoped Prettier checks; no global formatting sweep was applied.
- Documentation completed through the shipped documenter: additive Projects Desktop Workspace rule, sidecar and `/projects` brief covering portfolio and overview ownership. Existing product/design commitments were preserved.

Authenticated live-data browser acceptance remains unavailable because the user's local session is at login. Visual and mutation-state evidence uses clearly labeled synthetic fixtures; API read/security tests use disposable PGlite fixtures, never the development database. Existing API3001/web3004 stay available.
